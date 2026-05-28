// email-enrichment — agente D1, ENRIQUECE leads sin email
//
// Disparador:  POST { lead_id } (via event-dispatcher en 'lead.created')
// Lectura:     leads (busca el handle de Instagram)
// Acción:      fetch https://www.instagram.com/<handle>/ y extrae email del bio
//              (función pública, no requiere login)
// Escritura:   leads.email + leads.enriched_data
//              agent_runs (log)
//              events 'lead.enriched' (siempre, lleve o no email — para continuar el flow)
//
// Hit rate esperado: 30-50% de los leads que tengan Instagram.
// Si IG bloquea o no hay handle, sale silenciosamente y publica enriched igualmente
// para que el dispatcher continúe la cascada.

import { createClient } from 'npm:@supabase/supabase-js@2';

const AGENT_NAME = 'email-enrichment';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Dominios que NO son business email (filtros de ruido)
const BAD_DOMAINS = new Set([
  'sentry.io', 'sentry-cdn.com', 'cdn-cgi', 'instagram.com', 'facebook.com',
  'fbcdn.net', 'cdninstagram.com', 'akamaized.net', 'example.com', 'test.com',
]);

interface LeadRow {
  id: string;
  instagram_handle: string | null;
  email: string | null;
  marca: 'agutidesigns' | 'lokify';
  nombre_negocio: string;
}

function cleanHandle(h: string | null | undefined): string | null {
  if (!h) return null;
  return h.replace(/^@+/, '').trim().toLowerCase();
}

async function scrapeInstagramEmail(handle: string): Promise<{ email: string | null; rawSample: string | null }> {
  const url = `https://www.instagram.com/${encodeURIComponent(handle)}/`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    },
  });
  if (!res.ok) {
    return { email: null, rawSample: `IG HTTP ${res.status}` };
  }
  const html = await res.text();

  // Estrategia: buscar todos los matches de regex en el HTML y filtrar los basura.
  const candidates = (html.match(EMAIL_RE) ?? []).filter((e) => {
    const domain = e.split('@')[1]?.toLowerCase() ?? '';
    if (BAD_DOMAINS.has(domain)) return false;
    if (domain.includes('instagram') || domain.includes('facebook') || domain.includes('cdn')) return false;
    if (e.length > 80) return false;
    return true;
  });

  // El bio aparece en og:description meta tag con frecuencia. Buscamos ahí primero.
  const ogMatch = html.match(/<meta property="og:description"[^>]*content="([^"]*)"/);
  if (ogMatch) {
    const fromOg = ogMatch[1].match(EMAIL_RE)?.[0];
    if (fromOg) return { email: fromOg.toLowerCase(), rawSample: ogMatch[1].slice(0, 200) };
  }

  // Si no, el primer candidato razonable
  if (candidates.length > 0) {
    return { email: candidates[0].toLowerCase(), rawSample: candidates.slice(0, 3).join(', ') };
  }

  return { email: null, rawSample: ogMatch?.[1]?.slice(0, 200) ?? null };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Faltan secretos' }), { status: 500 });
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

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { data: agentCfg } = await supabase
    .from('agent_config')
    .select('enabled')
    .eq('agent_name', AGENT_NAME)
    .maybeSingle();

  if (!agentCfg?.enabled) {
    // Si el agente está apagado, igual publicamos lead.enriched para no romper el cascade
    return new Response(JSON.stringify({ skipped: true, reason: 'agente desactivado' }), { status: 200 });
  }

  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('id, instagram_handle, email, marca, nombre_negocio')
    .eq('id', leadId)
    .maybeSingle();

  if (leadErr || !lead) {
    return new Response(JSON.stringify({ error: `Lead no encontrado: ${leadErr?.message ?? leadId}` }), { status: 404 });
  }

  const startedAt = new Date().toISOString();
  const t0 = performance.now();

  let foundEmail: string | null = null;
  let rawSample: string | null = null;
  let errorMessage: string | null = null;
  let skipReason: string | null = null;

  // Si ya tiene email, no enriquecemos — pasamos al siguiente paso del cascade
  if (lead.email) {
    skipReason = 'ya tenía email';
  } else {
    const handle = cleanHandle((lead as LeadRow).instagram_handle);
    if (!handle) {
      skipReason = 'sin instagram_handle';
    } else {
      try {
        const result = await scrapeInstagramEmail(handle);
        foundEmail = result.email;
        rawSample = result.rawSample;
        if (!foundEmail) skipReason = 'IG sin email en bio';
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : String(err);
      }
    }
  }

  const finishedAt = new Date().toISOString();
  const durationMs = Math.round(performance.now() - t0);

  await supabase.from('agent_runs').insert({
    agent_name: AGENT_NAME,
    triggered_by: 'event',
    trigger_data: { lead_id: leadId },
    status: errorMessage ? 'failed' : 'completed',
    started_at: startedAt,
    finished_at: finishedAt,
    duration_ms: durationMs,
    output: { found_email: foundEmail, skip_reason: skipReason, raw_sample: rawSample },
    error_message: errorMessage,
  });

  if (foundEmail) {
    await supabase
      .from('leads')
      .update({
        email: foundEmail,
        enriched_data: { email_source: 'instagram_bio', enriched_at: finishedAt },
      })
      .eq('id', leadId);
  }

  // SIEMPRE publicamos lead.enriched para que continúe el cascade,
  // tanto si encontramos email como si no.
  await supabase.rpc('publish_event', {
    p_type: 'lead.enriched',
    p_payload: { email_found: !!foundEmail, skip_reason: skipReason },
    p_marca: lead.marca,
    p_lead_id: leadId,
    p_cliente_id: null,
    p_web_id: null,
    p_presupuesto_id: null,
    p_factura_id: null,
    p_source_agent: AGENT_NAME,
  });

  return new Response(
    JSON.stringify({
      lead_id: leadId,
      email_found: foundEmail,
      skip_reason: skipReason,
      duration_ms: durationMs,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
});
