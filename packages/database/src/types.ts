/**
 * Tipos Supabase generados a mano para el esquema v1.0.
 *
 * Para regenerar desde el proyecto Supabase remoto cuando lo tengas vinculado:
 *
 *   pnpm db:types
 *
 * (Ejecuta `supabase gen types typescript --linked > packages/database/src/types.ts`)
 *
 * Mantener sincronizado con supabase/migrations/20260528000001_initial_schema.sql
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      leads: {
        Row: {
          id: string;
          marca: Database['public']['Enums']['marca'];
          source: string;
          nombre_negocio: string;
          sector: string;
          ciudad: string | null;
          provincia: string | null;
          email: string | null;
          telefono: string | null;
          whatsapp: string | null;
          website_actual: string | null;
          google_maps_url: string | null;
          google_place_id: string | null;
          instagram_handle: string | null;
          score: number | null;
          score_reasons: Json | null;
          status: Database['public']['Enums']['lead_status'];
          raw_data: Json | null;
          enriched_data: Json | null;
          emails_sent: number;
          whatsapp_sent: number;
          last_contact_at: string | null;
          last_response_at: string | null;
          notas: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['leads']['Row']> & {
          marca: Database['public']['Enums']['marca'];
          source: string;
          nombre_negocio: string;
          sector: string;
        };
        Update: Partial<Database['public']['Tables']['leads']['Row']>;
      };
      clientes: {
        Row: {
          id: string;
          lead_id: string | null;
          marca: Database['public']['Enums']['marca'];
          nombre_negocio: string;
          cif_nif: string | null;
          email: string;
          telefono: string | null;
          whatsapp: string | null;
          razon_social: string | null;
          direccion_fiscal: string | null;
          codigo_postal: string | null;
          ciudad: string | null;
          provincia: string | null;
          pais: string;
          plan: Database['public']['Enums']['plan_tipo'];
          precio_mensual: number | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          holded_contact_id: string | null;
          kit_digital_expediente: string | null;
          activo: boolean;
          pausa_motivo: string | null;
          pausa_at: string | null;
          config: Json;
          alta_at: string;
          baja_at: string | null;
          proxima_renovacion: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['clientes']['Row']> & {
          marca: Database['public']['Enums']['marca'];
          nombre_negocio: string;
          email: string;
          plan: Database['public']['Enums']['plan_tipo'];
        };
        Update: Partial<Database['public']['Tables']['clientes']['Row']>;
      };
      webs: {
        Row: {
          id: string;
          cliente_id: string;
          template: string | null;
          status: Database['public']['Enums']['web_status'];
          subdominio: string | null;
          dominio_propio: string | null;
          vercel_project_id: string | null;
          vercel_deployment_id: string | null;
          vercel_url: string | null;
          ssl_status: string | null;
          briefing: Json | null;
          content: Json | null;
          assets: Json | null;
          qa_results: Json | null;
          qa_passed: boolean;
          qa_attempts: number;
          google_business_id: string | null;
          google_analytics_id: string | null;
          whatsapp_business_number: string | null;
          chatbot_enabled: boolean;
          chatbot_config: Json | null;
          visitas_30d: number | null;
          leads_30d: number | null;
          ranking_keywords: Json | null;
          last_seo_audit: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['webs']['Row']> & { cliente_id: string };
        Update: Partial<Database['public']['Tables']['webs']['Row']>;
      };
      presupuestos: {
        Row: {
          id: string;
          lead_id: string;
          briefing: Json;
          variantes: Json;
          recomendado: string | null;
          pdf_url: string | null;
          numero: string | null;
          status: string;
          requiere_aprobacion: boolean;
          aprobado_at: string | null;
          aprobado_por: string | null;
          auto_send_at: string | null;
          enviado_at: string | null;
          abierto_at: string | null;
          respondido_at: string | null;
          variante_elegida: string | null;
          precio_final: number | null;
          recordatorio_3d_enviado: boolean;
          oferta_7d_enviada: boolean;
          cierre_14d_aplicado: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['presupuestos']['Row']> & {
          lead_id: string;
          briefing: Json;
          variantes: Json;
        };
        Update: Partial<Database['public']['Tables']['presupuestos']['Row']>;
      };
      facturas: {
        Row: {
          id: string;
          cliente_id: string;
          numero: string;
          serie: string;
          holded_invoice_id: string | null;
          base_imponible: number;
          iva_porcentaje: number;
          iva_importe: number;
          total: number;
          status: Database['public']['Enums']['factura_status'];
          fecha_emision: string | null;
          fecha_vencimiento: string | null;
          fecha_pago: string | null;
          verifactu_id: string | null;
          verifactu_hash: string | null;
          verifactu_qr_url: string | null;
          verifactu_enviado_at: string | null;
          stripe_invoice_id: string | null;
          stripe_payment_intent_id: string | null;
          concepto: string;
          detalle: Json | null;
          recordatorios_enviados: number;
          ultimo_recordatorio_at: string | null;
          web_pausada_por_impago: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['facturas']['Row']> & {
          cliente_id: string;
          numero: string;
          base_imponible: number;
          iva_importe: number;
          total: number;
          concepto: string;
        };
        Update: Partial<Database['public']['Tables']['facturas']['Row']>;
      };
      events: {
        Row: {
          id: string;
          type: Database['public']['Enums']['event_type'];
          marca: Database['public']['Enums']['marca'] | null;
          lead_id: string | null;
          cliente_id: string | null;
          web_id: string | null;
          presupuesto_id: string | null;
          factura_id: string | null;
          source_agent: string | null;
          source_user: string | null;
          payload: Json;
          processed_at: string | null;
          processed_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['events']['Row']> & {
          type: Database['public']['Enums']['event_type'];
        };
        Update: Partial<Database['public']['Tables']['events']['Row']>;
      };
      agent_runs: {
        Row: {
          id: string;
          agent_name: string;
          agent_version: string;
          triggered_by: string;
          trigger_data: Json | null;
          event_id: string | null;
          status: Database['public']['Enums']['agent_status'];
          started_at: string;
          finished_at: string | null;
          duration_ms: number | null;
          output: Json | null;
          error_message: string | null;
          error_stack: string | null;
          claude_model: string | null;
          claude_tokens_input: number;
          claude_tokens_output: number;
          claude_cost_usd: number;
          other_costs: Json;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['agent_runs']['Row']> & {
          agent_name: string;
          triggered_by: string;
        };
        Update: Partial<Database['public']['Tables']['agent_runs']['Row']>;
      };
      agent_config: {
        Row: {
          agent_name: string;
          display_name: string;
          description: string | null;
          enabled: boolean;
          config_agutidesigns: Json;
          config_lokify: Json;
          claude_model: string;
          cron_schedule: string | null;
          trigger_events: Database['public']['Enums']['event_type'][] | null;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['agent_config']['Row']> & {
          agent_name: string;
          display_name: string;
        };
        Update: Partial<Database['public']['Tables']['agent_config']['Row']>;
      };
      conversations: {
        Row: {
          id: string;
          lead_id: string | null;
          cliente_id: string | null;
          channel: string;
          direction: string;
          subject: string | null;
          body: string;
          attachments: Json | null;
          gmail_message_id: string | null;
          whatsapp_message_id: string | null;
          processed_by_agent: string | null;
          ai_response_generated: boolean;
          ai_response_sent: boolean;
          escalated_to_human: boolean;
          escalation_reason: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['conversations']['Row']> & {
          channel: string;
          direction: string;
          body: string;
        };
        Update: Partial<Database['public']['Tables']['conversations']['Row']>;
      };
      nichos: {
        Row: {
          id: string;
          sector: string;
          ciudad: string | null;
          provincia: string | null;
          search_volume: number | null;
          keyword_difficulty: number | null;
          cpc_estimado: number | null;
          competidores_count: number | null;
          oportunidad_score: number | null;
          razones: Json | null;
          activo: boolean;
          campaign_launched: boolean;
          last_analyzed_at: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['nichos']['Row']> & { sector: string };
        Update: Partial<Database['public']['Tables']['nichos']['Row']>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      publish_event: {
        Args: {
          p_type: Database['public']['Enums']['event_type'];
          p_payload?: Json;
          p_marca?: Database['public']['Enums']['marca'] | null;
          p_lead_id?: string | null;
          p_cliente_id?: string | null;
          p_web_id?: string | null;
          p_presupuesto_id?: string | null;
          p_factura_id?: string | null;
          p_source_agent?: string | null;
        };
        Returns: string;
      };
    };
    Enums: {
      marca: 'agutidesigns' | 'lokify';
      lead_status:
        | 'nuevo'
        | 'calificado'
        | 'contactado'
        | 'interesado'
        | 'reunion_agendada'
        | 'presupuesto_enviado'
        | 'cliente'
        | 'perdido'
        | 'descartado';
      web_status:
        | 'pendiente'
        | 'briefing'
        | 'generando_contenido'
        | 'desplegando'
        | 'qa'
        | 'vivo'
        | 'pausado';
      plan_tipo: 'esencial' | 'negocio' | 'crecimiento' | 'custom';
      factura_status:
        | 'borrador'
        | 'emitida'
        | 'enviada'
        | 'pagada'
        | 'vencida'
        | 'cancelada';
      agent_status: 'running' | 'completed' | 'failed' | 'skipped';
      event_type:
        | 'lead.created'
        | 'lead.qualified'
        | 'lead.contacted'
        | 'meeting.scheduled'
        | 'meeting.completed'
        | 'quote.requested'
        | 'quote.generated'
        | 'quote.approved'
        | 'quote.sent'
        | 'quote.accepted'
        | 'quote.rejected'
        | 'payment.received'
        | 'onboarding.started'
        | 'onboarding.completed'
        | 'content.generated'
        | 'web.deployed'
        | 'qa.passed'
        | 'qa.failed'
        | 'web.delivered'
        | 'email.received'
        | 'whatsapp.received'
        | 'review.received'
        | 'invoice.created'
        | 'invoice.paid'
        | 'invoice.overdue'
        | 'agent.error'
        | 'subscription.churned';
    };
  };
};
