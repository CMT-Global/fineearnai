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
  countdownSeconds: number | null;
  hasBypass: boolean;
  /** When influencer override is used: e.g. "Mon, Wed, Fri" for display */
  withdrawalDaysLabel?: string | null;
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

      // Fetch user's bypass status and optional influencer withdrawal override
      const [{ data: profile, error: profileError }, { data: affiliateRow }] = await Promise.all([
        supabase.from('profiles').select('allow_daily_withdrawals').eq('id', user.id).single(),
        (supabase as any).from('user_affiliate_settings').select('override_withdrawal_days, withdrawal_days').eq('user_id', user.id).eq('is_affiliate', true).maybeSingle().then((r: { data: any }) => ({ data: r.data })),
      ]);

      if (profileError) {
        console.error('Error fetching user bypass status:', profileError);
      }

      const hasBypass = profile?.allow_daily_withdrawals || false;

      if (hasBypass) {
      return {
        isAllowed: true,
        schedule: null,
        nextWindow: null,
        currentDay: 0,
        currentTime: '00:00',
        message: '✅ VIP Access: Withdrawals available 24/7',
        countdownSeconds: null,
        hasBypass: true,
        withdrawalDaysLabel: null,
      };
    }

      const { data: currentDay, error: dayError } = await supabase.rpc('get_current_utc_day');
      const { data: currentTime, error: timeError } = await supabase.rpc('get_current_utc_time');
      if (dayError || timeError) throw new Error('Failed to get current UTC time');

      // Use user-specific schedule (influencer override) or global
      const useAffiliateSchedule = affiliateRow?.override_withdrawal_days && Array.isArray(affiliateRow?.withdrawal_days) && affiliateRow.withdrawal_days.length > 0;
      let schedule: PayoutSchedule[] | null = null;
      if (useAffiliateSchedule && affiliateRow?.withdrawal_days) {
        schedule = affiliateRow.withdrawal_days as unknown as PayoutSchedule[];
      } else {
        const { data: scheduleConfig } = await supabase.from('platform_config').select('value').eq('key', 'payout_schedule').maybeSingle();
        schedule = (scheduleConfig?.value && Array.isArray(scheduleConfig.value)) ? scheduleConfig.value as unknown as PayoutSchedule[] : null;
      }

      const { data: isAllowedRaw, error: allowedError } = await (supabase as any).rpc('is_withdrawal_allowed_for_user', { p_user_id: user.id });
      if (allowedError) throw new Error('Failed to check withdrawal availability');
      const isAllowed = Boolean(isAllowedRaw);

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

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const withdrawalDaysLabel: string | null = useAffiliateSchedule && schedule
        ? schedule.filter((s) => s.enabled).sort((a, b) => a.day - b.day).map((s) => dayNames[s.day].slice(0, 3)).join(', ')
        : null;

      return {
        isAllowed,
        schedule,
        nextWindow,
        currentDay: currentDay || 0,
        currentTime: currentTime || '00:00',
        message,
        countdownSeconds,
        hasBypass: false,
        withdrawalDaysLabel: withdrawalDaysLabel || null,
      };
    },
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider stale after 30 seconds
  });
};
