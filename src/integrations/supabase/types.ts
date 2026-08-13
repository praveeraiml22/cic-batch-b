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
      announcements: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_broadcast: boolean
          notification_attempts: number
          notification_error: string | null
          notification_sent_at: string | null
          notification_status: string
          onesignal_notification_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_broadcast?: boolean
          notification_attempts?: number
          notification_error?: string | null
          notification_sent_at?: string | null
          notification_status?: string
          onesignal_notification_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_broadcast?: boolean
          notification_attempts?: number
          notification_error?: string | null
          notification_sent_at?: string | null
          notification_status?: string
          onesignal_notification_id?: string | null
          title?: string
        }
        Relationships: []
      }
      assignments: {
        Row: {
          created_at: string
          description: string | null
          feedback: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          grade: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          semester: string | null
          status: Database["public"]["Enums"]["assignment_status"]
          subject: string
          submitted_by: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          feedback?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          grade?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          semester?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          subject: string
          submitted_by: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          feedback?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          grade?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          semester?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          subject?: string
          submitted_by?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      auth_logs: {
        Row: {
          action: string
          error_message: string | null
          id: string
          occurred_at: string
          user_email: string | null
        }
        Insert: {
          action: string
          error_message?: string | null
          id?: string
          occurred_at?: string
          user_email?: string | null
        }
        Update: {
          action?: string
          error_message?: string | null
          id?: string
          occurred_at?: string
          user_email?: string | null
        }
        Relationships: []
      }
      coordinators: {
        Row: {
          created_at: string
          designation: string
          id: string
          name: string
          photo_url: string | null
          sort_order: number
          type: Database["public"]["Enums"]["coordinator_type"]
        }
        Insert: {
          created_at?: string
          designation: string
          id?: string
          name: string
          photo_url?: string | null
          sort_order?: number
          type: Database["public"]["Enums"]["coordinator_type"]
        }
        Update: {
          created_at?: string
          designation?: string
          id?: string
          name?: string
          photo_url?: string | null
          sort_order?: number
          type?: Database["public"]["Enums"]["coordinator_type"]
        }
        Relationships: []
      }
      document_folders: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          owner_id: string
          parent_id: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          name: string
          owner_id: string
          parent_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          owner_id?: string
          parent_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: Database["public"]["Enums"]["document_category"]
          created_at: string
          description: string | null
          file_name: string
          file_size: number | null
          file_url: string
          folder_id: string
          id: string
          tags: string[] | null
          title: string
          uploaded_by: string
          version: number
        }
        Insert: {
          category?: Database["public"]["Enums"]["document_category"]
          created_at?: string
          description?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          folder_id: string
          id?: string
          tags?: string[] | null
          title: string
          uploaded_by: string
          version?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["document_category"]
          created_at?: string
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          folder_id?: string
          id?: string
          tags?: string[] | null
          title?: string
          uploaded_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          event_date: string | null
          id: string
          image_url: string | null
          tag: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string | null
          id?: string
          image_url?: string | null
          tag?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string | null
          id?: string
          image_url?: string | null
          tag?: string | null
          title?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          push_enabled: boolean
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          push_enabled?: boolean
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          push_enabled?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          department: string | null
          email: string | null
          full_name: string
          id: string
          mobile: string | null
          roll_number: string | null
          semester: string | null
          status: string
          student_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string
          id: string
          mobile?: string | null
          roll_number?: string | null
          semester?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string
          id?: string
          mobile?: string | null
          roll_number?: string | null
          semester?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_config: {
        Row: {
          created_at: string
          enabled: boolean
          endpoint_url: string
          id: boolean
          updated_at: string
          webhook_secret: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          endpoint_url: string
          id?: boolean
          updated_at?: string
          webhook_secret: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          endpoint_url?: string
          id?: boolean
          updated_at?: string
          webhook_secret?: string
        }
        Relationships: []
      }
      push_notification_logs: {
        Row: {
          body: string | null
          created_at: string
          dedupe_key: string
          error: string | null
          event_type: string
          id: string
          is_broadcast: boolean
          link: string | null
          response: Json | null
          source_id: string | null
          source_table: string | null
          status: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          dedupe_key: string
          error?: string | null
          event_type: string
          id?: string
          is_broadcast?: boolean
          link?: string | null
          response?: Json | null
          source_id?: string | null
          source_table?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          dedupe_key?: string
          error?: string | null
          event_type?: string
          id?: string
          is_broadcast?: boolean
          link?: string | null
          response?: Json | null
          source_id?: string | null
          source_table?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      resumes: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      role_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          new_role: string | null
          old_role: string | null
          reason: string | null
          status: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_role?: string | null
          old_role?: string | null
          reason?: string | null
          status?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_role?: string | null
          old_role?: string | null
          reason?: string | null
          status?: string
          target_user_id?: string | null
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
      claim_push_log: { Args: { _log_id: string }; Returns: boolean }
      enqueue_push: {
        Args: {
          _body: string
          _dedupe_key: string
          _event_type: string
          _is_broadcast: boolean
          _link: string
          _source_id: string
          _source_table: string
          _title: string
          _user_id: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      log_role_change: {
        Args: {
          _action: string
          _actor: string
          _new: string
          _old: string
          _target: string
        }
        Returns: undefined
      }
      sync_push_result: {
        Args: {
          _error: string
          _onesignal_id: string
          _source_id: string
          _source_table: string
          _status: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "student" | "faculty" | "coordinator" | "super_admin"
      assignment_status:
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "resubmission_required"
      coordinator_type: "faculty" | "student"
      document_category:
        | "assignments"
        | "reports"
        | "research_papers"
        | "project_files"
        | "notes"
        | "misc"
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
      app_role: ["admin", "student", "faculty", "coordinator", "super_admin"],
      assignment_status: [
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "resubmission_required",
      ],
      coordinator_type: ["faculty", "student"],
      document_category: [
        "assignments",
        "reports",
        "research_papers",
        "project_files",
        "notes",
        "misc",
      ],
    },
  },
} as const
