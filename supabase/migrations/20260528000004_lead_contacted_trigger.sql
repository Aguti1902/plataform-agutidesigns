-- ============================================================================
-- Trigger: publica 'lead.contacted' la primera vez que se hace contacto
-- ============================================================================
-- Cuando emails_sent o whatsapp_sent pasan de 0 a >0 (primer toque), se
-- publica el evento que dispara el crm-pipeline.
-- ============================================================================

CREATE OR REPLACE FUNCTION trg_lead_contacted() RETURNS TRIGGER AS $$
BEGIN
  IF (
    -- primer email enviado
    (COALESCE(OLD.emails_sent, 0) = 0 AND COALESCE(NEW.emails_sent, 0) > 0)
    OR
    -- primer whatsapp enviado
    (COALESCE(OLD.whatsapp_sent, 0) = 0 AND COALESCE(NEW.whatsapp_sent, 0) > 0)
  ) THEN
    PERFORM publish_event(
      'lead.contacted'::event_type,
      jsonb_build_object(
        'lead_id', NEW.id,
        'emails_sent', NEW.emails_sent,
        'whatsapp_sent', NEW.whatsapp_sent
      ),
      NEW.marca,
      NEW.id,
      NULL, NULL, NULL, NULL, NULL
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leads_contacted ON leads;
CREATE TRIGGER trg_leads_contacted
  AFTER UPDATE OF emails_sent, whatsapp_sent ON leads
  FOR EACH ROW EXECUTE FUNCTION trg_lead_contacted();
