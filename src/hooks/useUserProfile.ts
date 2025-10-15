import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { User } from '@supabase/supabase-js';

export function useUserProfile(user: User | null) {
  const [profile, setProfile] = useState<any>(null);
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [depositBalance, setDepositBalance] = useState<number>(0);

  const loadUserProfile = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        if (error.message?.includes('Failed to fetch') || error.message?.includes('network')) {
          toast.error("Network error while loading profile. Some features may be limited.");
        } else if (error.code === 'PGRST116') {
          toast.error("Profile not found. Please contact support.");
        } else {
          toast.error("Failed to load your profile. Please refresh the page.");
        }
        throw error;
      }
      
      setProfile(data);
      setCurrentPlan(data?.membership_plan || "free");
      setDepositBalance(parseFloat(String(data?.deposit_wallet_balance || 0)));
    } catch (error: any) {
      console.error("Failed to load profile:", error);
    }
  }, [user]);

  // Check if plan is expired or expiring soon
  const planStatus = useMemo(() => {
    if (!profile || !profile.plan_expires_at) return null;
    
    const now = new Date();
    const expiryDate = new Date(profile.plan_expires_at);
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      return { status: 'expired', daysUntilExpiry: 0 };
    } else if (daysUntilExpiry <= 7) {
      return { status: 'expiring_soon', daysUntilExpiry };
    }
    return null;
  }, [profile]);

  return {
    profile,
    currentPlan,
    depositBalance,
    planStatus,
    loadUserProfile,
    setCurrentPlan
  };
}
