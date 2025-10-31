import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { UserCheck, Calendar, Activity, Award, TrendingUp, Users, Globe, Flag, Network, AlertTriangle, UserPlus, Link2, Shield, AlertCircle, CheckCircle2, Lock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

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

  // PHASE 3: Handler for toggling daily withdrawal bypass
  const handleToggleDailyWithdrawals = async (enabled: boolean) => {
    setIsTogglingBypass(true);
    
    try {
      console.log('Toggling daily withdrawal bypass:', { 
        userId: profile.id, 
        username: profile.username,
        currentValue: profile.allow_daily_withdrawals,
        newValue: enabled 
      });

      const { data, error } = await supabase.functions.invoke('update-user-profile', {
        body: {
          userId: profile.id,
          updates: {
            allow_daily_withdrawals: enabled
          }
        }
      });

      if (error) throw error;

      toast({
        title: enabled ? "Daily Withdrawal Bypass Enabled" : "Daily Withdrawal Bypass Disabled",
        description: enabled 
          ? `${profile.username} can now withdraw any day/time, bypassing schedule restrictions.`
          : `${profile.username} must now follow the standard payout schedule.`,
        variant: "default",
      });

      // Refetch user data to show updated status
      onUserUpdated();
      
    } catch (error: any) {
      console.error('Error toggling daily withdrawal bypass:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update withdrawal bypass setting",
        variant: "destructive",
      });
    } finally {
      setIsTogglingBypass(false);
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
        <CardContent className="space-y-4">
          {/* Toggle Switch */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div className="space-y-1 flex-1">
              <Label className="text-base font-semibold">Allow Daily Withdrawals</Label>
              <p className="text-sm text-muted-foreground">
                Bypass payout schedule restrictions for this user
              </p>
            </div>
            <Switch
              checked={profile.allow_daily_withdrawals || false}
              onCheckedChange={handleToggleDailyWithdrawals}
              disabled={isTogglingBypass}
              className="ml-4"
            />
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Current Status:</p>
            <Badge 
              variant={profile.allow_daily_withdrawals ? "default" : "outline"}
              className="flex items-center gap-1"
            >
              {profile.allow_daily_withdrawals ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  Bypass Enabled
                </>
              ) : (
                <>
                  <Lock className="h-3 w-3" />
                  Standard Schedule
                </>
              )}
            </Badge>
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