import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, UserX, Ban, DollarSign, TrendingUp, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";

interface UserManagementStatsProps {
  stats: any;
  isLoading: boolean;
}

export const UserManagementStats = ({ stats, isLoading }: UserManagementStatsProps) => {
  const { t } = useTranslation();
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: t("admin.users.stats.totalUsers"),
      value: stats?.total_users?.toLocaleString() || "0",
      icon: Users,
      description: t("admin.users.stats.allRegisteredUsers"),
      color: "text-blue-600",
    },
    {
      title: t("admin.users.stats.activeUsers"),
      value: stats?.active_users?.toLocaleString() || "0",
      icon: UserCheck,
      description: t("admin.users.stats.percentOfTotal", { 
        percent: ((stats?.active_users / stats?.total_users) * 100 || 0).toFixed(1) 
      }),
      color: "text-green-600",
    },
    {
      title: t("admin.users.stats.suspended"),
      value: stats?.suspended_users?.toLocaleString() || "0",
      icon: UserX,
      description: t("admin.users.stats.temporarilySuspended"),
      color: "text-yellow-600",
    },
    {
      title: t("admin.users.stats.banned"),
      value: stats?.banned_users?.toLocaleString() || "0",
      icon: Ban,
      description: t("admin.users.stats.permanentlyBanned"),
      color: "text-red-600",
    },
    {
      title: t("admin.users.stats.platformBalance"),
      value: `$${(stats?.total_platform_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      description: t("admin.users.stats.totalLockedValue"),
      color: "text-purple-600",
    },
    {
      title: t("admin.users.stats.totalEarningsPaid"),
      value: `$${(stats?.total_earnings_paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: TrendingUp,
      description: t("admin.users.stats.lifetimePayouts"),
      color: "text-indigo-600",
    },
    {
      title: t("admin.users.stats.activeReferrals"),
      value: stats?.active_referrals_count?.toLocaleString() || "0",
      icon: Activity,
      description: t("admin.users.stats.totalReferralNetwork"),
      color: "text-teal-600",
    },
    {
      title: t("admin.users.stats.paidPlans"),
      value: `${((stats?.paid_plan_users / stats?.total_users) * 100 || 0).toFixed(1)}%`,
      icon: TrendingUp,
      description: t("admin.users.stats.users", { 
        count: stats?.paid_plan_users?.toLocaleString() || "0" 
      }),
      color: "text-orange-600",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};