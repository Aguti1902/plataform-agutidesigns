// lead-qualifier — agente D1 del pipeline de captación
//
// Disparador:  POST con body { lead_id: string }  (manual o vía webhook de events)
// Lectura:     leads (row a evaluar) + agent_config (¿está enabled?)
// Escritura:   leads.score, leads.score_reasons, leads.status
//              agent_runs (log de la ejecución)
//              events (publica 'lead.qualified' si score >= 60)
//
// Modelo: Haiku 4.5 (tarea simple, alto volumen) · temperatura 0.3 (consistencia)

import Anthropic from 'npm:@anthropic-ai/sdk@0.100.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const AGENT_NAME = 'lead-qualifier';
const MODEL = 'claude-haiku-4-5-20251001';
const QUALIFY_THRESHOLD = 60;
const PRICING = { input: 1 / 1_000_000, output: 5 / 1_000_000 }; // USD por token

const SYSTEM_PROMPT = `Eres un agente de cualificación de leads B2B para una agencia que vende webs a microempresas españolas.

Tu tarea: puntuar de 0 a 100 la probabilidad de que este lead se convierta en cliente que paga 1.500-4.000€ por una web (Agutidesigns) o 29-79€/mes en suscripción (Lokify).

Criterios (en orden de peso):
1. Si el lead NO tiene NINGÚN canal de contacto válido (ni email ni teléfono ni WhatsApp) → score = 0
2. ¿No tiene web actual o tiene una muy mala/anticuada? → +30
3. ¿Sector de margen alto (clínicas dentales/estéticas, abogados, asesores, restauración premium, ecommerce, inmobiliarias, formación)? → +20
4. ¿Ciudad con poder adquisitivo (capital de provincia, costa, zonas turísticas premium)? → +10
5. ¿Presencia digital activa (Instagram con seguidores, ficha de Google Maps)? → +10 (señal de que ya invierten en marketing)
6. ¿Sector saturado donde una web buena marca diferencia (peluquerías, gimnasios, talleres)? → +10
7. Resto → +0

Responde SIEMPRE en JSON válido, sin texto fuera del JSON, con esta estructura exacta:
{"score": <entero 0-100>, "reasons": [<3-5 strings cortas en español, una por criterio aplicado>]}`;

interface LeadRow {
  id: string;
  marca: 'agutidesigns' | 'lokify';
  nombre_negocio: string;
  sector: string;
  ciudad: string | null;
  provincia: string | null;
  email: string | null;
  telefono: string | null;
  whatsapp: string | null;
  website_actual: string | null;
  instagram_handle: string | null;
  google_maps_url: string | null;
}

function buildUserPrompt(lead: LeadRow): string {
  return `Lead a evaluar:
- Negocio: ${lead.nombre_negocio}
- Sector: ${lead.sector}
- Ubicación: ${lead.ciudad ?? 'N/A'} (${lead.provincia ?? 'N/A'})
- Email: ${lead.email ?? 'NO TIENE'}
- Teléfono: ${lead.telefono ?? 'NO TIENE'}
- WhatsApp: ${lead.whatsapp ?? 'NO TIENE'}
- Web actual: ${lead.website_actual ?? 'NO TIENE'}
- Instagram: ${lead.instagram_handle ?? 'NO TIENE'}
- Google Maps: ${lead.google_maps_url ? 'sí' : 'no'}

Devuelve el JSON.`;
}

function parseClaudeJson(text: string): { score: number; reasons: string[] } {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Respuesta sin JSON detectable');
  const parsed = JSON.parse(match[0]);
  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score))));
  const reasons = Array.isArray(parsed.reasons)
    ? parsed.reasons.map(String).slice(0, 5)
    : [];
  return { score, reasons };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anthropicKey) {
    return new Response(
      JSON.stringify({ error: 'Faltan secretos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o ANTHROPIC_API_KEY' }),
      { status: 500 },
    );
  }

  let leadId: string;
  try {
    const body = await req.json();
    leadId = String(body.lead_id ?? '').trim();
    if (!leadId) throw new Error('lead_id vacío');
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Body inválido: ${err instanceof Error ? err.message : err}` }),
      { status: 400 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: agentCfg } = await supabase
    .from('agent_config')
    .select('enabled')
    .eq('agent_name', AGENT_NAME)
    .maybeSingle();

  if (!agentCfg?.enabled) {
    return new Response(
      JSON.stringify({ skipped: true, reason: 'agente desactivado en agent_config' }),
      { status: 200 },
    );
  }

  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('id, marca, nombre_negocio, sector, ciudad, provincia, email, telefono, whatsapp, website_actual, instagram_handle, google_maps_url')
    .eq('id', leadId)
    .maybeSingle();

  if (leadErr || !lead) {
    return new Response(
      JSON.stringify({ error: `Lead no encontrado: ${leadErr?.message ?? leadId}` }),
      { status: 404 },
    );
  }

  const startedAt = new Date().toISOString();
  const t0 = performance.now();

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  let score = 0;
  let reasons: string[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let errorMessage: string | null = null;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      temperature: 0.3,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(lead as LeadRow) }],
    });
    inputTokens = response.usage.input_tokens;
    outputTokens = response.usage.output_tokens;
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    ({ score, reasons } = parseClaudeJson(text));
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
    triggered_by: 'manual',
    trigger_data: { lead_id: leadId },
    status: errorMessage ? 'failed' : 'completed',
    started_at: startedAt,
    finished_at: finishedAt,
    duration_ms: durationMs,
    output: errorMessage ? null : { score, reasons },
    error_message: errorMessage,
  });

  if (errorMessage) {
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
  }

  const newStatus: 'calificado' | 'descartado' = score >= QUALIFY_THRESHOLD ? 'calificado' : 'descartado';

  const { error: updateErr } = await supabase
    .from('leads')
    .update({ score, score_reasons: reasons, status: newStatus })
    .eq('id', leadId);

  if (updateErr) {
    return new Response(JSON.stringify({ error: `update lead falló: ${updateErr.message}` }), { status: 500 });
  }

  // Nota: NO publicamos 'lead.qualified' aquí — el trigger SQL trg_leads_qualified
  // lo hace automáticamente cuando leads.score cruza el umbral 60 en un UPDATE.
  // Ver supabase/migrations/20260528000001_initial_schema.sql:570

  return new Response(
    JSON.stringify({ lead_id: leadId, score, reasons, status: newStatus, duration_ms: durationMs, cost_usd: costUsd }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
});
