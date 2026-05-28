// whatsapp-outreach — agente D1 del pipeline de captación
//
// Disparador:  POST { lead_id } (via event-dispatcher en 'lead.qualified')
// Lectura:     leads (con score >= 60 y teléfono)
// Escritura:   conversations (channel='whatsapp', direction='outbound')
//              leads.whatsapp_sent ++, leads.last_contact_at, leads.status -> contactado
//              agent_runs (log)
//
// Stack: Claude Sonnet 4.6 para redacción + Twilio API para envío.
//
// Twilio Sandbox: durante testing, el destinatario debe haber enviado primero
// "join <sandbox-code>" al número del sandbox de Twilio. En producción se usa
// un template aprobado por WhatsApp y un número Business propio.

import Anthropic from 'npm:@anthropic-ai/sdk@0.100.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const AGENT_NAME = 'whatsapp-outreach';
const MODEL = 'claude-sonnet-4-6';
const PRICING = { input: 3 / 1_000_000, output: 15 / 1_000_000 };

const SYSTEM_PROMPT = `Eres un copywriter B2B redactando mensajes de WhatsApp en frío para microempresas españolas.

Objetivo: que el dueño del negocio responda "sí, cuéntame más" o "llámame".

Reglas de oro:
- TONO: natural, español neutro, tono de mensaje real (no email formal). Cercano, breve.
- LONGITUD: máximo 60 palabras. WhatsApp se lee en 5 segundos o no se lee.
- ESTRUCTURA: saludo corto → observación personal específica → problema en 1 frase → 1 CTA suave.
- PROHIBIDO: emojis comerciales (✨🚀💎), buzzwords ("disruptivo", "soluciones"), promesas de resultados.
- PUEDES usar UN emoji discreto al saludar (👋 o nada) y/o un punto medio "—".
- Despídete con "Un saludo, Alejandro" (sin más).
- No menciones precios ni planes.

Devuelve EXCLUSIVAMENTE JSON:
{"message": "<el mensaje completo, en una sola string, con \\n donde haya saltos de línea>"}`;

interface LeadRow {
  id: string;
  marca: 'agutidesigns' | 'lokify';
  nombre_negocio: string;
  sector: string;
  ciudad: string | null;
  telefono: string | null;
  whatsapp: string | null;
  instagram_handle: string | null;
  website_actual: string | null;
  score: number | null;
  score_reasons: string[] | null;
}

function buildUserPrompt(lead: LeadRow): string {
  return `Lead a contactar por WhatsApp:
- Negocio: ${lead.nombre_negocio}
- Sector: ${lead.sector}
- Ciudad: ${lead.ciudad ?? 'N/A'}
- Web actual: ${lead.website_actual ?? 'NO TIENE'}
- Instagram: ${lead.instagram_handle ?? 'N/A'}
- Marca a vender: ${lead.marca === 'agutidesigns' ? 'Agutidesigns (web personalizada 1.500-4.000€)' : 'Lokify (web por suscripción 29-79€/mes)'}

Redacta el mensaje de WhatsApp. Devuelve el JSON.`;
}

function parseJson(text: string): { message: string } {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Respuesta sin JSON');
  const parsed = JSON.parse(match[0]);
  if (!parsed.message || typeof parsed.message !== 'string') {
    throw new Error('JSON sin campo message válido');
  }
  return { message: parsed.message };
}

// Convierte un teléfono de cualquier formato a E.164 (+34...).
// Default España si no hay prefijo internacional.
function normalizeToE164(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  // Asume España si son 9 dígitos
  if (digits.length === 9) return '+34' + digits;
  if (digits.length === 11 && digits.startsWith('34')) return '+' + digits;
  return null;
}

