// content-generator — agente D3, redacta el contenido completo de la web
//
// Disparador:  POST { cliente_id, lead_id?, payload? } via dispatcher en 'onboarding.completed'
// Acción:      Claude (Opus, alta calidad creativa) genera contenido SEO por sección:
//              hero, about, services, gallery copy, testimonials, contact CTA, footer.
//              Optimizado por sector + ciudad.
// Escritura:   Crea row en `webs` con content JSONB + status='generando_contenido'
//              luego marca status='qa_pendiente' al terminar
//              Publica 'content.generated' con web_id
//
// Modelo: Opus (sin temperature, deprecated).

import Anthropic from 'npm:@anthropic-ai/sdk@0.100.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const AGENT_NAME = 'content-generator';
const MODEL = 'claude-opus-4-7';
const PRICING = { input: 15 / 1_000_000, output: 75 / 1_000_000 };

const SYSTEM_PROMPT = `Eres un copywriter SEO especializado en webs corporativas españolas. Vas a redactar TODO el contenido de la web del cliente.

Reglas:
- TONO: profesional pero humano, sin buzzwords ("solución integral", "innovador"...).
- SEO: incluye naturalmente el keyword principal (sector + ciudad) en H1, H2 y primeros 100 caracteres.
- ESTRUCTURA: el JSON debe ser EXACTAMENTE este. Cada string del array es un párrafo o ítem.

Devuelve JSON:
{
  "meta": {
    "title": "<title tag, <65 chars, incluye sector+ciudad>",
    "description": "<meta description, <155 chars>",
    "keywords_principales": ["...", "..."]
  },
  "hero": {
    "headline": "<H1 con keyword>",
    "subheadline": "<frase de 15-25 palabras>",
    "cta_primary": "<verbo de acción + beneficio>"
  },
  "about": {
    "title": "<H2>",
    "paragraphs": ["<párrafo 1>", "<párrafo 2>"]
  },
  "services": {
    "title": "<H2>",
    "items": [{"name": "<servicio>", "description": "<2-3 frases>"}]
  },
  "why_us": {
    "title": "<H2>",
    "items": ["<razón 1>", "<razón 2>", "<razón 3>", "<razón 4>"]
  },
  "testimonials_placeholder": [{"name": "Cliente A", "quote": "<testimonio realista que el cliente puede personalizar>"}],
  "contact": {
    "title": "<H2>",
    "cta": "<frase corta antes del formulario>"
  },
  "footer_tagline": "<frase breve>"
}`;

interface ClienteRow {
  id: string;
  marca: 'agutidesigns' | 'lokify';
  nombre_negocio: string;
  ciudad: string | null;
  provincia: string | null;
  config: Record<string, unknown> | null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405 });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anthropicKey) {
    return new Response(JSON.stringify({ error: 'Faltan secretos' }), { status: 500 });
  }

  let clienteId: string;
  let leadId: string | null = null;
  try {
    const body = await req.json();
    clienteId = String(body.cliente_id ?? '').trim();
    leadId = body.lead_id ?? null;
    if (!clienteId) throw new Error('cliente_id vacío');
  } catch (err) {
    return new Response(JSON.stringify({ error: `Body inválido: ${err instanceof Error ? err.message : err}` }), { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: agentCfg } = await supabase.from('agent_config').select('enabled').eq('agent_name', AGENT_NAME).maybeSingle();
  if (!agentCfg?.enabled) return new Response(JSON.stringify({ skipped: true }), { status: 200 });

  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, marca, nombre_negocio, ciudad, provincia, config')
    .eq('id', clienteId)
    .maybeSingle();
  if (!cliente) return new Response(JSON.stringify({ error: 'cliente no encontrado' }), { status: 404 });

  // Sector lo cogemos del lead vinculado
  const { data: lead } = leadId
    ? await supabase.from('leads').select('sector').eq('id', leadId).maybeSingle()
    : { data: null };
  const sector = (lead as { sector?: string } | null)?.sector ?? 'negocio local';

  const c = cliente as ClienteRow;
  const startedAt = new Date().toISOString();
  const t0 = performance.now();
  const anthropic = new Anthropic({ apiKey: anthropicKey });
  let content: Record<string, unknown> = {};
  let inputTokens = 0;
  let outputTokens = 0;
  let errorMessage: string | null = null;

  try {
    const userPrompt = `Cliente: ${c.nombre_negocio}\nSector: ${sector}\nCiudad: ${c.ciudad ?? 'España'}\nProvincia: ${c.provincia ?? 'N/A'}\nMarca: ${c.marca}\n\nRespuestas del onboarding: ${JSON.stringify(c.config ?? {}).slice(0, 1500)}\n\nRedacta el contenido completo de la web.`;
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });
    inputTokens = response.usage.input_tokens;
    outputTokens = response.usage.output_tokens;
    const text = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n');
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('Sin JSON en respuesta');
    content = JSON.parse(m[0]);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  const finishedAt = new Date().toISOString();
  const durationMs = Math.round(performance.now() - t0);

  await supabase.from('agent_runs').insert({
    agent_name: AGENT_NAME,
    claude_model: MODEL,
    claude_tokens_input: inputTokens,
    claude_tokens_output: outputTokens,
    claude_cost_usd: inputTokens * PRICING.input + outputTokens * PRICING.output,
    triggered_by: 'event',
    trigger_data: { cliente_id: clienteId },
    status: errorMessage ? 'failed' : 'completed',
    started_at: startedAt, finished_at: finishedAt, duration_ms: durationMs,
    output: errorMessage ? null : { sections_generated: Object.keys(content).length },
    error_message: errorMessage,
  });

  if (errorMessage) return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });

  // Crea row en webs o actualiza si ya existe (1 web por cliente)
  const subdominio = c.nombre_negocio.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '-' + clienteId.slice(0, 8);

  // Comprueba si ya hay web para este cliente
  const { data: existingWeb } = await supabase
    .from('webs')
    .select('id, subdominio')
    .eq('cliente_id', clienteId)
    .maybeSingle();

  let webRow: { id: string; subdominio: string | null } | null = null;
  let webErr: { message: string } | null = null;

  if (existingWeb) {
    const { data, error } = await supabase
      .from('webs')
      .update({ template: 'standard-v1', status: 'desplegando', content, briefing: c.config ?? {} })
      .eq('id', existingWeb.id)
      .select('id, subdominio')
      .single();
    webRow = data;
    webErr = error;
  } else {
    const { data, error } = await supabase
      .from('webs')
      .insert({ cliente_id: clienteId, subdominio, template: 'standard-v1', status: 'desplegando', content, briefing: c.config ?? {} })
      .select('id, subdominio')
      .single();
    webRow = data;
    webErr = error;
  }

  if (webErr || !webRow) {
    return new Response(JSON.stringify({ error: `upsert webs falló: ${webErr?.message}` }), { status: 500 });
  }

  await supabase.rpc('publish_event', {
    p_type: 'content.generated',
    p_payload: { web_id: webRow.id, sections: Object.keys(content) },
    p_marca: c.marca,
    p_lead_id: leadId,
    p_cliente_id: clienteId,
    p_web_id: webRow.id,
    p_presupuesto_id: null, p_factura_id: null,
    p_source_agent: AGENT_NAME,
  });

  return new Response(
    JSON.stringify({ cliente_id: clienteId, web_id: webRow.id, subdominio: webRow.subdominio, content, duration_ms: durationMs }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
});
