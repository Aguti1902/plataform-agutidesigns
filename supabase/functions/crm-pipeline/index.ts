// crm-pipeline — agente D2, gestiona el estado del lead en el funnel
//
// Disparador:  POST { lead_id } (via event-dispatcher en 'lead.contacted')
// Lectura:     leads + conversations (historial)
// Acción:      Claude clasifica la conversación y decide la siguiente acción
//              recomendada (esperar, recontactar, marcar perdido, escalar).
// Escritura:   leads.status (si toca cambiar), leads.notas (briefing breve)
//              agent_runs (log)
//
// v1: no toma acción autónoma (no envía emails ni cambia status drásticamente).
// Solo evalúa el lead y deja una recomendación en agent_runs + nota interna.
// Sirve como observabilidad del funnel. La automatización agresiva vendrá
// con seguimiento-presupuesto y similares.

import Anthropic from 'npm:@anthropic-ai/sdk@0.100.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const AGENT_NAME = 'crm-pipeline';
const MODEL = 'claude-haiku-4-5-20251001';
const PRICING = { input: 1 / 1_000_000, output: 5 / 1_000_000 };

const SYSTEM_PROMPT = `Eres un CRM-pipeline manager para una agencia de webs B2B.

Tu tarea: dado un lead y su historial de conversación, decide la siguiente acción.

Acciones posibles:
- "wait": esperar respuesta del lead (norma: dejar 3 días después del último contacto saliente)
- "follow_up": tocar de nuevo (han pasado >3 días sin respuesta)
- "schedule_meeting": el lead ya mostró interés explícito, pedir reunión
- "mark_lost": han pasado >14 días sin respuesta o el lead dijo "no me interesa"
- "escalate_human": el lead pide algo que solo un humano puede dar (precio negociado, factura especial, cliente sensible, etc.)

Responde EXCLUSIVAMENTE en JSON:
{"action": "wait|follow_up|schedule_meeting|mark_lost|escalate_human", "reason": "<una frase corta>", "next_check_in_days": <integer entre 1 y 30>}`;

interface LeadRow {
  id: string;
  marca: string;
  nombre_negocio: string;
  sector: string;
  status: string;
  emails_sent: number | null;
  whatsapp_sent: number | null;
  last_contact_at: string | null;
  last_response_at: string | null;
  notas: string | null;
}

interface ConversationRow {
  channel: string;
  direction: string;
  subject: string | null;
  body: string;
  created_at: string;
}

function buildUserPrompt(lead: LeadRow, conversations: ConversationRow[]): string {
  const history = conversations
    .map((c) => `[${c.created_at.slice(0, 10)}] ${c.direction.toUpperCase()} ${c.channel}: ${(c.subject ? c.subject + ' — ' : '') + c.body.slice(0, 300)}`)
    .join('\n\n');
  return `Lead: ${lead.nombre_negocio} (${lead.sector})
Status actual: ${lead.status}
Emails enviados: ${lead.emails_sent ?? 0}  ·  WhatsApps enviados: ${lead.whatsapp_sent ?? 0}
Último contacto saliente: ${lead.last_contact_at ?? 'N/A'}
Última respuesta del lead: ${lead.last_response_at ?? 'N/A (aún sin respuesta)'}

Historial:
${history || '(sin conversación registrada — primer contacto)'}

Decide la acción. Devuelve JSON.`;
}

function parseJson(text: string): { action: string; reason: string; next_check_in_days: number } {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Respuesta sin JSON');
  const p = JSON.parse(m[0]);
  return {
    action: String(p.action ?? 'wait'),
    reason: String(p.reason ?? ''),
    next_check_in_days: Math.max(1, Math.min(30, Number(p.next_check_in_days ?? 3))),
  };
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
  try {
    const body = await req.json();
    leadId = String(body.lead_id ?? '').trim();
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
    .select('id, marca, nombre_negocio, sector, status, emails_sent, whatsapp_sent, last_contact_at, last_response_at, notas')
    .eq('id', leadId)
    .maybeSingle();
  if (leadErr || !lead) {
    return new Response(JSON.stringify({ error: `Lead no encontrado: ${leadErr?.message ?? leadId}` }), { status: 404 });
  }

  const { data: conversations } = await supabase
    .from('conversations')
    .select('channel, direction, subject, body, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(10);

  const startedAt = new Date().toISOString();
  const t0 = performance.now();

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  let action = 'wait';
  let reason = '';
  let nextCheckInDays = 3;
  let inputTokens = 0;
  let outputTokens = 0;
  let errorMessage: string | null = null;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(lead as LeadRow, (conversations ?? []) as ConversationRow[]) }],
    });
    inputTokens = response.usage.input_tokens;
    outputTokens = response.usage.output_tokens;
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    ({ action, reason, next_check_in_days: nextCheckInDays } = parseJson(text));
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
    trigger_data: { lead_id: leadId },
    status: errorMessage ? 'failed' : 'completed',
    started_at: startedAt,
    finished_at: finishedAt,
    duration_ms: durationMs,
    output: errorMessage ? null : { action, reason, next_check_in_days: nextCheckInDays },
    error_message: errorMessage,
  });

  if (errorMessage) {
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
  }

  // Acciones de cambio de status (las únicas que ejecuta automáticamente v1)
  if (action === 'mark_lost' && lead.status !== 'perdido') {
    await supabase.from('leads').update({ status: 'perdido' }).eq('id', leadId);
  }

  // Anotación CRM en lead.notas (append, no overwrite)
  const noteLine = `[${finishedAt.slice(0, 10)}] crm-pipeline → ${action}: ${reason}`;
  const newNotas = lead.notas ? `${lead.notas}\n${noteLine}` : noteLine;
  await supabase.from('leads').update({ notas: newNotas }).eq('id', leadId);

  return new Response(
    JSON.stringify({ lead_id: leadId, action, reason, next_check_in_days: nextCheckInDays, duration_ms: durationMs, cost_usd: costUsd }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
});
