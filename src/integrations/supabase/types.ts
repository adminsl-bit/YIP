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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      assessment_locks: {
        Row: {
          id: string
          is_global_lock: boolean
          locked_at: string
          locked_by: string
          reason: string | null
        }
        Insert: {
          id?: string
          is_global_lock?: boolean
          locked_at?: string
          locked_by: string
          reason?: string | null
        }
        Update: {
          id?: string
          is_global_lock?: boolean
          locked_at?: string
          locked_by?: string
          reason?: string | null
        }
        Relationships: []
      }
      assessments: {
        Row: {
          created_at: string
          id: string
          jury_id: string
          notes: string | null
          scores: Json
          seat_role: string
          status: string
          student_id: string
          submitted_at: string | null
          total_score: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          jury_id: string
          notes?: string | null
          scores?: Json
          seat_role: string
          status?: string
          student_id: string
          submitted_at?: string | null
          total_score?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          jury_id?: string
          notes?: string | null
          scores?: Json
          seat_role?: string
          status?: string
          student_id?: string
          submitted_at?: string | null
          total_score?: number
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      award_votes: {
        Row: {
          award_id: string
          created_at: string
          id: string
          jury_id: string
          student_id: string
        }
        Insert: {
          award_id: string
          created_at?: string
          id?: string
          jury_id: string
          student_id: string
        }
        Update: {
          award_id?: string
          created_at?: string
          id?: string
          jury_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "award_votes_award_id_fkey"
            columns: ["award_id"]
            isOneToOne: false
            referencedRelation: "awards"
            referencedColumns: ["id"]
          },
        ]
      }
      awards: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      login_audit: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          is_duplicate_session: boolean | null
          login_attempt_at: string
          previous_session_id: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          is_duplicate_session?: boolean | null
          login_attempt_at?: string
          previous_session_id?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          is_duplicate_session?: boolean | null
          login_attempt_at?: string
          previous_session_id?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_id: string
          poll_id: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          poll_id: string
          voter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          poll_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          options: Json
          show_results_publicly: boolean
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          options?: Json
          show_results_publicly?: boolean
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          options?: Json
          show_results_publicly?: boolean
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          city: string | null
          constituency: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          last_login_at: string | null
          name: string
          party_number: number
          photo_url: string | null
          position: string
          serial_number: number
          session_id: string | null
          state: string | null
          updated_at: string
          user_id: string
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Insert: {
          city?: string | null
          constituency?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          name: string
          party_number: number
          photo_url?: string | null
          position: string
          serial_number: number
          session_id?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Update: {
          city?: string | null
          constituency?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          name?: string
          party_number?: number
          photo_url?: string | null
          position?: string
          serial_number?: number
          session_id?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Relationships: []
      }
      student_awards: {
        Row: {
          assigned_at: string
          assigned_by_jury_consensus: boolean
          award_id: string
          id: string
          student_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by_jury_consensus?: boolean
          award_id: string
          id?: string
          student_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by_jury_consensus?: boolean
          award_id?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_awards_award_id_fkey"
            columns: ["award_id"]
            isOneToOne: false
            referencedRelation: "awards"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string
        }
        Insert: {
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
          updated_by: string
        }
        Update: {
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      timer_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          duration_seconds: number
          id: string
          remaining_seconds: number
          started_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          duration_seconds?: number
          id?: string
          remaining_seconds: number
          started_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          duration_seconds?: number
          id?: string
          remaining_seconds?: number
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      votes: {
        Row: {
          created_at: string
          id: string
          vote_choice: string
          voter_id: string
          voting_session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          vote_choice: string
          voter_id: string
          voting_session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          vote_choice?: string
          voter_id?: string
          voting_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_voting_session_id_fkey"
            columns: ["voting_session_id"]
            isOneToOne: false
            referencedRelation: "voting_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      voting_sessions: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_time: string | null
          id: string
          is_active: boolean
          start_time: string | null
          title: string
          updated_at: string
          vote_type: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_time?: string | null
          id?: string
          is_active?: boolean
          start_time?: string | null
          title: string
          updated_at?: string
          vote_type: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_time?: string | null
          id?: string
          is_active?: boolean
          start_time?: string | null
          title?: string
          updated_at?: string
          vote_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      jury_leaderboard: {
        Row: {
          assessment_count: number | null
          average_score: number | null
          award_ids: string[] | null
          city: string | null
          constituency: string | null
          name: string | null
          party_number: number | null
          photo_url: string | null
          position: string | null
          state: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_total_score: {
        Args: { scores_json: Json }
        Returns: number
      }
      check_award_consensus: {
        Args: { p_award_id: string; p_student_id: string }
        Returns: boolean
      }
      create_user_profile: {
        Args: {
          p_city: string
          p_constituency: string
          p_name: string
          p_party_number: number
          p_position: string
          p_serial_number: number
          p_state: string
          p_user_id: string
        }
        Returns: undefined
      }
      get_current_user_type: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_type"]
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_details?: Json
          p_ip_address?: string
          p_resource_id?: string
          p_resource_type: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: string
      }
      log_user_login: {
        Args: {
          p_ip_address?: string
          p_session_id?: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      user_type: "student" | "jury" | "organizer"
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
      user_type: ["student", "jury", "organizer"],
    },
  },
} as const
