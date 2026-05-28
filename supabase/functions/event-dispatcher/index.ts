// event-dispatcher — router central de eventos
//
// Disparador:  trigger SQL trg_events_dispatch invoca esta función al INSERT en events
// Lectura:     mapping EVENT_HANDLERS (en este archivo)
// Escritura:   ninguna directa — solo invoca otras Edge Functions vía fetch
//
// Es la pieza que convierte el sistema en autónomo: en lugar de hacer curl manual,
// los agentes se disparan solos al publicarse el evento que les corresponde.
//
// Deploy con --no-verify-jwt porque solo lo llama el trigger SQL interno.

import { createClient } from 'npm:@supabase/supabase-js@2';

const AGENT_NAME = 'event-dispatcher';

// Mapping: tipo de evento → lista de agentes a invocar.
// Cuando añadas un agente nuevo, lo enchufas aquí.
const EVENT_HANDLERS: Record<string, string[]> = {
  'lead.created':   ['email-enrichment'],
  'lead.enriched':  ['lead-qualifier'],
  'lead.qualified': ['email-captacion', 'whatsapp-outreach'],
  // futuros:
  // 'lead.contacted': ['crm-pipeline'],
  // 'meeting.completed': ['generador-presupuesto'],
  // 'payment.received': ['onboarding'],
};

interface DispatchPayload {
  event_id?: string;
  type: string;
  lead_id?: string | null;
  cliente_id?: string | null;
  web_id?: string | null;
  presupuesto_id?: string | null;
  factura_id?: string | null;
  marca?: string | null;
  payload?: Record<string, unknown>;
}

// Cada agente espera su propio body. Aquí lo armamos por agente.
function buildAgentBody(agent: string, event: DispatchPayload): Record<string, unknown> {
  switch (agent) {
    case 'email-enrichment':
    case 'lead-qualifier':
    case 'email-captacion':
    case 'whatsapp-outreach':
      return { lead_id: event.lead_id };
    default:
      return { event_id: event.event_id, payload: event.payload };
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Faltan secretos del entorno' }), { status: 500 });
  }

  let event: DispatchPayload;
  try {
    event = await req.json();
    if (!event.type) throw new Error('type vacío');
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Body inválido: ${err instanceof Error ? err.message : err}` }),
      { status: 400 },
    );
  }

  const handlers = EVENT_HANDLERS[event.type] ?? [];

  // Cero handlers para este tipo → 200 OK y a otra cosa
  if (handlers.length === 0) {
    return new Response(
      JSON.stringify({ type: event.type, dispatched: [], reason: 'sin handlers' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // Filtra handlers que están desactivados en agent_config
  const { data: agentsCfg } = await supabase
    .from('agent_config')
    .select('agent_name, enabled')
    .in('agent_name', handlers);

  const enabledHandlers = handlers.filter((name) =>
    agentsCfg?.some((cfg) => cfg.agent_name === name && cfg.enabled),
  );

  if (enabledHandlers.length === 0) {
    return new Response(
      JSON.stringify({ type: event.type, dispatched: [], reason: 'todos los handlers están desactivados' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }

  // Invoca cada handler en paralelo. NO bloqueamos en errores individuales —
  // un agente que falla no debe impedir que otros corran.
  const startedAt = new Date().toISOString();
  const t0 = performance.now();

  const results = await Promise.allSettled(
    enabledHandlers.map(async (agent) => {
      const url = `${supabaseUrl}/functions/v1/${agent}`;
      const body = buildAgentBody(agent, event);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      return { agent, status: res.status, body: text.slice(0, 500) };
    }),
  );

  const durationMs = Math.round(performance.now() - t0);
  const summary = results.map((r, i) => ({
    agent: enabledHandlers[i],
    ok: r.status === 'fulfilled' && r.value.status < 400,
    detail: r.status === 'fulfilled' ? r.value : { error: String(r.reason) },
  }));

  await supabase.from('agent_runs').insert({
    agent_name: AGENT_NAME,
    triggered_by: 'event',
    trigger_data: { event_id: event.event_id, event_type: event.type, lead_id: event.lead_id },
    status: summary.every((s) => s.ok) ? 'completed' : 'failed',
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    duration_ms: durationMs,
    output: { handlers: enabledHandlers, results: summary },
    error_message: summary.filter((s) => !s.ok).map((s) => `${s.agent}: fail`).join(' | ') || null,
  });

  return new Response(
    JSON.stringify({ type: event.type, dispatched: enabledHandlers, duration_ms: durationMs, results: summary }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
});
