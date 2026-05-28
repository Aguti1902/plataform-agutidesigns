// seguimiento-presupuesto — agente D2, follow-up automático de presupuestos
//
// Disparador:  cron diario (0 10 * * *) — POST sin body
// Lectura:     presupuestos donde status='sent' y reminders pendientes
// Acción:      Para cada presupuesto:
//                - 3 días sin respuesta → recordatorio amable (email)
//                - 7 días sin respuesta → oferta de descuento (sonnet escribe)
//                - 14 días sin respuesta → cierre suave ("dejamos aquí, llámanos si...")
// Escritura:   conversations, leads.last_contact_at, presupuestos.*_enviado flags
//              agent_runs (uno por presupuesto procesado + uno global del run)

import Anthropic from 'npm:@anthropic-ai/sdk@0.100.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const AGENT_NAME = 'seguimiento-presupuesto';
const MODEL = 'claude-sonnet-4-6';
const PRICING = { input: 3 / 1_000_000, output: 15 / 1_000_000 };

const FROM_NAME = 'Alejandro · Agutidesigns';
const FROM_FALLBACK = 'onboarding@resend.dev';

const SYSTEM_PROMPT = `Eres un copywriter B2B que escribe seguimientos de presupuestos para una agencia de webs.

Reglas:
- Tono cercano, español neutro, NUNCA agresivo ni con urgencia falsa.
- Cuerpo: máximo 80 palabras. Asunto: máximo 7 palabras.
- Reconoce el silencio del cliente sin culparle ("igual lo perdiste en el correo", "sé que cada negocio tiene su ritmo").
- Aporta valor en el seguimiento: un detalle nuevo, una micro-pregunta, una garantía concreta.
- CTA única y suave: "¿lo retomamos?" / "¿te llamo 5 min?" / "responde con un sí/no y listo".
- Firma simple: "Un saludo, Alejandro".

Devuelve JSON: {"subject": "...", "body_text": "...", "body_html": "<p>...</p>"}`;

interface PresupuestoRow {
  id: string;
  lead_id: string;
  status: string;
  recomendado: string | null;
  precio_final: number | null;
  enviado_at: string | null;
  respondido_at: string | null;
  recordatorio_3d_enviado: boolean | null;
  oferta_7d_enviada: boolean | null;
  cierre_14d_aplicado: boolean | null;
  variantes: unknown;
  briefing: unknown;
}

interface LeadRow {
  id: string;
  marca: string;
  nombre_negocio: string;
  sector: string;
  email: string | null;
}

type FollowupStage = 'recordatorio_3d' | 'oferta_7d' | 'cierre_14d';

