import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { UserCheck, Calendar, Activity, Award, TrendingUp, Users, Globe, Flag, Network, AlertTriangle, UserPlus, Link2, Shield, AlertCircle, CheckCircle2, Lock, Crown, XCircle, Clock, Sparkles } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

interface OverviewTabProps {
  userData: any;
  onEditProfile: () => void;
  onChangePlan: () => void;
  onSuspend: () => void;
  onBan: () => void;
  onResetLimits: () => void;
  onMasterLogin: () => void;
  onUserUpdated: () => void;
}

export const OverviewTab = ({
  userData,
  onEditProfile,
  onChangePlan,
  onSuspend,
  onBan,
  onResetLimits,
  onMasterLogin,
  onUserUpdated,
}: OverviewTabProps) => {
  const { toast } = useToast();
  const [isTogglingBypass, setIsTogglingBypass] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [lastBypassUpdate, setLastBypassUpdate] = useState<{ admin: string; timestamp: string } | null>(null);
  
  // PHASE 1 & 2: Local state for optimistic updates
  const [currentBypassValue, setCurrentBypassValue] = useState(false);
  
  // PHASE 2: Smart sync with tri-state guard and fallback fetch
  useEffect(() => {
    const syncBypassValue = async () => {
      if (!userData?.profile?.id) return;
      
      const aggregatedValue = userData.profile.allow_daily_withdrawals;
      
      // Tri-state guard: only proceed if value is explicitly boolean
      if (typeof aggregatedValue === 'boolean') {
        setCurrentBypassValue(aggregatedValue);
        console.log('✅ PHASE 2: Using aggregated value:', {
          timestamp: new Date().toISOString(),
          userId: userData.profile.id,
          username: userData.profile.username,
          source: 'aggregated_function',
          value: aggregatedValue
        });
        return;
      }
      
      // Fallback: If undefined, fetch directly from profiles table
      console.log('⚠️ PHASE 2: Aggregated value undefined, fetching fallback:', {
        timestamp: new Date().toISOString(),
        userId: userData.profile.id,
        username: userData.profile.username,
        aggregatedValue,
        action: 'lightweight_fallback_fetch'
      });
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('allow_daily_withdrawals')
          .eq('id', userData.profile.id)
          .single();
        
        if (error) throw error;
        
        const fallbackValue = data?.allow_daily_withdrawals ?? false;
        setCurrentBypassValue(fallbackValue);
        
        console.log('✅ PHASE 2: Fallback fetch successful:', {
          timestamp: new Date().toISOString(),
          userId: userData.profile.id,
          source: 'direct_profiles_query',
          value: fallbackValue,
          rawData: data
        });
      } catch (error: any) {
        console.error('❌ PHASE 2: Fallback fetch failed:', {
          timestamp: new Date().toISOString(),
          userId: userData.profile.id,
          error: error.message,
          defaultingTo: false
        });
        setCurrentBypassValue(false);
      }
    };
    
    syncBypassValue();
  }, [userData?.profile?.allow_daily_withdrawals, userData?.profile?.id]);

  // PHASE 3: Fetch last bypass update info with two-step safe query
  useEffect(() => {
    const fetchLastBypassUpdate = async () => {
      if (!userData?.profile?.id) return;
      
      console.log('📋 PHASE 3: Fetching audit log history:', {
        timestamp: new Date().toISOString(),
        userId: userData.profile.id,
        action: 'two_step_safe_query'
      });
      
      try {
        // Step 1: Fetch the latest audit log entry (no FK join)
        const { data: auditLog, error: auditError } = await supabase
          .from('audit_logs')
          .select('admin_id, created_at')
          .eq('target_user_id', userData.profile.id)
          .eq('action_type', 'profile_update')
          .like('details', '%withdrawal_bypass_changed%')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (auditError) {
          console.error('❌ PHASE 3: Audit log query failed:', auditError);
          return;
        }

        if (!auditLog) {
          console.log('ℹ️ PHASE 3: No audit log history found');
          return;
        }

        console.log('✅ PHASE 3: Audit log found:', {
          adminId: auditLog.admin_id,
          createdAt: auditLog.created_at
        });

        // Step 2: If admin_id exists, fetch the admin's username separately
        if (auditLog.admin_id) {
          const { data: adminProfile, error: profileError } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', auditLog.admin_id)
            .maybeSingle();

          if (profileError) {
            console.error('❌ PHASE 3: Admin profile query failed:', profileError);
            setLastBypassUpdate({
              admin: 'Admin',
              timestamp: auditLog.created_at
            });
            return;
          }

          console.log('✅ PHASE 3: Admin profile found:', {
            username: adminProfile?.username || 'Admin'
          });

          setLastBypassUpdate({
            admin: adminProfile?.username || 'Admin',
            timestamp: auditLog.created_at
          });
        } else {
          console.log('ℹ️ PHASE 3: No admin_id in audit log');
          setLastBypassUpdate({
            admin: 'System',
            timestamp: auditLog.created_at
          });
        }
      } catch (err: any) {
        console.error('❌ PHASE 3: Unexpected error:', {
          error: err.message,
          stack: err.stack
        });
      }
    };

    fetchLastBypassUpdate();
  }, [userData?.profile?.id, userData?.profile?.allow_daily_withdrawals]);

  if (!userData) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const profile = userData.profile;
  const stats = userData.stats;
  const planInfo = userData.plan_info;
  const upline = userData.upline;
  const referralDetails = userData.referral_details;
  const navigate = useNavigate();

  // PHASE 1: Handler for toggling daily withdrawal bypass with optimistic update
  const handleToggleDailyWithdrawals = async (enabled: boolean) => {
    console.log('🎯 Toggle Initiated:', {
      timestamp: new Date().toISOString(),
      userId: profile.id,
      username: profile.username,
      previousLocalState: currentBypassValue,
      previousDatabaseValue: profile.allow_daily_withdrawals,
      requestedValue: enabled,
      action: enabled ? 'ENABLE' : 'DISABLE'
    });

    // Show confirmation dialog when disabling (security-critical action)
    if (!enabled && currentBypassValue) {
      console.log('⚠️ Showing confirmation dialog for DISABLE action');
      setShowDisableDialog(true);
      return;
    }

    // PHASE 1: Optimistic update - immediately update UI
    setCurrentBypassValue(enabled);
    console.log('⚡ Optimistic update applied:', {
      newLocalState: enabled,
      uiUpdated: true
    });

    await performBypassToggle(enabled);
  };

  const performBypassToggle = async (enabled: boolean) => {
    // PHASE 1: Save previous value for rollback on error
    const previousValue = currentBypassValue;
    setIsTogglingBypass(true);
    
    console.log('🚀 API Call Starting:', {
      timestamp: new Date().toISOString(),
      userId: profile.id,
      username: profile.username,
      previousLocalState: previousValue,
      databaseValue: profile.allow_daily_withdrawals,
      targetValue: enabled,
      isLoading: true
    });
    
    try {
      const { data, error } = await supabase.functions.invoke('update-user-profile', {
        body: {
          userId: profile.id,
          updates: {
            allow_daily_withdrawals: enabled
          }
        }
      });

      if (error) throw error;

      console.log('✅ API Call Successful:', {
        timestamp: new Date().toISOString(),
        userId: profile.id,
        newValue: enabled,
        response: data
      });

      // Enhanced toast with larger text and longer duration
      toast({
        title: enabled ? "✅ VIP Bypass Enabled" : "🔒 Bypass Disabled",
        description: enabled 
          ? `${profile.username} can now withdraw ANY TIME, bypassing all schedule restrictions. This action has been logged.`
          : `${profile.username} must now follow the standard payout schedule. All users will be notified.`,
        variant: enabled ? "default" : "destructive",
        duration: 8000, // 8 seconds
      });

      // PHASE 1: Force query invalidation and refetch
      console.log('🔄 Triggering data refetch...');
      await new Promise(resolve => setTimeout(resolve, 200)); // Allow DB to commit
      onUserUpdated();
      
    } catch (error: any) {
      // PHASE 1: Rollback optimistic update on error
      console.error('❌ API Call Failed - Rolling back:', {
        timestamp: new Date().toISOString(),
        error: error.message,
        sqlState: error.code,
        rollingBackTo: previousValue
      });
      
      setCurrentBypassValue(previousValue);
      
      toast({
        title: "❌ Update Failed",
        description: (
          <div className="space-y-2">
            <p>{error.message || "Failed to update withdrawal bypass setting."}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setCurrentBypassValue(enabled);
                performBypassToggle(enabled);
              }}
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        ),
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setIsTogglingBypass(false);
      setShowDisableDialog(false);
      
      console.log('🏁 Toggle Operation Complete:', {
        timestamp: new Date().toISOString(),
        finalLocalState: currentBypassValue,
        isLoading: false
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Profile Information</CardTitle>
            <Button variant="outline" size="sm" onClick={onEditProfile}>
              Edit Profile
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Username</p>
              <p className="font-medium">{profile.username}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{profile.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Full Name</p>
              <p className="font-medium">{profile.full_name || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{profile.phone || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Country</p>
              <p className="font-medium">{profile.country || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge
                variant={
                  profile.account_status === "active"
                    ? "default"
                    : profile.account_status === "suspended"
                    ? "secondary"
                    : "destructive"
                }
              >
                {profile.account_status}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Referral Code</p>
              <p className="font-mono font-medium">{profile.referral_code}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Admin</p>
              <Badge variant={userData.is_admin ? "default" : "outline"}>
                {userData.is_admin ? "Yes" : "No"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upline Information Card */}
      {upline ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Upline Information
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate(`/admin/users/${upline.id}`)}
              >
                View Upline Profile
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Upline Username</p>
                <p className="font-medium">{upline.username}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Upline Email</p>
                <p className="font-medium">{upline.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Upline Plan</p>
                <Badge variant="outline">{upline.membership_plan}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Upline Status</p>
                <Badge
                  variant={
                    upline.account_status === "active"
                      ? "default"
                      : upline.account_status === "suspended"
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {upline.account_status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Referral Code Used</p>
                <p className="font-mono font-medium">{referralDetails?.referral_code_used || upline.referral_code}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Commission Earned by Upline</p>
                <p className="font-medium text-lg text-green-600">
                  ${(referralDetails?.total_commission_earned || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Referral Status</p>
                <Badge variant={referralDetails?.status === "active" ? "default" : "secondary"}>
                  {referralDetails?.status || "unknown"}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Referred On</p>
                <p className="font-medium">
                  {referralDetails?.created_at 
                    ? format(new Date(referralDetails.created_at), "PPP")
                    : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Upline Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Link2 className="h-4 w-4" />
              <p className="text-sm">This user signed up without a referral link</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Location & Security Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Location & Security Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Registration Details */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Registration Location</Label>
              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-muted-foreground" />
                  <span>{profile.registration_country_name || "Unknown"}</span>
                  {profile.registration_country && (
                    <Badge variant="outline">{profile.registration_country}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Network className="h-4 w-4" />
                  <span className="font-mono text-xs">{profile.registration_ip || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Last Login Details */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Last Login Location</Label>
              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-muted-foreground" />
                  <span>{profile.last_login_country_name || "Unknown"}</span>
                  {profile.last_login_country && (
                    <Badge variant="outline">{profile.last_login_country}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Network className="h-4 w-4" />
                  <span className="font-mono text-xs">{profile.last_login_ip || "N/A"}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {profile.last_login && formatDistanceToNow(new Date(profile.last_login), { addSuffix: true })}
                </div>
              </div>
            </div>
          </div>

          {/* Security Alert: Different countries */}
          {profile.registration_country && 
           profile.last_login_country && 
           profile.registration_country !== profile.last_login_country && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Location Change Detected</AlertTitle>
              <AlertDescription>
                This user registered from {profile.registration_country_name} but last logged in from {profile.last_login_country_name}.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(stats.total_earned || 0).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total_tasks || 0} tasks completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accuracy</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.accuracy || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.correct_tasks || 0} correct / {stats.wrong_tasks || 0} wrong
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_referrals || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats.active_referrals || 0} active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Account Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Account Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Joined</p>
                <p className="text-sm text-muted-foreground">
                  {profile.created_at ? format(new Date(profile.created_at), "PPP") : "-"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Last Login</p>
                <p className="text-sm text-muted-foreground">
                  {profile.last_login ? format(new Date(profile.last_login), "PPP") : "Never"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Last Activity</p>
                <p className="text-sm text-muted-foreground">
                  {profile.last_activity ? format(new Date(profile.last_activity), "PPP") : "Never"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Membership Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Membership Plan</CardTitle>
            <Button variant="outline" size="sm" onClick={onChangePlan}>
              Change Plan
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <p className="font-medium text-lg">{planInfo?.display_name || profile.membership_plan}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Plan Type</p>
              <Badge>{planInfo?.account_type || "unknown"}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Expires At</p>
              <p className="font-medium">
                {profile.plan_expires_at
                  ? format(new Date(profile.plan_expires_at), "PPP")
                  : "No expiry"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Daily Task Limit</p>
              <p className="font-medium">{planInfo?.daily_task_limit || 0} tasks</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Earning Per Task</p>
              <p className="font-medium">${planInfo?.earning_per_task || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Auto Renew</p>
              <Badge variant={profile.auto_renew ? "default" : "outline"}>
                {profile.auto_renew ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PHASE 3: Withdrawal Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Withdrawal Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* PHASE 1: Enhanced Toggle Switch with Clear Visual Feedback + Loading State */}
          <div 
            className={`relative p-5 border-2 rounded-lg transition-all duration-300 ${
              currentBypassValue 
                ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-500 dark:border-green-600 shadow-lg shadow-green-100 dark:shadow-green-900/20' 
                : 'bg-muted/30 border-muted-foreground/20'
            }`}
          >
            {/* Pulsing indicator for active bypass */}
            {currentBypassValue && (
              <div className="absolute top-3 right-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <Label className="text-lg font-bold">Allow Daily Withdrawals</Label>
                  {currentBypassValue && (
                    <Badge variant="default" className="bg-green-600 hover:bg-green-700 gap-1">
                      <Crown className="h-3 w-3" />
                      VIP ACCESS
                    </Badge>
                  )}
                  {/* PHASE 1: Loading Badge */}
                  {isTogglingBypass && (
                    <Badge variant="outline" className="animate-pulse gap-1">
                      <Activity className="h-3 w-3 animate-spin" />
                      Updating...
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Bypass payout schedule restrictions for this user
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Visual Status Label */}
                <div className="text-right">
                  <div className={`text-sm font-bold ${
                    currentBypassValue 
                      ? 'text-green-700 dark:text-green-400' 
                      : 'text-muted-foreground'
                  }`}>
                    {currentBypassValue ? 'ENABLED' : 'DISABLED'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {currentBypassValue ? 'Active Now' : 'Standard Mode'}
                  </div>
                </div>
                
                {/* PHASE 1: Toggle Switch bound to local state */}
                <Switch
                  checked={currentBypassValue}
                  onCheckedChange={handleToggleDailyWithdrawals}
                  disabled={isTogglingBypass}
                  className={`data-[state=checked]:bg-green-600 scale-125 transition-opacity ${
                    isTogglingBypass ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                />
              </div>
            </div>

            {/* Status Indicator Icon */}
            <div className="mt-4 pt-4 border-t border-current/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {currentBypassValue ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                        Bypass Active - User can withdraw anytime
                      </span>
                      <Sparkles className="h-4 w-4 text-yellow-500 animate-pulse" />
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">
                        Standard schedule applies
                      </span>
                    </>
                  )}
                </div>
                
                {/* Last Updated Info */}
                {lastBypassUpdate && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      Modified {formatDistanceToNow(new Date(lastBypassUpdate.timestamp), { addSuffix: true })}
                      {' by '}
                      <span className="font-semibold">{lastBypassUpdate.admin}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Informational Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>How This Feature Works</AlertTitle>
            <AlertDescription className="space-y-2 mt-2">
              <p><strong>When Enabled:</strong></p>
              <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                <li>User can withdraw <strong>any day, any time</strong> (bypasses payout schedule)</li>
                <li>Schedule restrictions like "Friday 00:00-13:00 UTC" are ignored</li>
                <li>Useful for VIP users, special cases, or customer support resolutions</li>
              </ul>
              
              <p className="pt-2"><strong>Limits That Still Apply:</strong></p>
              <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                <li>Minimum withdrawal amount (from membership plan)</li>
                <li>Maximum daily withdrawal limit</li>
                <li>Account balance checks</li>
                <li>Rate limiting (10 requests per hour)</li>
              </ul>

              <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs">
                <strong>⚠️ Security:</strong> All bypass usage is logged in audit trail for compliance and monitoring.
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Confirmation Dialog for Disabling Bypass */}
      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Disable VIP Withdrawal Bypass?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p>
                You are about to <strong>disable</strong> the daily withdrawal bypass for{' '}
                <strong className="text-foreground">{profile.username}</strong>.
              </p>
              
              <div className="p-3 bg-muted rounded-lg border border-muted-foreground/20">
                <p className="text-sm font-semibold mb-2">This means:</p>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li>User will <strong>only</strong> be able to withdraw during scheduled times</li>
                  <li>Pending withdrawal requests may be affected</li>
                  <li>User will see the standard withdrawal countdown timer</li>
                </ul>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  🔒 Security Note: This action will be logged in the audit trail.
                </p>
              </div>

              <p className="text-sm font-medium">
                Are you sure you want to proceed?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => performBypassToggle(false)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Yes, Disable Bypass
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onResetLimits}>
              Reset Daily Limits
            </Button>
            <Button
              variant={profile.account_status === "suspended" ? "default" : "outline"}
              size="sm"
              onClick={onSuspend}
            >
              {profile.account_status === "suspended" ? "Unsuspend" : "Suspend"} User
            </Button>
            <Button variant="destructive" size="sm" onClick={onBan}>
              Ban User
            </Button>
            <Button variant="secondary" size="sm" onClick={onMasterLogin}>
              Generate Master Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};