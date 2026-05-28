-- ============================================================================
-- Añade el tipo de evento 'lead.enriched'
-- ============================================================================
-- Lo emite el agente email-enrichment después de intentar enriquecer un lead
-- con email scrapeado del Instagram bio. Se emite tanto si encuentra email
-- como si no, para que el dispatcher pueda continuar la cascada
-- (siguiente paso: lead-qualifier).
-- ============================================================================

ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'lead.enriched';

-- Registra el nuevo agente email-enrichment en agent_config
INSERT INTO agent_config (agent_name, display_name, description, claude_model, trigger_events, enabled)
VALUES (
  'email-enrichment',
  'Email enrichment',
  'Scrapea email del bio de Instagram para leads sin contacto email. Hit rate ~30-50%.',
  NULL,  -- no usa Claude (solo fetch + regex)
  ARRAY['lead.created']::event_type[],
  true
)
ON CONFLICT (agent_name) DO NOTHING;

