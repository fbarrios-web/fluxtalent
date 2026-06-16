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
      organizations: {
        Row: {
          brand_color: string | null
          created_at: string
          current_period_end: string | null
          id: string
          last_payment_at: string | null
          logo_url: string | null
          mp_preapproval_id: string | null
          name: string
          plan_price_ars: number
          sender_email: string | null
          signature_html: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string
        }
        Insert: {
          brand_color?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          last_payment_at?: string | null
          logo_url?: string | null
          mp_preapproval_id?: string | null
          name: string
          plan_price_ars?: number
          sender_email?: string | null
          signature_html?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string
        }
        Update: {
          brand_color?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          last_payment_at?: string | null
          logo_url?: string | null
          mp_preapproval_id?: string | null
          name?: string
          plan_price_ars?: number
          sender_email?: string | null
          signature_html?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_ars: number
          created_at: string
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          org_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          org_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          org_id?: string | null
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
          position: number
          question: string
          required: boolean
          vacancy_id: string
        }
        Insert: {
          id?: string
          position?: number
          question: string
          required?: boolean
          vacancy_id: string
        }
        Update: {
          id?: string
          position?: number
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
        }
        Insert: {
          area?: string | null
          competencies?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
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
        }
        Update: {
          area?: string | null
          competencies?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_org_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_subscription_active: { Args: { _org_id: string }; Returns: boolean }
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
