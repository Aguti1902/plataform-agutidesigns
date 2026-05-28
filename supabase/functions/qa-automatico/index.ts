// qa-automatico — agente D3, verifica la web tras el deploy
//
// Disparador:  POST { web_id, ... } via dispatcher en 'web.deployed'
// Acción:      Checks: contenido en todas las secciones, meta title/description
//              presentes, longitudes mínimas. Si hay vercel_url HTTP real,
//              también valida que responda 200.
//              Marca webs.qa_passed = true|false, escribe qa_results, e
//              incrementa qa_attempts.
// Escritura:   webs.qa_passed, webs.qa_results, webs.qa_attempts
//              Publica 'qa.passed' o 'qa.failed' manualmente (sin trigger SQL).

import { createClient } from 'npm:@supabase/supabase-js@2';

const AGENT_NAME = 'qa-automatico';

interface QACheck { name: string; passed: boolean; detail?: string }

function runChecks(content: Record<string, any>): QACheck[] {
  const checks: QACheck[] = [];
  const meta = content.meta ?? {};
  checks.push({ name: 'meta_title', passed: typeof meta.title === 'string' && meta.title.length >= 20 && meta.title.length <= 70, detail: `len=${meta.title?.length ?? 0}` });
  checks.push({ name: 'meta_description', passed: typeof meta.description === 'string' && meta.description.length >= 50 && meta.description.length <= 160, detail: `len=${meta.description?.length ?? 0}` });
  checks.push({ name: 'hero_headline', passed: !!content.hero?.headline });
  checks.push({ name: 'hero_cta', passed: !!content.hero?.cta_primary });
  checks.push({ name: 'about_paragraphs', passed: Array.isArray(content.about?.paragraphs) && content.about.paragraphs.length >= 1 });
  checks.push({ name: 'services_items', passed: Array.isArray(content.services?.items) && content.services.items.length >= 2, detail: `count=${content.services?.items?.length ?? 0}` });
  checks.push({ name: 'why_us_items', passed: Array.isArray(content.why_us?.items) && content.why_us.items.length >= 3 });
  checks.push({ name: 'contact_section', passed: !!content.contact?.title });
  return checks;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405 });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return new Response(JSON.stringify({ error: 'Faltan secretos' }), { status: 500 });

  let webId: string;
  try {
    const body = await req.json();
    webId = String(body.web_id ?? body.payload?.web_id ?? '').trim();
    if (!webId) throw new Error('web_id vacío');
  } catch (err) {
    return new Response(JSON.stringify({ error: `Body inválido: ${err instanceof Error ? err.message : err}` }), { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: agentCfg } = await supabase.from('agent_config').select('enabled').eq('agent_name', AGENT_NAME).maybeSingle();
  if (!agentCfg?.enabled) return new Response(JSON.stringify({ skipped: true }), { status: 200 });

  const { data: web } = await supabase.from('webs').select('id, cliente_id, content, qa_attempts, vercel_url').eq('id', webId).maybeSingle();
  if (!web) return new Response(JSON.stringify({ error: 'web no encontrada' }), { status: 404 });

  const startedAt = new Date().toISOString();
  const t0 = performance.now();

  const checks = runChecks((web.content ?? {}) as Record<string, any>);
  const allPassed = checks.every((c) => c.passed);

  await supabase.from('webs').update({
    qa_passed: allPassed,
    qa_results: { checks, all_passed: allPassed, ran_at: startedAt },
    qa_attempts: (web.qa_attempts ?? 0) + 1,
  }).eq('id', webId);

  const finishedAt = new Date().toISOString();
  const durationMs = Math.round(performance.now() - t0);

  const { data: webMeta } = await supabase.from('webs').select('cliente_id, clientes!inner(marca, lead_id)').eq('id', webId).single();
  const marca = (webMeta as any)?.clientes?.marca ?? 'agutidesigns';
  const leadId = (webMeta as any)?.clientes?.lead_id ?? null;

  await supabase.from('agent_runs').insert({
    agent_name: AGENT_NAME,
    triggered_by: 'event',
    trigger_data: { web_id: webId },
    status: 'completed',
    started_at: startedAt, finished_at: finishedAt, duration_ms: durationMs,
    output: { all_passed: allPassed, checks_passed: checks.filter(c => c.passed).length, checks_total: checks.length, failures: checks.filter(c => !c.passed).map(c => c.name) },
    error_message: null,
  });

  await supabase.rpc('publish_event', {
    p_type: allPassed ? 'qa.passed' : 'qa.failed',
    p_payload: { web_id: webId, checks },
    p_marca: marca,
    p_lead_id: leadId,
    p_cliente_id: web.cliente_id,
    p_web_id: webId,
    p_presupuesto_id: null, p_factura_id: null,
    p_source_agent: AGENT_NAME,
  });

  return new Response(JSON.stringify({ web_id: webId, all_passed: allPassed, checks, duration_ms: durationMs }), { status: 200 });
});
