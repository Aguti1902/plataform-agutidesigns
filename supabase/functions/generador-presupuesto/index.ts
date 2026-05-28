// generador-presupuesto — agente D2, crea el presupuesto con 3 variantes
//
// Disparador:  POST { lead_id, payload? } (via event-dispatcher en 'meeting.completed')
// Lectura:     leads + agent_runs (último briefing de briefing-reunion) + payload del evento
// Acción:      Claude (Opus, tarea creativa+compleja) genera 3 planes:
//              Básico / Recomendado / Premium con precio, features, justificación.
// Escritura:   INSERT en presupuestos (status='borrador', requiere_aprobacion=true)
//              agent_runs (log)
//
// El presupuesto queda en estado 'borrador' — Alejandro lo aprueba desde Mission Control
// antes de que seguimiento-presupuesto lo envíe al cliente.

import Anthropic from 'npm:@anthropic-ai/sdk@0.100.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const AGENT_NAME = 'generador-presupuesto';
const MODEL = 'claude-opus-4-7';
const PRICING = { input: 15 / 1_000_000, output: 75 / 1_000_000 };

const SYSTEM_PROMPT = `Eres un consultor que diseña presupuestos comerciales para una agencia de webs B2B.

Tu output: 3 variantes (Básico, Recomendado, Premium) con precio cerrado, features incluidas, y una justificación breve de cada una.

Reglas:
- AGUTIDESIGNS (web personalizada, pago único): Básico 1.500€, Recomendado 2.500€, Premium 4.000€.
- LOKIFY (suscripción mensual): Básico 29€/mes, Recomendado 49€/mes, Premium 79€/mes.
- Las features deben ser CONCRETAS, no buzzwords (ej. "5 páginas SEO optimizadas para 'clínica dental Madrid'" en vez de "SEO premium").
- Adapta las features al sector y a las notas de la reunión.
- El Recomendado debe ser claramente el mejor valor — el efecto goldilocks.
- Justificación de 1 frase por plan, en tono asesor.

Devuelve EXCLUSIVAMENTE JSON:
{
  "briefing": {
    "necesidades": ["<lo que el cliente pidió>"],
    "objeciones_previstas": ["<posibles objeciones>"],
    "urgencia": "alta|media|baja",
    "presupuesto_cliente_estimado_eur": <integer o null>
  },
  "variantes": [
    {"nombre": "Básico", "precio_eur": <num>, "es_recomendado": false, "features": ["..."], "justificacion": "..."},
    {"nombre": "Recomendado", "precio_eur": <num>, "es_recomendado": true, "features": ["..."], "justificacion": "..."},
    {"nombre": "Premium", "precio_eur": <num>, "es_recomendado": false, "features": ["..."], "justificacion": "..."}
  ]
}`;

interface LeadRow {
  id: string;
  marca: string;
  nombre_negocio: string;
  sector: string;
  ciudad: string | null;
}

function buildUserPrompt(lead: LeadRow, lastBriefing: Record<string, unknown> | null, meetingPayload: Record<string, unknown> | null): string {
  const notas = meetingPayload?.notes ?? meetingPayload?.notas ?? null;
  const briefingTxt = lastBriefing
    ? `Briefing previo (de la preparación de la reunión):
- Plan recomendado: ${lastBriefing.plan_recomendado}
- Oportunidad estimada: €${lastBriefing.oportunidad_estimada_eur}
- Señales clave: ${(lastBriefing.senales_clave as string[] | undefined)?.join(' | ') ?? 'N/A'}
- Riesgos: ${(lastBriefing.riesgos as string[] | undefined)?.join(' | ') ?? 'N/A'}`
    : '(sin briefing previo)';

  return `Cliente: ${lead.nombre_negocio} — ${lead.sector} en ${lead.ciudad ?? 'N/A'}
Marca a vender: ${lead.marca}

${briefingTxt}

Notas de la reunión completada:
${notas ?? '(sin notas — usa lo que sepas del lead)'}

Genera el presupuesto con 3 variantes. Devuelve JSON.`;
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
    .select('id, marca, nombre_negocio, sector, ciudad')
    .eq('id', leadId)
    .maybeSingle();
  if (leadErr || !lead) {
    return new Response(JSON.stringify({ error: `Lead no encontrado: ${leadErr?.message ?? leadId}` }), { status: 404 });
  }

  // Recupera el último briefing del agente briefing-reunion para este lead
  const { data: lastBriefingRun } = await supabase
    .from('agent_runs')
    .select('output')
    .eq('agent_name', 'briefing-reunion')
    .eq('trigger_data->>lead_id', leadId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastBriefing = (lastBriefingRun?.output ?? null) as Record<string, unknown> | null;

  const startedAt = new Date().toISOString();
  const t0 = performance.now();

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  let result: Record<string, unknown> = {};
  let inputTokens = 0;
  let outputTokens = 0;
  let errorMessage: string | null = null;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2500,
      // temperature deprecated en Opus 4.7 — usa el default del modelo
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(lead as LeadRow, lastBriefing, meetingPayload) }],
    });
    inputTokens = response.usage.input_tokens;
    outputTokens = response.usage.output_tokens;
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    result = parseJson(text);
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
    output: errorMessage ? null : result,
    error_message: errorMessage,
  });

  if (errorMessage) {
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
  }

  // Inserta el presupuesto en estado 'borrador' — requiere aprobación humana antes de enviarse
  const recomendado = (result.variantes as Array<Record<string, unknown>> | undefined)?.find((v) => v.es_recomendado) ?? null;

  const { data: presupuesto, error: presErr } = await supabase
    .from('presupuestos')
    .insert({
      lead_id: leadId,
      briefing: result.briefing ?? {},
      variantes: result.variantes ?? [],
      recomendado: (recomendado?.nombre as string) ?? null,
      status: 'borrador',
      requiere_aprobacion: true,
    })
    .select('id, numero')
    .single();

  if (presErr) {
    return new Response(JSON.stringify({ error: `insert presupuesto falló: ${presErr.message}` }), { status: 500 });
  }

  // Publica evento quote.generated
  await supabase.rpc('publish_event', {
    p_type: 'quote.generated',
    p_payload: { recomendado: recomendado?.nombre ?? null },
    p_marca: lead.marca,
    p_lead_id: leadId,
    p_cliente_id: null,
    p_web_id: null,
    p_presupuesto_id: presupuesto?.id ?? null,
    p_factura_id: null,
    p_source_agent: AGENT_NAME,
  });

  // Actualiza status del lead
  await supabase.from('leads').update({ status: 'presupuesto_enviado' }).eq('id', leadId);

  return new Response(
    JSON.stringify({ lead_id: leadId, presupuesto_id: presupuesto?.id, briefing: result.briefing, variantes: result.variantes, duration_ms: durationMs, cost_usd: costUsd }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
});
