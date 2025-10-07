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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_tasks: {
        Row: {
          category: string
          correct_response: string
          created_at: string
          difficulty: Database["public"]["Enums"]["task_difficulty"]
          id: string
          is_active: boolean
          prompt: string
          response_a: string
          response_b: string
        }
        Insert: {
          category: string
          correct_response: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["task_difficulty"]
          id?: string
          is_active?: boolean
          prompt: string
          response_a: string
          response_b: string
        }
        Update: {
          category?: string
          correct_response?: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["task_difficulty"]
          id?: string
          is_active?: boolean
          prompt?: string
          response_a?: string
          response_b?: string
        }
        Relationships: []
      }
      membership_plans: {
        Row: {
          account_type: string
          billing_period_days: number
          created_at: string
          daily_task_limit: number
          deposit_commission_rate: number
          display_name: string
          earning_per_task: number
          features: Json | null
          id: string
          is_active: boolean
          max_active_referrals: number
          max_daily_withdrawal: number
          min_daily_withdrawal: number
          min_withdrawal: number
          name: string
          price: number
          task_commission_rate: number
          task_skip_limit_per_day: number
          updated_at: string
        }
        Insert: {
          account_type: string
          billing_period_days?: number
          created_at?: string
          daily_task_limit?: number
          deposit_commission_rate?: number
          display_name: string
          earning_per_task?: number
          features?: Json | null
          id?: string
          is_active?: boolean
          max_active_referrals?: number
          max_daily_withdrawal?: number
          min_daily_withdrawal?: number
          min_withdrawal?: number
          name: string
          price?: number
          task_commission_rate?: number
          task_skip_limit_per_day?: number
          updated_at?: string
        }
        Update: {
          account_type?: string
          billing_period_days?: number
          created_at?: string
          daily_task_limit?: number
          deposit_commission_rate?: number
          display_name?: string
          earning_per_task?: number
          features?: Json | null
          id?: string
          is_active?: boolean
          max_active_referrals?: number
          max_daily_withdrawal?: number
          min_daily_withdrawal?: number
          min_withdrawal?: number
          name?: string
          price?: number
          task_commission_rate?: number
          task_skip_limit_per_day?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          country: string | null
          created_at: string
          deposit_wallet_balance: number
          earnings_wallet_balance: number
          email: string | null
          full_name: string | null
          id: string
          last_login: string | null
          last_task_date: string | null
          membership_plan: string
          phone: string | null
          plan_expires_at: string | null
          referral_code: string
          referred_by: string | null
          skips_today: number
          tasks_completed_today: number
          username: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          deposit_wallet_balance?: number
          earnings_wallet_balance?: number
          email?: string | null
          full_name?: string | null
          id: string
          last_login?: string | null
          last_task_date?: string | null
          membership_plan?: string
          phone?: string | null
          plan_expires_at?: string | null
          referral_code: string
          referred_by?: string | null
          skips_today?: number
          tasks_completed_today?: number
          username: string
        }
        Update: {
          country?: string | null
          created_at?: string
          deposit_wallet_balance?: number
          earnings_wallet_balance?: number
          email?: string | null
          full_name?: string | null
          id?: string
          last_login?: string | null
          last_task_date?: string | null
          membership_plan?: string
          phone?: string | null
          plan_expires_at?: string | null
          referral_code?: string
          referred_by?: string | null
          skips_today?: number
          tasks_completed_today?: number
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_earnings: {
        Row: {
          base_amount: number
          commission_amount: number
          commission_rate: number
          created_at: string
          earning_type: string
          id: string
          metadata: Json | null
          referred_user_id: string
          referrer_id: string
        }
        Insert: {
          base_amount: number
          commission_amount: number
          commission_rate: number
          created_at?: string
          earning_type: string
          id?: string
          metadata?: Json | null
          referred_user_id: string
          referrer_id: string
        }
        Update: {
          base_amount?: number
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          earning_type?: string
          id?: string
          metadata?: Json | null
          referred_user_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      task_completions: {
        Row: {
          completed_at: string
          earnings_amount: number
          id: string
          is_correct: boolean
          selected_response: string
          task_id: string
          time_taken_seconds: number
          user_id: string
        }
        Insert: {
          completed_at?: string
          earnings_amount?: number
          id?: string
          is_correct: boolean
          selected_response: string
          task_id: string
          time_taken_seconds: number
          user_id: string
        }
        Update: {
          completed_at?: string
          earnings_amount?: number
          id?: string
          is_correct?: boolean
          selected_response?: string
          task_id?: string
          time_taken_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "ai_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          base_reward: number
          created_at: string
          description: string
          difficulty: Database["public"]["Enums"]["task_difficulty"]
          id: string
          instructions: Json | null
          is_active: boolean
          time_estimate_minutes: number
          title: string
          updated_at: string
          validation_criteria: Json | null
        }
        Insert: {
          base_reward?: number
          created_at?: string
          description: string
          difficulty?: Database["public"]["Enums"]["task_difficulty"]
          id?: string
          instructions?: Json | null
          is_active?: boolean
          time_estimate_minutes?: number
          title: string
          updated_at?: string
          validation_criteria?: Json | null
        }
        Update: {
          base_reward?: number
          created_at?: string
          description?: string
          difficulty?: Database["public"]["Enums"]["task_difficulty"]
          id?: string
          instructions?: Json | null
          is_active?: boolean
          time_estimate_minutes?: number
          title?: string
          updated_at?: string
          validation_criteria?: Json | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          gateway_transaction_id: string | null
          id: string
          metadata: Json | null
          new_balance: number
          payment_gateway: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          gateway_transaction_id?: string | null
          id?: string
          metadata?: Json | null
          new_balance: number
          payment_gateway?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          gateway_transaction_id?: string | null
          id?: string
          metadata?: Json | null
          new_balance?: number
          payment_gateway?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
          wallet_type?: Database["public"]["Enums"]["wallet_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      user_tasks: {
        Row: {
          assigned_at: string
          completed_at: string | null
          earned_amount: number | null
          expires_at: string
          id: string
          skipped_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          submission_data: Json | null
          task_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          completed_at?: string | null
          earned_amount?: number | null
          expires_at: string
          id?: string
          skipped_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          submission_data?: Json | null
          task_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          completed_at?: string | null
          earned_amount?: number | null
          expires_at?: string
          id?: string
          skipped_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          submission_data?: Json | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_referral_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_referral_stats: {
        Args: { user_uuid: string }
        Returns: {
          active_referrals: number
          deposit_commission_earnings: number
          task_commission_earnings: number
          total_earnings: number
          total_referrals: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      task_difficulty: "easy" | "medium" | "hard"
      task_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "skipped"
        | "expired"
      transaction_status: "pending" | "completed" | "failed" | "cancelled"
      transaction_type:
        | "deposit"
        | "withdrawal"
        | "task_earning"
        | "referral_commission"
        | "plan_upgrade"
        | "transfer"
        | "adjustment"
      wallet_type: "deposit" | "earnings"
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
      app_role: ["admin", "moderator", "user"],
      task_difficulty: ["easy", "medium", "hard"],
      task_status: [
        "pending",
        "in_progress",
        "completed",
        "skipped",
        "expired",
      ],
      transaction_status: ["pending", "completed", "failed", "cancelled"],
      transaction_type: [
        "deposit",
        "withdrawal",
        "task_earning",
        "referral_commission",
        "plan_upgrade",
        "transfer",
        "adjustment",
      ],
      wallet_type: ["deposit", "earnings"],
    },
  },
} as const
