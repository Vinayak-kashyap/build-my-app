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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      authority_requests: {
        Row: {
          created_at: string
          credential_path: string | null
          id: string
          jurisdiction: string | null
          organization: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["authority_request_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          credential_path?: string | null
          id?: string
          jurisdiction?: string | null
          organization?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["authority_request_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          credential_path?: string | null
          id?: string
          jurisdiction?: string | null
          organization?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["authority_request_status"]
          user_id?: string
        }
        Relationships: []
      }
      prediction_digests: {
        Row: {
          created_at: string
          headline: string
          id: string
          narrative: string
          period: string
          region: string | null
          top_roads: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          headline: string
          id?: string
          narrative: string
          period?: string
          region?: string | null
          top_roads?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          headline?: string
          id?: string
          narrative?: string
          period?: string
          region?: string | null
          top_roads?: Json
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          onboarding_completed: boolean
          points: number
          region: string | null
          streak_days: number
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          onboarding_completed?: boolean
          points?: number
          region?: string | null
          streak_days?: number
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean
          points?: number
          region?: string | null
          streak_days?: number
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      report_votes: {
        Row: {
          created_at: string
          id: string
          report_id: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          report_id: string
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          report_id?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_votes_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          address: string | null
          ai_suggestion: string | null
          ai_summary: string | null
          community_verified: boolean
          confidence: number
          created_at: string
          damage_types: Database["public"]["Enums"]["damage_type"][]
          downvotes: number
          id: string
          is_flagged: boolean
          latitude: number
          longitude: number
          notes: string | null
          photos: string[]
          report_count: number
          severity: Database["public"]["Enums"]["severity_level"]
          status: Database["public"]["Enums"]["repair_status"]
          tags: string[]
          updated_at: string
          upvotes: number
          user_id: string
        }
        Insert: {
          address?: string | null
          ai_suggestion?: string | null
          ai_summary?: string | null
          community_verified?: boolean
          confidence?: number
          created_at?: string
          damage_types?: Database["public"]["Enums"]["damage_type"][]
          downvotes?: number
          id?: string
          is_flagged?: boolean
          latitude: number
          longitude: number
          notes?: string | null
          photos?: string[]
          report_count?: number
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["repair_status"]
          tags?: string[]
          updated_at?: string
          upvotes?: number
          user_id: string
        }
        Update: {
          address?: string | null
          ai_suggestion?: string | null
          ai_summary?: string | null
          community_verified?: boolean
          confidence?: number
          created_at?: string
          damage_types?: Database["public"]["Enums"]["damage_type"][]
          downvotes?: number
          id?: string
          is_flagged?: boolean
          latitude?: number
          longitude?: number
          notes?: string | null
          photos?: string[]
          report_count?: number
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["repair_status"]
          tags?: string[]
          updated_at?: string
          upvotes?: number
          user_id?: string
        }
        Relationships: []
      }
      road_predictions: {
        Row: {
          address: string | null
          avg_temp_c: number | null
          created_at: string
          expires_at: string
          id: string
          latitude: number
          longitude: number
          predicted_damage: string | null
          rainfall_mm: number | null
          rationale: string | null
          report_count: number
          risk_level: Database["public"]["Enums"]["risk_level"]
          risk_score: number
          updated_at: string
          weather_summary: string | null
          window_days: number
        }
        Insert: {
          address?: string | null
          avg_temp_c?: number | null
          created_at?: string
          expires_at?: string
          id?: string
          latitude: number
          longitude: number
          predicted_damage?: string | null
          rainfall_mm?: number | null
          rationale?: string | null
          report_count?: number
          risk_level?: Database["public"]["Enums"]["risk_level"]
          risk_score?: number
          updated_at?: string
          weather_summary?: string | null
          window_days?: number
        }
        Update: {
          address?: string | null
          avg_temp_c?: number | null
          created_at?: string
          expires_at?: string
          id?: string
          latitude?: number
          longitude?: number
          predicted_damage?: string | null
          rainfall_mm?: number | null
          rationale?: string | null
          report_count?: number
          risk_level?: Database["public"]["Enums"]["risk_level"]
          risk_score?: number
          updated_at?: string
          weather_summary?: string | null
          window_days?: number
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "citizen" | "authority" | "admin"
      authority_request_status: "pending" | "approved" | "rejected"
      damage_type:
        | "pothole"
        | "crack"
        | "waterlogging"
        | "landslide"
        | "drainage"
        | "bridge_damage"
        | "streetlight_failure"
        | "guardrail_damage"
      repair_status: "pending" | "in_progress" | "resolved"
      risk_level: "low" | "moderate" | "high" | "critical"
      severity_level: "minor" | "moderate" | "critical"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["citizen", "authority", "admin"],
      authority_request_status: ["pending", "approved", "rejected"],
      damage_type: [
        "pothole",
        "crack",
        "waterlogging",
        "landslide",
        "drainage",
        "bridge_damage",
        "streetlight_failure",
        "guardrail_damage",
      ],
      repair_status: ["pending", "in_progress", "resolved"],
      risk_level: ["low", "moderate", "high", "critical"],
      severity_level: ["minor", "moderate", "critical"],
    },
  },
} as const
