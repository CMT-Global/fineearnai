import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserCheck, Calendar, Activity, Award, TrendingUp, Users } from "lucide-react";
import { format } from "date-fns";

interface OverviewTabProps {
  userData: any;
  onEditProfile: () => void;
  onChangePlan: () => void;
  onSuspend: () => void;
  onBan: () => void;
  onResetLimits: () => void;
  onMasterLogin: () => void;
}

export const OverviewTab = ({
  userData,
  onEditProfile,
  onChangePlan,
  onSuspend,
  onBan,
  onResetLimits,
  onMasterLogin,
}: OverviewTabProps) => {
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