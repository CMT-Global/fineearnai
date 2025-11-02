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
          prompt_hash: string | null
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
          prompt_hash?: string | null
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
          prompt_hash?: string | null
          response_a?: string
          response_b?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action_type: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      cpay_checkouts: {
        Row: {
          checkout_id: string
          checkout_url: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          is_active: boolean
          max_amount: number
          min_amount: number
          updated_at: string
        }
        Insert: {
          checkout_id: string
          checkout_url: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          is_active?: boolean
          max_amount?: number
          min_amount?: number
          updated_at?: string
        }
        Update: {
          checkout_id?: string
          checkout_url?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          is_active?: boolean
          max_amount?: number
          min_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      daily_reset_logs: {
        Row: {
          created_at: string
          details: Json | null
          executed_at: string
          execution_time_ms: number | null
          id: string
          reset_date: string
          triggered_by: string
          users_reset: number
        }
        Insert: {
          created_at?: string
          details?: Json | null
          executed_at?: string
          execution_time_ms?: number | null
          id?: string
          reset_date: string
          triggered_by?: string
          users_reset: number
        }
        Update: {
          created_at?: string
          details?: Json | null
          executed_at?: string
          execution_time_ms?: number | null
          id?: string
          reset_date?: string
          triggered_by?: string
          users_reset?: number
        }
        Relationships: []
      }
      edge_function_metrics: {
        Row: {
          created_at: string
          error_message: string | null
          execution_time_ms: number
          function_name: string
          id: string
          metadata: Json | null
          success: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          execution_time_ms: number
          function_name: string
          id?: string
          metadata?: Json | null
          success: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number
          function_name?: string
          id?: string
          metadata?: Json | null
          success?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          body: string
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          recipient_email: string
          recipient_user_id: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          subject: string
          template_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient_email: string
          recipient_user_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject: string
          template_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient_email?: string
          recipient_user_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          subject: string
          template_type: string
          updated_at: string
          variables: Json | null
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          subject: string
          template_type: string
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          subject?: string
          template_type?: string
          updated_at?: string
          variables?: Json | null
        }
        Relationships: []
      }
      group_account_config: {
        Row: {
          created_at: string
          default_commission_rate_to_master: number
          default_earning_rate_for_sub_accounts: number
          enable_master_account_top_up: boolean
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_commission_rate_to_master?: number
          default_earning_rate_for_sub_accounts?: number
          enable_master_account_top_up?: boolean
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_commission_rate_to_master?: number
          default_earning_rate_for_sub_accounts?: number
          enable_master_account_top_up?: boolean
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      master_login_sessions: {
        Row: {
          admin_id: string
          created_at: string
          expires_at: string
          id: string
          one_time_token: string
          target_user_id: string
          used_at: string | null
        }
        Insert: {
          admin_id: string
          created_at?: string
          expires_at: string
          id?: string
          one_time_token: string
          target_user_id: string
          used_at?: string | null
        }
        Update: {
          admin_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          one_time_token?: string
          target_user_id?: string
          used_at?: string | null
        }
        Relationships: []
      }
      membership_plans: {
        Row: {
          account_type: string
          billing_period_days: number
          billing_period_unit: string
          billing_period_value: number
          created_at: string
          custom_categories: boolean
          daily_task_limit: number
          deposit_commission_rate: number
          display_name: string
          earning_per_task: number
          features: Json | null
          free_plan_expiry_days: number | null
          free_unlock_withdrawal_days: number | null
          free_unlock_withdrawal_enabled: boolean
          id: string
          is_active: boolean
          max_active_referrals: number
          max_daily_withdrawal: number
          max_group_members: number
          min_daily_withdrawal: number
          min_withdrawal: number
          name: string
          price: number
          priority_support: boolean
          referral_eligible: boolean
          sub_account_earning_commission_rate: number | null
          task_commission_rate: number
          task_skip_limit_per_day: number
          updated_at: string
        }
        Insert: {
          account_type: string
          billing_period_days?: number
          billing_period_unit?: string
          billing_period_value?: number
          created_at?: string
          custom_categories?: boolean
          daily_task_limit?: number
          deposit_commission_rate?: number
          display_name: string
          earning_per_task?: number
          features?: Json | null
          free_plan_expiry_days?: number | null
          free_unlock_withdrawal_days?: number | null
          free_unlock_withdrawal_enabled?: boolean
          id?: string
          is_active?: boolean
          max_active_referrals?: number
          max_daily_withdrawal?: number
          max_group_members?: number
          min_daily_withdrawal?: number
          min_withdrawal?: number
          name: string
          price?: number
          priority_support?: boolean
          referral_eligible?: boolean
          sub_account_earning_commission_rate?: number | null
          task_commission_rate?: number
          task_skip_limit_per_day?: number
          updated_at?: string
        }
        Update: {
          account_type?: string
          billing_period_days?: number
          billing_period_unit?: string
          billing_period_value?: number
          created_at?: string
          custom_categories?: boolean
          daily_task_limit?: number
          deposit_commission_rate?: number
          display_name?: string
          earning_per_task?: number
          features?: Json | null
          free_plan_expiry_days?: number | null
          free_unlock_withdrawal_days?: number | null
          free_unlock_withdrawal_enabled?: boolean
          id?: string
          is_active?: boolean
          max_active_referrals?: number
          max_daily_withdrawal?: number
          max_group_members?: number
          min_daily_withdrawal?: number
          min_withdrawal?: number
          name?: string
          price?: number
          priority_support?: boolean
          referral_eligible?: boolean
          sub_account_earning_commission_rate?: number | null
          task_commission_rate?: number
          task_skip_limit_per_day?: number
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          priority: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          priority?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          priority?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_processors: {
        Row: {
          config: Json
          created_at: string
          fee_fixed: number
          fee_percentage: number
          id: string
          is_active: boolean
          max_amount: number
          min_amount: number
          name: string
          processor_type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          fee_fixed?: number
          fee_percentage?: number
          id?: string
          is_active?: boolean
          max_amount?: number
          min_amount?: number
          name: string
          processor_type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          fee_fixed?: number
          fee_percentage?: number
          id?: string
          is_active?: boolean
          max_amount?: number
          min_amount?: number
          name?: string
          processor_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_config: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          allow_daily_withdrawals: boolean
          auto_renew: boolean
          country: string | null
          created_at: string
          current_plan_start_date: string | null
          deposit_wallet_balance: number
          earnings_wallet_balance: number
          email: string | null
          full_name: string | null
          id: string
          last_activity: string | null
          last_login: string | null
          last_login_country: string | null
          last_login_country_name: string | null
          last_login_ip: string | null
          last_task_date: string | null
          membership_plan: string
          payeer_payout_addresses: Json | null
          phone: string | null
          plan_expires_at: string | null
          preferred_currency: string
          referral_code: string
          registration_country: string | null
          registration_country_name: string | null
          registration_ip: string | null
          skips_today: number
          tasks_completed_today: number
          total_earned: number
          username: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          allow_daily_withdrawals?: boolean
          auto_renew?: boolean
          country?: string | null
          created_at?: string
          current_plan_start_date?: string | null
          deposit_wallet_balance?: number
          earnings_wallet_balance?: number
          email?: string | null
          full_name?: string | null
          id: string
          last_activity?: string | null
          last_login?: string | null
          last_login_country?: string | null
          last_login_country_name?: string | null
          last_login_ip?: string | null
          last_task_date?: string | null
          membership_plan?: string
          payeer_payout_addresses?: Json | null
          phone?: string | null
          plan_expires_at?: string | null
          preferred_currency?: string
          referral_code: string
          registration_country?: string | null
          registration_country_name?: string | null
          registration_ip?: string | null
          skips_today?: number
          tasks_completed_today?: number
          total_earned?: number
          username: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          allow_daily_withdrawals?: boolean
          auto_renew?: boolean
          country?: string | null
          created_at?: string
          current_plan_start_date?: string | null
          deposit_wallet_balance?: number
          earnings_wallet_balance?: number
          email?: string | null
          full_name?: string | null
          id?: string
          last_activity?: string | null
          last_login?: string | null
          last_login_country?: string | null
          last_login_country_name?: string | null
          last_login_ip?: string | null
          last_task_date?: string | null
          membership_plan?: string
          payeer_payout_addresses?: Json | null
          phone?: string | null
          plan_expires_at?: string | null
          preferred_currency?: string
          referral_code?: string
          registration_country?: string | null
          registration_country_name?: string | null
          registration_ip?: string | null
          skips_today?: number
          tasks_completed_today?: number
          total_earned?: number
          username?: string
        }
        Relationships: []
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
      referral_program_config: {
        Row: {
          created_at: string
          id: string
          signup_bonus_amount: number
          signup_bonus_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          signup_bonus_amount?: number
          signup_bonus_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          signup_bonus_amount?: number
          signup_bonus_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          last_commission_date: string | null
          referral_code_used: string
          referred_id: string
          referrer_id: string
          status: string
          total_commission_earned: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_commission_date?: string | null
          referral_code_used: string
          referred_id: string
          referrer_id: string
          status?: string
          total_commission_earned?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_commission_date?: string | null
          referral_code_used?: string
          referred_id?: string
          referrer_id?: string
          status?: string
          total_commission_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "user_daily_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "user_daily_stats"
            referencedColumns: ["user_id"]
          },
        ]
      }
      scheduled_emails: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          recipient_filter: Json
          scheduled_for: string
          sent_at: string | null
          status: string
          subject: string
          template_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          recipient_filter?: Json
          scheduled_for: string
          sent_at?: string | null
          status?: string
          subject: string
          template_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          recipient_filter?: Json
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_emails_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
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
      task_pool_metrics: {
        Row: {
          active_task_count: number
          alert_message: string | null
          alert_triggered: boolean | null
          average_completion_rate: number | null
          created_at: string
          id: string
          tasks_completed_last_24h: number
          total_task_count: number
        }
        Insert: {
          active_task_count: number
          alert_message?: string | null
          alert_triggered?: boolean | null
          average_completion_rate?: number | null
          created_at?: string
          id?: string
          tasks_completed_last_24h: number
          total_task_count: number
        }
        Update: {
          active_task_count?: number
          alert_message?: string | null
          alert_triggered?: boolean | null
          average_completion_rate?: number | null
          created_at?: string
          id?: string
          tasks_completed_last_24h?: number
          total_task_count?: number
        }
        Relationships: []
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
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_daily_stats"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_activity_log: {
        Row: {
          activity_type: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_daily_stats"
            referencedColumns: ["user_id"]
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
      withdrawal_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          api_response: Json | null
          created_at: string
          fee: number
          id: string
          manual_txn_hash: string | null
          net_amount: number
          payment_method: string
          payment_processor_id: string | null
          payment_provider: string | null
          payout_address: string
          processed_at: string | null
          processed_by: string | null
          rejection_reason: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          api_response?: Json | null
          created_at?: string
          fee?: number
          id?: string
          manual_txn_hash?: string | null
          net_amount: number
          payment_method: string
          payment_processor_id?: string | null
          payment_provider?: string | null
          payout_address: string
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          api_response?: Json | null
          created_at?: string
          fee?: number
          id?: string
          manual_txn_hash?: string | null
          net_amount?: number
          payment_method?: string
          payment_processor_id?: string | null
          payment_provider?: string | null
          payout_address?: string
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_withdrawal_payment_processor"
            columns: ["payment_processor_id"]
            isOneToOne: false
            referencedRelation: "payment_processors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_withdrawal_requests_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_withdrawal_requests_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_daily_stats"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      cron_job_status: {
        Row: {
          active: boolean | null
          command: string | null
          database: string | null
          jobid: number | null
          jobname: string | null
          nodename: string | null
          nodeport: number | null
          schedule: string | null
          username: string | null
        }
        Insert: {
          active?: boolean | null
          command?: string | null
          database?: string | null
          jobid?: number | null
          jobname?: string | null
          nodename?: string | null
          nodeport?: number | null
          schedule?: string | null
          username?: string | null
        }
        Update: {
          active?: boolean | null
          command?: string | null
          database?: string | null
          jobid?: number | null
          jobname?: string | null
          nodename?: string | null
          nodeport?: number | null
          schedule?: string | null
          username?: string | null
        }
        Relationships: []
      }
      mv_platform_stats: {
        Row: {
          active_tasks: number | null
          active_users_30d: number | null
          captured_at: string | null
          pending_withdrawals: number | null
          total_referrals: number | null
          total_tasks_completed: number | null
          total_users: number | null
          total_value_locked: number | null
        }
        Relationships: []
      }
      mv_user_referral_stats: {
        Row: {
          active_referrals: number | null
          deposit_commission_earnings: number | null
          referrer_id: string | null
          task_commission_earnings: number | null
          total_earnings: number | null
          total_referrals: number | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "user_daily_stats"
            referencedColumns: ["user_id"]
          },
        ]
      }
      pending_transactions_health: {
        Row: {
          newest_pending: string | null
          oldest_pending: string | null
          pending_last_24h: number | null
          pending_last_hour: number | null
          stale_pending: number | null
          total_pending: number | null
          total_pending_amount: number | null
        }
        Relationships: []
      }
      user_daily_stats: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"] | null
          daily_task_limit: number | null
          deposit_commission_rate: number | null
          deposit_wallet_balance: number | null
          earning_per_task: number | null
          earnings_wallet_balance: number | null
          last_task_date: string | null
          max_daily_withdrawal: number | null
          membership_plan: string | null
          min_daily_withdrawal: number | null
          min_withdrawal: number | null
          plan_expires_at: string | null
          remaining_skips: number | null
          remaining_tasks: number | null
          skips_today: number | null
          task_commission_rate: number | null
          task_skip_limit_per_day: number | null
          tasks_completed_today: number | null
          total_earned: number | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      analyze_query_performance: {
        Args: { query_text: string }
        Returns: {
          plan_line: string
        }[]
      }
      calculate_proration: {
        Args: {
          p_current_plan_billing_days: number
          p_current_plan_price: number
          p_current_plan_start_date: string
          p_new_plan_price: number
        }
        Returns: Json
      }
      complete_task_atomic: {
        Args: {
          p_earnings_amount: number
          p_is_correct: boolean
          p_selected_response: string
          p_task_id: string
          p_time_taken_seconds: number
          p_user_id: string
        }
        Returns: Json
      }
      credit_deposit_atomic: {
        Args: {
          p_amount: number
          p_gateway_transaction_id?: string
          p_metadata?: Json
          p_order_id: string
          p_payment_method?: string
          p_user_id: string
        }
        Returns: Json
      }
      credit_deposit_atomic_v2: {
        Args: {
          p_amount: number
          p_metadata?: Json
          p_payment_id: string
          p_payment_method?: string
          p_tracking_id: string
          p_user_id: string
        }
        Returns: Json
      }
      generate_referral_code: { Args: never; Returns: string }
      get_available_task_count: { Args: { p_user_id: string }; Returns: number }
      get_current_utc_day: { Args: never; Returns: number }
      get_current_utc_time: { Args: never; Returns: string }
      get_multiple_users_detail: {
        Args: { p_user_ids: string[] }
        Returns: Json
      }
      get_next_available_task: {
        Args: { p_user_id: string }
        Returns: {
          category: string
          created_at: string
          difficulty: Database["public"]["Enums"]["task_difficulty"]
          prompt: string
          response_a: string
          response_b: string
          task_id: string
        }[]
      }
      get_next_task_optimized: {
        Args: { p_user_id: string }
        Returns: {
          available_count: number
          category: string
          created_at: string
          difficulty: Database["public"]["Enums"]["task_difficulty"]
          prompt: string
          response_a: string
          response_b: string
          task_id: string
        }[]
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
      get_referrals_with_details: {
        Args: { p_limit?: number; p_offset?: number; p_referrer_id: string }
        Returns: {
          account_status: Database["public"]["Enums"]["account_status"]
          created_at: string
          email: string
          id: string
          last_activity: string
          membership_plan: string
          referred_id: string
          status: string
          total_commission_earned: number
          total_count: number
          username: string
        }[]
      }
      get_task_pool_health: {
        Args: never
        Returns: {
          active_tasks: number
          avg_completion_rate: number
          completed_last_24h: number
          health_status: string
          recommendation: string
          total_tasks: number
        }[]
      }
      get_user_detail_aggregated: { Args: { p_user_id: string }; Returns: Json }
      get_username_by_referral_code: {
        Args: { p_referral_code: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_withdrawal_allowed: { Args: never; Returns: boolean }
      process_plan_upgrade_atomic: {
        Args: {
          p_expiry_date: string
          p_final_cost: number
          p_metadata?: Json
          p_plan_name: string
          p_previous_plan?: string
          p_user_id: string
        }
        Returns: Json
      }
      process_withdrawal_request_atomic: {
        Args: {
          p_amount: number
          p_fee: number
          p_net_amount: number
          p_payment_method: string
          p_payment_processor_id?: string
          p_payout_address: string
          p_user_id: string
        }
        Returns: Json
      }
      refresh_materialized_views: { Args: never; Returns: undefined }
      validate_payout_days: { Args: { config_value: Json }; Returns: boolean }
      validate_payout_schedule: {
        Args: { config_value: Json }
        Returns: boolean
      }
    }
    Enums: {
      account_status: "active" | "suspended" | "banned"
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
      account_status: ["active", "suspended", "banned"],
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