async function sendWhatsAppViaTwilio(opts: {
  accountSid: string;
  authToken: string;
  fromNumber: string; // formato 'whatsapp:+14155238886'
  toNumber: string;   // formato 'whatsapp:+34911234567'
  body: string;
}): Promise<{ sid: string; status: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${opts.accountSid}/Messages.json`;
  const params = new URLSearchParams({
    From: opts.fromNumber,
    To: opts.toNumber,
    Body: opts.body,
  });
  const auth = btoa(`${opts.accountSid}:${opts.authToken}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Twilio HTTP ${res.status}: ${data?.message ?? JSON.stringify(data)}`);
  }
  return { sid: data.sid, status: data.status };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const twilioFrom = Deno.env.get('TWILIO_WHATSAPP_FROM'); // ej. 'whatsapp:+14155238886'

  if (!supabaseUrl || !serviceRoleKey || !anthropicKey || !twilioSid || !twilioToken || !twilioFrom) {
    return new Response(
      JSON.stringify({ error: 'Faltan secretos: SUPABASE_*, ANTHROPIC_API_KEY o TWILIO_*' }),
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
    return new Response(JSON.stringify({ skipped: true, reason: 'agente desactivado' }), { status: 200 });
  }

  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('id, marca, nombre_negocio, sector, ciudad, telefono, whatsapp, instagram_handle, website_actual, score, score_reasons')
    .eq('id', leadId)
    .maybeSingle();

  if (leadErr || !lead) {
    return new Response(JSON.stringify({ error: `Lead no encontrado: ${leadErr?.message ?? leadId}` }), { status: 404 });
  }

  const phoneRaw = lead.whatsapp ?? lead.telefono;
  if (!phoneRaw) {
    return new Response(JSON.stringify({ skipped: true, reason: 'lead sin teléfono/whatsapp' }), { status: 200 });
  }
  const e164 = normalizeToE164(phoneRaw);
  if (!e164) {
    return new Response(JSON.stringify({ skipped: true, reason: `teléfono inválido: ${phoneRaw}` }), { status: 200 });
  }
  if ((lead.score ?? 0) < 60) {
    return new Response(JSON.stringify({ skipped: true, reason: `score ${lead.score} < 60` }), { status: 200 });
  }

  const startedAt = new Date().toISOString();
  const t0 = performance.now();

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  let message = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let twilioSid_resp: string | null = null;
  let errorMessage: string | null = null;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
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
    ({ message } = parseJson(text));

    if (!dryRun) {
      const sent = await sendWhatsAppViaTwilio({
        accountSid: twilioSid,
        authToken: twilioToken,
        fromNumber: twilioFrom,
        toNumber: `whatsapp:${e164}`,
        body: message,
      });
      twilioSid_resp = sent.sid;
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
    triggered_by: 'event',
    trigger_data: { lead_id: leadId, dry_run: dryRun },
    status: errorMessage ? 'failed' : 'completed',
    started_at: startedAt,
    finished_at: finishedAt,
    duration_ms: durationMs,
    output: errorMessage ? null : { message, e164, twilio_sid: twilioSid_resp, dry_run: dryRun },
    error_message: errorMessage,
  });

  if (errorMessage) {
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
  }

  if (!dryRun) {
    await supabase.from('conversations').insert({
      lead_id: leadId,
      channel: 'whatsapp',
      direction: 'outbound',
      body: message,
      whatsapp_message_id: twilioSid_resp,
      processed_by_agent: AGENT_NAME,
      ai_response_generated: true,
      ai_response_sent: true,
    });

    const { data: cur } = await supabase
      .from('leads')
      .select('whatsapp_sent')
      .eq('id', leadId)
      .single();

    await supabase
      .from('leads')
      .update({
        status: 'contactado',
        last_contact_at: new Date().toISOString(),
        whatsapp_sent: (cur?.whatsapp_sent ?? 0) + 1,
      })
      .eq('id', leadId);
  }

  return new Response(
    JSON.stringify({
      lead_id: leadId,
      message,
      e164,
      sent: !dryRun,
      twilio_sid: twilioSid_resp,
      dry_run: dryRun,
      duration_ms: durationMs,
      cost_usd: costUsd,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
});
