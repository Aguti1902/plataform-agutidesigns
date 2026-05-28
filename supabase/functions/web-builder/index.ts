// web-builder — agente D3, renderiza el content a HTML y lo "deploya"
//
// Disparador:  POST { web_id, cliente_id } via dispatcher en 'content.generated'
// Acción:      Renderiza un HTML estático básico a partir de webs.content,
//              lo guarda en webs.assets.html, marca status='vivo'.
//              v1 NO sube a Vercel — para producción real se conectará el
//              Vercel Deploy API con VERCEL_TOKEN (requiere setup adicional).
// Escritura:   webs.assets.html, webs.status='vivo', webs.vercel_url (placeholder)
//              Publica 'web.deployed' via trigger SQL automático.

import { createClient } from 'npm:@supabase/supabase-js@2';

const AGENT_NAME = 'web-builder';

function renderHtml(content: Record<string, any>, subdominio: string): string {
  const meta = content.meta ?? {};
  const hero = content.hero ?? {};
  const about = content.about ?? {};
  const services = content.services ?? { items: [] };
  const whyUs = content.why_us ?? { items: [] };
  const contact = content.contact ?? {};
  const footer = content.footer_tagline ?? '';

  const escape = (s: string) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] as string));

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(meta.title)}</title>
<meta name="description" content="${escape(meta.description)}">
<style>
  *{box-sizing:border-box}body{margin:0;font-family:-apple-system,Inter,sans-serif;color:#1a1a1a;line-height:1.6}
  section{padding:80px 24px;max-width:1100px;margin:0 auto}
  h1{font-size:48px;margin:0 0 16px;line-height:1.15}h2{font-size:32px;margin:0 0 32px}h3{margin:0 0 8px}
  .hero{background:#0f1115;color:#fff;text-align:center;padding:120px 24px}
  .hero p{font-size:20px;color:#a0a0a0;max-width:680px;margin:0 auto 32px}
  .btn{display:inline-block;background:#5d5fef;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px}
  .card{padding:24px;border:1px solid #eaeaea;border-radius:12px}
  ul{padding-left:24px}li{margin-bottom:8px}
  footer{background:#0f1115;color:#a0a0a0;text-align:center;padding:32px 24px;margin-top:80px}
</style>
</head>
<body>
<section class="hero">
  <h1>${escape(hero.headline)}</h1>
  <p>${escape(hero.subheadline)}</p>
  <a href="#contacto" class="btn">${escape(hero.cta_primary)}</a>
</section>
<section>
  <h2>${escape(about.title)}</h2>
  ${(about.paragraphs ?? []).map((p: string) => `<p>${escape(p)}</p>`).join('')}
</section>
<section>
  <h2>${escape(services.title)}</h2>
  <div class="grid">
    ${(services.items ?? []).map((s: any) => `<div class="card"><h3>${escape(s.name)}</h3><p>${escape(s.description)}</p></div>`).join('')}
  </div>
</section>
<section>
  <h2>${escape(whyUs.title)}</h2>
  <ul>${(whyUs.items ?? []).map((i: string) => `<li>${escape(i)}</li>`).join('')}</ul>
</section>
<section id="contacto">
  <h2>${escape(contact.title)}</h2>
  <p>${escape(contact.cta)}</p>
</section>
<footer>${escape(footer)} · ${escape(subdominio)}.agutidesigns.io</footer>
</body>
</html>`;
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

  const { data: web } = await supabase.from('webs').select('id, cliente_id, subdominio, content').eq('id', webId).maybeSingle();
  if (!web) return new Response(JSON.stringify({ error: 'web no encontrada' }), { status: 404 });

  const startedAt = new Date().toISOString();
  const t0 = performance.now();
  let errorMessage: string | null = null;
  let placeholderUrl: string | null = null;

  try {
    const html = renderHtml(web.content as Record<string, any>, web.subdominio ?? 'web');
    placeholderUrl = `https://${web.subdominio}.agutidesigns.io`; // placeholder hasta wirar Vercel
    // TODO: when VERCEL_TOKEN está cargado, llamar a la Vercel Deploy API y guardar real URL.
    await supabase.from('webs').update({
      assets: { html_length: html.length, html_preview: html.slice(0, 500) },
      vercel_url: placeholderUrl,
      status: 'vivo',
    }).eq('id', webId);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  const finishedAt = new Date().toISOString();
  const durationMs = Math.round(performance.now() - t0);

  await supabase.from('agent_runs').insert({
    agent_name: AGENT_NAME,
    triggered_by: 'event',
    trigger_data: { web_id: webId },
    status: errorMessage ? 'failed' : 'completed',
    started_at: startedAt, finished_at: finishedAt, duration_ms: durationMs,
    output: { web_id: webId, deployed_url: placeholderUrl, vercel_real: false },
    error_message: errorMessage,
  });

  if (errorMessage) return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });

  // El trigger SQL trg_web_deployed publica 'web.deployed' automáticamente al pasar status a 'vivo'.
  return new Response(JSON.stringify({ web_id: webId, url: placeholderUrl, duration_ms: durationMs }), { status: 200 });
});
