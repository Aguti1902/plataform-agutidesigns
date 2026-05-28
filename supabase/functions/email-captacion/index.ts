// email-captacion — agente D1 del pipeline de captación
//
// Disparador:  POST con body { lead_id: string }  (manual o vía webhook de events 'lead.qualified')
// Lectura:     leads (con score >= 60)
// Escritura:   conversations (channel='email', direction='outbound')
//              leads.emails_sent ++ , leads.last_contact_at
//              leads.status -> 'contactado'
//              agent_runs (log)
//              events 'lead.contacted' se publica vía trigger SQL si lo hay
//
// Stack: Claude Sonnet 4.6 para redacción + Resend para envío.

import Anthropic from 'npm:@anthropic-ai/sdk@0.100.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const AGENT_NAME = 'email-captacion';
const MODEL = 'claude-sonnet-4-6';
const PRICING = { input: 3 / 1_000_000, output: 15 / 1_000_000 };

const FROM_NAME = 'Alejandro · Agutidesigns';
const FROM_EMAIL_AGUTIDESIGNS = 'alejandro@agutidesigns.io';
const FROM_EMAIL_LOKIFY = 'hola@lokify.es';
// Si aún no has verificado el dominio en Resend, usa onboarding@resend.dev para probar:
const FROM_EMAIL_FALLBACK = 'onboarding@resend.dev';

const SYSTEM_PROMPT = `Eres un copywriter B2B que redacta emails de captación en frío para microempresas españolas.

Tu objetivo: que el dueño del negocio responda interesándose por una reunión de 15 min.

Reglas de oro:
- Tono natural, español neutro, cercano pero profesional. NUNCA suene a plantilla genérica.
- Máximo 100 palabras en el cuerpo. El asunto, máximo 7 palabras.
- Personaliza con UN detalle específico del negocio (sector, ciudad, presencia digital actual).
- Habla del problema antes que de ti. Una sola CTA al final ("¿te llamo 5 min esta semana?").
- Cero buzzwords ("disruptivo", "sinergias", "soluciones a medida", "potencializar"...).
- No prometas resultados imposibles. No menciones precios.
- Firma simple: "Un saludo, Alejandro".

Devuelve EXCLUSIVAMENTE JSON con esta estructura:
{
  "subject": "<asunto>",
  "body_text": "<cuerpo en texto plano, con saltos de línea reales \\n donde toque>",
  "body_html": "<mismo cuerpo en HTML simple: <p>...</p>, <br>, nada de estilos inline>"
}`;

interface LeadRow {
  id: string;
  marca: 'agutidesigns' | 'lokify';
  nombre_negocio: string;
  sector: string;
  ciudad: string | null;
  email: string | null;
  website_actual: string | null;
  instagram_handle: string | null;
  score: number | null;
  score_reasons: string[] | null;
}

function buildUserPrompt(lead: LeadRow): string {
  return `Lead a contactar:
- Negocio: ${lead.nombre_negocio}
- Sector: ${lead.sector}
- Ciudad: ${lead.ciudad ?? 'N/A'}
- Web actual: ${lead.website_actual ?? 'NO TIENE'}
- Instagram: ${lead.instagram_handle ?? 'N/A'}
- Marca a vender: ${lead.marca === 'agutidesigns' ? 'Agutidesigns (web personalizada 1.500-4.000€, una sola vez)' : 'Lokify (web por suscripción 29-79€/mes)'}
- Razones por las que es buen lead: ${(lead.score_reasons ?? []).join(' | ')}

Redacta el email para ${lead.nombre_negocio}. Devuelve el JSON.`;
}

function parseJson(text: string): { subject: string; body_text: string; body_html: string } {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Respuesta sin JSON detectable');
  const parsed = JSON.parse(match[0]);
  if (!parsed.subject || !parsed.body_text || !parsed.body_html) {
    throw new Error('JSON incompleto: faltan subject/body_text/body_html');
  }
  return parsed;
}

