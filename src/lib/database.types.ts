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
  public: {
    Tables: {
      ai_generations: {
        Row: {
          cost_krw: number | null
          created_at: string | null
          drop_id: string | null
          error_message: string | null
          generation_type: string
          id: string
          model: string | null
          prompt: string | null
          response: Json | null
          source_id: string | null
          status: string
          tokens_used: number | null
        }
        Insert: {
          cost_krw?: number | null
          created_at?: string | null
          drop_id?: string | null
          error_message?: string | null
          generation_type: string
          id?: string
          model?: string | null
          prompt?: string | null
          response?: Json | null
          source_id?: string | null
          status?: string
          tokens_used?: number | null
        }
        Update: {
          cost_krw?: number | null
          created_at?: string | null
          drop_id?: string | null
          error_message?: string | null
          generation_type?: string
          id?: string
          model?: string | null
          prompt?: string | null
          response?: Json | null
          source_id?: string | null
          status?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generations_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "info_drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generations_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "content_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_quotas: {
        Row: {
          daily_limit: number
          id: string
          period_start: string
          updated_at: string
          used_count: number
          user_id: string
        }
        Insert: {
          daily_limit?: number
          id?: string
          period_start?: string
          updated_at?: string
          used_count?: number
          user_id: string
        }
        Update: {
          daily_limit?: number
          id?: string
          period_start?: string
          updated_at?: string
          used_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_quotas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_quotas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_hash: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_hash?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      click_audit_logs: {
        Row: {
          click_sequence_hash: string | null
          created_at: string
          device_hash: string | null
          id: string
          ip_hash: string | null
          is_suspicious: boolean
          metadata: Json
          share_event_id: string | null
          suspicion_reasons: string[] | null
          suspicion_score: number | null
          time_since_last_click_ms: number | null
          user_agent_hash: string | null
          user_id: string | null
          was_counted: boolean
        }
        Insert: {
          click_sequence_hash?: string | null
          created_at?: string
          device_hash?: string | null
          id?: string
          ip_hash?: string | null
          is_suspicious?: boolean
          metadata?: Json
          share_event_id?: string | null
          suspicion_reasons?: string[] | null
          suspicion_score?: number | null
          time_since_last_click_ms?: number | null
          user_agent_hash?: string | null
          user_id?: string | null
          was_counted?: boolean
        }
        Update: {
          click_sequence_hash?: string | null
          created_at?: string
          device_hash?: string | null
          id?: string
          ip_hash?: string | null
          is_suspicious?: boolean
          metadata?: Json
          share_event_id?: string | null
          suspicion_reasons?: string[] | null
          suspicion_score?: number | null
          time_since_last_click_ms?: number | null
          user_agent_hash?: string | null
          user_id?: string | null
          was_counted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "click_audit_logs_share_event_id_fkey"
            columns: ["share_event_id"]
            isOneToOne: false
            referencedRelation: "share_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "click_audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "click_audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      component_blocks: {
        Row: {
          block_config: Json
          block_data: Json
          block_kind: Database["public"]["Enums"]["block_kind"]
          created_at: string | null
          id: string
          info_drop_id: string
          is_locked: boolean
          position: number
          updated_at: string | null
          video_end_seconds: number | null
          video_start_seconds: number | null
        }
        Insert: {
          block_config?: Json
          block_data?: Json
          block_kind: Database["public"]["Enums"]["block_kind"]
          created_at?: string | null
          id?: string
          info_drop_id: string
          is_locked?: boolean
          position?: number
          updated_at?: string | null
          video_end_seconds?: number | null
          video_start_seconds?: number | null
        }
        Update: {
          block_config?: Json
          block_data?: Json
          block_kind?: Database["public"]["Enums"]["block_kind"]
          created_at?: string | null
          id?: string
          info_drop_id?: string
          is_locked?: boolean
          position?: number
          updated_at?: string | null
          video_end_seconds?: number | null
          video_start_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "component_blocks_info_drop_id_fkey"
            columns: ["info_drop_id"]
            isOneToOne: false
            referencedRelation: "info_drops"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          agreed: boolean
          agreed_at: string
          consent_type: string
          created_at: string | null
          id: string
          ip_hash: string | null
          policy_version: string | null
          subject_id: string
          subject_type: string
        }
        Insert: {
          agreed: boolean
          agreed_at?: string
          consent_type: string
          created_at?: string | null
          id?: string
          ip_hash?: string | null
          policy_version?: string | null
          subject_id: string
          subject_type: string
        }
        Update: {
          agreed?: boolean
          agreed_at?: string
          consent_type?: string
          created_at?: string | null
          id?: string
          ip_hash?: string | null
          policy_version?: string | null
          subject_id?: string
          subject_type?: string
        }
        Relationships: []
      }
      consultation_leads: {
        Row: {
          adults: number | null
          budget_range: string | null
          children: number | null
          created_at: string | null
          desired_date: string | null
          desired_time: string | null
          drop_id: string | null
          id: string
          lead_type: string
          message: string | null
          name: string
          partner_id: string | null
          phone: string
          phone_hash: string
          privacy_agreed: boolean
          status: string
          updated_at: string | null
        }
        Insert: {
          adults?: number | null
          budget_range?: string | null
          children?: number | null
          created_at?: string | null
          desired_date?: string | null
          desired_time?: string | null
          drop_id?: string | null
          id?: string
          lead_type: string
          message?: string | null
          name: string
          partner_id?: string | null
          phone: string
          phone_hash: string
          privacy_agreed: boolean
          status?: string
          updated_at?: string | null
        }
        Update: {
          adults?: number | null
          budget_range?: string | null
          children?: number | null
          created_at?: string | null
          desired_date?: string | null
          desired_time?: string | null
          drop_id?: string | null
          id?: string
          lead_type?: string
          message?: string | null
          name?: string
          partner_id?: string | null
          phone?: string
          phone_hash?: string
          privacy_agreed?: boolean
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_leads_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "info_drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_leads_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      content_sources: {
        Row: {
          author_name: string | null
          cache_ttl_minutes: number | null
          canonical_url: string | null
          caption: string | null
          category: string | null
          created_at: string | null
          creator_verification_id: string | null
          duration_sec: number | null
          duration_seconds: number | null
          embed_html: string | null
          extracted_at: string | null
          extraction_confidence: number | null
          extraction_errors: string[] | null
          extraction_method: string | null
          extraction_version: string | null
          fetched_at: string | null
          id: string
          language: string | null
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          price_currency: string | null
          price_krw: number | null
          provider: Database["public"]["Enums"]["source_provider"]
          rating: number | null
          rating_count: number | null
          raw_meta: Json | null
          registered_by_user_id: string | null
          rights_status: Database["public"]["Enums"]["rights_status"]
          source_id: string | null
          source_mode: Database["public"]["Enums"]["source_mode"]
          source_url: string
          thumbnail_url: string | null
          title: string | null
        }
        Insert: {
          author_name?: string | null
          cache_ttl_minutes?: number | null
          canonical_url?: string | null
          caption?: string | null
          category?: string | null
          created_at?: string | null
          creator_verification_id?: string | null
          duration_sec?: number | null
          duration_seconds?: number | null
          embed_html?: string | null
          extracted_at?: string | null
          extraction_confidence?: number | null
          extraction_errors?: string[] | null
          extraction_method?: string | null
          extraction_version?: string | null
          fetched_at?: string | null
          id?: string
          language?: string | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          price_currency?: string | null
          price_krw?: number | null
          provider: Database["public"]["Enums"]["source_provider"]
          rating?: number | null
          rating_count?: number | null
          raw_meta?: Json | null
          registered_by_user_id?: string | null
          rights_status?: Database["public"]["Enums"]["rights_status"]
          source_id?: string | null
          source_mode?: Database["public"]["Enums"]["source_mode"]
          source_url: string
          thumbnail_url?: string | null
          title?: string | null
        }
        Update: {
          author_name?: string | null
          cache_ttl_minutes?: number | null
          canonical_url?: string | null
          caption?: string | null
          category?: string | null
          created_at?: string | null
          creator_verification_id?: string | null
          duration_sec?: number | null
          duration_seconds?: number | null
          embed_html?: string | null
          extracted_at?: string | null
          extraction_confidence?: number | null
          extraction_errors?: string[] | null
          extraction_method?: string | null
          extraction_version?: string | null
          fetched_at?: string | null
          id?: string
          language?: string | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          price_currency?: string | null
          price_krw?: number | null
          provider?: Database["public"]["Enums"]["source_provider"]
          rating?: number | null
          rating_count?: number | null
          raw_meta?: Json | null
          registered_by_user_id?: string | null
          rights_status?: Database["public"]["Enums"]["rights_status"]
          source_id?: string | null
          source_mode?: Database["public"]["Enums"]["source_mode"]
          source_url?: string
          thumbnail_url?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_sources_registered_by_user_id_fkey"
            columns: ["registered_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_sources_registered_by_user_id_fkey"
            columns: ["registered_by_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversion_events: {
        Row: {
          campaign_id: string | null
          chain_depth: number
          chain_origin_user_id: string | null
          chain_path: string[]
          conversion_type: Database["public"]["Enums"]["conversion_type"]
          direct_advocate_user_id: string | null
          gross_amount_krw: number
          id: string
          info_drop_id: string | null
          is_settled: boolean | null
          occurred_at: string | null
          partner_fee_krw: number
          platform_fee_krw: number
          reservation_id: string | null
          reward_pool_krw: number
          settled_at: string | null
          share_event_id: string
          source_id: string
          visitor_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          chain_depth?: number
          chain_origin_user_id?: string | null
          chain_path?: string[]
          conversion_type: Database["public"]["Enums"]["conversion_type"]
          direct_advocate_user_id?: string | null
          gross_amount_krw?: number
          id?: string
          info_drop_id?: string | null
          is_settled?: boolean | null
          occurred_at?: string | null
          partner_fee_krw?: number
          platform_fee_krw?: number
          reservation_id?: string | null
          reward_pool_krw?: number
          settled_at?: string | null
          share_event_id: string
          source_id: string
          visitor_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          chain_depth?: number
          chain_origin_user_id?: string | null
          chain_path?: string[]
          conversion_type?: Database["public"]["Enums"]["conversion_type"]
          direct_advocate_user_id?: string | null
          gross_amount_krw?: number
          id?: string
          info_drop_id?: string | null
          is_settled?: boolean | null
          occurred_at?: string | null
          partner_fee_krw?: number
          platform_fee_krw?: number
          reservation_id?: string | null
          reward_pool_krw?: number
          settled_at?: string | null
          share_event_id?: string
          source_id?: string
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversion_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "drop_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_events_chain_origin_user_id_fkey"
            columns: ["chain_origin_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_events_chain_origin_user_id_fkey"
            columns: ["chain_origin_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_events_direct_advocate_user_id_fkey"
            columns: ["direct_advocate_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_events_direct_advocate_user_id_fkey"
            columns: ["direct_advocate_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_events_info_drop_id_fkey"
            columns: ["info_drop_id"]
            isOneToOne: false
            referencedRelation: "info_drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_events_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_events_share_event_id_fkey"
            columns: ["share_event_id"]
            isOneToOne: false
            referencedRelation: "share_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_events_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          amount_krw: number | null
          claim_code: string | null
          claim_id: string | null
          coupon_id: string | null
          created_at: string
          error_code: string | null
          id: string
          ip: unknown
          metadata: Json
          partner_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          amount_krw?: number | null
          claim_code?: string | null
          claim_id?: string | null
          coupon_id?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          ip?: unknown
          metadata?: Json
          partner_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          amount_krw?: number | null
          claim_code?: string | null
          claim_id?: string | null
          coupon_id?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          ip?: unknown
          metadata?: Json
          partner_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_audit_logs_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "coupon_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_audit_logs_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_audit_logs_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_claims: {
        Row: {
          catcher_user_id: string | null
          claim_code: string
          coupon_id: string
          expires_at: string | null
          id: string
          issued_at: string | null
          phone_hash: string | null
          share_event_id: string | null
          status: Database["public"]["Enums"]["claim_status"]
          used_at: string | null
          visitor_id: string | null
        }
        Insert: {
          catcher_user_id?: string | null
          claim_code: string
          coupon_id: string
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          phone_hash?: string | null
          share_event_id?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          used_at?: string | null
          visitor_id?: string | null
        }
        Update: {
          catcher_user_id?: string | null
          claim_code?: string
          coupon_id?: string
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          phone_hash?: string | null
          share_event_id?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          used_at?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_claims_catcher_user_id_fkey"
            columns: ["catcher_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_claims_catcher_user_id_fkey"
            columns: ["catcher_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_claims_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_claims_share_event_id_fkey"
            columns: ["share_event_id"]
            isOneToOne: false
            referencedRelation: "share_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_claims_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          coupon_claim_id: string
          dispute_note: string | null
          id: string
          is_disputed: boolean | null
          metadata: Json | null
          partner_id: string
          redeem_amount_krw: number | null
          redeemed_at: string | null
          redeemed_by_staff_id: string | null
        }
        Insert: {
          coupon_claim_id: string
          dispute_note?: string | null
          id?: string
          is_disputed?: boolean | null
          metadata?: Json | null
          partner_id: string
          redeem_amount_krw?: number | null
          redeemed_at?: string | null
          redeemed_by_staff_id?: string | null
        }
        Update: {
          coupon_claim_id?: string
          dispute_note?: string | null
          id?: string
          is_disputed?: boolean | null
          metadata?: Json | null
          partner_id?: string
          redeem_amount_krw?: number | null
          redeemed_at?: string | null
          redeemed_by_staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_claim_id_fkey"
            columns: ["coupon_claim_id"]
            isOneToOne: true
            referencedRelation: "coupon_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_redeemed_by_staff_id_fkey"
            columns: ["redeemed_by_staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_redeemed_by_staff_id_fkey"
            columns: ["redeemed_by_staff_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          campaign_id: string | null
          conditions: Json | null
          coupon_type: string
          created_at: string | null
          discount_unit: string | null
          discount_value: number | null
          id: string
          is_active: boolean | null
          partner_id: string
          per_user_limit: number | null
          title: string
          total_count: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          campaign_id?: string | null
          conditions?: Json | null
          coupon_type: string
          created_at?: string | null
          discount_unit?: string | null
          discount_value?: number | null
          id?: string
          is_active?: boolean | null
          partner_id: string
          per_user_limit?: number | null
          title: string
          total_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          campaign_id?: string | null
          conditions?: Json | null
          coupon_type?: string
          created_at?: string | null
          discount_unit?: string | null
          discount_value?: number | null
          id?: string
          is_active?: boolean | null
          partner_id?: string
          per_user_limit?: number | null
          title?: string
          total_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "drop_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      drop_campaigns: {
        Row: {
          budget_limit_krw: number | null
          budget_used_krw: number | null
          campaign_status: Database["public"]["Enums"]["campaign_status"]
          campaign_title: string
          commission_rate: number | null
          content_source_id: string | null
          conversion_key: Database["public"]["Enums"]["conversion_type"]
          created_at: string | null
          creator_user_id: string | null
          ends_at: string | null
          id: string
          intent_id: string
          partner_fee_krw: number | null
          partner_id: string | null
          rules: Json | null
          starts_at: string | null
          updated_at: string | null
        }
        Insert: {
          budget_limit_krw?: number | null
          budget_used_krw?: number | null
          campaign_status?: Database["public"]["Enums"]["campaign_status"]
          campaign_title: string
          commission_rate?: number | null
          content_source_id?: string | null
          conversion_key: Database["public"]["Enums"]["conversion_type"]
          created_at?: string | null
          creator_user_id?: string | null
          ends_at?: string | null
          id?: string
          intent_id: string
          partner_fee_krw?: number | null
          partner_id?: string | null
          rules?: Json | null
          starts_at?: string | null
          updated_at?: string | null
        }
        Update: {
          budget_limit_krw?: number | null
          budget_used_krw?: number | null
          campaign_status?: Database["public"]["Enums"]["campaign_status"]
          campaign_title?: string
          commission_rate?: number | null
          content_source_id?: string | null
          conversion_key?: Database["public"]["Enums"]["conversion_type"]
          created_at?: string | null
          creator_user_id?: string | null
          ends_at?: string | null
          id?: string
          intent_id?: string
          partner_fee_krw?: number | null
          partner_id?: string | null
          rules?: Json | null
          starts_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drop_campaigns_content_source_id_fkey"
            columns: ["content_source_id"]
            isOneToOne: false
            referencedRelation: "content_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_campaigns_creator_user_id_fkey"
            columns: ["creator_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_campaigns_creator_user_id_fkey"
            columns: ["creator_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_campaigns_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "intent_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_campaigns_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      drop_ctas: {
        Row: {
          created_at: string | null
          cta_type: string
          drop_id: string
          id: string
          is_primary: boolean
          label: string
          sort_order: number
          updated_at: string | null
          url: string | null
        }
        Insert: {
          created_at?: string | null
          cta_type: string
          drop_id: string
          id?: string
          is_primary?: boolean
          label: string
          sort_order?: number
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string | null
          cta_type?: string
          drop_id?: string
          id?: string
          is_primary?: boolean
          label?: string
          sort_order?: number
          updated_at?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drop_ctas_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "info_drops"
            referencedColumns: ["id"]
          },
        ]
      }
      drop_event_fraud_signals: {
        Row: {
          click_audit_log_id: string | null
          conversion_event_id: string | null
          created_at: string
          decision: Database["public"]["Enums"]["fraud_decision_kind"]
          device_hash: string | null
          event_type: string
          id: string
          info_drop_id: string | null
          ip_hash: string | null
          metadata: Json
          reasons: string[]
          receiver_user_id: string | null
          resolution: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          risk_score: number
          sender_user_id: string | null
          session_hash: string | null
          share_event_id: string | null
          source: string
          user_agent_hash: string | null
        }
        Insert: {
          click_audit_log_id?: string | null
          conversion_event_id?: string | null
          created_at?: string
          decision: Database["public"]["Enums"]["fraud_decision_kind"]
          device_hash?: string | null
          event_type: string
          id?: string
          info_drop_id?: string | null
          ip_hash?: string | null
          metadata?: Json
          reasons?: string[]
          receiver_user_id?: string | null
          resolution?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          risk_score: number
          sender_user_id?: string | null
          session_hash?: string | null
          share_event_id?: string | null
          source: string
          user_agent_hash?: string | null
        }
        Update: {
          click_audit_log_id?: string | null
          conversion_event_id?: string | null
          created_at?: string
          decision?: Database["public"]["Enums"]["fraud_decision_kind"]
          device_hash?: string | null
          event_type?: string
          id?: string
          info_drop_id?: string | null
          ip_hash?: string | null
          metadata?: Json
          reasons?: string[]
          receiver_user_id?: string | null
          resolution?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          risk_score?: number
          sender_user_id?: string | null
          session_hash?: string | null
          share_event_id?: string | null
          source?: string
          user_agent_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drop_event_fraud_signals_click_audit_log_id_fkey"
            columns: ["click_audit_log_id"]
            isOneToOne: false
            referencedRelation: "click_audit_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_event_fraud_signals_conversion_event_id_fkey"
            columns: ["conversion_event_id"]
            isOneToOne: false
            referencedRelation: "conversion_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_event_fraud_signals_info_drop_id_fkey"
            columns: ["info_drop_id"]
            isOneToOne: false
            referencedRelation: "info_drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_event_fraud_signals_receiver_user_id_fkey"
            columns: ["receiver_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_event_fraud_signals_receiver_user_id_fkey"
            columns: ["receiver_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_event_fraud_signals_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_event_fraud_signals_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_event_fraud_signals_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_event_fraud_signals_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_event_fraud_signals_share_event_id_fkey"
            columns: ["share_event_id"]
            isOneToOne: false
            referencedRelation: "share_events"
            referencedColumns: ["id"]
          },
        ]
      }
      drop_forks: {
        Row: {
          block_overrides: Json
          child_drop_id: string
          created_at: string
          cta_variant: string | null
          custom_message: string | null
          custom_title: string | null
          fork_reason: string | null
          forked_by_user_id: string
          id: string
          intent_code: string | null
          metadata: Json
          origin_maker_user_id: string | null
          parent_drop_id: string
          preserves_creator_credit: boolean
          preserves_origin_credit: boolean
          status: Database["public"]["Enums"]["fork_status_kind"]
          updated_at: string
        }
        Insert: {
          block_overrides?: Json
          child_drop_id: string
          created_at?: string
          cta_variant?: string | null
          custom_message?: string | null
          custom_title?: string | null
          fork_reason?: string | null
          forked_by_user_id: string
          id?: string
          intent_code?: string | null
          metadata?: Json
          origin_maker_user_id?: string | null
          parent_drop_id: string
          preserves_creator_credit?: boolean
          preserves_origin_credit?: boolean
          status?: Database["public"]["Enums"]["fork_status_kind"]
          updated_at?: string
        }
        Update: {
          block_overrides?: Json
          child_drop_id?: string
          created_at?: string
          cta_variant?: string | null
          custom_message?: string | null
          custom_title?: string | null
          fork_reason?: string | null
          forked_by_user_id?: string
          id?: string
          intent_code?: string | null
          metadata?: Json
          origin_maker_user_id?: string | null
          parent_drop_id?: string
          preserves_creator_credit?: boolean
          preserves_origin_credit?: boolean
          status?: Database["public"]["Enums"]["fork_status_kind"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drop_forks_child_drop_id_fkey"
            columns: ["child_drop_id"]
            isOneToOne: false
            referencedRelation: "info_drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_forks_forked_by_user_id_fkey"
            columns: ["forked_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_forks_forked_by_user_id_fkey"
            columns: ["forked_by_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_forks_intent_code_fkey"
            columns: ["intent_code"]
            isOneToOne: false
            referencedRelation: "drop_intents"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "drop_forks_origin_maker_user_id_fkey"
            columns: ["origin_maker_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_forks_origin_maker_user_id_fkey"
            columns: ["origin_maker_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_forks_parent_drop_id_fkey"
            columns: ["parent_drop_id"]
            isOneToOne: false
            referencedRelation: "info_drops"
            referencedColumns: ["id"]
          },
        ]
      }
      drop_intents: {
        Row: {
          active: boolean
          allowed_reward_types: string[]
          category: Database["public"]["Enums"]["intent_category"]
          code: string
          created_at: string
          default_cta_label: string
          description: string | null
          fraud_sensitivity: Database["public"]["Enums"]["fraud_sensitivity_level"]
          max_chain_depth: number
          metadata: Json
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          allowed_reward_types?: string[]
          category: Database["public"]["Enums"]["intent_category"]
          code: string
          created_at?: string
          default_cta_label: string
          description?: string | null
          fraud_sensitivity?: Database["public"]["Enums"]["fraud_sensitivity_level"]
          max_chain_depth?: number
          metadata?: Json
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          allowed_reward_types?: string[]
          category?: Database["public"]["Enums"]["intent_category"]
          code?: string
          created_at?: string
          default_cta_label?: string
          description?: string | null
          fraud_sensitivity?: Database["public"]["Enums"]["fraud_sensitivity_level"]
          max_chain_depth?: number
          metadata?: Json
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      drop_sender_reputation: {
        Row: {
          avg_click_rate: number
          avg_conversion_rate: number
          avg_open_rate: number
          avg_reshare_rate: number
          calculation_version: string
          created_at: string
          last_calculated_at: string
          metadata: Json
          sender_user_id: string
          spam_report_count: number
          status: Database["public"]["Enums"]["sender_reputation_status"]
          suspicious_event_count: number
          total_clicked: number
          total_converted: number
          total_forked: number
          total_opened: number
          total_reshared: number
          total_sent: number
          trust_score: number
          updated_at: string
        }
        Insert: {
          avg_click_rate?: number
          avg_conversion_rate?: number
          avg_open_rate?: number
          avg_reshare_rate?: number
          calculation_version?: string
          created_at?: string
          last_calculated_at?: string
          metadata?: Json
          sender_user_id: string
          spam_report_count?: number
          status?: Database["public"]["Enums"]["sender_reputation_status"]
          suspicious_event_count?: number
          total_clicked?: number
          total_converted?: number
          total_forked?: number
          total_opened?: number
          total_reshared?: number
          total_sent?: number
          trust_score?: number
          updated_at?: string
        }
        Update: {
          avg_click_rate?: number
          avg_conversion_rate?: number
          avg_open_rate?: number
          avg_reshare_rate?: number
          calculation_version?: string
          created_at?: string
          last_calculated_at?: string
          metadata?: Json
          sender_user_id?: string
          spam_report_count?: number
          status?: Database["public"]["Enums"]["sender_reputation_status"]
          suspicious_event_count?: number
          total_clicked?: number
          total_converted?: number
          total_forked?: number
          total_opened?: number
          total_reshared?: number
          total_sent?: number
          trust_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drop_sender_reputation_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_sender_reputation_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drop_share_contexts: {
        Row: {
          created_at: string
          cta_variant: string | null
          custom_message: string | null
          customizations: Json
          device_type: string | null
          emotion: Database["public"]["Enums"]["share_emotion"] | null
          id: string
          intent_code: string | null
          metadata: Json
          primary_intent_id: string | null
          relationship_hint:
            | Database["public"]["Enums"]["share_relationship"]
            | null
          secondary_intents: string[]
          sender_note: string | null
          sender_tier_at_send: string | null
          sender_trust_score_at_send: number | null
          sender_user_id: string
          share_event_id: string
          template_id: string | null
          time_of_day: string | null
          trust_hint_score: number
          urgency_score: number | null
        }
        Insert: {
          created_at?: string
          cta_variant?: string | null
          custom_message?: string | null
          customizations?: Json
          device_type?: string | null
          emotion?: Database["public"]["Enums"]["share_emotion"] | null
          id?: string
          intent_code?: string | null
          metadata?: Json
          primary_intent_id?: string | null
          relationship_hint?:
            | Database["public"]["Enums"]["share_relationship"]
            | null
          secondary_intents?: string[]
          sender_note?: string | null
          sender_tier_at_send?: string | null
          sender_trust_score_at_send?: number | null
          sender_user_id: string
          share_event_id: string
          template_id?: string | null
          time_of_day?: string | null
          trust_hint_score?: number
          urgency_score?: number | null
        }
        Update: {
          created_at?: string
          cta_variant?: string | null
          custom_message?: string | null
          customizations?: Json
          device_type?: string | null
          emotion?: Database["public"]["Enums"]["share_emotion"] | null
          id?: string
          intent_code?: string | null
          metadata?: Json
          primary_intent_id?: string | null
          relationship_hint?:
            | Database["public"]["Enums"]["share_relationship"]
            | null
          secondary_intents?: string[]
          sender_note?: string | null
          sender_tier_at_send?: string | null
          sender_trust_score_at_send?: number | null
          sender_user_id?: string
          share_event_id?: string
          template_id?: string | null
          time_of_day?: string | null
          trust_hint_score?: number
          urgency_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "drop_share_contexts_intent_code_fkey"
            columns: ["intent_code"]
            isOneToOne: false
            referencedRelation: "drop_intents"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "drop_share_contexts_primary_intent_id_fkey"
            columns: ["primary_intent_id"]
            isOneToOne: false
            referencedRelation: "intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_share_contexts_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_share_contexts_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_share_contexts_share_event_id_fkey"
            columns: ["share_event_id"]
            isOneToOne: true
            referencedRelation: "share_events"
            referencedColumns: ["id"]
          },
        ]
      }
      drop_share_edges: {
        Row: {
          chain_depth: number
          chain_origin_user_id: string
          child_share_event_id: string
          child_user_id: string
          created_at: string
          id: string
          info_drop_id: string
          parent_share_event_id: string | null
          parent_user_id: string | null
        }
        Insert: {
          chain_depth?: number
          chain_origin_user_id: string
          child_share_event_id: string
          child_user_id: string
          created_at?: string
          id?: string
          info_drop_id: string
          parent_share_event_id?: string | null
          parent_user_id?: string | null
        }
        Update: {
          chain_depth?: number
          chain_origin_user_id?: string
          child_share_event_id?: string
          child_user_id?: string
          created_at?: string
          id?: string
          info_drop_id?: string
          parent_share_event_id?: string | null
          parent_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drop_share_edges_chain_origin_user_id_fkey"
            columns: ["chain_origin_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_share_edges_chain_origin_user_id_fkey"
            columns: ["chain_origin_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_share_edges_child_share_event_id_fkey"
            columns: ["child_share_event_id"]
            isOneToOne: true
            referencedRelation: "share_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_share_edges_child_user_id_fkey"
            columns: ["child_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_share_edges_child_user_id_fkey"
            columns: ["child_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_share_edges_info_drop_id_fkey"
            columns: ["info_drop_id"]
            isOneToOne: false
            referencedRelation: "info_drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_share_edges_parent_share_event_id_fkey"
            columns: ["parent_share_event_id"]
            isOneToOne: false
            referencedRelation: "share_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_share_edges_parent_user_id_fkey"
            columns: ["parent_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_share_edges_parent_user_id_fkey"
            columns: ["parent_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      info_drops: {
        Row: {
          ai_key_points: Json
          ai_summary: string | null
          block_order: string[] | null
          campaign_id: string | null
          category_key: string | null
          conversion_count: number | null
          created_at: string | null
          curator_note: string | null
          has_ad_disclosure: boolean
          id: string
          intent_id: string
          legal_flags: Json | null
          official_status: string
          owner_user_id: string
          partner_id: string | null
          published_at: string | null
          purpose: Database["public"]["Enums"]["drop_purpose"]
          reservation_data: Json | null
          share_count: number | null
          source_id: string | null
          status: Database["public"]["Enums"]["drop_status"]
          trust_label: Database["public"]["Enums"]["trust_label"]
          updated_at: string | null
          user_tags: string[] | null
          vertical_key: string | null
          view_count: number | null
        }
        Insert: {
          ai_key_points?: Json
          ai_summary?: string | null
          block_order?: string[] | null
          campaign_id?: string | null
          category_key?: string | null
          conversion_count?: number | null
          created_at?: string | null
          curator_note?: string | null
          has_ad_disclosure?: boolean
          id?: string
          intent_id: string
          legal_flags?: Json | null
          official_status?: string
          owner_user_id: string
          partner_id?: string | null
          published_at?: string | null
          purpose: Database["public"]["Enums"]["drop_purpose"]
          reservation_data?: Json | null
          share_count?: number | null
          source_id?: string | null
          status?: Database["public"]["Enums"]["drop_status"]
          trust_label?: Database["public"]["Enums"]["trust_label"]
          updated_at?: string | null
          user_tags?: string[] | null
          vertical_key?: string | null
          view_count?: number | null
        }
        Update: {
          ai_key_points?: Json
          ai_summary?: string | null
          block_order?: string[] | null
          campaign_id?: string | null
          category_key?: string | null
          conversion_count?: number | null
          created_at?: string | null
          curator_note?: string | null
          has_ad_disclosure?: boolean
          id?: string
          intent_id?: string
          legal_flags?: Json | null
          official_status?: string
          owner_user_id?: string
          partner_id?: string | null
          published_at?: string | null
          purpose?: Database["public"]["Enums"]["drop_purpose"]
          reservation_data?: Json | null
          share_count?: number | null
          source_id?: string | null
          status?: Database["public"]["Enums"]["drop_status"]
          trust_label?: Database["public"]["Enums"]["trust_label"]
          updated_at?: string | null
          user_tags?: string[] | null
          vertical_key?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "info_drops_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "drop_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "info_drops_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "intent_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "info_drops_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "info_drops_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "info_drops_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "info_drops_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "content_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      intent_automation_presets: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_active: boolean
          preset_key: string
          rule_ids: string[]
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          preset_key: string
          rule_ids?: string[]
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          preset_key?: string
          rule_ids?: string[]
        }
        Relationships: []
      }
      intent_rules: {
        Row: {
          action_config: Json
          action_type: string
          created_at: string
          id: string
          intent_id: string
          is_active: boolean
          priority: number
          rule_key: string
          trigger_condition: Json
          trigger_event: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          created_at?: string
          id?: string
          intent_id: string
          is_active?: boolean
          priority?: number
          rule_key: string
          trigger_condition?: Json
          trigger_event: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          created_at?: string
          id?: string
          intent_id?: string
          is_active?: boolean
          priority?: number
          rule_key?: string
          trigger_condition?: Json
          trigger_event?: string
        }
        Relationships: [
          {
            foreignKeyName: "intent_rules_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "intents"
            referencedColumns: ["id"]
          },
        ]
      }
      intent_templates: {
        Row: {
          created_at: string
          default_blocks: Json
          description: string | null
          display_name: string
          id: string
          intent_id: string
          is_active: boolean
          is_default: boolean
          template_key: string
          visual_config: Json
        }
        Insert: {
          created_at?: string
          default_blocks?: Json
          description?: string | null
          display_name: string
          id?: string
          intent_id: string
          is_active?: boolean
          is_default?: boolean
          template_key: string
          visual_config?: Json
        }
        Update: {
          created_at?: string
          default_blocks?: Json
          description?: string | null
          display_name?: string
          id?: string
          intent_id?: string
          is_active?: boolean
          is_default?: boolean
          template_key?: string
          visual_config?: Json
        }
        Relationships: [
          {
            foreignKeyName: "intent_templates_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "intents"
            referencedColumns: ["id"]
          },
        ]
      }
      intent_types: {
        Row: {
          allowed_blocks: string[] | null
          allowed_conversion_types: string[] | null
          created_at: string | null
          default_cta: Json | null
          default_required_blocks: string[] | null
          description: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          purpose: Database["public"]["Enums"]["drop_purpose"]
          requires_conversion: boolean
          requires_disclosure: boolean
          requires_partner: boolean
        }
        Insert: {
          allowed_blocks?: string[] | null
          allowed_conversion_types?: string[] | null
          created_at?: string | null
          default_cta?: Json | null
          default_required_blocks?: string[] | null
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          purpose: Database["public"]["Enums"]["drop_purpose"]
          requires_conversion?: boolean
          requires_disclosure?: boolean
          requires_partner?: boolean
        }
        Update: {
          allowed_blocks?: string[] | null
          allowed_conversion_types?: string[] | null
          created_at?: string | null
          default_cta?: Json | null
          default_required_blocks?: string[] | null
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          purpose?: Database["public"]["Enums"]["drop_purpose"]
          requires_conversion?: boolean
          requires_disclosure?: boolean
          requires_partner?: boolean
        }
        Relationships: []
      }
      intents: {
        Row: {
          automation_preset_key: string | null
          created_at: string
          description: string | null
          display_name: string
          drop_intent_code: string | null
          emoji_or_icon: string | null
          id: string
          intent_type_id: string
          is_active: boolean
          primary_cta_label: string | null
          requires_ad_disclosure: boolean
          requires_partner: boolean
          secondary_cta_label: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          automation_preset_key?: string | null
          created_at?: string
          description?: string | null
          display_name: string
          drop_intent_code?: string | null
          emoji_or_icon?: string | null
          id?: string
          intent_type_id: string
          is_active?: boolean
          primary_cta_label?: string | null
          requires_ad_disclosure?: boolean
          requires_partner?: boolean
          secondary_cta_label?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          automation_preset_key?: string | null
          created_at?: string
          description?: string | null
          display_name?: string
          drop_intent_code?: string | null
          emoji_or_icon?: string | null
          id?: string
          intent_type_id?: string
          is_active?: boolean
          primary_cta_label?: string | null
          requires_ad_disclosure?: boolean
          requires_partner?: boolean
          secondary_cta_label?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intents_drop_intent_code_fkey"
            columns: ["drop_intent_code"]
            isOneToOne: false
            referencedRelation: "drop_intents"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "intents_intent_type_id_fkey"
            columns: ["intent_type_id"]
            isOneToOne: false
            referencedRelation: "intent_types"
            referencedColumns: ["id"]
          },
        ]
      }
      lifecycle_events: {
        Row: {
          context: Json
          conversion_event_id: string | null
          created_at: string
          event_type: string
          id: string
          info_drop_id: string | null
          new_stage: Database["public"]["Enums"]["lifecycle_stage"] | null
          previous_stage: Database["public"]["Enums"]["lifecycle_stage"] | null
          share_event_id: string | null
          user_id: string | null
          visitor_id: string | null
        }
        Insert: {
          context?: Json
          conversion_event_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          info_drop_id?: string | null
          new_stage?: Database["public"]["Enums"]["lifecycle_stage"] | null
          previous_stage?: Database["public"]["Enums"]["lifecycle_stage"] | null
          share_event_id?: string | null
          user_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          context?: Json
          conversion_event_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          info_drop_id?: string | null
          new_stage?: Database["public"]["Enums"]["lifecycle_stage"] | null
          previous_stage?: Database["public"]["Enums"]["lifecycle_stage"] | null
          share_event_id?: string | null
          user_id?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lifecycle_events_conversion_event_id_fkey"
            columns: ["conversion_event_id"]
            isOneToOne: false
            referencedRelation: "conversion_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lifecycle_events_info_drop_id_fkey"
            columns: ["info_drop_id"]
            isOneToOne: false
            referencedRelation: "info_drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lifecycle_events_share_event_id_fkey"
            columns: ["share_event_id"]
            isOneToOne: false
            referencedRelation: "share_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lifecycle_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lifecycle_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lifecycle_events_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_staff: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          partner_id: string
          role: string
          staff_user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          partner_id: string
          role?: string
          staff_user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          partner_id?: string
          role?: string
          staff_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_staff_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_staff_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_staff_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          address: string | null
          business_no: string | null
          business_type: string | null
          contact_phone: string | null
          created_at: string | null
          display_name: string
          id: string
          lat: number | null
          lng: number | null
          metadata: Json | null
          operating_end: string | null
          operating_start: string | null
          owner_user_id: string
          partner_kind: Database["public"]["Enums"]["partner_kind"]
          rejection_reason: string | null
          reservation_url: string | null
          slot_duration_min: number | null
          slug: string | null
          updated_at: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          address?: string | null
          business_no?: string | null
          business_type?: string | null
          contact_phone?: string | null
          created_at?: string | null
          display_name: string
          id?: string
          lat?: number | null
          lng?: number | null
          metadata?: Json | null
          operating_end?: string | null
          operating_start?: string | null
          owner_user_id: string
          partner_kind: Database["public"]["Enums"]["partner_kind"]
          rejection_reason?: string | null
          reservation_url?: string | null
          slot_duration_min?: number | null
          slug?: string | null
          updated_at?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          address?: string | null
          business_no?: string | null
          business_type?: string | null
          contact_phone?: string | null
          created_at?: string | null
          display_name?: string
          id?: string
          lat?: number | null
          lng?: number | null
          metadata?: Json | null
          operating_end?: string | null
          operating_start?: string | null
          owner_user_id?: string
          partner_kind?: Database["public"]["Enums"]["partner_kind"]
          rejection_reason?: string | null
          reservation_url?: string | null
          slot_duration_min?: number | null
          slug?: string | null
          updated_at?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "partners_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partners_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_detections: {
        Row: {
          ai_generation_id: string | null
          brand_guess: string | null
          category: string | null
          confidence: string
          created_at: string | null
          drop_id: string
          evidence_text: string | null
          evidence_timestamp_sec: number | null
          id: string
          product_name_guess: string | null
          sort_order: number
          user_confirmed: boolean
        }
        Insert: {
          ai_generation_id?: string | null
          brand_guess?: string | null
          category?: string | null
          confidence?: string
          created_at?: string | null
          drop_id: string
          evidence_text?: string | null
          evidence_timestamp_sec?: number | null
          id?: string
          product_name_guess?: string | null
          sort_order?: number
          user_confirmed?: boolean
        }
        Update: {
          ai_generation_id?: string | null
          brand_guess?: string | null
          category?: string | null
          confidence?: string
          created_at?: string | null
          drop_id?: string
          evidence_text?: string | null
          evidence_timestamp_sec?: number | null
          id?: string
          product_name_guess?: string | null
          sort_order?: number
          user_confirmed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "product_detections_ai_generation_id_fkey"
            columns: ["ai_generation_id"]
            isOneToOne: false
            referencedRelation: "ai_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_detections_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "info_drops"
            referencedColumns: ["id"]
          },
        ]
      }
      product_offers: {
        Row: {
          affiliate_tag: string | null
          created_at: string | null
          currency: string
          delivery_days_max: number | null
          delivery_days_min: number | null
          detection_id: string
          estimated_tax: number | null
          estimated_total_price: number | null
          id: string
          last_checked_at: string | null
          platform: string | null
          price: number | null
          product_url: string | null
          seller_country: string
          seller_name: string
          shipping_fee: number | null
          status: string
        }
        Insert: {
          affiliate_tag?: string | null
          created_at?: string | null
          currency?: string
          delivery_days_max?: number | null
          delivery_days_min?: number | null
          detection_id: string
          estimated_tax?: number | null
          estimated_total_price?: number | null
          id?: string
          last_checked_at?: string | null
          platform?: string | null
          price?: number | null
          product_url?: string | null
          seller_country?: string
          seller_name: string
          shipping_fee?: number | null
          status?: string
        }
        Update: {
          affiliate_tag?: string | null
          created_at?: string | null
          currency?: string
          delivery_days_max?: number | null
          delivery_days_min?: number | null
          detection_id?: string
          estimated_tax?: number | null
          estimated_total_price?: number | null
          id?: string
          last_checked_at?: string | null
          platform?: string | null
          price?: number | null
          product_url?: string | null
          seller_country?: string
          seller_name?: string
          shipping_fee?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_offers_detection_id_fkey"
            columns: ["detection_id"]
            isOneToOne: false
            referencedRelation: "product_detections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_roles: Database["public"]["Enums"]["user_role"][] | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string
          is_phone_verified: boolean | null
          last_active_at: string | null
          marketing_consent_at: string | null
          pii_consent_at: string | null
          primary_role: Database["public"]["Enums"]["user_role"] | null
          username: string | null
        }
        Insert: {
          active_roles?: Database["public"]["Enums"]["user_role"][] | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          is_phone_verified?: boolean | null
          last_active_at?: string | null
          marketing_consent_at?: string | null
          pii_consent_at?: string | null
          primary_role?: Database["public"]["Enums"]["user_role"] | null
          username?: string | null
        }
        Update: {
          active_roles?: Database["public"]["Enums"]["user_role"][] | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_phone_verified?: boolean | null
          last_active_at?: string | null
          marketing_consent_at?: string | null
          pii_consent_at?: string | null
          primary_role?: Database["public"]["Enums"]["user_role"] | null
          username?: string | null
        }
        Relationships: []
      }
      reservation_contacts: {
        Row: {
          created_at: string
          id: string
          me_user_id: string | null
          me_verified_at: string | null
          phone_hash: string
          phone_last4: string
          requester_name: string
          reservation_id: string
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          me_user_id?: string | null
          me_verified_at?: string | null
          phone_hash: string
          phone_last4: string
          requester_name: string
          reservation_id: string
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          me_user_id?: string | null
          me_verified_at?: string | null
          phone_hash?: string
          phone_last4?: string
          requester_name?: string
          reservation_id?: string
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_contacts_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_contacts_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_notifications: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          id: string
          reservation_id: string
          sent_at: string | null
          status: string
          target_type: string
        }
        Insert: {
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          reservation_id: string
          sent_at?: string | null
          status?: string
          target_type: string
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          reservation_id?: string
          sent_at?: string | null
          status?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_notifications_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_slots: {
        Row: {
          calendar_mode: string
          created_at: string
          current_bookings: number
          drop_id: string
          id: string
          is_blocked: boolean
          max_capacity: number
          partner_id: string
          slot_date: string
          slot_time: string | null
          updated_at: string
        }
        Insert: {
          calendar_mode: string
          created_at?: string
          current_bookings?: number
          drop_id: string
          id?: string
          is_blocked?: boolean
          max_capacity?: number
          partner_id: string
          slot_date: string
          slot_time?: string | null
          updated_at?: string
        }
        Update: {
          calendar_mode?: string
          created_at?: string
          current_bookings?: number
          drop_id?: string
          id?: string
          is_blocked?: boolean
          max_capacity?: number
          partner_id?: string
          slot_date?: string
          slot_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_slots_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "info_drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_slots_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          calendar_mode: string
          check_in_date: string | null
          check_out_date: string | null
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          customer_message: string | null
          drop_id: string
          expires_at: string
          guest_count: number
          id: string
          partner_id: string
          partner_message: string | null
          reserved_date: string | null
          share_event_id: string | null
          status: string
          time_slot: string | null
          updated_at: string
          visitor_id: string | null
        }
        Insert: {
          calendar_mode: string
          check_in_date?: string | null
          check_out_date?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_message?: string | null
          drop_id: string
          expires_at?: string
          guest_count?: number
          id?: string
          partner_id: string
          partner_message?: string | null
          reserved_date?: string | null
          share_event_id?: string | null
          status?: string
          time_slot?: string | null
          updated_at?: string
          visitor_id?: string | null
        }
        Update: {
          calendar_mode?: string
          check_in_date?: string | null
          check_out_date?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_message?: string | null
          drop_id?: string
          expires_at?: string
          guest_count?: number
          id?: string
          partner_id?: string
          partner_message?: string | null
          reserved_date?: string | null
          share_event_id?: string | null
          status?: string
          time_slot?: string | null
          updated_at?: string
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "info_drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_share_event_id_fkey"
            columns: ["share_event_id"]
            isOneToOne: false
            referencedRelation: "share_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_ledger: {
        Row: {
          amount_krw: number
          conversion_event_id: string
          created_at: string | null
          id: string
          idempotency_key: string
          ledger_status: Database["public"]["Enums"]["ledger_status"]
          notes: string | null
          party: Database["public"]["Enums"]["reward_party"]
          party_user_id: string | null
          rate_applied: number
          reversal_of: string | null
          reward_form: Database["public"]["Enums"]["reward_form"]
          rule_item_id: string | null
        }
        Insert: {
          amount_krw: number
          conversion_event_id: string
          created_at?: string | null
          id?: string
          idempotency_key: string
          ledger_status?: Database["public"]["Enums"]["ledger_status"]
          notes?: string | null
          party: Database["public"]["Enums"]["reward_party"]
          party_user_id?: string | null
          rate_applied: number
          reversal_of?: string | null
          reward_form: Database["public"]["Enums"]["reward_form"]
          rule_item_id?: string | null
        }
        Update: {
          amount_krw?: number
          conversion_event_id?: string
          created_at?: string | null
          id?: string
          idempotency_key?: string
          ledger_status?: Database["public"]["Enums"]["ledger_status"]
          notes?: string | null
          party?: Database["public"]["Enums"]["reward_party"]
          party_user_id?: string | null
          rate_applied?: number
          reversal_of?: string | null
          reward_form?: Database["public"]["Enums"]["reward_form"]
          rule_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reward_ledger_conversion_event_id_fkey"
            columns: ["conversion_event_id"]
            isOneToOne: false
            referencedRelation: "conversion_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_ledger_party_user_id_fkey"
            columns: ["party_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_ledger_party_user_id_fkey"
            columns: ["party_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_ledger_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "reward_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_ledger_rule_item_id_fkey"
            columns: ["rule_item_id"]
            isOneToOne: false
            referencedRelation: "reward_rule_items"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_rule_items: {
        Row: {
          created_at: string | null
          id: string
          max_amount_krw: number | null
          min_amount_krw: number | null
          notes: string | null
          party: Database["public"]["Enums"]["reward_party"]
          rate: number
          reward_form: Database["public"]["Enums"]["reward_form"]
          reward_rule_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_amount_krw?: number | null
          min_amount_krw?: number | null
          notes?: string | null
          party: Database["public"]["Enums"]["reward_party"]
          rate: number
          reward_form: Database["public"]["Enums"]["reward_form"]
          reward_rule_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          max_amount_krw?: number | null
          min_amount_krw?: number | null
          notes?: string | null
          party?: Database["public"]["Enums"]["reward_party"]
          rate?: number
          reward_form?: Database["public"]["Enums"]["reward_form"]
          reward_rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_rule_items_reward_rule_id_fkey"
            columns: ["reward_rule_id"]
            isOneToOne: false
            referencedRelation: "reward_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_rules: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          effective_from: string | null
          effective_until: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_rules_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "drop_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_migrations: {
        Row: {
          applied_at: string | null
          notes: string | null
          version: string
        }
        Insert: {
          applied_at?: string | null
          notes?: string | null
          version: string
        }
        Update: {
          applied_at?: string | null
          notes?: string | null
          version?: string
        }
        Relationships: []
      }
      share_events: {
        Row: {
          campaign_id: string | null
          chain_depth: number
          chain_origin_user_id: string | null
          channel: Database["public"]["Enums"]["share_channel"]
          click_count: number | null
          conversion_count: number | null
          created_at: string | null
          curator_message: string | null
          device_hash: string | null
          dub_link_id: string | null
          dub_short_url: string | null
          expires_at: string | null
          fraud_decision: Database["public"]["Enums"]["fraud_decision_kind"]
          fraud_risk_score: number
          id: string
          info_drop_id: string
          ip_hash: string | null
          parent_share_event_id: string | null
          reshared_from_claim_id: string | null
          sender_user_id: string
          session_hash: string | null
          share_code: string | null
          share_uuid: string
          sharer_label: string | null
          sharer_type: string | null
          unique_clicker_count: number | null
          user_agent_hash: string | null
        }
        Insert: {
          campaign_id?: string | null
          chain_depth?: number
          chain_origin_user_id?: string | null
          channel?: Database["public"]["Enums"]["share_channel"]
          click_count?: number | null
          conversion_count?: number | null
          created_at?: string | null
          curator_message?: string | null
          device_hash?: string | null
          dub_link_id?: string | null
          dub_short_url?: string | null
          expires_at?: string | null
          fraud_decision?: Database["public"]["Enums"]["fraud_decision_kind"]
          fraud_risk_score?: number
          id?: string
          info_drop_id: string
          ip_hash?: string | null
          parent_share_event_id?: string | null
          reshared_from_claim_id?: string | null
          sender_user_id: string
          session_hash?: string | null
          share_code?: string | null
          share_uuid?: string
          sharer_label?: string | null
          sharer_type?: string | null
          unique_clicker_count?: number | null
          user_agent_hash?: string | null
        }
        Update: {
          campaign_id?: string | null
          chain_depth?: number
          chain_origin_user_id?: string | null
          channel?: Database["public"]["Enums"]["share_channel"]
          click_count?: number | null
          conversion_count?: number | null
          created_at?: string | null
          curator_message?: string | null
          device_hash?: string | null
          dub_link_id?: string | null
          dub_short_url?: string | null
          expires_at?: string | null
          fraud_decision?: Database["public"]["Enums"]["fraud_decision_kind"]
          fraud_risk_score?: number
          id?: string
          info_drop_id?: string
          ip_hash?: string | null
          parent_share_event_id?: string | null
          reshared_from_claim_id?: string | null
          sender_user_id?: string
          session_hash?: string | null
          share_code?: string | null
          share_uuid?: string
          sharer_label?: string | null
          sharer_type?: string | null
          unique_clicker_count?: number | null
          user_agent_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "share_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "drop_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_events_chain_origin_user_id_fkey"
            columns: ["chain_origin_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_events_chain_origin_user_id_fkey"
            columns: ["chain_origin_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_events_info_drop_id_fkey"
            columns: ["info_drop_id"]
            isOneToOne: false
            referencedRelation: "info_drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_events_parent_share_event_id_fkey"
            columns: ["parent_share_event_id"]
            isOneToOne: false
            referencedRelation: "share_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_events_reshared_from_claim_id_fkey"
            columns: ["reshared_from_claim_id"]
            isOneToOne: false
            referencedRelation: "coupon_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_events_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_events_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      url_metadata_cache: {
        Row: {
          author_name: string | null
          canonical_url: string
          created_at: string
          description: string | null
          duration_sec: number | null
          embed_html: string | null
          expires_at: string
          extraction_confidence: number | null
          extraction_errors: string[] | null
          extraction_method: string
          fetched_at: string
          hit_count: number
          id: string
          language: string | null
          last_accessed_at: string
          provider: Database["public"]["Enums"]["source_provider"]
          raw_meta: Json
          site_name: string | null
          source_id: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          author_name?: string | null
          canonical_url: string
          created_at?: string
          description?: string | null
          duration_sec?: number | null
          embed_html?: string | null
          expires_at: string
          extraction_confidence?: number | null
          extraction_errors?: string[] | null
          extraction_method?: string
          fetched_at?: string
          hit_count?: number
          id?: string
          language?: string | null
          last_accessed_at?: string
          provider: Database["public"]["Enums"]["source_provider"]
          raw_meta?: Json
          site_name?: string | null
          source_id?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_name?: string | null
          canonical_url?: string
          created_at?: string
          description?: string | null
          duration_sec?: number | null
          embed_html?: string | null
          expires_at?: string
          extraction_confidence?: number | null
          extraction_errors?: string[] | null
          extraction_method?: string
          fetched_at?: string
          hit_count?: number
          id?: string
          language?: string | null
          last_accessed_at?: string
          provider?: Database["public"]["Enums"]["source_provider"]
          raw_meta?: Json
          site_name?: string | null
          source_id?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_lifecycle_state: {
        Row: {
          current_stage: Database["public"]["Enums"]["lifecycle_stage"]
          first_seen_at: string
          last_active_at: string
          metadata: Json
          stage_entered_at: string
          total_advocacy: number
          total_advocate_krw: number
          total_chain_advocacy: number
          total_chain_advocate_krw: number
          total_chain_origin_points: number
          total_coupons_received: number
          total_cta_clicks: number
          total_redemptions: number
          total_reshares: number
          total_shares: number
          total_views: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_stage?: Database["public"]["Enums"]["lifecycle_stage"]
          first_seen_at?: string
          last_active_at?: string
          metadata?: Json
          stage_entered_at?: string
          total_advocacy?: number
          total_advocate_krw?: number
          total_chain_advocacy?: number
          total_chain_advocate_krw?: number
          total_chain_origin_points?: number
          total_coupons_received?: number
          total_cta_clicks?: number
          total_redemptions?: number
          total_reshares?: number
          total_shares?: number
          total_views?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_stage?: Database["public"]["Enums"]["lifecycle_stage"]
          first_seen_at?: string
          last_active_at?: string
          metadata?: Json
          stage_entered_at?: string
          total_advocacy?: number
          total_advocate_krw?: number
          total_chain_advocacy?: number
          total_chain_advocate_krw?: number
          total_chain_origin_points?: number
          total_coupons_received?: number
          total_cta_clicks?: number
          total_redemptions?: number
          total_reshares?: number
          total_shares?: number
          total_views?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_lifecycle_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_lifecycle_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_private_profiles: {
        Row: {
          created_at: string | null
          email_encrypted: string | null
          kakao_id: string | null
          payout_info_encrypted: Json | null
          phone_encrypted: string | null
          tax_id_encrypted: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_encrypted?: string | null
          kakao_id?: string | null
          payout_info_encrypted?: Json | null
          phone_encrypted?: string | null
          tax_id_encrypted?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_encrypted?: string | null
          kakao_id?: string | null
          payout_info_encrypted?: Json | null
          phone_encrypted?: string | null
          tax_id_encrypted?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_private_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_private_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      visitors: {
        Row: {
          anonymous_id: string
          created_at: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          anonymous_id: string
          created_at?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          anonymous_id?: string
          created_at?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_category_intent_map: {
        Row: {
          category_id: number
          category_name: string
          created_at: string
          intent_codes: string[]
          is_active: boolean
          notes: string | null
          updated_at: string
        }
        Insert: {
          category_id: number
          category_name: string
          created_at?: string
          intent_codes: string[]
          is_active?: boolean
          notes?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: number
          category_name?: string
          created_at?: string
          intent_codes?: string[]
          is_active?: boolean
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          display_name: string | null
          id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          id?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      approve_partner: { Args: { p_partner_id: string }; Returns: undefined }
      check_ai_quota: { Args: { p_user_id?: string }; Returns: Json }
      claim_coupon: {
        Args: {
          p_catcher_user_id: string
          p_coupon_id: string
          p_share_event_id: string
        }
        Returns: {
          claim_code: string
          claim_id: string
          expires_at: string
        }[]
      }
      claim_coupon_anon: {
        Args: {
          p_coupon_id: string
          p_phone: string
          p_visitor_anon_id: string
        }
        Returns: Json
      }
      compute_avatar_url_from_auth: { Args: { meta: Json }; Returns: string }
      compute_display_name_from_auth: {
        Args: { email_in: string; meta: Json }
        Returns: string
      }
      confirm_reservation: {
        Args: { p_partner_message: string; p_reservation_id: string }
        Returns: undefined
      }
      create_drop_v2: {
        Args: {
          p_blocks?: Json
          p_campaign_id?: string
          p_curator_message?: string
          p_intent_id: string
          p_source_id: string
        }
        Returns: Json
      }
      create_reservation_anon: {
        Args: {
          p_calendar_mode: string
          p_check_in_date: string
          p_check_out_date: string
          p_customer_message: string
          p_drop_id: string
          p_guest_count: number
          p_name: string
          p_phone_hash: string
          p_phone_last4: string
          p_reserved_date: string
          p_share_event_id: string
          p_time_slot: string
          p_visitor_id: string
        }
        Returns: string
      }
      distribute_rewards_safe: {
        Args: { p_conversion_event_id: string }
        Returns: {
          out_amount_krw: number
          out_ledger_id: string
          out_party: Database["public"]["Enums"]["reward_party"]
          out_reward_form: Database["public"]["Enums"]["reward_form"]
        }[]
      }
      generate_claim_code_v2: { Args: { p_length?: number }; Returns: string }
      get_available_slots: {
        Args: { p_date: string; p_drop_id: string }
        Returns: {
          available: boolean
          remaining: number
          slot_time: string
        }[]
      }
      get_drop_detail: { Args: { p_share_uuid: string }; Returns: Json }
      get_drop_results: { Args: { p_share_uuid: string }; Returns: Json }
      get_my_coupons: { Args: { p_status?: string }; Returns: Json }
      get_my_drops: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: Json
      }
      get_partner_dashboard: { Args: { p_partner_id: string }; Returns: Json }
      get_partner_reservations: {
        Args: { p_partner_id: string }
        Returns: {
          calendar_mode: string
          check_in_date: string
          check_out_date: string
          created_at: string
          customer_message: string
          customer_name: string
          drop_id: string
          guest_count: number
          phone_last4: string
          reservation_id: string
          reserved_date: string
          status: string
          time_slot: string
        }[]
      }
      get_store_by_slug: { Args: { p_slug: string }; Returns: Json }
      get_user_stats: { Args: never; Returns: Json }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      hash_phone: { Args: { p_phone: string }; Returns: string }
      increment_share_view: {
        Args: { p_share_event_id: string }
        Returns: undefined
      }
      is_active_partner_owner: { Args: { _user_id: string }; Returns: boolean }
      is_partner_staff: {
        Args: { _partner_id: string; _user_id: string }
        Returns: boolean
      }
      ld_create_share_edge_v3: {
        Args: {
          p_channel?: Database["public"]["Enums"]["share_channel"]
          p_cta_variant?: string
          p_custom_message?: string
          p_device_hash?: string
          p_emotion?: Database["public"]["Enums"]["share_emotion"]
          p_info_drop_id: string
          p_intent_code?: string
          p_ip_hash?: string
          p_parent_share_event_id?: string
          p_relationship_hint?: Database["public"]["Enums"]["share_relationship"]
          p_reshared_from_claim_id?: string
          p_sender_note?: string
          p_sender_user_id: string
          p_session_hash?: string
          p_template_id?: string
          p_trust_hint_score?: number
          p_urgency_score?: number
          p_user_agent_hash?: string
        }
        Returns: {
          chain_depth: number
          chain_origin_user_id: string
          share_context_id: string
          share_event_id: string
          share_uuid: string
        }[]
      }
      ld_rebuild_sender_reputation_v3: {
        Args: { p_sender_user_id: string }
        Returns: {
          avg_click_rate: number
          avg_conversion_rate: number
          avg_open_rate: number
          avg_reshare_rate: number
          calculation_version: string
          created_at: string
          last_calculated_at: string
          metadata: Json
          sender_user_id: string
          spam_report_count: number
          status: Database["public"]["Enums"]["sender_reputation_status"]
          suspicious_event_count: number
          total_clicked: number
          total_converted: number
          total_forked: number
          total_opened: number
          total_reshared: number
          total_sent: number
          trust_score: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "drop_sender_reputation"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_ai_generation: {
        Args: {
          p_cost_krw?: number
          p_drop_id?: string
          p_error_message?: string
          p_generation_type: string
          p_model?: string
          p_prompt?: string
          p_response?: Json
          p_source_id?: string
          p_status?: string
          p_tokens_used?: number
          p_user_id?: string
        }
        Returns: string
      }
      redeem_coupon: {
        Args: {
          p_amount_krw?: number
          p_claim_code: string
          p_staff_id: string
        }
        Returns: string
      }
      redeem_coupon_v2: {
        Args: {
          p_amount_krw?: number
          p_claim_code: string
          p_ip?: unknown
          p_staff_id: string
          p_user_agent?: string
        }
        Returns: string
      }
      reject_reservation: {
        Args: { p_reason: string; p_reservation_id: string }
        Returns: undefined
      }
      show_chain_graph: {
        Args: { p_share_uuid: string }
        Returns: {
          click_count: number
          depth: number
          parent_id: string
          sender_id: string
          share_id: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      simulate_distribution: {
        Args: { p_amount: number }
        Returns: {
          out_amount_krw: number
          out_party: Database["public"]["Enums"]["reward_party"]
          out_rate: number
          out_reward_form: Database["public"]["Enums"]["reward_form"]
        }[]
      }
      submit_consultation_lead: {
        Args: {
          p_adults?: number
          p_budget_range?: string
          p_children?: number
          p_desired_date?: string
          p_desired_time?: string
          p_drop_id: string
          p_lead_type: string
          p_message?: string
          p_name: string
          p_partner_id?: string
          p_phone: string
          p_privacy_agreed: boolean
        }
        Returns: string
      }
      suggest_intent_for_url: {
        Args: { p_category_id?: number; p_url: string }
        Returns: {
          intent_code: string
          matched_category_id: number
          matched_category_name: string
          rank: number
          source: string
        }[]
      }
      track_drop_event: {
        Args: {
          p_anonymous_id?: string
          p_context?: Json
          p_event_type: string
          p_info_drop_id?: string
        }
        Returns: string
      }
      update_lifecycle_stage: {
        Args: { p_new_event: string; p_user_id: string }
        Returns: Database["public"]["Enums"]["lifecycle_stage"]
      }
      upsert_visitor: {
        Args: { p_anonymous_id: string; p_metadata?: Json }
        Returns: string
      }
      url_metadata_cache_get: {
        Args: { p_canonical_url: string }
        Returns: {
          author_name: string | null
          canonical_url: string
          created_at: string
          description: string | null
          duration_sec: number | null
          embed_html: string | null
          expires_at: string
          extraction_confidence: number | null
          extraction_errors: string[] | null
          extraction_method: string
          fetched_at: string
          hit_count: number
          id: string
          language: string | null
          last_accessed_at: string
          provider: Database["public"]["Enums"]["source_provider"]
          raw_meta: Json
          site_name: string | null
          source_id: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "url_metadata_cache"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      block_kind:
        | "video"
        | "text"
        | "map"
        | "coupon"
        | "reservation"
        | "product"
        | "discuss"
        | "similar"
        | "campaign_info"
      campaign_status: "draft" | "active" | "paused" | "ended" | "cancelled"
      claim_status: "issued" | "used" | "expired" | "cancelled"
      conversion_type:
        | "coupon_use"
        | "reservation_confirm"
        | "sale_complete"
        | "ticket_purchase"
        | "ticket_checkin"
        | "lead_approved"
      drop_purpose: "정보" | "쿠폰" | "예약" | "구매" | "상담"
      drop_status:
        | "draft"
        | "pending_review"
        | "published"
        | "suspended"
        | "archived"
      fork_status_kind: "draft" | "active" | "archived" | "blocked"
      fraud_decision_kind: "allow" | "review" | "block"
      fraud_sensitivity_level: "low" | "medium" | "high"
      intent_category:
        | "local_commerce"
        | "commerce"
        | "community"
        | "public"
        | "content"
        | "custom"
      ledger_status: "pending" | "confirmed" | "paid" | "reversed" | "cancelled"
      lifecycle_stage:
        | "new_receiver"
        | "viewer"
        | "hot_viewer"
        | "cta_clicker"
        | "coupon_intent"
        | "reservation_intent"
        | "buyer"
        | "sharer"
        | "resharer"
        | "advocate"
        | "chain_advocate"
        | "lost"
        | "returned"
        | "remix_curator"
        | "trusted_advocate"
      partner_kind:
        | "store"
        | "campsite"
        | "brand"
        | "creator_owned"
        | "ticket_seller"
        | "campaign_org"
        | "other"
      reward_form: "cash" | "store_benefit" | "coupon" | "points"
      reward_party:
        | "creator"
        | "dropper"
        | "platform"
        | "reserve"
        | "chain_advocate"
        | "chain_origin"
      rights_status:
        | "unclaimed"
        | "pending_claim"
        | "verified"
        | "disputed"
        | "blocked"
      sender_reputation_status: "normal" | "watch" | "restricted" | "blocked"
      share_channel: "kakao" | "sms" | "instagram_dm" | "copy_link" | "other"
      share_emotion:
        | "warm"
        | "urgent"
        | "enthusiastic"
        | "casual"
        | "formal"
        | "gift"
        | "check_this"
      share_relationship:
        | "close_friend"
        | "family"
        | "professional"
        | "community"
        | "casual_acquaintance"
        | "unknown"
      source_mode: "creator_registered" | "partner_official" | "user_submitted"
      source_provider:
        | "youtube"
        | "instagram"
        | "tiktok"
        | "naver_clip"
        | "manual"
      trust_label:
        | "unofficial"
        | "ai_estimated"
        | "verified_creator"
        | "official_partner"
        | "official_famous"
      user_role:
        | "catcher"
        | "dropper"
        | "creator"
        | "partner_owner"
        | "famous"
        | "shopper"
        | "staff"
        | "admin"
      verification_status:
        | "pending"
        | "in_review"
        | "approved"
        | "rejected"
        | "revoked"
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
  public: {
    Enums: {
      block_kind: [
        "video",
        "text",
        "map",
        "coupon",
        "reservation",
        "product",
        "discuss",
        "similar",
        "campaign_info",
      ],
      campaign_status: ["draft", "active", "paused", "ended", "cancelled"],
      claim_status: ["issued", "used", "expired", "cancelled"],
      conversion_type: [
        "coupon_use",
        "reservation_confirm",
        "sale_complete",
        "ticket_purchase",
        "ticket_checkin",
        "lead_approved",
      ],
      drop_purpose: ["정보", "쿠폰", "예약", "구매", "상담"],
      drop_status: [
        "draft",
        "pending_review",
        "published",
        "suspended",
        "archived",
      ],
      fork_status_kind: ["draft", "active", "archived", "blocked"],
      fraud_decision_kind: ["allow", "review", "block"],
      fraud_sensitivity_level: ["low", "medium", "high"],
      intent_category: [
        "local_commerce",
        "commerce",
        "community",
        "public",
        "content",
        "custom",
      ],
      ledger_status: ["pending", "confirmed", "paid", "reversed", "cancelled"],
      lifecycle_stage: [
        "new_receiver",
        "viewer",
        "hot_viewer",
        "cta_clicker",
        "coupon_intent",
        "reservation_intent",
        "buyer",
        "sharer",
        "resharer",
        "advocate",
        "chain_advocate",
        "lost",
        "returned",
        "remix_curator",
        "trusted_advocate",
      ],
      partner_kind: [
        "store",
        "campsite",
        "brand",
        "creator_owned",
        "ticket_seller",
        "campaign_org",
        "other",
      ],
      reward_form: ["cash", "store_benefit", "coupon", "points"],
      reward_party: [
        "creator",
        "dropper",
        "platform",
        "reserve",
        "chain_advocate",
        "chain_origin",
      ],
      rights_status: [
        "unclaimed",
        "pending_claim",
        "verified",
        "disputed",
        "blocked",
      ],
      sender_reputation_status: ["normal", "watch", "restricted", "blocked"],
      share_channel: ["kakao", "sms", "instagram_dm", "copy_link", "other"],
      share_emotion: [
        "warm",
        "urgent",
        "enthusiastic",
        "casual",
        "formal",
        "gift",
        "check_this",
      ],
      share_relationship: [
        "close_friend",
        "family",
        "professional",
        "community",
        "casual_acquaintance",
        "unknown",
      ],
      source_mode: ["creator_registered", "partner_official", "user_submitted"],
      source_provider: [
        "youtube",
        "instagram",
        "tiktok",
        "naver_clip",
        "manual",
      ],
      trust_label: [
        "unofficial",
        "ai_estimated",
        "verified_creator",
        "official_partner",
        "official_famous",
      ],
      user_role: [
        "catcher",
        "dropper",
        "creator",
        "partner_owner",
        "famous",
        "shopper",
        "staff",
        "admin",
      ],
      verification_status: [
        "pending",
        "in_review",
        "approved",
        "rejected",
        "revoked",
      ],
    },
  },
} as const
