// briefing-reunion — agente D2, prepara dossier antes de la reunión
//
// Disparador:  POST { lead_id, meeting_payload? } (via event-dispatcher en 'meeting.scheduled')
// Lectura:     leads + conversations completas
// Acción:      Claude redacta un briefing estructurado: contexto del negocio,
//              señales clave del lead, preguntas que conviene hacer, oportunidad
//              estimada (€), riesgos, plan de la reunión.
// Escritura:   agent_runs.output (el briefing completo en JSON estructurado)
//              leads.notas (preview del briefing — el dueño lo lee en Mission Control)
//
// Pensado para correrse ~30 min antes de la reunión. v1 se invoca directamente
// con el evento meeting.scheduled. Más adelante se conectará un cron que
// detecte reuniones próximas en la agenda.

import Anthropic from 'npm:@anthropic-ai/sdk@0.100.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const AGENT_NAME = 'briefing-reunion';
const MODEL = 'claude-sonnet-4-6';
const PRICING = { input: 3 / 1_000_000, output: 15 / 1_000_000 };

const SYSTEM_PROMPT = `Eres un consultor que prepara dossieres de reuniones de venta B2B en agencias de webs.

Tu output: un briefing claro, accionable y breve. NO una novela. Pensado para que Alejandro lo lea en 2 minutos antes de la reunión.

Devuelve EXCLUSIVAMENTE este JSON:
{
  "contexto_negocio": "<2-3 frases sobre qué hace, sector, ciudad>",
  "senales_clave": ["<bullet 1>", "<bullet 2>", "<bullet 3>"],
  "preguntas_recomendadas": ["<pregunta 1>", "<pregunta 2>", "<pregunta 3>", "<pregunta 4>"],
  "oportunidad_estimada_eur": <número entero entre 0 y 5000>,
  "plan_recomendado": "agutidesigns|lokify",
  "riesgos": ["<riesgo 1>", "<riesgo 2>"],
  "plan_reunion": "<3-4 frases con el orden sugerido para llevar la conversación: presentación, descubrir, mostrar, cerrar reunión siguiente>"
}`;

interface LeadRow {
  id: string;
  marca: string;
  nombre_negocio: string;
  sector: string;
  ciudad: string | null;
  provincia: string | null;
  website_actual: string | null;
  instagram_handle: string | null;
  score: number | null;
  score_reasons: string[] | null;
  emails_sent: number | null;
  whatsapp_sent: number | null;
  notas: string | null;
}

interface ConversationRow {
  channel: string;
  direction: string;
  body: string;
  created_at: string;
}

function buildUserPrompt(lead: LeadRow, conversations: ConversationRow[], meetingPayload: Record<string, unknown> | null): string {
  const meetingWhen = meetingPayload?.datetime ?? 'fecha por definir';
  const platform = meetingPayload?.platform ?? 'sin especificar';
  const history = conversations
    .map((c) => `[${c.created_at.slice(0, 10)}] ${c.direction.toUpperCase()} ${c.channel}: ${c.body.slice(0, 250)}`)
    .join('\n\n');

  return `Reunión programada con ${lead.nombre_negocio} — ${meetingWhen} (${platform}).

Datos del lead:
- Sector: ${lead.sector}
- Ciudad: ${lead.ciudad ?? 'N/A'}, ${lead.provincia ?? 'N/A'}
- Web actual: ${lead.website_actual ?? 'NO TIENE'}
- Instagram: ${lead.instagram_handle ?? 'N/A'}
- Marca a vender: ${lead.marca}
- Score de cualificación: ${lead.score ?? 'sin cualificar'} (${(lead.score_reasons ?? []).join(' | ')})
- Histórico: ${lead.emails_sent ?? 0} emails enviados, ${lead.whatsapp_sent ?? 0} WhatsApps

Conversación previa:
${history || '(sin historial — fría)'}

Genera el briefing. Devuelve JSON.`;
}

function parseJson(text: string): Record<string, unknown> {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Respuesta sin JSON');
  return JSON.parse(m[0]);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405 });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anthropicKey) {
    return new Response(JSON.stringify({ error: 'Faltan secretos' }), { status: 500 });
  }

  let leadId: string;
  let meetingPayload: Record<string, unknown> | null = null;
  try {
    const body = await req.json();
    leadId = String(body.lead_id ?? '').trim();
    meetingPayload = body.payload ?? body.meeting_payload ?? null;
    if (!leadId) throw new Error('lead_id vacío');
  } catch (err) {
    return new Response(JSON.stringify({ error: `Body inválido: ${err instanceof Error ? err.message : err}` }), { status: 400 });
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

  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('id, marca, nombre_negocio, sector, ciudad, provincia, website_actual, instagram_handle, score, score_reasons, emails_sent, whatsapp_sent, notas')
    .eq('id', leadId)
    .maybeSingle();
  if (leadErr || !lead) {
    return new Response(JSON.stringify({ error: `Lead no encontrado: ${leadErr?.message ?? leadId}` }), { status: 404 });
  }

  const { data: conversations } = await supabase
    .from('conversations')
    .select('channel, direction, body, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true })
    .limit(20);

  const startedAt = new Date().toISOString();
  const t0 = performance.now();

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  let briefing: Record<string, unknown> = {};
  let inputTokens = 0;
  let outputTokens = 0;
  let errorMessage: string | null = null;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      temperature: 0.4,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(lead as LeadRow, (conversations ?? []) as ConversationRow[], meetingPayload) }],
    });
    inputTokens = response.usage.input_tokens;
    outputTokens = response.usage.output_tokens;
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    briefing = parseJson(text);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  const finishedAt = new Date().toISOString();
  const durationMs = Math.round(performance.now() - t0);
  const costUsd = inputTokens * PRICING.input + outputTokens * PRICING.output;

  await supabase.from('agent_runs').insert({
    agent_name: AGENT_NAME,
    claude_model: MODEL,
    claude_tokens_input: inputTokens,
    claude_tokens_output: outputTokens,
    claude_cost_usd: costUsd,
    triggered_by: 'event',
    trigger_data: { lead_id: leadId, meeting: meetingPayload },
    status: errorMessage ? 'failed' : 'completed',
    started_at: startedAt,
    finished_at: finishedAt,
    duration_ms: durationMs,
    output: errorMessage ? null : briefing,
    error_message: errorMessage,
  });

  if (errorMessage) {
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
  }

  // Preview en notas: 1 línea con resumen — el briefing completo está en agent_runs.output
  const noteLine = `[${finishedAt.slice(0, 10)}] briefing-reunion → ${briefing.plan_recomendado ?? '?'} · oportunidad €${briefing.oportunidad_estimada_eur ?? '?'} — ver agent_runs`;
  const newNotas = lead.notas ? `${lead.notas}\n${noteLine}` : noteLine;
  await supabase.from('leads').update({ notas: newNotas }).eq('id', leadId);

  return new Response(
    JSON.stringify({ lead_id: leadId, briefing, duration_ms: durationMs, cost_usd: costUsd }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
});
