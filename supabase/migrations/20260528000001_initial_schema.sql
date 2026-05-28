-- ============================================================================
-- AGUTIDESIGNS PLATFORM v1.0 — Supabase Schema
-- ============================================================================
-- Marcas: agutidesigns (proyectos custom) + lokify (membresías)
-- Diseñado para orquestar 30 agentes IA vía eventos
-- Generado: 28 mayo 2026
-- ============================================================================

-- ============================================================================
-- EXTENSIONES
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- TIPOS ENUM
-- ============================================================================

CREATE TYPE marca AS ENUM ('agutidesigns', 'lokify');

CREATE TYPE lead_status AS ENUM (
  'nuevo',
  'calificado',
  'contactado',
  'interesado',
  'reunion_agendada',
  'presupuesto_enviado',
  'cliente',
  'perdido',
  'descartado'
);

CREATE TYPE web_status AS ENUM (
  'pendiente',
  'briefing',
  'generando_contenido',
  'desplegando',
  'qa',
  'vivo',
  'pausado'
);

CREATE TYPE plan_tipo AS ENUM (
  'esencial',
  'negocio',
  'crecimiento',
  'custom'
);

CREATE TYPE factura_status AS ENUM (
  'borrador',
  'emitida',
  'enviada',
  'pagada',
  'vencida',
  'cancelada'
);

CREATE TYPE agent_status AS ENUM (
  'running',
  'completed',
  'failed',
  'skipped'
);

CREATE TYPE event_type AS ENUM (
  -- Captación
  'lead.created',
  'lead.qualified',
  'lead.contacted',
  -- Ventas
  'meeting.scheduled',
  'meeting.completed',
  'quote.requested',
  'quote.generated',
  'quote.approved',
  'quote.sent',
  'quote.accepted',
  'quote.rejected',
  -- Producción
  'payment.received',
  'onboarding.started',
  'onboarding.completed',
  'content.generated',
  'web.deployed',
  'qa.passed',
  'qa.failed',
  'web.delivered',
  -- Operación
  'email.received',
  'whatsapp.received',
  'review.received',
  -- Finanzas
  'invoice.created',
  'invoice.paid',
  'invoice.overdue',
  -- Sistema
  'agent.error',
  'subscription.churned'
);

-- ============================================================================
-- TABLA 1: LEADS
-- ============================================================================

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marca marca NOT NULL,
  source TEXT NOT NULL,

  nombre_negocio TEXT NOT NULL,
  sector TEXT NOT NULL,
  ciudad TEXT,
  provincia TEXT,

  email TEXT,
  telefono TEXT,
  whatsapp TEXT,
  website_actual TEXT,
  google_maps_url TEXT,
  google_place_id TEXT,
  instagram_handle TEXT,

  score INTEGER CHECK (score >= 0 AND score <= 100),
  score_reasons JSONB,
  status lead_status NOT NULL DEFAULT 'nuevo',

  raw_data JSONB,
  enriched_data JSONB,

  emails_sent INTEGER DEFAULT 0,
  whatsapp_sent INTEGER DEFAULT 0,
  last_contact_at TIMESTAMPTZ,
  last_response_at TIMESTAMPTZ,

  notas TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLA 2: CLIENTES
-- ============================================================================

CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  marca marca NOT NULL,

  nombre_negocio TEXT NOT NULL,
  cif_nif TEXT,
  email TEXT NOT NULL,
  telefono TEXT,
  whatsapp TEXT,

  razon_social TEXT,
  direccion_fiscal TEXT,
  codigo_postal TEXT,
  ciudad TEXT,
  provincia TEXT,
  pais TEXT DEFAULT 'ES',

  plan plan_tipo NOT NULL,
  precio_mensual DECIMAL(10,2),

  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  holded_contact_id TEXT,
  kit_digital_expediente TEXT,

  activo BOOLEAN NOT NULL DEFAULT true,
  pausa_motivo TEXT,
  pausa_at TIMESTAMPTZ,

  config JSONB NOT NULL DEFAULT '{}'::jsonb,

  alta_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  baja_at TIMESTAMPTZ,
  proxima_renovacion TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(marca, email)
);

-- ============================================================================
-- TABLA 3: WEBS
-- ============================================================================

