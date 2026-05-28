// onboarding — agente D3 producción
//
// Disparador:  POST { lead_id, cliente_id?, plan?, payload? } via dispatcher en 'payment.received'
// Acción:      1. Si no existe cliente, lo crea a partir del lead
//              2. Genera preguntas de onboarding personalizadas por sector (Claude)
//              3. Envía email al cliente con el formulario (link a Mission Control)
//              4. Publica 'onboarding.completed' INMEDIATAMENTE para que la cascada
//                 continúe en demo. En producción real, el evento vendría del webhook
//                 del formulario cuando el cliente lo complete.
//
// Modelo: Sonnet (las preguntas necesitan algo de criterio).

import Anthropic from 'npm:@anthropic-ai/sdk@0.100.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const AGENT_NAME = 'onboarding';
const MODEL = 'claude-sonnet-4-6';
const PRICING = { input: 3 / 1_000_000, output: 15 / 1_000_000 };
const FROM_FALLBACK = 'onboarding@resend.dev';

const SYSTEM_PROMPT = `Eres el agente de onboarding de Agutidesigns. Acaba de pagar un cliente y ahora hay que recoger el contenido para construir su web.

Genera 8-12 preguntas específicas para su sector. Cada pregunta:
- Es CONCRETA y ACCIONABLE (no genérica).
- Tiene un placeholder o ejemplo que ayude a responder rápido.
- Está agrupada en secciones: "Negocio", "Servicios", "Equipo", "Contacto".

Devuelve JSON: {"questions": [{"id": "q1", "section": "Negocio", "label": "...", "placeholder": "...", "required": true}]}`;

interface LeadRow {
  id: string;
  marca: 'agutidesigns' | 'lokify';
  nombre_negocio: string;
  sector: string;
  email: string | null;
  telefono: string | null;
  whatsapp: string | null;
  ciudad: string | null;
  provincia: string | null;
}

