import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DailyResetLog {
  id: string;
  reset_date: string;
  users_reset: number;
  triggered_by: string;
  execution_time_ms: number;
  executed_at: string;
  details: {
    utc_time: string;
    eat_time: string;
    reset_operation_ms: number;
    request_id: string;
    user_sample?: Array<{ id: string; username: string }>;
  };
}

interface DailyResetLogsFilters {
  dateFrom?: string;
  dateTo?: string;
  triggeredBy?: string;
}

export const useDailyResetLogs = (filters?: DailyResetLogsFilters) => {
  return useQuery({
    queryKey: ['daily-reset-logs', filters],
    queryFn: async () => {
      let query = supabase
        .from('daily_reset_logs')
        .select('*')
        .order('reset_date', { ascending: false });

      // Apply filters
      if (filters?.dateFrom) {
        query = query.gte('reset_date', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('reset_date', filters.dateTo);
      }
      if (filters?.triggeredBy) {
        query = query.eq('triggered_by', filters.triggeredBy);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as unknown as DailyResetLog[];
    },
    staleTime: 30000, // 30 seconds
  });
};

export const useDailyResetStats = () => {
  return useQuery({
    queryKey: ['daily-reset-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_reset_logs')
        .select('users_reset, execution_time_ms')
        .order('reset_date', { ascending: false })
        .limit(30);

      if (error) throw error;

      const logs = (data || []) as unknown as DailyResetLog[];
      
      if (!logs.length) {
        return {
          avgUsersReset: 0,
          avgExecutionTime: 0,
          maxExecutionTime: 0,
          minExecutionTime: 0,
          totalResets: 0,
        };
      }

      const totalUsersReset = logs.reduce((sum, log) => sum + log.users_reset, 0);
      const totalExecutionTime = logs.reduce((sum, log) => sum + log.execution_time_ms, 0);
      const executionTimes = logs.map(log => log.execution_time_ms);

      return {
        avgUsersReset: Math.round(totalUsersReset / logs.length),
        avgExecutionTime: Math.round(totalExecutionTime / logs.length),
        maxExecutionTime: Math.max(...executionTimes),
        minExecutionTime: Math.min(...executionTimes),
        totalResets: logs.length,
      };
    },
    staleTime: 60000, // 1 minute
  });
};
