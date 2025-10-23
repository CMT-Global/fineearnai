import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PayoutSchedule {
  day: number;
  enabled: boolean;
  start_time: string;
  end_time: string;
}

interface NextWindow {
  next_day: string;
  next_date: string;
  start_time: string;
  end_time: string;
  hours_until: number;
}

interface WithdrawalValidation {
  isAllowed: boolean;
  schedule: PayoutSchedule[] | null;
  nextWindow: NextWindow | null;
  currentDay: number;
  currentTime: string;
  message: string;
}

export const useWithdrawalValidation = () => {
  return useQuery<WithdrawalValidation>({
    queryKey: ['withdrawal-validation'],
    queryFn: async () => {
      // Get current UTC day and time
      const { data: currentDay, error: dayError } = await supabase
        .rpc('get_current_utc_day');
      
      const { data: currentTime, error: timeError } = await supabase
        .rpc('get_current_utc_time');

      if (dayError || timeError) {
        throw new Error('Failed to get current UTC time');
      }

      // Check if withdrawals are currently allowed
      const { data: isAllowed, error: allowedError } = await supabase
        .rpc('is_withdrawal_allowed');

      if (allowedError) {
        throw new Error('Failed to check withdrawal availability');
      }

      // Get payout schedule
      const { data: scheduleConfig } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'payout_schedule')
        .single();

      const schedule = (scheduleConfig?.value && Array.isArray(scheduleConfig.value)) 
        ? scheduleConfig.value as unknown as PayoutSchedule[] 
        : null;

      // Get next available window if not currently allowed
      let nextWindow: NextWindow | null = null;
      if (!isAllowed) {
        const { data, error: windowError } = await supabase
          .from('platform_config')
          .select('value')
          .eq('key', 'payout_schedule')
          .single();
        
        if (!windowError && data) {
          // For now, we'll calculate next window client-side from schedule
          // The DB function isn't typed in the generated types yet
          nextWindow = null; // Will be populated after types regenerate
        }
      }

      // Build user-friendly message
      let message = '';
      if (isAllowed) {
        message = '✅ Withdrawals are currently available';
      } else if (nextWindow) {
        const hoursText = nextWindow.hours_until === 1 ? 'hour' : 'hours';
        message = `❌ Withdrawals closed. Next available: ${nextWindow.next_day} at ${nextWindow.start_time}-${nextWindow.end_time} UTC (in ${nextWindow.hours_until} ${hoursText})`;
      } else if (schedule) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const enabledDays = schedule
          .filter(s => s.enabled)
          .map(s => `${dayNames[s.day]} (${s.start_time}-${s.end_time} UTC)`)
          .join(', ');
        message = `❌ Withdrawals are only allowed during: ${enabledDays}`;
      } else {
        message = '❌ Withdrawals are currently not available';
      }

      return {
        isAllowed: isAllowed || false,
        schedule,
        nextWindow,
        currentDay: currentDay || 0,
        currentTime: currentTime || '00:00',
        message,
      };
    },
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider stale after 30 seconds
  });
};
