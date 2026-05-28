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
const PLACES_TEXT_SEARCH = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const PLACES_DETAILS = 'https://maps.googleapis.com/maps/api/place/details/json';
const DEFAULT_MAX = 20;

interface ScrapeRequest {
  sector: string;
  ciudad: string;
  provincia?: string;
  marca?: 'agutidesigns' | 'lokify';
  max?: number;
}

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  website?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  url?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
}

async function textSearch(query: string, key: string): Promise<PlaceResult[]> {
  const url = new URL(PLACES_TEXT_SEARCH);
  url.searchParams.set('query', query);
  url.searchParams.set('key', key);
  url.searchParams.set('language', 'es');
  url.searchParams.set('region', 'es');
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Places text search HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Places text search error: ${data.status} ${data.error_message ?? ''}`);
  }
  return (data.results ?? []) as PlaceResult[];
}

async function placeDetails(placeId: string, key: string): Promise<PlaceResult> {
  const url = new URL(PLACES_DETAILS);
  url.searchParams.set('place_id', placeId);
  url.searchParams.set(
    'fields',
    'place_id,name,formatted_address,website,formatted_phone_number,international_phone_number,url,rating,user_ratings_total,business_status',
  );
  url.searchParams.set('key', key);
  url.searchParams.set('language', 'es');
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Places details HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== 'OK') {
    throw new Error(`Places details error: ${data.status} ${data.error_message ?? ''}`);
  }
  return data.result as PlaceResult;
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
    const initial = await textSearch(query, placesKey);
    totalSeen = initial.length;
    const limited = initial.slice(0, max);

    for (const place of limited) {
      try {
        // Dedup por place_id
        const { data: existing } = await supabase
          .from('leads')
          .select('id')
          .eq('google_place_id', place.place_id)
          .maybeSingle();

        if (existing) {
          skippedExisting++;
          continue;
        }

        const details = await placeDetails(place.place_id, placesKey);

        // Filtro de negocio: skip si tiene web (no es nuestro target)
        if (details.website && details.website.length > 0) {
          skippedHasWebsite++;
          continue;
        }

        const { error: insertErr } = await supabase.from('leads').insert({
          marca,
          source: 'google_maps',
          nombre_negocio: details.name ?? place.name,
          sector: body.sector,
          ciudad: body.ciudad,
          provincia: body.provincia ?? null,
          telefono: normalizePhone(details.formatted_phone_number ?? details.international_phone_number),
          website_actual: details.website ?? null,
          google_place_id: place.place_id,
          google_maps_url: details.url ?? null,
          raw_data: {
            address: details.formatted_address,
            rating: details.rating,
            user_ratings_total: details.user_ratings_total,
            business_status: details.business_status,
          },
        });

        if (insertErr) {
          errors.push(`${place.name}: ${insertErr.message}`);
        } else {
          inserted++;
        }
      } catch (err) {
        errors.push(`${place.name}: ${err instanceof Error ? err.message : err}`);
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
