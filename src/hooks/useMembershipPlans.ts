import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MembershipPlan {
  id: string;
  name: string;
  display_name: string;
  account_type: string;
  price: number;
  billing_period_days: number;
  billing_period_unit?: string;
  billing_period_value?: number;
  daily_task_limit: number;
  earning_per_task: number;
  task_skip_limit_per_day: number;
  features: any;
  task_commission_rate: number;
  deposit_commission_rate: number;
  free_plan_expiry_days?: number;
  free_unlock_withdrawal_enabled?: boolean;
  free_unlock_withdrawal_days?: number;
}

const PLANS_CACHE_KEY = 'membership_plans_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useMembershipPlans() {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'network' | 'auth' | 'data' | 'unknown' | null>(null);
  const [retrying, setRetrying] = useState(false);

  const loadPlans = useCallback(async () => {
    try {
      setError(null);
      setErrorType(null);
      
      // Check cache first
      const cachedData = sessionStorage.getItem(PLANS_CACHE_KEY);
      if (cachedData) {
        const { data: cachedPlans, timestamp } = JSON.parse(cachedData);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setPlans(cachedPlans);
          setLoading(false);
          setRetrying(false);
          return;
        }
      }
      
      const { data, error } = await supabase
        .from("membership_plans")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });

      if (error) {
        // Determine error type
        if (error.message?.includes('Failed to fetch') || error.message?.includes('network')) {
          setErrorType('network');
          setError("Network connection failed. Please check your internet connection and try again.");
        } else if (error.message?.includes('JWT') || error.message?.includes('auth')) {
          setErrorType('auth');
          setError("Authentication error. Please log in again.");
        } else {
          setErrorType('data');
          setError("Unable to load membership plans. Please try again.");
        }
        throw error;
      }
      
      if (!data || data.length === 0) {
        setErrorType('data');
        setError("No membership plans are currently available. Please contact support.");
        return;
      }
      
      // Cache the data
      sessionStorage.setItem(PLANS_CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      
      setPlans(data);
    } catch (error: any) {
      console.error("Failed to load plans:", error);
      
      if (!errorType) {
        const isNetworkError = !navigator.onLine || error.message?.includes('Failed to fetch');
        if (isNetworkError) {
          setErrorType('network');
          setError("Network connection failed. Please check your internet connection and try again.");
        } else {
          setErrorType('unknown');
          setError("An unexpected error occurred. Please try again.");
        }
        toast.error(isNetworkError ? "No internet connection" : "Failed to load membership plans");
      }
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, [errorType]);

  // Calculate earning potentials for all plans
  const earningPotentials = useMemo(() => {
    const potentials: Record<string, { daily: number; weekly: number; monthly: number; quarterly: number; sixMonthly: number; annually: number } | null> = {};
    
    plans.forEach(plan => {
      if (plan.name === 'free') {
        potentials[plan.id] = null;
      } else {
        const daily = plan.daily_task_limit * plan.earning_per_task;
        potentials[plan.id] = {
          daily,
          weekly: daily * 7,
          monthly: daily * 30,
          quarterly: daily * 90,
          sixMonthly: daily * 180,
          annually: daily * 365
        };
      }
    });
    
    return potentials;
  }, [plans]);

  const retry = useCallback(async () => {
    setRetrying(true);
    setError(null);
    setErrorType(null);
    
    if (!navigator.onLine) {
      toast.error("No internet connection. Please check your network.");
      setRetrying(false);
      return;
    }
    
    await loadPlans();
  }, [loadPlans]);

  return {
    plans,
    loading,
    error,
    errorType,
    retrying,
    earningPotentials,
    loadPlans,
    retry
  };
}
