export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_config: {
        Row: {
          agent_name: string
          claude_model: string | null
          config_agutidesigns: Json | null
          config_lokify: Json | null
          cron_schedule: string | null
          description: string | null
          display_name: string
          enabled: boolean
          trigger_events: Database["public"]["Enums"]["event_type"][] | null
          updated_at: string
        }
        Insert: {
          agent_name: string
          claude_model?: string | null
          config_agutidesigns?: Json | null
          config_lokify?: Json | null
          cron_schedule?: string | null
          description?: string | null
          display_name: string
          enabled?: boolean
          trigger_events?: Database["public"]["Enums"]["event_type"][] | null
          updated_at?: string
        }
        Update: {
          agent_name?: string
          claude_model?: string | null
          config_agutidesigns?: Json | null
          config_lokify?: Json | null
          cron_schedule?: string | null
          description?: string | null
          display_name?: string
          enabled?: boolean
          trigger_events?: Database["public"]["Enums"]["event_type"][] | null
          updated_at?: string
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          agent_name: string
          agent_version: string | null
          claude_cost_usd: number | null
          claude_model: string | null
          claude_tokens_input: number | null
          claude_tokens_output: number | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          error_stack: string | null
          event_id: string | null
          finished_at: string | null
          id: string
          other_costs: Json | null
          output: Json | null
          started_at: string
          status: Database["public"]["Enums"]["agent_status"]
          trigger_data: Json | null
          triggered_by: string
        }
        Insert: {
          agent_name: string
          agent_version?: string | null
          claude_cost_usd?: number | null
          claude_model?: string | null
          claude_tokens_input?: number | null
          claude_tokens_output?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          error_stack?: string | null
          event_id?: string | null
          finished_at?: string | null
          id?: string
          other_costs?: Json | null
          output?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["agent_status"]
          trigger_data?: Json | null
          triggered_by: string
        }
        Update: {
          agent_name?: string
          agent_version?: string | null
          claude_cost_usd?: number | null
          claude_model?: string | null
          claude_tokens_input?: number | null
          claude_tokens_output?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          error_stack?: string | null
          event_id?: string | null
          finished_at?: string | null
          id?: string
          other_costs?: Json | null
          output?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["agent_status"]
          trigger_data?: Json | null
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          activo: boolean
          alta_at: string
          baja_at: string | null
          cif_nif: string | null
          ciudad: string | null
          codigo_postal: string | null
          config: Json
          created_at: string
          direccion_fiscal: string | null
          email: string
          holded_contact_id: string | null
          id: string
          kit_digital_expediente: string | null
          lead_id: string | null
          marca: Database["public"]["Enums"]["marca"]
          nombre_negocio: string
          pais: string | null
          pausa_at: string | null
          pausa_motivo: string | null
          plan: Database["public"]["Enums"]["plan_tipo"]
          precio_mensual: number | null
          provincia: string | null
          proxima_renovacion: string | null
          razon_social: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          telefono: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          activo?: boolean
          alta_at?: string
          baja_at?: string | null
          cif_nif?: string | null
          ciudad?: string | null
          codigo_postal?: string | null
          config?: Json
          created_at?: string
          direccion_fiscal?: string | null
          email: string
          holded_contact_id?: string | null
          id?: string
          kit_digital_expediente?: string | null
          lead_id?: string | null
          marca: Database["public"]["Enums"]["marca"]
          nombre_negocio: string
          pais?: string | null
          pausa_at?: string | null
          pausa_motivo?: string | null
          plan: Database["public"]["Enums"]["plan_tipo"]
          precio_mensual?: number | null
          provincia?: string | null
          proxima_renovacion?: string | null
          razon_social?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          telefono?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          activo?: boolean
          alta_at?: string
          baja_at?: string | null
          cif_nif?: string | null
          ciudad?: string | null
          codigo_postal?: string | null
          config?: Json
          created_at?: string
          direccion_fiscal?: string | null
          email?: string
          holded_contact_id?: string | null
          id?: string
          kit_digital_expediente?: string | null
          lead_id?: string | null
          marca?: Database["public"]["Enums"]["marca"]
          nombre_negocio?: string
          pais?: string | null
          pausa_at?: string | null
          pausa_motivo?: string | null
          plan?: Database["public"]["Enums"]["plan_tipo"]
          precio_mensual?: number | null
          provincia?: string | null
          proxima_renovacion?: string | null
          razon_social?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          telefono?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ai_response_generated: boolean | null
          ai_response_sent: boolean | null
          attachments: Json | null
          body: string
          channel: string
          cliente_id: string | null
          created_at: string
          direction: string
          escalated_to_human: boolean | null
          escalation_reason: string | null
          gmail_message_id: string | null
          id: string
          lead_id: string | null
          processed_by_agent: string | null
          subject: string | null
          whatsapp_message_id: string | null
        }
        Insert: {
          ai_response_generated?: boolean | null
          ai_response_sent?: boolean | null
          attachments?: Json | null
          body: string
          channel: string
          cliente_id?: string | null
          created_at?: string
          direction: string
          escalated_to_human?: boolean | null
          escalation_reason?: string | null
          gmail_message_id?: string | null
          id?: string
          lead_id?: string | null
          processed_by_agent?: string | null
          subject?: string | null
          whatsapp_message_id?: string | null
        }
        Update: {
          ai_response_generated?: boolean | null
          ai_response_sent?: boolean | null
          attachments?: Json | null
          body?: string
          channel?: string
          cliente_id?: string | null
          created_at?: string
          direction?: string
          escalated_to_human?: boolean | null
          escalation_reason?: string | null
          gmail_message_id?: string | null
          id?: string
          lead_id?: string | null
          processed_by_agent?: string | null
          subject?: string | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          cliente_id: string | null
          created_at: string
          factura_id: string | null
          id: string
          lead_id: string | null
          marca: Database["public"]["Enums"]["marca"] | null
          payload: Json
          presupuesto_id: string | null
          processed_at: string | null
          processed_by: string | null
          source_agent: string | null
          source_user: string | null
          type: Database["public"]["Enums"]["event_type"]
          web_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          factura_id?: string | null
          id?: string
          lead_id?: string | null
          marca?: Database["public"]["Enums"]["marca"] | null
          payload?: Json
          presupuesto_id?: string | null
          processed_at?: string | null
          processed_by?: string | null
          source_agent?: string | null
          source_user?: string | null
          type: Database["public"]["Enums"]["event_type"]
          web_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          factura_id?: string | null
          id?: string
          lead_id?: string | null
          marca?: Database["public"]["Enums"]["marca"] | null
          payload?: Json
          presupuesto_id?: string | null
          processed_at?: string | null
          processed_by?: string | null
          source_agent?: string | null
          source_user?: string | null
          type?: Database["public"]["Enums"]["event_type"]
          web_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_web_id_fkey"
            columns: ["web_id"]
            isOneToOne: false
            referencedRelation: "webs"
            referencedColumns: ["id"]
          },
        ]
      }
      facturas: {
        Row: {
          base_imponible: number
          cliente_id: string
          concepto: string
          created_at: string
          detalle: Json | null
          fecha_emision: string | null
          fecha_pago: string | null
          fecha_vencimiento: string | null
          holded_invoice_id: string | null
          id: string
          iva_importe: number
          iva_porcentaje: number | null
          numero: string
          recordatorios_enviados: number | null
          serie: string | null
          status: Database["public"]["Enums"]["factura_status"]
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          total: number
          ultimo_recordatorio_at: string | null
          updated_at: string
          verifactu_enviado_at: string | null
          verifactu_hash: string | null
          verifactu_id: string | null
          verifactu_qr_url: string | null
          web_pausada_por_impago: boolean | null
        }
        Insert: {
          base_imponible: number
          cliente_id: string
          concepto: string
          created_at?: string
          detalle?: Json | null
          fecha_emision?: string | null
          fecha_pago?: string | null
          fecha_vencimiento?: string | null
          holded_invoice_id?: string | null
          id?: string
          iva_importe: number
          iva_porcentaje?: number | null
          numero: string
          recordatorios_enviados?: number | null
          serie?: string | null
          status?: Database["public"]["Enums"]["factura_status"]
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          total: number
          ultimo_recordatorio_at?: string | null
          updated_at?: string
          verifactu_enviado_at?: string | null
          verifactu_hash?: string | null
          verifactu_id?: string | null
          verifactu_qr_url?: string | null
          web_pausada_por_impago?: boolean | null
        }
        Update: {
          base_imponible?: number
          cliente_id?: string
          concepto?: string
          created_at?: string
          detalle?: Json | null
          fecha_emision?: string | null
          fecha_pago?: string | null
          fecha_vencimiento?: string | null
          holded_invoice_id?: string | null
          id?: string
          iva_importe?: number
          iva_porcentaje?: number | null
          numero?: string
          recordatorios_enviados?: number | null
          serie?: string | null
          status?: Database["public"]["Enums"]["factura_status"]
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          total?: number
          ultimo_recordatorio_at?: string | null
          updated_at?: string
          verifactu_enviado_at?: string | null
          verifactu_hash?: string | null
          verifactu_id?: string | null
          verifactu_qr_url?: string | null
          web_pausada_por_impago?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "facturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ciudad: string | null
          created_at: string
          email: string | null
          emails_sent: number | null
          enriched_data: Json | null
          google_maps_url: string | null
          google_place_id: string | null
          id: string
          instagram_handle: string | null
          last_contact_at: string | null
          last_response_at: string | null
          marca: Database["public"]["Enums"]["marca"]
          nombre_negocio: string
          notas: string | null
          provincia: string | null
          raw_data: Json | null
          score: number | null
          score_reasons: Json | null
          sector: string
          source: string
          status: Database["public"]["Enums"]["lead_status"]
          telefono: string | null
          updated_at: string
          website_actual: string | null
          whatsapp: string | null
          whatsapp_sent: number | null
        }
        Insert: {
          ciudad?: string | null
          created_at?: string
          email?: string | null
          emails_sent?: number | null
          enriched_data?: Json | null
          google_maps_url?: string | null
          google_place_id?: string | null
          id?: string
          instagram_handle?: string | null
          last_contact_at?: string | null
          last_response_at?: string | null
          marca: Database["public"]["Enums"]["marca"]
          nombre_negocio: string
          notas?: string | null
          provincia?: string | null
          raw_data?: Json | null
          score?: number | null
          score_reasons?: Json | null
          sector: string
          source: string
          status?: Database["public"]["Enums"]["lead_status"]
          telefono?: string | null
          updated_at?: string
          website_actual?: string | null
          whatsapp?: string | null
          whatsapp_sent?: number | null
        }
        Update: {
          ciudad?: string | null
          created_at?: string
          email?: string | null
          emails_sent?: number | null
          enriched_data?: Json | null
          google_maps_url?: string | null
          google_place_id?: string | null
          id?: string
          instagram_handle?: string | null
          last_contact_at?: string | null
          last_response_at?: string | null
          marca?: Database["public"]["Enums"]["marca"]
          nombre_negocio?: string
          notas?: string | null
          provincia?: string | null
          raw_data?: Json | null
          score?: number | null
          score_reasons?: Json | null
          sector?: string
          source?: string
          status?: Database["public"]["Enums"]["lead_status"]
          telefono?: string | null
          updated_at?: string
          website_actual?: string | null
          whatsapp?: string | null
          whatsapp_sent?: number | null
        }
        Relationships: []
      }
      nichos: {
        Row: {
          activo: boolean | null
          campaign_launched: boolean | null
          ciudad: string | null
          competidores_count: number | null
          cpc_estimado: number | null
          created_at: string
          id: string
          keyword_difficulty: number | null
          last_analyzed_at: string
          oportunidad_score: number | null
          provincia: string | null
          razones: Json | null
          search_volume: number | null
          sector: string
        }
        Insert: {
          activo?: boolean | null
          campaign_launched?: boolean | null
          ciudad?: string | null
          competidores_count?: number | null
          cpc_estimado?: number | null
          created_at?: string
          id?: string
          keyword_difficulty?: number | null
          last_analyzed_at?: string
          oportunidad_score?: number | null
          provincia?: string | null
          razones?: Json | null
          search_volume?: number | null
          sector: string
        }
        Update: {
          activo?: boolean | null
          campaign_launched?: boolean | null
          ciudad?: string | null
          competidores_count?: number | null
          cpc_estimado?: number | null
          created_at?: string
          id?: string
          keyword_difficulty?: number | null
          last_analyzed_at?: string
          oportunidad_score?: number | null
          provincia?: string | null
          razones?: Json | null
          search_volume?: number | null
          sector?: string
        }
        Relationships: []
      }
      presupuestos: {
        Row: {
          abierto_at: string | null
          aprobado_at: string | null
          aprobado_por: string | null
          auto_send_at: string | null
          briefing: Json
          cierre_14d_aplicado: boolean | null
          created_at: string
          enviado_at: string | null
          id: string
          lead_id: string
          numero: string | null
          oferta_7d_enviada: boolean | null
          pdf_url: string | null
          precio_final: number | null
          recomendado: string | null
          recordatorio_3d_enviado: boolean | null
          requiere_aprobacion: boolean
          respondido_at: string | null
          status: string
          updated_at: string
          variante_elegida: string | null
          variantes: Json
        }
        Insert: {
          abierto_at?: string | null
          aprobado_at?: string | null
          aprobado_por?: string | null
          auto_send_at?: string | null
          briefing: Json
          cierre_14d_aplicado?: boolean | null
          created_at?: string
          enviado_at?: string | null
          id?: string
          lead_id: string
          numero?: string | null
          oferta_7d_enviada?: boolean | null
          pdf_url?: string | null
          precio_final?: number | null
          recomendado?: string | null
          recordatorio_3d_enviado?: boolean | null
          requiere_aprobacion?: boolean
          respondido_at?: string | null
          status?: string
          updated_at?: string
          variante_elegida?: string | null
          variantes: Json
        }
        Update: {
          abierto_at?: string | null
          aprobado_at?: string | null
          aprobado_por?: string | null
          auto_send_at?: string | null
          briefing?: Json
          cierre_14d_aplicado?: boolean | null
          created_at?: string
          enviado_at?: string | null
          id?: string
          lead_id?: string
          numero?: string | null
          oferta_7d_enviada?: boolean | null
          pdf_url?: string | null
          precio_final?: number | null
          recomendado?: string | null
          recordatorio_3d_enviado?: boolean | null
          requiere_aprobacion?: boolean
          respondido_at?: string | null
          status?: string
          updated_at?: string
          variante_elegida?: string | null
          variantes?: Json
        }
        Relationships: [
          {
            foreignKeyName: "presupuestos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      webs: {
        Row: {
          assets: Json | null
          briefing: Json | null
          chatbot_config: Json | null
          chatbot_enabled: boolean | null
          cliente_id: string
          content: Json | null
          created_at: string
          dominio_propio: string | null
          google_analytics_id: string | null
          google_business_id: string | null
          id: string
          last_seo_audit: string | null
          leads_30d: number | null
          qa_attempts: number | null
          qa_passed: boolean | null
          qa_results: Json | null
          ranking_keywords: Json | null
          ssl_status: string | null
          status: Database["public"]["Enums"]["web_status"]
          subdominio: string | null
          template: string | null
          updated_at: string
          vercel_deployment_id: string | null
          vercel_project_id: string | null
          vercel_url: string | null
          visitas_30d: number | null
          whatsapp_business_number: string | null
        }
        Insert: {
          assets?: Json | null
          briefing?: Json | null
          chatbot_config?: Json | null
          chatbot_enabled?: boolean | null
          cliente_id: string
          content?: Json | null
          created_at?: string
          dominio_propio?: string | null
          google_analytics_id?: string | null
          google_business_id?: string | null
          id?: string
          last_seo_audit?: string | null
          leads_30d?: number | null
          qa_attempts?: number | null
          qa_passed?: boolean | null
          qa_results?: Json | null
          ranking_keywords?: Json | null
          ssl_status?: string | null
          status?: Database["public"]["Enums"]["web_status"]
          subdominio?: string | null
          template?: string | null
          updated_at?: string
          vercel_deployment_id?: string | null
          vercel_project_id?: string | null
          vercel_url?: string | null
          visitas_30d?: number | null
          whatsapp_business_number?: string | null
        }
        Update: {
          assets?: Json | null
          briefing?: Json | null
          chatbot_config?: Json | null
          chatbot_enabled?: boolean | null
          cliente_id?: string
          content?: Json | null
          created_at?: string
          dominio_propio?: string | null
          google_analytics_id?: string | null
          google_business_id?: string | null
          id?: string
          last_seo_audit?: string | null
          leads_30d?: number | null
          qa_attempts?: number | null
          qa_passed?: boolean | null
          qa_results?: Json | null
          ranking_keywords?: Json | null
          ssl_status?: string | null
          status?: Database["public"]["Enums"]["web_status"]
          subdominio?: string | null
          template?: string | null
          updated_at?: string
          vercel_deployment_id?: string | null
          vercel_project_id?: string | null
          vercel_url?: string | null
          visitas_30d?: number | null
          whatsapp_business_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webs_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      publish_event: {
        Args: {
          p_cliente_id?: string
          p_factura_id?: string
          p_lead_id?: string
          p_marca?: Database["public"]["Enums"]["marca"]
          p_payload?: Json
          p_presupuesto_id?: string
          p_source_agent?: string
          p_type: Database["public"]["Enums"]["event_type"]
          p_web_id?: string
        }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      agent_status: "running" | "completed" | "failed" | "skipped"
      event_type:
        | "lead.created"
        | "lead.qualified"
        | "lead.contacted"
        | "meeting.scheduled"
        | "meeting.completed"
        | "quote.requested"
        | "quote.generated"
        | "quote.approved"
        | "quote.sent"
        | "quote.accepted"
        | "quote.rejected"
        | "payment.received"
        | "onboarding.started"
        | "onboarding.completed"
        | "content.generated"
        | "web.deployed"
        | "qa.passed"
        | "qa.failed"
        | "web.delivered"
        | "email.received"
        | "whatsapp.received"
        | "review.received"
        | "invoice.created"
        | "invoice.paid"
        | "invoice.overdue"
        | "agent.error"
        | "subscription.churned"
      factura_status:
        | "borrador"
        | "emitida"
        | "enviada"
        | "pagada"
        | "vencida"
        | "cancelada"
      lead_status:
        | "nuevo"
        | "calificado"
        | "contactado"
        | "interesado"
        | "reunion_agendada"
        | "presupuesto_enviado"
        | "cliente"
        | "perdido"
        | "descartado"
      marca: "agutidesigns" | "lokify"
      plan_tipo: "esencial" | "negocio" | "crecimiento" | "custom"
      web_status:
        | "pendiente"
        | "briefing"
        | "generando_contenido"
        | "desplegando"
        | "qa"
        | "vivo"
        | "pausado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      agent_status: ["running", "completed", "failed", "skipped"],
      event_type: [
        "lead.created",
        "lead.qualified",
        "lead.contacted",
        "meeting.scheduled",
        "meeting.completed",
        "quote.requested",
        "quote.generated",
        "quote.approved",
        "quote.sent",
        "quote.accepted",
        "quote.rejected",
        "payment.received",
        "onboarding.started",
        "onboarding.completed",
        "content.generated",
        "web.deployed",
        "qa.passed",
        "qa.failed",
        "web.delivered",
        "email.received",
        "whatsapp.received",
        "review.received",
        "invoice.created",
        "invoice.paid",
        "invoice.overdue",
        "agent.error",
        "subscription.churned",
      ],
      factura_status: [
        "borrador",
        "emitida",
        "enviada",
        "pagada",
        "vencida",
        "cancelada",
      ],
      lead_status: [
        "nuevo",
        "calificado",
        "contactado",
        "interesado",
        "reunion_agendada",
        "presupuesto_enviado",
        "cliente",
        "perdido",
        "descartado",
      ],
      marca: ["agutidesigns", "lokify"],
      plan_tipo: ["esencial", "negocio", "crecimiento", "custom"],
      web_status: [
        "pendiente",
        "briefing",
        "generando_contenido",
        "desplegando",
        "qa",
        "vivo",
        "pausado",
      ],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const
