import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, EventType, Marca } from '@agutidesigns/database';

export interface PublishEventInput {
  type: EventType;
  payload?: Record<string, unknown>;
  marca?: Marca | null;
  leadId?: string | null;
  clienteId?: string | null;
  webId?: string | null;
  presupuestoId?: string | null;
  facturaId?: string | null;
  sourceAgent?: string | null;
}

/**
 * Publica un evento en la tabla `events` usando la función RPC publish_event.
 * Devuelve el UUID del evento creado.
 */
export async function publishEvent(
  supabase: SupabaseClient<Database>,
  input: PublishEventInput,
): Promise<string> {
  const { data, error } = await supabase.rpc('publish_event', {
    p_type: input.type,
    p_payload: input.payload ?? {},
    p_marca: input.marca ?? null,
    p_lead_id: input.leadId ?? null,
    p_cliente_id: input.clienteId ?? null,
    p_web_id: input.webId ?? null,
    p_presupuesto_id: input.presupuestoId ?? null,
    p_factura_id: input.facturaId ?? null,
    p_source_agent: input.sourceAgent ?? null,
  });

  if (error) {
    throw new Error(`publishEvent(${input.type}) falló: ${error.message}`);
  }
  return data as unknown as string;
}
