-- Phase 1: Add allow_daily_withdrawals to get_user_detail_aggregated function
CREATE OR REPLACE FUNCTION public.get_user_detail_aggregated(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    -- Core profile data
    'profile', json_build_object(
      'id', p.id,
      'username', p.username,
      'email', p.email,
      'full_name', p.full_name,
      'phone', p.phone,
      'country', p.country,
      'membership_plan', p.membership_plan,
      'account_status', p.account_status,
      'referral_code', p.referral_code,
      'plan_expires_at', p.plan_expires_at,
      'current_plan_start_date', p.current_plan_start_date,
      'auto_renew', p.auto_renew,
      'allow_daily_withdrawals', p.allow_daily_withdrawals,
      'registration_country', p.registration_country,
      'registration_country_name', p.registration_country_name,
      'registration_ip', p.registration_ip,
      'last_login_country', p.last_login_country,
      'last_login_country_name', p.last_login_country_name,
      'last_login_ip', p.last_login_ip,
      'created_at', p.created_at,
      'last_login', p.last_login,
      'last_activity', p.last_activity
    ),
    
    -- Task & earning statistics
    'stats', json_build_object(
      'total_tasks', COALESCE((
        SELECT COUNT(*) 
        FROM task_completions 
        WHERE user_id = p_user_id
      ), 0),
      'correct_tasks', COALESCE((
        SELECT COUNT(*) 
        FROM task_completions 
        WHERE user_id = p_user_id AND is_correct = true
      ), 0),
      'wrong_tasks', COALESCE((
        SELECT COUNT(*) 
        FROM task_completions 
        WHERE user_id = p_user_id AND is_correct = false
      ), 0),
      'accuracy', COALESCE((
        SELECT ROUND(
          (COUNT(*) FILTER (WHERE is_correct = true) * 100.0) / NULLIF(COUNT(*), 0), 2
        ) 
        FROM task_completions 
        WHERE user_id = p_user_id
      ), 0),
      'total_earned', p.total_earned,
      'tasks_completed_today', p.tasks_completed_today,
      'skips_today', p.skips_today,
      'last_task_date', p.last_task_date,
      'total_referrals', COALESCE((
        SELECT COUNT(*) 
        FROM referrals 
        WHERE referrer_id = p_user_id
      ), 0),
      'active_referrals', COALESCE((
        SELECT COUNT(*) 
        FROM referrals 
        WHERE referrer_id = p_user_id AND status = 'active'
      ), 0),
      'total_referral_earnings', COALESCE((
        SELECT SUM(total_commission_earned) 
        FROM referrals 
        WHERE referrer_id = p_user_id
      ), 0)
    ),
    
    -- Financial overview
    'financial', json_build_object(
      'deposit_wallet_balance', p.deposit_wallet_balance,
      'earnings_wallet_balance', p.earnings_wallet_balance,
      'total_balance', (p.deposit_wallet_balance + p.earnings_wallet_balance),
      'total_deposits', COALESCE((
        SELECT SUM(amount) 
        FROM transactions 
        WHERE user_id = p_user_id 
          AND type = 'deposit' 
          AND status = 'completed'
      ), 0),
      'total_withdrawals', COALESCE((
        SELECT SUM(amount) 
        FROM transactions 
        WHERE user_id = p_user_id 
          AND type = 'withdrawal' 
          AND status = 'completed'
      ), 0),
      'pending_withdrawals', COALESCE((
        SELECT COUNT(*) 
        FROM withdrawal_requests 
        WHERE user_id = p_user_id AND status = 'pending'
      ), 0),
      'pending_withdrawal_amount', COALESCE((
        SELECT SUM(amount) 
        FROM withdrawal_requests 
        WHERE user_id = p_user_id AND status = 'pending'
      ), 0),
      'total_withdrawal_requests', COALESCE((
        SELECT COUNT(*) 
        FROM withdrawal_requests 
        WHERE user_id = p_user_id
      ), 0),
      'completed_withdrawals', COALESCE((
        SELECT COUNT(*) 
        FROM withdrawal_requests 
        WHERE user_id = p_user_id AND status = 'completed'
      ), 0),
      'rejected_withdrawals', COALESCE((
        SELECT COUNT(*) 
        FROM withdrawal_requests 
        WHERE user_id = p_user_id AND status = 'rejected'
      ), 0),
      'total_transactions', COALESCE((
        SELECT COUNT(*) 
        FROM transactions 
        WHERE user_id = p_user_id
      ), 0),
      'lifetime_net_earnings', (
        p.total_earned + COALESCE((
          SELECT SUM(amount) 
          FROM transactions 
          WHERE user_id = p_user_id 
            AND type = 'deposit' 
            AND status = 'completed'
        ), 0) - COALESCE((
          SELECT SUM(amount) 
          FROM transactions 
          WHERE user_id = p_user_id 
            AND type = 'withdrawal' 
            AND status = 'completed'
        ), 0)
      )
    ),
    
    -- Upline/referrer information (FIXED: Uses referrals table as source of truth)
    'upline', (
      SELECT json_build_object(
        'id', up.id,
        'username', up.username,
        'email', up.email,
        'membership_plan', up.membership_plan,
        'account_status', up.account_status,
        'referral_code', up.referral_code
      )
      FROM referrals r
      INNER JOIN profiles up ON up.id = r.referrer_id
      WHERE r.referred_id = p_user_id
      LIMIT 1
    ),
    
    -- Referral relationship details (FIXED: Uses referrals table as source of truth)
    'referral_details', (
      SELECT json_build_object(
        'referral_id', r.id,
        'status', r.status,
        'total_commission_earned', r.total_commission_earned,
        'created_at', r.created_at,
        'last_commission_date', r.last_commission_date,
        'referral_code_used', r.referral_code_used
      )
      FROM referrals r
      WHERE r.referred_id = p_user_id
      LIMIT 1
    ),
    
    -- Recent activity summary
    'recent_activity', json_build_object(
      'last_task_completion', (
        SELECT json_build_object(
          'completed_at', tc.completed_at,
          'is_correct', tc.is_correct,
          'earnings_amount', tc.earnings_amount
        )
        FROM task_completions tc
        WHERE tc.user_id = p_user_id
        ORDER BY tc.completed_at DESC
        LIMIT 1
      ),
      'last_transaction', (
        SELECT json_build_object(
          'id', t.id,
          'type', t.type,
          'amount', t.amount,
          'status', t.status,
          'created_at', t.created_at,
          'description', t.description
        )
        FROM transactions t
        WHERE t.user_id = p_user_id
        ORDER BY t.created_at DESC
        LIMIT 1
      ),
      'last_withdrawal_request', (
        SELECT json_build_object(
          'id', wr.id,
          'amount', wr.amount,
          'status', wr.status,
          'payment_method', wr.payment_method,
          'created_at', wr.created_at,
          'processed_at', wr.processed_at
        )
        FROM withdrawal_requests wr
        WHERE wr.user_id = p_user_id
        ORDER BY wr.created_at DESC
        LIMIT 1
      )
    ),
    
    -- Membership plan details
    'plan_info', (
      SELECT json_build_object(
        'name', mp.name,
        'display_name', mp.display_name,
        'account_type', mp.account_type,
        'price', mp.price,
        'daily_task_limit', mp.daily_task_limit,
        'earning_per_task', mp.earning_per_task,
        'min_withdrawal', mp.min_withdrawal,
        'max_daily_withdrawal', mp.max_daily_withdrawal,
        'task_commission_rate', mp.task_commission_rate,
        'deposit_commission_rate', mp.deposit_commission_rate,
        'max_active_referrals', mp.max_active_referrals,
        'features', mp.features
      )
      FROM membership_plans mp
      WHERE mp.name = p.membership_plan
      LIMIT 1
    ),
    
    -- Admin role check
    'is_admin', (
      SELECT EXISTS(
        SELECT 1 
        FROM user_roles 
        WHERE user_id = p_user_id AND role = 'admin'
      )
    )
  )
  INTO result
  FROM profiles p
  WHERE p.id = p_user_id;
  
  RETURN result;
END;
$function$;