CREATE TABLE webs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,

  template TEXT,
  status web_status NOT NULL DEFAULT 'pendiente',

  subdominio TEXT UNIQUE,
  dominio_propio TEXT,
  vercel_project_id TEXT,
  vercel_deployment_id TEXT,
  vercel_url TEXT,
  ssl_status TEXT,

  briefing JSONB,
  content JSONB,
  assets JSONB,

  qa_results JSONB,
  qa_passed BOOLEAN DEFAULT false,
  qa_attempts INTEGER DEFAULT 0,

  google_business_id TEXT,
  google_analytics_id TEXT,
  whatsapp_business_number TEXT,
  chatbot_enabled BOOLEAN DEFAULT false,
  chatbot_config JSONB,

  visitas_30d INTEGER,
  leads_30d INTEGER,
  ranking_keywords JSONB,
  last_seo_audit TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLA 4: PRESUPUESTOS
-- ============================================================================

CREATE TABLE presupuestos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  briefing JSONB NOT NULL,

  variantes JSONB NOT NULL,
  recomendado TEXT,

  pdf_url TEXT,
  numero TEXT,
  status TEXT NOT NULL DEFAULT 'borrador',

  requiere_aprobacion BOOLEAN NOT NULL DEFAULT true,
  aprobado_at TIMESTAMPTZ,
  aprobado_por UUID,
  auto_send_at TIMESTAMPTZ,

  enviado_at TIMESTAMPTZ,
  abierto_at TIMESTAMPTZ,
  respondido_at TIMESTAMPTZ,
  variante_elegida TEXT,
  precio_final DECIMAL(10,2),

  recordatorio_3d_enviado BOOLEAN DEFAULT false,
  oferta_7d_enviada BOOLEAN DEFAULT false,
  cierre_14d_aplicado BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLA 5: FACTURAS
-- ============================================================================

CREATE TABLE facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,

  numero TEXT NOT NULL UNIQUE,
  serie TEXT DEFAULT 'A',

  holded_invoice_id TEXT UNIQUE,

  base_imponible DECIMAL(10,2) NOT NULL,
  iva_porcentaje DECIMAL(5,2) DEFAULT 21.00,
  iva_importe DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,

  status factura_status NOT NULL DEFAULT 'borrador',
  fecha_emision DATE,
  fecha_vencimiento DATE,
  fecha_pago TIMESTAMPTZ,

  verifactu_id TEXT,
  verifactu_hash TEXT,
  verifactu_qr_url TEXT,
  verifactu_enviado_at TIMESTAMPTZ,

  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,

  concepto TEXT NOT NULL,
  detalle JSONB,

  recordatorios_enviados INTEGER DEFAULT 0,
  ultimo_recordatorio_at TIMESTAMPTZ,
  web_pausada_por_impago BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLA 6: EVENTS
-- ============================================================================

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type event_type NOT NULL,

  marca marca,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  web_id UUID REFERENCES webs(id) ON DELETE CASCADE,
  presupuesto_id UUID REFERENCES presupuestos(id) ON DELETE CASCADE,
  factura_id UUID REFERENCES facturas(id) ON DELETE CASCADE,

  source_agent TEXT,
  source_user UUID,

  payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  processed_at TIMESTAMPTZ,
  processed_by TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLA 7: AGENT_RUNS
-- ============================================================================

CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  agent_version TEXT DEFAULT '1.0',

  triggered_by TEXT NOT NULL,
  trigger_data JSONB,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,

  status agent_status NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,

  output JSONB,
  error_message TEXT,
  error_stack TEXT,

  claude_model TEXT,
  claude_tokens_input INTEGER DEFAULT 0,
  claude_tokens_output INTEGER DEFAULT 0,
  claude_cost_usd DECIMAL(10,6) DEFAULT 0,
  other_costs JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLA 8: AGENT_CONFIG
-- ============================================================================

