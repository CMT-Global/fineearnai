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
  countdownSeconds: number | null; // NEW: Seconds until next window
  hasBypass: boolean; // PHASE 4: User has daily withdrawal bypass
}

export const useWithdrawalValidation = () => {
  return useQuery<WithdrawalValidation>({
    queryKey: ['withdrawal-validation'],
    queryFn: async () => {
      // PHASE 4: Check if user has daily withdrawal bypass enabled
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Fetch user's bypass status
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('allow_daily_withdrawals')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching user bypass status:', profileError);
      }

      const hasBypass = profile?.allow_daily_withdrawals || false;

      // If user has bypass enabled, return immediately with allowed status
      if (hasBypass) {
        console.log('✅ VIP Bypass Active: User has daily withdrawal access');
        return {
          isAllowed: true,
          schedule: null,
          nextWindow: null,
          currentDay: 0,
          currentTime: '00:00',
          message: '✅ VIP Access: Withdrawals available 24/7',
          countdownSeconds: null,
          hasBypass: true,
        };
      }

      // Standard users: Check schedule as usual
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

      // Calculate next available window and countdown if not currently allowed
      let nextWindow: NextWindow | null = null;
      let countdownSeconds: number | null = null;
      
      if (!isAllowed && schedule) {
        const now = new Date();
        const utcNow = Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          now.getUTCHours(),
          now.getUTCMinutes(),
          now.getUTCSeconds()
        );
        
        // Find next enabled window
        const enabledDays = schedule.filter(s => s.enabled).sort((a, b) => a.day - b.day);
        
        if (enabledDays.length > 0) {
          const currentDayNum = now.getUTCDay();
          const currentTimeMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
          
          // Search for next window (today or future days)
          let nextWindowFound = false;
          
          for (let i = 0; i < 7 && !nextWindowFound; i++) {
            const checkDay = (currentDayNum + i) % 7;
            const daySchedule = enabledDays.find(s => s.day === checkDay);
            
            if (daySchedule) {
              const [startHour, startMin] = daySchedule.start_time.split(':').map(Number);
              const startTimeMinutes = startHour * 60 + startMin;
              
              // If today and window hasn't started, or future day
              if (i > 0 || startTimeMinutes > currentTimeMinutes) {
                const daysAhead = i;
                const targetDate = new Date(now);
                targetDate.setUTCDate(targetDate.getUTCDate() + daysAhead);
                targetDate.setUTCHours(startHour, startMin, 0, 0);
                
                const targetTime = targetDate.getTime();
                countdownSeconds = Math.floor((targetTime - utcNow) / 1000);
                
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                nextWindow = {
                  next_day: dayNames[checkDay],
                  next_date: targetDate.toISOString().split('T')[0],
                  start_time: daySchedule.start_time,
                  end_time: daySchedule.end_time,
                  hours_until: Math.floor(countdownSeconds / 3600)
                };
                
                nextWindowFound = true;
              }
            }
          }
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
        countdownSeconds,
        hasBypass: false,
      };
    },
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider stale after 30 seconds
  });
};
