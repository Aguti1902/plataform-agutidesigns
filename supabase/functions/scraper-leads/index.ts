// scraper-leads — agente D1 del pipeline de captación
//
// Disparador:  cron (0 3 * * *) o POST manual con body { sector, ciudad, marca?, max? }
// Lectura:     Google Maps Places API (Text Search)
// Escritura:   leads (uno por negocio nuevo, dedup por google_place_id)
//              agent_runs (log)
//              events 'lead.created' se publican automáticamente via trigger SQL
//
// El siguiente agente (lead-qualifier) se dispara solo cuando ve los 'lead.created'.

import { createClient } from 'npm:@supabase/supabase-js@2';

const AGENT_NAME = 'scraper-leads';
// Places API (New) — endpoint único, devuelve todos los campos en una sola llamada
const PLACES_SEARCH_TEXT = 'https://places.googleapis.com/v1/places:searchText';
const DEFAULT_MAX = 20;

interface ScrapeRequest {
  sector: string;
  ciudad: string;
  provincia?: string;
  marca?: 'agutidesigns' | 'lokify';
  max?: number;
}

interface PlaceResult {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
}

async function searchText(query: string, max: number, key: string): Promise<PlaceResult[]> {
  const res = await fetch(PLACES_SEARCH_TEXT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.internationalPhoneNumber,places.googleMapsUri,places.rating,places.userRatingCount,places.businessStatus',
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: 'es',
      regionCode: 'ES',
      pageSize: Math.min(max, 20),
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Places searchText HTTP ${res.status}: ${errBody}`);
  }
  const data = await res.json();
  return (data.places ?? []) as PlaceResult[];
}

function normalizePhone(p?: string): string | null {
  if (!p) return null;
  return p.replace(/\s+/g, ' ').trim();
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const placesKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!supabaseUrl || !serviceRoleKey || !placesKey) {
    return new Response(
      JSON.stringify({ error: 'Faltan secretos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o GOOGLE_PLACES_API_KEY' }),
      { status: 500 },
    );
  }

  let body: ScrapeRequest;
  try {
    body = await req.json();
    if (!body.sector || !body.ciudad) throw new Error('sector y ciudad son obligatorios');
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

  const startedAt = new Date().toISOString();
  const t0 = performance.now();
  const marca = body.marca ?? 'agutidesigns';
  const max = Math.min(Math.max(1, body.max ?? DEFAULT_MAX), 60);
  const query = `${body.sector} en ${body.ciudad}`;

  let inserted = 0;
  let skippedExisting = 0;
  let skippedHasWebsite = 0;
  let errors: string[] = [];
  let totalSeen = 0;

  try {
    const places = await searchText(query, max, placesKey);
    totalSeen = places.length;

    for (const place of places) {
      const name = place.displayName?.text ?? '(sin nombre)';
      try {
        const { data: existing } = await supabase
          .from('leads')
          .select('id')
          .eq('google_place_id', place.id)
          .maybeSingle();

        if (existing) {
          skippedExisting++;
          continue;
        }

        if (place.websiteUri && place.websiteUri.length > 0) {
          skippedHasWebsite++;
          continue;
        }

        const { error: insertErr } = await supabase.from('leads').insert({
          marca,
          source: 'google_maps',
          nombre_negocio: name,
          sector: body.sector,
          ciudad: body.ciudad,
          provincia: body.provincia ?? null,
          telefono: normalizePhone(place.nationalPhoneNumber ?? place.internationalPhoneNumber),
          website_actual: place.websiteUri ?? null,
          google_place_id: place.id,
          google_maps_url: place.googleMapsUri ?? null,
          raw_data: {
            address: place.formattedAddress,
            rating: place.rating,
            user_ratings_total: place.userRatingCount,
            business_status: place.businessStatus,
          },
        });

        if (insertErr) {
          errors.push(`${name}: ${insertErr.message}`);
        } else {
          inserted++;
        }
      } catch (err) {
        errors.push(`${name}: ${err instanceof Error ? err.message : err}`);
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  const finishedAt = new Date().toISOString();
  const durationMs = Math.round(performance.now() - t0);
  const status = errors.length > 0 && inserted === 0 ? 'failed' : 'completed';

  await supabase.from('agent_runs').insert({
    agent_name: AGENT_NAME,
    triggered_by: 'manual',
    trigger_data: { sector: body.sector, ciudad: body.ciudad, max },
    status,
    started_at: startedAt,
    finished_at: finishedAt,
    duration_ms: durationMs,
    output: { totalSeen, inserted, skippedExisting, skippedHasWebsite, errorsCount: errors.length },
    error_message: errors.length > 0 ? errors.slice(0, 5).join(' | ') : null,
  });

  return new Response(
    JSON.stringify({
      sector: body.sector,
      ciudad: body.ciudad,
      query,
      totalSeen,
      inserted,
      skippedExisting,
      skippedHasWebsite,
      errors,
      durationMs,
    }),
    { status: status === 'failed' ? 500 : 200, headers: { 'content-type': 'application/json' } },
  );
});