CREATE TABLE agent_config (
  agent_name TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,

  config_agutidesigns JSONB DEFAULT '{}'::jsonb,
  config_lokify JSONB DEFAULT '{}'::jsonb,

  claude_model TEXT DEFAULT 'claude-sonnet-4-6',

  cron_schedule TEXT,

  trigger_events event_type[],

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLA 9: CONVERSATIONS
-- ============================================================================

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,

  channel TEXT NOT NULL,
  direction TEXT NOT NULL,

  subject TEXT,
  body TEXT NOT NULL,
  attachments JSONB,

  gmail_message_id TEXT,
  whatsapp_message_id TEXT,

  processed_by_agent TEXT,
  ai_response_generated BOOLEAN DEFAULT false,
  ai_response_sent BOOLEAN DEFAULT false,
  escalated_to_human BOOLEAN DEFAULT false,
  escalation_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLA 10: NICHOS
-- ============================================================================

CREATE TABLE nichos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector TEXT NOT NULL,
  ciudad TEXT,
  provincia TEXT,

  search_volume INTEGER,
  keyword_difficulty INTEGER,
  cpc_estimado DECIMAL(6,2),
  competidores_count INTEGER,

  oportunidad_score INTEGER CHECK (oportunidad_score >= 0 AND oportunidad_score <= 100),
  razones JSONB,

  activo BOOLEAN DEFAULT true,
  campaign_launched BOOLEAN DEFAULT false,

  last_analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ÍNDICES
-- ============================================================================

CREATE INDEX idx_leads_marca ON leads(marca);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_score ON leads(score DESC NULLS LAST);
CREATE INDEX idx_leads_sector_ciudad ON leads(sector, ciudad);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_nombre_trgm ON leads USING gin (nombre_negocio gin_trgm_ops);

CREATE INDEX idx_clientes_marca ON clientes(marca);
CREATE INDEX idx_clientes_activo ON clientes(activo) WHERE activo = true;
CREATE INDEX idx_clientes_email ON clientes(email);
CREATE INDEX idx_clientes_stripe ON clientes(stripe_customer_id);
CREATE INDEX idx_clientes_holded ON clientes(holded_contact_id);
CREATE INDEX idx_clientes_proxima_renovacion ON clientes(proxima_renovacion) WHERE activo = true;

CREATE INDEX idx_webs_cliente ON webs(cliente_id);
CREATE INDEX idx_webs_status ON webs(status);
CREATE INDEX idx_webs_subdominio ON webs(subdominio);
CREATE INDEX idx_webs_qa_pendiente ON webs(qa_passed) WHERE qa_passed = false;

CREATE INDEX idx_presupuestos_lead ON presupuestos(lead_id);
CREATE INDEX idx_presupuestos_status ON presupuestos(status);
CREATE INDEX idx_presupuestos_auto_send ON presupuestos(auto_send_at)
  WHERE status = 'esperando_aprobacion';

CREATE INDEX idx_facturas_cliente ON facturas(cliente_id);
CREATE INDEX idx_facturas_status ON facturas(status);
CREATE INDEX idx_facturas_vencimiento ON facturas(fecha_vencimiento)
  WHERE status IN ('emitida','enviada','vencida');
CREATE INDEX idx_facturas_verifactu ON facturas(verifactu_id) WHERE verifactu_id IS NOT NULL;

CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_unprocessed ON events(created_at) WHERE processed_at IS NULL;
CREATE INDEX idx_events_lead ON events(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_events_cliente ON events(cliente_id) WHERE cliente_id IS NOT NULL;

CREATE INDEX idx_agent_runs_name ON agent_runs(agent_name);
CREATE INDEX idx_agent_runs_status ON agent_runs(status);
CREATE INDEX idx_agent_runs_started ON agent_runs(started_at DESC);
CREATE INDEX idx_agent_runs_errors ON agent_runs(agent_name, started_at DESC)
  WHERE status = 'failed';

CREATE INDEX idx_conv_lead ON conversations(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_conv_cliente ON conversations(cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX idx_conv_channel ON conversations(channel, created_at DESC);
CREATE INDEX idx_conv_escalated ON conversations(escalated_to_human)
  WHERE escalated_to_human = true;

CREATE INDEX idx_nichos_oportunidad ON nichos(oportunidad_score DESC) WHERE activo = true;
CREATE INDEX idx_nichos_sector ON nichos(sector);

-- ============================================================================
-- FUNCIONES Y TRIGGERS — updated_at automático
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_clientes_updated BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_webs_updated BEFORE UPDATE ON webs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_presupuestos_updated BEFORE UPDATE ON presupuestos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_facturas_updated BEFORE UPDATE ON facturas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_agent_config_updated BEFORE UPDATE ON agent_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- FUNCIÓN: publish_event
-- ============================================================================

CREATE OR REPLACE FUNCTION publish_event(
  p_type event_type,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_marca marca DEFAULT NULL,
  p_lead_id UUID DEFAULT NULL,
  p_cliente_id UUID DEFAULT NULL,
  p_web_id UUID DEFAULT NULL,
  p_presupuesto_id UUID DEFAULT NULL,
  p_factura_id UUID DEFAULT NULL,
  p_source_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO events (
    type, payload, marca, lead_id, cliente_id, web_id,
    presupuesto_id, factura_id, source_agent
  ) VALUES (
    p_type, p_payload, p_marca, p_lead_id, p_cliente_id, p_web_id,
    p_presupuesto_id, p_factura_id, p_source_agent
  ) RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS: Publicar eventos automáticamente
-- ============================================================================

CREATE OR REPLACE FUNCTION trg_lead_created() RETURNS TRIGGER AS $$
BEGIN
  PERFORM publish_event(
    'lead.created'::event_type,
    jsonb_build_object('lead_id', NEW.id, 'source', NEW.source),
    NEW.marca,
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_leads_insert AFTER INSERT ON leads
  FOR EACH ROW EXECUTE FUNCTION trg_lead_created();

CREATE OR REPLACE FUNCTION trg_lead_qualified() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.score IS NOT NULL AND NEW.score >= 60
     AND (OLD.score IS NULL OR OLD.score < 60) THEN
    PERFORM publish_event(
      'lead.qualified'::event_type,
      jsonb_build_object('lead_id', NEW.id, 'score', NEW.score),
      NEW.marca,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_leads_qualified AFTER UPDATE OF score ON leads
  FOR EACH ROW EXECUTE FUNCTION trg_lead_qualified();

CREATE OR REPLACE FUNCTION trg_web_deployed() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'vivo' AND OLD.status != 'vivo' THEN
    PERFORM publish_event(
      'web.deployed'::event_type,
      jsonb_build_object('web_id', NEW.id, 'subdominio', NEW.subdominio),
      (SELECT marca FROM clientes WHERE id = NEW.cliente_id),
      NULL,
      NEW.cliente_id,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_webs_deployed AFTER UPDATE OF status ON webs
  FOR EACH ROW EXECUTE FUNCTION trg_web_deployed();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE webs ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE nichos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access leads" ON leads
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access clientes" ON clientes
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access webs" ON webs
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access presupuestos" ON presupuestos
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access facturas" ON facturas
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access events" ON events
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access agent_runs" ON agent_runs
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access agent_config" ON agent_config
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access conversations" ON conversations
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access nichos" ON nichos
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Cliente ve sus propios datos" ON clientes
  FOR SELECT TO authenticated
  USING (email = auth.jwt() ->> 'email');

CREATE POLICY "Cliente ve sus propias webs" ON webs
  FOR SELECT TO authenticated
  USING (cliente_id IN (
    SELECT id FROM clientes WHERE email = auth.jwt() ->> 'email'
  ));

CREATE POLICY "Cliente ve sus propias facturas" ON facturas
  FOR SELECT TO authenticated
  USING (cliente_id IN (
    SELECT id FROM clientes WHERE email = auth.jwt() ->> 'email'
  ));

-- ============================================================================
-- SEED: Configuración inicial de los 30 agentes
-- ============================================================================

INSERT INTO agent_config (agent_name, display_name, description, claude_model, cron_schedule, trigger_events) VALUES
-- D1: Captación
('scraper-leads', 'Scraper de leads', 'Busca negocios locales sin web por sector y ciudad', 'claude-sonnet-4-6', '0 3 * * *', NULL),
('lead-qualifier', 'Lead qualifier', 'Puntúa cada lead 0-100', 'claude-haiku-4-5', NULL, ARRAY['lead.created']::event_type[]),
('nicho-hunter', 'Nicho hunter', 'Detecta sectores rentables semanalmente', 'claude-sonnet-4-6', '0 2 * * 1', NULL),
('email-captacion', 'Email de captación', 'Email personalizado por sector', 'claude-sonnet-4-6', NULL, ARRAY['lead.qualified']::event_type[]),
('whatsapp-outreach', 'WhatsApp outreach', 'Contacta leads por WhatsApp', 'claude-sonnet-4-6', NULL, ARRAY['lead.qualified']::event_type[]),
('ads-manager', 'Ads manager', 'Crea campañas Meta y Google por nicho', 'claude-opus-4-7', NULL, NULL),
('competitor-spy', 'Competitor spy', 'Monitoriza agencias rivales', 'claude-sonnet-4-6', '0 6 * * 5', NULL),

-- D2: Ventas
('crm-pipeline', 'CRM pipeline', 'Mueve leads por el pipeline', 'claude-haiku-4-5', NULL, ARRAY['lead.contacted']::event_type[]),
('briefing-reunion', 'Briefing pre-reunión', 'Prepara briefing 30 min antes', 'claude-sonnet-4-6', NULL, ARRAY['meeting.scheduled']::event_type[]),
('generador-presupuesto', 'Generador de presupuestos', 'PDF con 3 planes', 'claude-opus-4-7', NULL, ARRAY['meeting.completed']::event_type[]),
('seguimiento-presupuesto', 'Seguimiento presupuesto', 'Recordatorios y descuentos', 'claude-sonnet-4-6', '0 10 * * *', NULL),

-- D3: Producción
('onboarding', 'Onboarding cliente', 'Formulario inteligente post-pago', 'claude-sonnet-4-6', NULL, ARRAY['payment.received']::event_type[]),
('content-generator', 'Content generator', 'Textos SEO por sector y ciudad', 'claude-opus-4-7', NULL, ARRAY['onboarding.completed']::event_type[]),
('web-builder', 'Web builder', 'Despliega en Vercel', 'claude-sonnet-4-6', NULL, ARRAY['content.generated']::event_type[]),
('qa-automatico', 'QA automático', 'Verifica web antes de entregar', 'claude-sonnet-4-6', NULL, ARRAY['web.deployed']::event_type[]),
('google-business', 'Google My Business', 'Ficha Google del cliente', 'claude-sonnet-4-6', NULL, ARRAY['qa.passed']::event_type[]),
('chatbot-embed', 'Chatbot embebido', 'Chatbot IA en web cliente', 'claude-haiku-4-5', NULL, ARRAY['qa.passed']::event_type[]),

-- D4: Ads & creatividad
('video-creator', 'Video creator', 'Genera videos para ads con Kling', 'claude-sonnet-4-6', NULL, NULL),
('ad-copywriter', 'Ad copywriter', 'Copies de anuncios', 'claude-sonnet-4-6', NULL, NULL),
('social-publisher', 'Social publisher', 'Publica en IG y TikTok', 'claude-sonnet-4-6', '0 9 * * *', NULL),

-- D5: Atención al cliente
('email-entrega', 'Email de entrega', 'Bienvenida con web + upsells', 'claude-sonnet-4-6', NULL, ARRAY['qa.passed']::event_type[]),
('support-bot', 'Support bot 24/7', 'Responde emails de clientes', 'claude-sonnet-4-6', NULL, ARRAY['email.received']::event_type[]),
('reviews-manager', 'Reviews manager', 'Pide y responde reseñas', 'claude-sonnet-4-6', '0 11 * * *', NULL),
('retencion-upsell', 'Retención & upsell', 'Lunes: inactivos y upsells', 'claude-sonnet-4-6', '0 9 * * 1', NULL),
('informe-seo', 'Informe SEO mensual', 'Día 1: informe para cada cliente', 'claude-sonnet-4-6', '0 8 1 * *', NULL),

-- D6: Administración
('facturacion-verifactu', 'Facturación Verifactu', 'Holded + Verifactu legal', 'claude-haiku-4-5', NULL, ARRAY['payment.received', 'quote.accepted']::event_type[]),
('kit-digital', 'Kit Digital', 'Gestiona subvención del cliente', 'claude-sonnet-4-6', NULL, NULL),
('gestion-impagos', 'Gestión de impagos', 'Avisos y pausas automáticas', 'claude-haiku-4-5', '0 8 * * *', NULL),
('reconciliacion', 'Reconciliación contable', 'Stripe vs Holded', 'claude-haiku-4-5', '0 7 * * 0', NULL),
('dashboard-financiero', 'Dashboard financiero', 'MRR, churn, proyección', 'claude-sonnet-4-6', '0 8 * * 1', NULL);

-- ============================================================================
-- FIN DEL ESQUEMA v1.0
-- ============================================================================
