import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useReferralData } from "@/hooks/useReferralData";
import { useRealtimeReferrals } from "@/hooks/useRealtimeReferrals";
import { usePaginatedReferrals } from "@/hooks/usePaginatedReferrals";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageLoading } from "@/components/shared/PageLoading";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ReferralCodeCard } from "@/components/referrals/ReferralCodeCard";
import { ReferralStatsCard } from "@/components/referrals/ReferralStatsCard";
import { ReferralQRCode } from "@/components/referrals/ReferralQRCode";
import { SocialShareButtons } from "@/components/referrals/SocialShareButtons";
import { CommissionHistoryList } from "@/components/referrals/CommissionHistoryList";
import { CommissionStructureCard } from "@/components/referrals/CommissionStructureCard";
import { UplineInfoCard } from "@/components/referrals/UplineInfoCard";
import { HowTaskCommissionsWork } from "@/components/referrals/HowTaskCommissionsWork";
import { Users, ChevronLeft, ChevronRight, AlertCircle, ArrowRight } from "lucide-react";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { supabase } from "@/integrations/supabase/client";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReferralAnalyticsTab } from "@/components/referrals/ReferralAnalyticsTab";
import { useTranslation } from "react-i18next";

const Referrals = () => {
  const { t } = useTranslation();
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);

  // ✅ NEW: Single React Query hook for all referral data (including upline)
  const { data: referralData, isLoading: isReferralDataLoading } = useReferralData(user?.id);
  
  // ✅ Enable real-time referral updates (matches transaction pattern)
  useRealtimeReferrals(user?.id);
  
  const { profile, stats, upline } = referralData || {};

  // ✅ NEW: Separate hook for paginated referrals
  const { data: paginatedData, isLoading: isReferralsLoading } = usePaginatedReferrals(user?.id, currentPage);
  const { referrals: referredUsers, pagination } = paginatedData || { referrals: [], pagination: null };

  // Fetch platform name from admin panel
  const { data: platformName } = useQuery({
    queryKey: ["platform-name"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("value")
        .eq("key", "platform_name")
        .maybeSingle();

      if (error) throw error;
      // platform_name is stored as a string directly, not as an object
      return (data?.value as string) || "ProfitChips";
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch default plan (Trainee) display name from membership_plans (admin-configured)
  const { data: defaultPlanDisplayName } = useQuery({
    queryKey: ["default-plan-display-name"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membership_plans")
        .select("display_name")
        .eq("account_type", "free")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return (data?.display_name as string) || "";
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    document.title = `${t("referrals.title")} | ProfitChips`;
    return () => {
      document.title = "ProfitChips";
    };
  }, [t]);

  // Early return ONLY for auth loading (before we have user)
  if (loading || !user) {
    return <PageLoading text={t("dashboard.authenticating")} />;
  }

  if (isReferralDataLoading || !profile) {
    return <PageLoading text={t("referrals.loadingReferrals")} />;
  }

  return (
    <>
      {/* Header */}
          <header className="bg-card border-b px-4 lg:px-8 py-6">
              <div className="flex-1 mb-4">
                <h1 className="text-2xl font-bold">{t("referrals.title")}</h1>
                <p className="text-muted-foreground">
                  {t("referrals.subtitle")}
                </p>
              </div>

              {/* Stats */}
              <ReferralStatsCard
                totalReferrals={stats?.total_referrals || 0}
                activeReferrals={stats?.active_referrals || 0}
                totalEarnings={Number(stats?.total_earnings || 0)}
                taskCommissionEarnings={Number(stats?.task_commission_earnings || 0)}
              />
            </header>

            {/* Tabs: Overview (current content) / Analytics */}
            <Tabs defaultValue="overview" className="w-full">
              <div className="px-4 lg:px-8 pt-4">
                <TabsList>
                  <TabsTrigger value="overview">{t("referrals.tabs.overview")}</TabsTrigger>
                  <TabsTrigger value="analytics">{t("referrals.tabs.analytics")}</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="overview" className="mt-0">
            {/* Main Content - Overview */}
            <div className="p-4 lg:p-8">
              {/* My Upline Card */}
              <UplineInfoCard upline={upline} isLoading={isReferralDataLoading} />

              {/* Default plan (Trainee) banner - task commissions locked (only for unverified / Trainee users) */}
              {profile?.earnerBadge && !profile.earnerBadge.isVerified && (
                <Alert className="mb-6 bg-orange-500/10 border-orange-500/20">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{profile.earnerBadge.icon}</span>
                    <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-500" />
                  </div>
                  <AlertTitle className="text-orange-700 dark:text-orange-400">
                    {t("referrals.freePlanBannerTitle", { planName: defaultPlanDisplayName || t("referrals.defaultPlan") })}
                  </AlertTitle>
                  <AlertDescription className="text-orange-800 dark:text-orange-300 space-y-3">
                    <p>{t("referrals.freePlanBannerMessage", { planName: defaultPlanDisplayName || t("referrals.defaultPlan") })}</p>
                    <Button 
                      onClick={() => navigate("/plans")}
                      className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white font-semibold"
                    >
                      {t("referrals.freePlanBannerCta")}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* How Task Commissions Work - Collapsible */}
              <div className="mb-6">
                <HowTaskCommissionsWork />
              </div>

              {/* Referral Code Card - Full Width */}
              <Card className="p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4">{t("referrals.yourReferralLink")}</h2>
                
                <ReferralCodeCard
                  referralCode={profile.referral_code}
                  username={profile.username}
                  platformName={platformName}
                />

                <div className="mt-4 pt-4 border-t space-y-4">
                  <div className="flex gap-2">
                    <ReferralQRCode
                      referralUrl={`${window.location.origin}/signup?ref=${profile.referral_code}`}
                      username={profile.username}
                    />
                  </div>

                  <SocialShareButtons
                    referralUrl={`${window.location.origin}/signup?ref=${profile.referral_code}`}
                    username={profile.username}
                    platformName={platformName}
                  />
                </div>
              </Card>

            {/* Commission Structure */}
            <div className="mb-8">
              <CommissionStructureCard userPlan={profile.membership_plan} />
            </div>

            {/* Referred Users */}
            <Card className="p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <h2 className="text-xl font-semibold">{t("referrals.yourReferrals")}</h2>
                </div>
                {pagination && pagination.totalCount > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {t("referrals.totalReferrals", { count: pagination.totalCount })}
                  </span>
                )}
              </div>

              {isReferralsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>{t("referrals.loadingReferrals")}</p>
                </div>
              ) : referredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>{t("referrals.noReferrals")}</p>
                  <p className="text-sm mt-2">{t("referrals.noReferralsDescription")}</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            {t("referrals.tableHeaders.username")}
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            {t("referrals.tableHeaders.membership")}
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            {t("referrals.tableHeaders.status")}
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            {t("referrals.tableHeaders.totalCommission")}
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            {t("referrals.tableHeaders.lastActivity")}
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            {t("referrals.tableHeaders.joined")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {referredUsers.map((referral) => (
                          <tr key={referral.id} className="border-b last:border-0">
                            <td className="py-3 px-4">{referral.referredUser.username}</td>
                            <td className="py-3 px-4 capitalize">
                              {(() => {
                                const planKey = `referrals.planNames.${referral.referredUser.membershipPlan}`;
                                const translated = t(planKey);
                                return translated !== planKey ? translated : referral.referredUser.membershipPlan;
                              })()}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                referral.status === 'active'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                              }`}>
                                {(() => {
                                  const statusKey = `referrals.statuses.${referral.status}`;
                                  const translated = t(statusKey);
                                  return translated !== statusKey ? translated : referral.status;
                                })()}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-medium text-[hsl(var(--wallet-earnings))]">
                              <CurrencyDisplay amountUSD={referral.totalCommissionEarned} />
                            </td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">
                              {referral.referredUser.lastActivity 
                                ? new Date(referral.referredUser.lastActivity).toLocaleDateString()
                                : t("referrals.never")}
                            </td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">
                              {new Date(referral.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {pagination && pagination.totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {t("referrals.page")} {currentPage} {t("referrals.of")} {pagination.totalPages}
                      </p>
                      
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={!pagination.hasPreviousPage}
                              className="gap-1"
                            >
                              <ChevronLeft className="h-4 w-4" />
                              {t("referrals.previous")}
                            </Button>
                          </PaginationItem>

                          {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                            let pageNum;
                            if (pagination.totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= pagination.totalPages - 2) {
                              pageNum = pagination.totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }

                            return (
                              <PaginationItem key={pageNum}>
                                <PaginationLink
                                  onClick={() => setCurrentPage(pageNum)}
                                  isActive={currentPage === pageNum}
                                  className="cursor-pointer"
                                >
                                  {pageNum}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          })}

                          <PaginationItem>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                              disabled={!pagination.hasNextPage}
                              className="gap-1"
                            >
                              {t("referrals.next")}
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              )}
            </Card>

            {/* Commission History */}
            <CommissionHistoryList userId={user?.id || ""} />
          </div>
              </TabsContent>

              <TabsContent value="analytics" className="mt-0">
                <div className="p-4 lg:p-8">
                  <ReferralAnalyticsTab userId={user?.id ?? ""} />
                </div>
              </TabsContent>
            </Tabs>
    </>
  );
};

export default Referrals;