function daysSince(iso: string | null): number {
  if (!iso) return -1;
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

function pickStage(p: PresupuestoRow): FollowupStage | null {
  if (!p.enviado_at || p.respondido_at) return null;
  const d = daysSince(p.enviado_at);
  if (d >= 14 && !p.cierre_14d_aplicado) return 'cierre_14d';
  if (d >= 7 && !p.oferta_7d_enviada) return 'oferta_7d';
  if (d >= 3 && !p.recordatorio_3d_enviado) return 'recordatorio_3d';
  return null;
}

function buildUserPrompt(p: PresupuestoRow, lead: LeadRow, stage: FollowupStage): string {
  const stageDescription = {
    recordatorio_3d: '3 días desde envío. Recordatorio suave + reafirma valor del presupuesto.',
    oferta_7d: '7 días desde envío. Pequeño extra (ej. "te incluyo 1 año de soporte sin coste si decidimos esta semana"). Sin descuento agresivo.',
    cierre_14d: '14 días desde envío. Cierre amable: "asumo que no es el momento, queda la puerta abierta". Despedida cálida.',
  }[stage];

  return `Lead: ${lead.nombre_negocio} (${lead.sector}) — marca ${lead.marca}
Plan recomendado: ${p.recomendado ?? '?'}
Estado seguimiento: ${stage} — ${stageDescription}

Genera el email de follow-up. Devuelve JSON.`;
}

function parseJson(text: string): { subject: string; body_text: string; body_html: string } {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Respuesta sin JSON');
  return JSON.parse(m[0]);
}

async function sendViaResend(apiKey: string, opts: { from: string; to: string; subject: string; html: string; text: string }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: opts.from, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text }),
  });
  if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()) as { id: string };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405 });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anthropicKey || !resendKey) {
    return new Response(JSON.stringify({ error: 'Faltan secretos' }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { data: agentCfg } = await supabase
    .from('agent_config')
    .select('enabled')
    .eq('agent_name', AGENT_NAME)
    .maybeSingle();
  if (!agentCfg?.enabled) {
    return new Response(JSON.stringify({ skipped: true, reason: 'agente desactivado' }), { status: 200 });
  }

  const startedAt = new Date().toISOString();
  const t0 = performance.now();

  // Candidatos: status='sent', sin respuesta aún, y al menos 3 días desde el envío
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: candidates, error: candErr } = await supabase
    .from('presupuestos')
    .select('id, lead_id, status, recomendado, precio_final, enviado_at, respondido_at, recordatorio_3d_enviado, oferta_7d_enviada, cierre_14d_aplicado, variantes, briefing')
    .eq('status', 'sent')
    .is('respondido_at', null)
    .lte('enviado_at', threeDaysAgo)
    .limit(50);

  if (candErr) {
    return new Response(JSON.stringify({ error: `query candidates falló: ${candErr.message}` }), { status: 500 });
  }

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let processed = 0;
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const p of (candidates ?? []) as PresupuestoRow[]) {
    const stage = pickStage(p);
    if (!stage) { skipped++; continue; }

    const { data: lead } = await supabase
      .from('leads')
      .select('id, marca, nombre_negocio, sector, email')
      .eq('id', p.lead_id)
      .maybeSingle();

    if (!lead?.email) { skipped++; continue; }

    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 800,
        temperature: 0.6,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(p, lead as LeadRow, stage) }],
      });
      totalTokensIn += response.usage.input_tokens;
      totalTokensOut += response.usage.output_tokens;
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      const { subject, body_text, body_html } = parseJson(text);

      // Envío (fallback a onboarding@resend.dev si el dominio FROM no está verificado)
      let resendId: string | null = null;
      try {
        const r = await sendViaResend(resendKey, {
          from: `${FROM_NAME} <alejandro@agutidesigns.io>`,
          to: lead.email,
          subject, html: body_html, text: body_text,
        });
        resendId = r.id;
      } catch (e1) {
        const r = await sendViaResend(resendKey, {
          from: `${FROM_NAME} <${FROM_FALLBACK}>`,
          to: lead.email,
          subject, html: body_html, text: body_text,
        });
        resendId = r.id;
      }

      await supabase.from('conversations').insert({
        lead_id: lead.id,
        channel: 'email',
        direction: 'outbound',
        subject,
        body: body_text,
        processed_by_agent: AGENT_NAME,
        ai_response_generated: true,
        ai_response_sent: true,
      });

      const flagUpdate: Record<string, boolean | string> = {};
      if (stage === 'recordatorio_3d') flagUpdate.recordatorio_3d_enviado = true;
      if (stage === 'oferta_7d')       flagUpdate.oferta_7d_enviada       = true;
      if (stage === 'cierre_14d')      flagUpdate.cierre_14d_aplicado     = true;

      await supabase.from('presupuestos').update(flagUpdate).eq('id', p.id);
      await supabase.from('leads').update({ last_contact_at: new Date().toISOString() }).eq('id', lead.id);

      sent++;
    } catch (err) {
      errors.push(`${p.id}: ${err instanceof Error ? err.message : err}`);
    }
    processed++;
  }

  const finishedAt = new Date().toISOString();
  const durationMs = Math.round(performance.now() - t0);
  const costUsd = totalTokensIn * PRICING.input + totalTokensOut * PRICING.output;

  await supabase.from('agent_runs').insert({
    agent_name: AGENT_NAME,
    claude_model: MODEL,
    claude_tokens_input: totalTokensIn,
    claude_tokens_output: totalTokensOut,
    claude_cost_usd: costUsd,
    triggered_by: 'cron',
    trigger_data: { candidates: candidates?.length ?? 0 },
    status: errors.length > 0 && sent === 0 ? 'failed' : 'completed',
    started_at: startedAt,
    finished_at: finishedAt,
    duration_ms: durationMs,
    output: { processed, sent, skipped, errors_count: errors.length },
    error_message: errors.length > 0 ? errors.slice(0, 5).join(' | ') : null,
  });

  return new Response(
    JSON.stringify({ processed, sent, skipped, errors, duration_ms: durationMs, cost_usd: costUsd }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
});
