-- Phase 1: Create get_withdrawal_stats function and optimize indexes

-- Create composite index for fast withdrawal queries
CREATE INDEX IF NOT EXISTS idx_transactions_type_created_status 
ON public.transactions(type, created_at DESC, status)
WHERE type = 'withdrawal';

-- Create get_withdrawal_stats function (mirrors get_deposit_stats structure)
CREATE OR REPLACE FUNCTION public.get_withdrawal_stats(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE(
  today_count BIGINT,
  yesterday_count BIGINT,
  today_volume NUMERIC,
  yesterday_volume NUMERIC,
  total_volume NUMERIC,
  daily_breakdown JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
BEGIN
  RETURN QUERY
  WITH withdrawal_data AS (
    SELECT 
      DATE(created_at AT TIME ZONE 'UTC') as withdrawal_date,
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as volume
    FROM public.transactions
    WHERE type = 'withdrawal'
      AND status = 'completed'
      AND DATE(created_at AT TIME ZONE 'UTC') >= p_start_date
      AND DATE(created_at AT TIME ZONE 'UTC') <= p_end_date
    GROUP BY DATE(created_at AT TIME ZONE 'UTC')
  ),
  today_stats AS (
    SELECT 
      COALESCE(COUNT(*), 0) as count,
      COALESCE(SUM(amount), 0) as volume
    FROM public.transactions
    WHERE type = 'withdrawal'
      AND status = 'completed'
      AND DATE(created_at AT TIME ZONE 'UTC') = v_today
  ),
  yesterday_stats AS (
    SELECT 
      COALESCE(COUNT(*), 0) as count,
      COALESCE(SUM(amount), 0) as volume
    FROM public.transactions
    WHERE type = 'withdrawal'
      AND status = 'completed'
      AND DATE(created_at AT TIME ZONE 'UTC') = v_yesterday
  ),
  total_stats AS (
    SELECT COALESCE(SUM(amount), 0) as volume
    FROM public.transactions
    WHERE type = 'withdrawal'
      AND status = 'completed'
      AND DATE(created_at AT TIME ZONE 'UTC') >= p_start_date
      AND DATE(created_at AT TIME ZONE 'UTC') <= p_end_date
  ),
  daily_agg AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'date', withdrawal_date,
        'count', count,
        'volume', volume
      ) ORDER BY withdrawal_date
    ) as breakdown
    FROM withdrawal_data
  )
  SELECT
    (SELECT count FROM today_stats)::BIGINT,
    (SELECT count FROM yesterday_stats)::BIGINT,
    (SELECT volume FROM today_stats)::NUMERIC,
    (SELECT volume FROM yesterday_stats)::NUMERIC,
    (SELECT volume FROM total_stats)::NUMERIC,
    COALESCE((SELECT breakdown FROM daily_agg), '[]'::jsonb);
END;
$function$;