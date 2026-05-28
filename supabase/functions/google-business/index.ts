// google-business — agente D3 (STUB)
//
// Disparador:  POST { web_id } via dispatcher en 'qa.passed'
// Estado:      v1 STUB. La Google Business Profile API requiere:
//              1) Crear/verificar proyecto en GCP con la API habilitada
//              2) OAuth con permisos del dueño del negocio
//              3) Manual verification por correo postal o llamada
//              No automatizable end-to-end sin participación humana.
//              Esta función deja constancia y marca webs.google_business_id
//              como 'pending_manual_setup'.

import { createClient } from 'npm:@supabase/supabase-js@2';

const AGENT_NAME = 'google-business';

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

  const startedAt = new Date().toISOString();
  const t0 = performance.now();

  await supabase.from('webs').update({ google_business_id: 'pending_manual_setup' }).eq('id', webId);

  await supabase.from('agent_runs').insert({
    agent_name: AGENT_NAME,
    triggered_by: 'event',
    trigger_data: { web_id: webId },
    status: 'skipped',
    started_at: startedAt, finished_at: new Date().toISOString(),
    duration_ms: Math.round(performance.now() - t0),
    output: {
      stub: true,
      reason: 'Google Business Profile API requiere OAuth manual y verificación postal/telefónica. No automatizable.',
      next_steps: ['Crear Google Cloud project + habilitar Business Profile API', 'Conectar OAuth del dueño del negocio', 'Solicitar verificación por correo postal'],
    },
    error_message: null,
  });

  return new Response(JSON.stringify({ web_id: webId, skipped: true, reason: 'GBP requires manual OAuth + verification' }), { status: 200 });
});
