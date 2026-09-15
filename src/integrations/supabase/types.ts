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
      civic_submission_logs: {
        Row: {
          created_at: string
          detail: Json | null
          event: string
          id: string
          submission_id: string
        }
        Insert: {
          created_at?: string
          detail?: Json | null
          event: string
          id?: string
          submission_id: string
        }
        Update: {
          created_at?: string
          detail?: Json | null
          event?: string
          id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "civic_submission_logs_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "civic_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      civic_submissions: {
        Row: {
          attempts: number
          complaint_number: string | null
          created_at: string
          error_message: string | null
          id: string
          portal: Database["public"]["Enums"]["civic_portal"]
          report_id: string
          request_payload: Json
          response_payload: Json | null
          status: Database["public"]["Enums"]["civic_submission_status"]
          submitted_at: string | null
          tracking_url: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          complaint_number?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          portal: Database["public"]["Enums"]["civic_portal"]
          report_id: string
          request_payload?: Json
          response_payload?: Json | null
          status?: Database["public"]["Enums"]["civic_submission_status"]
          submitted_at?: string | null
          tracking_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          complaint_number?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          portal?: Database["public"]["Enums"]["civic_portal"]
          report_id?: string
          request_payload?: Json
          response_payload?: Json | null
          status?: Database["public"]["Enums"]["civic_submission_status"]
          submitted_at?: string | null
          tracking_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "civic_submissions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          alert_radius_m: number
          authority_alerts: boolean
          created_at: string
          hazard_proximity: boolean
          prediction_warnings: boolean
          repair_updates: boolean
          updated_at: string
          user_id: string
          vote_activity: boolean
          weekly_digest_email: boolean
        }
        Insert: {
          alert_radius_m?: number
          authority_alerts?: boolean
          created_at?: string
          hazard_proximity?: boolean
          prediction_warnings?: boolean
          repair_updates?: boolean
          updated_at?: string
          user_id: string
          vote_activity?: boolean
          weekly_digest_email?: boolean
        }
        Update: {
          alert_radius_m?: number
          authority_alerts?: boolean
          created_at?: string
          hazard_proximity?: boolean
          prediction_warnings?: boolean
          repair_updates?: boolean
          updated_at?: string
          user_id?: string
          vote_activity?: boolean
          weekly_digest_email?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          latitude: number | null
          location_label: string | null
          longitude: number | null
          read: boolean
          report_id: string | null
          reviewed: boolean
          severity: Database["public"]["Enums"]["severity_level"] | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          location_label?: string | null
          longitude?: number | null
          read?: boolean
          report_id?: string | null
          reviewed?: boolean
          severity?: Database["public"]["Enums"]["severity_level"] | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          location_label?: string | null
          longitude?: number | null
          read?: boolean
          report_id?: string | null
          reviewed?: boolean
          severity?: Database["public"]["Enums"]["severity_level"] | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      point_events: {
        Row: {
          created_at: string
          id: string
          points: number
          reason: string
          report_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points: number
          reason: string
          report_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: number
          reason?: string
          report_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_events_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
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
          city: string | null
          created_at: string
          full_name: string | null
          id: string
          last_report_on: string | null
          longest_streak: number
          onboarding_completed: boolean
          phone: string | null
          points: number
          region: string | null
          state: string | null
          streak_days: number
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          last_report_on?: string | null
          longest_streak?: number
          onboarding_completed?: boolean
          phone?: string | null
          points?: number
          region?: string | null
          state?: string | null
          streak_days?: number
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          last_report_on?: string | null
          longest_streak?: number
          onboarding_completed?: boolean
          phone?: string | null
          points?: number
          region?: string | null
          state?: string | null
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
          accident_count: number
          address: string | null
          ai_confidence: number
          ai_suggestion: string | null
          ai_summary: string | null
          bike_severity: Database["public"]["Enums"]["severity_level"] | null
          car_severity: Database["public"]["Enums"]["severity_level"] | null
          community_verified: boolean
          confidence: number
          created_at: string
          damage_types: Database["public"]["Enums"]["damage_type"][]
          district: string
          downvotes: number
          id: string
          is_flagged: boolean
          latitude: number
          longitude: number
          notes: string | null
          photos: string[]
          priority_score: number
          report_count: number
          severity: Database["public"]["Enums"]["severity_level"]
          status: Database["public"]["Enums"]["repair_status"]
          status_updated_at: string | null
          status_updated_by: string | null
          tags: string[]
          updated_at: string
          upvotes: number
          user_id: string
        }
        Insert: {
          accident_count?: number
          address?: string | null
          ai_confidence?: number
          ai_suggestion?: string | null
          ai_summary?: string | null
          bike_severity?: Database["public"]["Enums"]["severity_level"] | null
          car_severity?: Database["public"]["Enums"]["severity_level"] | null
          community_verified?: boolean
          confidence?: number
          created_at?: string
          damage_types?: Database["public"]["Enums"]["damage_type"][]
          district?: string
          downvotes?: number
          id?: string
          is_flagged?: boolean
          latitude: number
          longitude: number
          notes?: string | null
          photos?: string[]
          priority_score?: number
          report_count?: number
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["repair_status"]
          status_updated_at?: string | null
          status_updated_by?: string | null
          tags?: string[]
          updated_at?: string
          upvotes?: number
          user_id: string
        }
        Update: {
          accident_count?: number
          address?: string | null
          ai_confidence?: number
          ai_suggestion?: string | null
          ai_summary?: string | null
          bike_severity?: Database["public"]["Enums"]["severity_level"] | null
          car_severity?: Database["public"]["Enums"]["severity_level"] | null
          community_verified?: boolean
          confidence?: number
          created_at?: string
          damage_types?: Database["public"]["Enums"]["damage_type"][]
          district?: string
          downvotes?: number
          id?: string
          is_flagged?: boolean
          latitude?: number
          longitude?: number
          notes?: string | null
          photos?: string[]
          priority_score?: number
          report_count?: number
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["repair_status"]
          status_updated_at?: string | null
          status_updated_by?: string | null
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
      user_badges: {
        Row: {
          badge_key: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_key: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_key?: string
          earned_at?: string
          id?: string
          user_id?: string
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
      award_points: {
        Args: {
          _points: number
          _reason: string
          _report_id?: string
          _user_id: string
        }
        Returns: undefined
      }
      evaluate_badges: { Args: { _user_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      leaderboard: {
        Args: { _limit?: number; _scope?: string }
        Returns: {
          avatar_url: string
          city: string
          full_name: string
          points: number
          rank: number
          report_count: number
          state: string
          streak_days: number
          user_id: string
          username: string
          weekly_points: number
        }[]
      }
      username_available: { Args: { _username: string }; Returns: boolean }
      vote_weight: { Args: { _user_id: string }; Returns: number }
    }
    Enums: {
      app_role: "citizen" | "authority" | "admin"
      authority_request_status: "pending" | "approved" | "rejected"
      civic_portal:
        | "everything_civic"
        | "lucknow_smart_city"
        | "lucknow_nagar_nigam"
      civic_submission_status:
        | "queued"
        | "submitting"
        | "submitted"
        | "failed"
        | "manual_required"
      damage_type:
        | "pothole"
        | "crack"
        | "waterlogging"
        | "landslide"
        | "drainage"
        | "bridge_damage"
        | "streetlight_failure"
        | "guardrail_damage"
      notification_type:
        | "hazard"
        | "authority"
        | "repair"
        | "prediction"
        | "community"
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
      civic_portal: [
        "everything_civic",
        "lucknow_smart_city",
        "lucknow_nagar_nigam",
      ],
      civic_submission_status: [
        "queued",
        "submitting",
        "submitted",
        "failed",
        "manual_required",
      ],
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
      notification_type: [
        "hazard",
        "authority",
        "repair",
        "prediction",
        "community",
      ],
      repair_status: ["pending", "in_progress", "resolved"],
      risk_level: ["low", "moderate", "high", "critical"],
      severity_level: ["minor", "moderate", "critical"],
    },
  },
} as const
