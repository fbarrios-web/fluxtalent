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
      activity_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          org_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          org_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          org_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      application_events: {
        Row: {
          actor_id: string | null
          application_id: string
          created_at: string
          id: string
          payload: Json | null
          type: string
        }
        Insert: {
          actor_id?: string | null
          application_id: string
          created_at?: string
          id?: string
          payload?: Json | null
          type: string
        }
        Update: {
          actor_id?: string | null
          application_id?: string
          created_at?: string
          id?: string
          payload?: Json | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          ai_attempts: number
          ai_last_error: string | null
          ai_next_attempt_at: string | null
          ai_status: string | null
          ai_summary: string | null
          created_at: string
          cv_text: string | null
          cv_url: string | null
          email: string
          first_name: string
          gaps: string[] | null
          id: string
          last_name: string
          linkedin: string | null
          match_breakdown: Json | null
          match_score: number | null
          org_id: string
          parsed_data: Json | null
          phone: string | null
          red_flags: string[] | null
          screening_answers: Json | null
          source: string | null
          stage: Database["public"]["Enums"]["pipeline_stage"]
          strengths: string[] | null
          updated_at: string
          vacancy_id: string
        }
        Insert: {
          ai_attempts?: number
          ai_last_error?: string | null
          ai_next_attempt_at?: string | null
          ai_status?: string | null
          ai_summary?: string | null
          created_at?: string
          cv_text?: string | null
          cv_url?: string | null
          email: string
          first_name: string
          gaps?: string[] | null
          id?: string
          last_name: string
          linkedin?: string | null
          match_breakdown?: Json | null
          match_score?: number | null
          org_id: string
          parsed_data?: Json | null
          phone?: string | null
          red_flags?: string[] | null
          screening_answers?: Json | null
          source?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          strengths?: string[] | null
          updated_at?: string
          vacancy_id: string
        }
        Update: {
          ai_attempts?: number
          ai_last_error?: string | null
          ai_next_attempt_at?: string | null
          ai_status?: string | null
          ai_summary?: string | null
          created_at?: string
          cv_text?: string | null
          cv_url?: string | null
          email?: string
          first_name?: string
          gaps?: string[] | null
          id?: string
          last_name?: string
          linkedin?: string | null
          match_breakdown?: Json | null
          match_score?: number | null
          org_id?: string
          parsed_data?: Json | null
          phone?: string | null
          red_flags?: string[] | null
          screening_answers?: Json | null
          source?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          strengths?: string[] | null
          updated_at?: string
          vacancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_vacancy_id_fkey"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "vacancies"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_rules: {
        Row: {
          created_at: string
          effective_from: string | null
          effective_until: string | null
          end_time: string
          id: string
          org_id: string
          stage: string
          start_time: string
          vacancy_id: string
          weekday: number
        }
        Insert: {
          created_at?: string
          effective_from?: string | null
          effective_until?: string | null
          end_time: string
          id?: string
          org_id: string
          stage?: string
          start_time: string
          vacancy_id: string
          weekday: number
        }
        Update: {
          created_at?: string
          effective_from?: string | null
          effective_until?: string | null
          end_time?: string
          id?: string
          org_id?: string
          stage?: string
          start_time?: string
          vacancy_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_rules_vacancy_id_fkey"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "vacancies"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_slots: {
        Row: {
          created_at: string
          end_at: string
          id: string
          org_id: string
          source: string
          stage: string
          start_at: string
          status: string
          vacancy_id: string
        }
        Insert: {
          created_at?: string
          end_at: string
          id?: string
          org_id: string
          source?: string
          stage?: string
          start_at: string
          status?: string
          vacancy_id: string
        }
        Update: {
          created_at?: string
          end_at?: string
          id?: string
          org_id?: string
          source?: string
          stage?: string
          start_at?: string
          status?: string
          vacancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_slots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_slots_vacancy_id_fkey"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "vacancies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          id: string
          key: string
          org_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          id?: string
          key: string
          org_id: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          id?: string
          key?: string
          org_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      interview_bookings: {
        Row: {
          application_id: string
          booking_token: string
          created_at: string
          duration_minutes: number | null
          google_event_id: string | null
          id: string
          meet_link: string | null
          org_id: string
          recruiter_id: string | null
          scheduled_at: string | null
          slot_id: string | null
          stage: string
          status: string
          updated_at: string
          vacancy_id: string
        }
        Insert: {
          application_id: string
          booking_token?: string
          created_at?: string
          duration_minutes?: number | null
          google_event_id?: string | null
          id?: string
          meet_link?: string | null
          org_id: string
          recruiter_id?: string | null
          scheduled_at?: string | null
          slot_id?: string | null
          stage: string
          status?: string
          updated_at?: string
          vacancy_id: string
        }
        Update: {
          application_id?: string
          booking_token?: string
          created_at?: string
          duration_minutes?: number | null
          google_event_id?: string | null
          id?: string
          meet_link?: string | null
          org_id?: string
          recruiter_id?: string | null
          scheduled_at?: string | null
          slot_id?: string | null
          stage?: string
          status?: string
          updated_at?: string
          vacancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_bookings_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_bookings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "availability_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_bookings_vacancy_id_fkey"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "vacancies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_requests: {
        Row: {
          address: string | null
          amount_ars: number | null
          business_name: string
          created_at: string
          cuit_or_dni: string
          email: string
          id: string
          invoice_type: string
          notes: string | null
          org_id: string
          phone: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          amount_ars?: number | null
          business_name: string
          created_at?: string
          cuit_or_dni: string
          email: string
          id?: string
          invoice_type?: string
          notes?: string | null
          org_id: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          amount_ars?: number | null
          business_name?: string
          created_at?: string
          cuit_or_dni?: string
          email?: string
          id?: string
          invoice_type?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          archived_at: string | null
          brand_color: string | null
          consultancy_name: string | null
          contact_email: string | null
          created_at: string
          current_period_end: string | null
          id: string
          is_unlimited: boolean
          last_payment_at: string | null
          logo_url: string | null
          mp_preapproval_id: string | null
          name: string
          paddle_customer_id: string | null
          paddle_subscription_id: string | null
          parent_org_id: string | null
          plan_currency: string
          plan_price_ars: number
          sender_email: string | null
          signature_html: string | null
          signature_image_url: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          timezone: string
          trial_ends_at: string
        }
        Insert: {
          archived_at?: string | null
          brand_color?: string | null
          consultancy_name?: string | null
          contact_email?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          is_unlimited?: boolean
          last_payment_at?: string | null
          logo_url?: string | null
          mp_preapproval_id?: string | null
          name: string
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          parent_org_id?: string | null
          plan_currency?: string
          plan_price_ars?: number
          sender_email?: string | null
          signature_html?: string | null
          signature_image_url?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          timezone?: string
          trial_ends_at?: string
        }
        Update: {
          archived_at?: string | null
          brand_color?: string | null
          consultancy_name?: string | null
          contact_email?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          is_unlimited?: boolean
          last_payment_at?: string | null
          logo_url?: string | null
          mp_preapproval_id?: string | null
          name?: string
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          parent_org_id?: string | null
          plan_currency?: string
          plan_price_ars?: number
          sender_email?: string | null
          signature_html?: string | null
          signature_image_url?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          timezone?: string
          trial_ends_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_parent_org_id_fkey"
            columns: ["parent_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_ars: number
          created_at: string
          currency: string
          id: string
          org_id: string
          paid_at: string | null
          provider: string
          provider_payment_id: string | null
          raw: Json | null
          status: string
        }
        Insert: {
          amount_ars: number
          created_at?: string
          currency?: string
          id?: string
          org_id: string
          paid_at?: string | null
          provider?: string
          provider_payment_id?: string | null
          raw?: Json | null
          status: string
        }
        Update: {
          amount_ars?: number
          created_at?: string
          currency?: string
          id?: string
          org_id?: string
          paid_at?: string | null
          provider?: string
          provider_payment_id?: string | null
          raw?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_pricing: {
        Row: {
          base_price_ars: number
          discount_pct: number
          plan_id: string
          updated_at: string
        }
        Insert: {
          base_price_ars: number
          discount_pct?: number
          plan_id: string
          updated_at?: string
        }
        Update: {
          base_price_ars?: number
          discount_pct?: number
          plan_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          country: string | null
          created_at: string
          display_name: string | null
          dni: string | null
          full_name: string | null
          google_connected_at: string | null
          google_email: string | null
          google_refresh_token: string | null
          id: string
          microsoft_connected_at: string | null
          microsoft_email: string | null
          microsoft_refresh_token: string | null
          org_id: string | null
          province: string | null
          setup_completed_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          dni?: string | null
          full_name?: string | null
          google_connected_at?: string | null
          google_email?: string | null
          google_refresh_token?: string | null
          id: string
          microsoft_connected_at?: string | null
          microsoft_email?: string | null
          microsoft_refresh_token?: string | null
          org_id?: string | null
          province?: string | null
          setup_completed_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          dni?: string | null
          full_name?: string | null
          google_connected_at?: string | null
          google_email?: string | null
          google_refresh_token?: string | null
          id?: string
          microsoft_connected_at?: string | null
          microsoft_email?: string | null
          microsoft_refresh_token?: string | null
          org_id?: string | null
          province?: string | null
          setup_completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      satisfaction_surveys: {
        Row: {
          bucket: number
          comments: string | null
          created_at: string
          id: string
          nps: number
          org_id: string | null
          user_id: string
        }
        Insert: {
          bucket: number
          comments?: string | null
          created_at?: string
          id?: string
          nps: number
          org_id?: string | null
          user_id: string
        }
        Update: {
          bucket?: number
          comments?: string | null
          created_at?: string
          id?: string
          nps?: number
          org_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "satisfaction_surveys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scorecards: {
        Row: {
          application_id: string
          created_at: string
          id: string
          interviewer_id: string | null
          notes: string | null
          overall: number | null
          ratings: Json
          recommendation: string | null
          stage: Database["public"]["Enums"]["pipeline_stage"]
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          interviewer_id?: string | null
          notes?: string | null
          overall?: number | null
          ratings: Json
          recommendation?: string | null
          stage: Database["public"]["Enums"]["pipeline_stage"]
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          interviewer_id?: string | null
          notes?: string | null
          overall?: number | null
          ratings?: Json
          recommendation?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "scorecards_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_questions: {
        Row: {
          id: string
          options: Json
          position: number
          qtype: string
          question: string
          required: boolean
          vacancy_id: string
        }
        Insert: {
          id?: string
          options?: Json
          position?: number
          qtype?: string
          question: string
          required?: boolean
          vacancy_id: string
        }
        Update: {
          id?: string
          options?: Json
          position?: number
          qtype?: string
          question?: string
          required?: boolean
          vacancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "screening_questions_vacancy_id_fkey"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "vacancies"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          org_id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          org_id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          org_id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vacancies: {
        Row: {
          area: string | null
          competencies: string[] | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          location: string | null
          min_match: number
          modality: Database["public"]["Enums"]["modality"] | null
          nice_to_have: string | null
          org_id: string
          public_slug: string
          requirements: string | null
          responsibilities: string | null
          seniority: Database["public"]["Enums"]["seniority"] | null
          status: Database["public"]["Enums"]["vacancy_status"]
          title: string
          updated_at: string
          work_schedule: string | null
        }
        Insert: {
          area?: string | null
          competencies?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          min_match?: number
          modality?: Database["public"]["Enums"]["modality"] | null
          nice_to_have?: string | null
          org_id: string
          public_slug?: string
          requirements?: string | null
          responsibilities?: string | null
          seniority?: Database["public"]["Enums"]["seniority"] | null
          status?: Database["public"]["Enums"]["vacancy_status"]
          title: string
          updated_at?: string
          work_schedule?: string | null
        }
        Update: {
          area?: string | null
          competencies?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          min_match?: number
          modality?: Database["public"]["Enums"]["modality"] | null
          nice_to_have?: string | null
          org_id?: string
          public_slug?: string
          requirements?: string | null
          responsibilities?: string | null
          seniority?: Database["public"]["Enums"]["seniority"] | null
          status?: Database["public"]["Enums"]["vacancy_status"]
          title?: string
          updated_at?: string
          work_schedule?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vacancies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vacancy_assignees: {
        Row: {
          created_at: string
          id: string
          user_id: string
          vacancy_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          vacancy_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          vacancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacancy_assignees_vacancy_id_fkey"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "vacancies"
            referencedColumns: ["id"]
          },
        ]
      }
      vacancy_scheduling: {
        Row: {
          created_at: string
          duration_minutes: number
          enabled: boolean
          extra_invitees: Json
          instructions: string | null
          interviewer_email: string | null
          org_id: string
          recruiter_id: string
          stage: string
          updated_at: string
          vacancy_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          enabled?: boolean
          extra_invitees?: Json
          instructions?: string | null
          interviewer_email?: string | null
          org_id: string
          recruiter_id: string
          stage?: string
          updated_at?: string
          vacancy_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          enabled?: boolean
          extra_invitees?: Json
          instructions?: string | null
          interviewer_email?: string | null
          org_id?: string
          recruiter_id?: string
          stage?: string
          updated_at?: string
          vacancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacancy_scheduling_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacancy_scheduling_vacancy_id_fkey"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "vacancies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_org: { Args: { _org_id: string }; Returns: undefined }
      claim_pending_ai_analyses: {
        Args: { _limit?: number; _stale_seconds?: number }
        Returns: {
          application_id: string
        }[]
      }
      current_org_id: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_booking_by_token: { Args: { _token: string }; Returns: Json }
      get_public_vacancy_by_slug: {
        Args: { _slug: string }
        Returns: {
          area: string
          description: string
          id: string
          location: string
          modality: string
          nice_to_have: string
          org_id: string
          org_name: string
          requirements: string
          responsibilities: string
          screening_questions: Json
          seniority: string
          status: string
          title: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      identity_exists: {
        Args: { _birth_date: string; _dni: string; _full_name: string }
        Returns: boolean
      }
      is_subscription_active: { Args: { _org_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      reserve_slot: {
        Args: { _slot_id: string; _token: string }
        Returns: Json
      }
      root_org_id: { Args: { _org_id: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "recruiter"
      modality: "remote" | "hybrid" | "onsite"
      pipeline_stage:
        | "received"
        | "shortlisted"
        | "interview_1"
        | "interview_2"
        | "interview_3"
        | "offer"
        | "hired"
        | "rejected"
      seniority:
        | "intern"
        | "junior"
        | "mid"
        | "senior"
        | "lead"
        | "manager"
        | "director"
      subscription_status: "trialing" | "active" | "past_due" | "canceled"
      vacancy_status: "draft" | "active" | "paused" | "closed"
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
      app_role: ["admin", "recruiter"],
      modality: ["remote", "hybrid", "onsite"],
      pipeline_stage: [
        "received",
        "shortlisted",
        "interview_1",
        "interview_2",
        "interview_3",
        "offer",
        "hired",
        "rejected",
      ],
      seniority: [
        "intern",
        "junior",
        "mid",
        "senior",
        "lead",
        "manager",
        "director",
      ],
      subscription_status: ["trialing", "active", "past_due", "canceled"],
      vacancy_status: ["draft", "active", "paused", "closed"],
    },
  },
} as const
