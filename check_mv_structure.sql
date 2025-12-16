-- Check the actual structure of mv_user_referral_stats
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'mv_user_referral_stats'
ORDER BY ordinal_position;



