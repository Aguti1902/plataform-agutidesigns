-- ============================================================================
-- Event dispatcher trigger
-- ============================================================================
-- Conecta la tabla `events` con las Edge Functions de los agentes.
-- Cuando se inserta un evento, esta trigger llama vía HTTP a la función
-- `event-dispatcher`, que a su vez invoca los agentes correspondientes.
--
-- Configuración post-migración (cargar dispatcher_url y dispatcher_token
-- en la tabla _runtime_config — fuera del control de versiones):
--   INSERT INTO _runtime_config(key, value)
--     VALUES ('dispatcher_url', 'https://<ref>.supabase.co/functions/v1/event-dispatcher'),
--            ('dispatcher_token', '<service_role_key>')
--     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
-- ============================================================================

-- pg_net viene preinstalado en Supabase con su función net.http_post en el schema `net`.
-- No reinstalamos la extensión aquí — Supabase la gestiona.

CREATE TABLE IF NOT EXISTS _runtime_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sin políticas RLS: solo service_role lee/escribe. Anon no debe ver nunca esta tabla.
ALTER TABLE _runtime_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON _runtime_config FROM anon, authenticated;

CREATE OR REPLACE FUNCTION dispatch_event_to_agents()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  dispatcher_url   TEXT;
  dispatcher_token TEXT;
  request_id       BIGINT;
BEGIN
  SELECT value INTO dispatcher_url   FROM _runtime_config WHERE key = 'dispatcher_url';
  SELECT value INTO dispatcher_token FROM _runtime_config WHERE key = 'dispatcher_token';

  -- Sin config → salimos sin error (útil en local o si todavía no se ha cargado).
  IF dispatcher_url IS NULL OR dispatcher_url = '' THEN
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url     := dispatcher_url,
    body    := jsonb_build_object(
      'event_id',       NEW.id,
      'type',           NEW.type,
      'lead_id',        NEW.lead_id,
      'cliente_id',     NEW.cliente_id,
      'web_id',         NEW.web_id,
      'presupuesto_id', NEW.presupuesto_id,
      'factura_id',     NEW.factura_id,
      'marca',          NEW.marca,
      'payload',        NEW.payload
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(dispatcher_token, '')
    ),
    timeout_milliseconds := 25000
  ) INTO request_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_dispatch ON events;
CREATE TRIGGER trg_events_dispatch
  AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION dispatch_event_to_agents();

COMMENT ON FUNCTION dispatch_event_to_agents IS
  'Dispara la función event-dispatcher por HTTP cada vez que se inserta un evento. '
  'Lee URL + token de la tabla _runtime_config (cargada fuera del control de versiones).';