async function sendOnboardingEmail(apiKey: string, opts: { to: string; nombre: string; formUrl: string }) {
  const subject = `${opts.nombre}: vamos a empezar tu web`;
  const html = `<p>Hola,</p>
<p>Gracias por confiar en Agutidesigns. Para empezar a construir tu web necesito que rellenes este pequeño formulario (te llevará 5-10 min):</p>
<p><strong><a href="${opts.formUrl}">${opts.formUrl}</a></strong></p>
<p>En cuanto lo tenga, mis agentes empezarán a generar el contenido y la web estará lista en 48-72h.</p>
<p>Un saludo,<br>Alejandro</p>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: `Alejandro · Agutidesigns <${FROM_FALLBACK}>`,
      to: opts.to,
      subject, html,
      text: `Hola, gracias por confiar en Agutidesigns. Completa el formulario aquí: ${opts.formUrl}`,
    }),
  });
  if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()) as { id: string };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405 });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anthropicKey || !resendKey) {
    return new Response(JSON.stringify({ error: 'Faltan secretos' }), { status: 500 });
  }

  let leadId: string | null = null;
  let clienteId: string | null = null;
  let plan = 'negocio'; // plan_tipo enum: esencial | negocio | crecimiento | custom
  let payload: Record<string, unknown> | null = null;
  try {
    const body = await req.json();
    leadId = body.lead_id ?? null;
    clienteId = body.cliente_id ?? null;
    plan = body.plan ?? (body.payload?.plan ?? 'negocio');
    // Si llega un plan no válido del payload, fallback a 'negocio'
    if (!['esencial', 'negocio', 'crecimiento', 'custom'].includes(plan)) plan = 'negocio';
    payload = body.payload ?? null;
    if (!leadId && !clienteId) throw new Error('lead_id o cliente_id obligatorio');
  } catch (err) {
    return new Response(JSON.stringify({ error: `Body inválido: ${err instanceof Error ? err.message : err}` }), { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: agentCfg } = await supabase.from('agent_config').select('enabled').eq('agent_name', AGENT_NAME).maybeSingle();
  if (!agentCfg?.enabled) return new Response(JSON.stringify({ skipped: true }), { status: 200 });

  // 1. Obtener o crear cliente
  let cliente: { id: string; email: string; marca: 'agutidesigns' | 'lokify'; nombre_negocio: string } | null = null;
  if (clienteId) {
    const { data } = await supabase.from('clientes').select('id, email, marca, nombre_negocio').eq('id', clienteId).maybeSingle();
    cliente = data as typeof cliente;
  }
  if (!cliente && leadId) {
    const { data: lead } = await supabase
      .from('leads')
      .select('id, marca, nombre_negocio, sector, email, telefono, whatsapp, ciudad, provincia')
      .eq('id', leadId)
      .maybeSingle();
    if (!lead?.email) {
      return new Response(JSON.stringify({ error: 'Lead sin email — no se puede crear cliente' }), { status: 400 });
    }
    const l = lead as LeadRow;
    const { data: newCliente, error: insertErr } = await supabase
      .from('clientes')
      .insert({
        lead_id: l.id,
        marca: l.marca,
        nombre_negocio: l.nombre_negocio,
        email: l.email,
        telefono: l.telefono,
        whatsapp: l.whatsapp,
        ciudad: l.ciudad,
        provincia: l.provincia,
        plan,
        activo: true,
      })
      .select('id, email, marca, nombre_negocio')
      .single();
    if (insertErr || !newCliente) {
      return new Response(JSON.stringify({ error: `insert cliente: ${insertErr?.message}` }), { status: 500 });
    }
    cliente = newCliente as typeof cliente;
    clienteId = newCliente.id;
    await supabase.from('leads').update({ status: 'cliente' }).eq('id', l.id);
  }
  if (!cliente) {
    return new Response(JSON.stringify({ error: 'No se pudo resolver cliente' }), { status: 400 });
  }

  const startedAt = new Date().toISOString();
  const t0 = performance.now();
  const anthropic = new Anthropic({ apiKey: anthropicKey });
  let questions: unknown = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let errorMessage: string | null = null;

  try {
    const { data: leadForPrompt } = leadId
      ? await supabase.from('leads').select('sector, ciudad').eq('id', leadId).maybeSingle()
      : { data: null };
    const sector = (leadForPrompt as { sector?: string } | null)?.sector ?? 'genérico';
    const userPrompt = `Cliente: ${cliente.nombre_negocio} (${sector})\nGenera el formulario de onboarding.`;
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      temperature: 0.4,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });
    inputTokens = response.usage.input_tokens;
    outputTokens = response.usage.output_tokens;
    const text = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n');
    const m = text.match(/\{[\s\S]*\}/);
    if (m) questions = JSON.parse(m[0]).questions;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  // Guardar form en cliente.config y enviar email
  const formUrl = `https://admin.agutidesigns.io/onboarding/${clienteId}`;
  if (cliente.email) {
    try {
      await sendOnboardingEmail(resendKey, { to: cliente.email, nombre: cliente.nombre_negocio, formUrl });
    } catch (e) {
      errorMessage = (errorMessage ?? '') + ` | email: ${e instanceof Error ? e.message : e}`;
    }
  }

  await supabase.from('clientes').update({ config: { onboarding_questions: questions, form_url: formUrl, sent_at: new Date().toISOString() } }).eq('id', clienteId);

  const finishedAt = new Date().toISOString();
  const durationMs = Math.round(performance.now() - t0);

  await supabase.from('agent_runs').insert({
    agent_name: AGENT_NAME,
    claude_model: MODEL,
    claude_tokens_input: inputTokens,
    claude_tokens_output: outputTokens,
    claude_cost_usd: inputTokens * PRICING.input + outputTokens * PRICING.output,
    triggered_by: 'event',
    trigger_data: { lead_id: leadId, cliente_id: clienteId, plan },
    status: errorMessage ? 'failed' : 'completed',
    started_at: startedAt, finished_at: finishedAt, duration_ms: durationMs,
    output: { cliente_id: clienteId, form_url: formUrl, questions_count: Array.isArray(questions) ? (questions as unknown[]).length : 0 },
    error_message: errorMessage,
  });

  // En demo, publicamos onboarding.completed inmediatamente. En producción, esperaríamos al webhook del form.
  await supabase.rpc('publish_event', {
    p_type: 'onboarding.completed',
    p_payload: { auto_completed: true, questions_count: Array.isArray(questions) ? (questions as unknown[]).length : 0 },
    p_marca: cliente.marca,
    p_lead_id: leadId,
    p_cliente_id: clienteId,
    p_web_id: null, p_presupuesto_id: null, p_factura_id: null,
    p_source_agent: AGENT_NAME,
  });

  return new Response(
    JSON.stringify({ cliente_id: clienteId, form_url: formUrl, questions, duration_ms: durationMs }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
});