async function sendEmailViaResend(opts: {
  apiKey: string;
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ id: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: `${opts.fromName} <${opts.fromEmail}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend HTTP ${res.status}: ${errText}`);
  }
  return (await res.json()) as { id: string };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anthropicKey || !resendKey) {
    return new Response(
      JSON.stringify({ error: 'Faltan secretos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY o RESEND_API_KEY' }),
      { status: 500 },
    );
  }

  let leadId: string;
  let dryRun = false;
  try {
    const body = await req.json();
    leadId = String(body.lead_id ?? '').trim();
    dryRun = body.dry_run === true;
    if (!leadId) throw new Error('lead_id vacío');
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Body inválido: ${err instanceof Error ? err.message : err}` }),
      { status: 400 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

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
    .select('id, marca, nombre_negocio, sector, ciudad, email, website_actual, instagram_handle, score, score_reasons')
    .eq('id', leadId)
    .maybeSingle();

  if (leadErr || !lead) {
    return new Response(JSON.stringify({ error: `Lead no encontrado: ${leadErr?.message ?? leadId}` }), { status: 404 });
  }

  if (!lead.email) {
    return new Response(JSON.stringify({ skipped: true, reason: 'lead sin email' }), { status: 200 });
  }

  if ((lead.score ?? 0) < 60) {
    return new Response(JSON.stringify({ skipped: true, reason: `score ${lead.score} < 60` }), { status: 200 });
  }

  const startedAt = new Date().toISOString();
  const t0 = performance.now();

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  let subject = '';
  let bodyText = '';
  let bodyHtml = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let resendId: string | null = null;
  let errorMessage: string | null = null;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 800,
      temperature: 0.6,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(lead as LeadRow) }],
    });
    inputTokens = response.usage.input_tokens;
    outputTokens = response.usage.output_tokens;
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    ({ subject, body_text: bodyText, body_html: bodyHtml } = parseJson(text));

    if (!dryRun) {
      const fromEmail =
        lead.marca === 'lokify' ? FROM_EMAIL_LOKIFY : FROM_EMAIL_AGUTIDESIGNS;
      try {
        const sent = await sendEmailViaResend({
          apiKey: resendKey,
          fromName: FROM_NAME,
          fromEmail,
          to: lead.email,
          subject,
          html: bodyHtml,
          text: bodyText,
        });
        resendId = sent.id;
      } catch (sendErr) {
        // Fallback: si el dominio no está verificado en Resend, intenta con onboarding@resend.dev
        const errStr = sendErr instanceof Error ? sendErr.message : String(sendErr);
        if (errStr.includes('domain') || errStr.includes('not verified')) {
          const sent = await sendEmailViaResend({
            apiKey: resendKey,
            fromName: FROM_NAME,
            fromEmail: FROM_EMAIL_FALLBACK,
            to: lead.email,
            subject,
            html: bodyHtml,
            text: bodyText,
          });
          resendId = sent.id;
        } else {
          throw sendErr;
        }
      }
    }
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
    trigger_data: { lead_id: leadId, dry_run: dryRun },
    status: errorMessage ? 'failed' : 'completed',
    started_at: startedAt,
    finished_at: finishedAt,
    duration_ms: durationMs,
    output: errorMessage ? null : { subject, resend_id: resendId, dry_run: dryRun },
    error_message: errorMessage,
  });

  if (errorMessage) {
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
  }

  if (!dryRun) {
    await supabase.from('conversations').insert({
      lead_id: leadId,
      channel: 'email',
      direction: 'outbound',
      subject,
      body: bodyText,
      processed_by_agent: AGENT_NAME,
      ai_response_generated: true,
      ai_response_sent: true,
    });

    await supabase
      .from('leads')
      .update({
        status: 'contactado',
        last_contact_at: new Date().toISOString(),
      })
      .eq('id', leadId);

    // emails_sent: incremento via RPC seguro (race-condition safe)
    // Si no existe la RPC, fallback a fetch + update
    const { error: rpcErr } = await supabase.rpc('increment_emails_sent' as never, { p_lead_id: leadId });
    if (rpcErr) {
      const { data: cur } = await supabase
        .from('leads')
        .select('emails_sent')
        .eq('id', leadId)
        .single();
      await supabase
        .from('leads')
        .update({ emails_sent: (cur?.emails_sent ?? 0) + 1 })
        .eq('id', leadId);
    }
  }

  return new Response(
    JSON.stringify({
      lead_id: leadId,
      subject,
      body_text: bodyText,
      sent: !dryRun,
      resend_id: resendId,
      dry_run: dryRun,
      duration_ms: durationMs,
      cost_usd: costUsd,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
});
