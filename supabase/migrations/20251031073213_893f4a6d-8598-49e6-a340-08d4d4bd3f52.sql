-- Phase 4: Enable realtime for profiles table to support multi-tab sync
-- This allows the admin panel to receive real-time updates when allow_daily_withdrawals changes

-- Enable REPLICA IDENTITY FULL to capture all column changes
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- Add profiles table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;