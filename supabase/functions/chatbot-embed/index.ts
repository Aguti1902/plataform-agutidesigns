// chatbot-embed — agente D3, activa el chatbot IA en la web cliente
//
// Disparador:  POST { web_id } via dispatcher en 'qa.passed'
// Acción:      Genera snippet de embed JS personalizado, lo guarda en
//              webs.assets.chatbot_snippet, marca webs.chatbot_enabled=true.
//              El endpoint /api/chatbot/<web_id> (futuro) servirá las respuestas
//              de Claude entrenado con el content de la web.
// Escritura:   webs.chatbot_enabled, webs.assets.chatbot_snippet

import { createClient } from 'npm:@supabase/supabase-js@2';

const AGENT_NAME = 'chatbot-embed';

function buildSnippet(webId: string, businessName: string): string {
  return `<!-- Agutidesigns chatbot · web_id=${webId} -->
<script>
(function(){
  var w=window,d=document;
  if(w.agutiChat)return;
  w.agutiChat={webId:'${webId}',name:${JSON.stringify(businessName)}};
  var s=d.createElement('script');
  s.async=1;s.src='https://chatbot.agutidesigns.io/widget.js';
  s.dataset.webId='${webId}';
  d.head.appendChild(s);
})();
</script>`;
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

  const { data: web } = await supabase
    .from('webs')
    .select('id, cliente_id, assets, clientes!inner(nombre_negocio)')
    .eq('id', webId)
    .maybeSingle();
  if (!web) return new Response(JSON.stringify({ error: 'web no encontrada' }), { status: 404 });

  const businessName = (web as any).clientes?.nombre_negocio ?? 'el negocio';
  const snippet = buildSnippet(webId, businessName);

  const startedAt = new Date().toISOString();
  const t0 = performance.now();
  const mergedAssets = { ...((web.assets ?? {}) as Record<string, unknown>), chatbot_snippet: snippet };

  await supabase.from('webs').update({ chatbot_enabled: true, assets: mergedAssets }).eq('id', webId);

  await supabase.from('agent_runs').insert({
    agent_name: AGENT_NAME,
    triggered_by: 'event',
    trigger_data: { web_id: webId },
    status: 'completed',
    started_at: startedAt, finished_at: new Date().toISOString(),
    duration_ms: Math.round(performance.now() - t0),
    output: { web_id: webId, snippet_length: snippet.length, chatbot_enabled: true },
    error_message: null,
  });

  return new Response(JSON.stringify({ web_id: webId, chatbot_enabled: true, snippet_length: snippet.length }), { status: 200 });
});
