import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useReferralData } from "@/hooks/useReferralData";
import { useRealtimeReferrals } from "@/hooks/useRealtimeReferrals";
import { usePaginatedReferrals } from "@/hooks/usePaginatedReferrals";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageLayout } from "@/components/layout/PageLayout";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ReferralCodeCard } from "@/components/referrals/ReferralCodeCard";
import { ReferralStatsCard } from "@/components/referrals/ReferralStatsCard";
import { ReferralQRCode } from "@/components/referrals/ReferralQRCode";
import { SocialShareButtons } from "@/components/referrals/SocialShareButtons";
import { CommissionHistoryList } from "@/components/referrals/CommissionHistoryList";
import { CommissionStructureCard } from "@/components/referrals/CommissionStructureCard";
import { UplineInfoCard } from "@/components/referrals/UplineInfoCard";
import { Users, ChevronLeft, ChevronRight, AlertCircle, ArrowRight } from "lucide-react";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const Referrals = () => {
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

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  // Early return ONLY for auth loading (before we have user)
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Authenticating..." />
      </div>
    );
  }

  return (
    <PageLayout
      profile={profile}
      isAdmin={isAdmin}
      onSignOut={signOut}
      isLoading={isReferralDataLoading || !profile}
      loadingText="Loading referrals..."
    >
      {profile && (
        <>
          {/* Header */}
          <header className="bg-card border-b px-4 lg:px-8 py-6">
              <div className="flex-1 mb-4">
                <h1 className="text-2xl font-bold">Referral Program</h1>
                <p className="text-muted-foreground">
                  Invite friends and earn commissions from their activities.
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

            {/* Main Content */}
            <div className="p-4 lg:p-8">
              {/* My Upline Card */}
              <UplineInfoCard upline={upline} isLoading={isReferralDataLoading} />

              {/* Earner Status Banner - Unverified Users Only */}
              {profile?.earnerBadge && !profile.earnerBadge.isVerified && (
                <Alert className="mb-6 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{profile.earnerBadge.icon}</span>
                    <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <AlertTitle className="text-orange-900 dark:text-orange-100">
                    {profile.earnerBadge.badgeText} - No Referral Commissions
                  </AlertTitle>
                  <AlertDescription className="text-orange-800 dark:text-orange-200 space-y-3">
                    <p>{profile.earnerBadge.upgradePrompt}</p>
                    <Button 
                      onClick={() => navigate("/plans")}
                      className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white font-semibold"
                    >
                      Upgrade to Earn Commissions
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Referral Code Card - Full Width */}
              <Card className="p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4">Your Referral Link & Commission</h2>
                
                <ReferralCodeCard
                  referralCode={profile.referral_code}
                  username={profile.username}
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
                  <h2 className="text-xl font-semibold">Your Referrals</h2>
                </div>
                {pagination && pagination.totalCount > 0 && (
                  <span className="text-sm text-muted-foreground">
                    Total: {pagination.totalCount} referral{pagination.totalCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {isReferralsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Loading referrals...</p>
                </div>
              ) : referredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No referrals yet. Share your link to get started!</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            Username
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            Membership
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            Status
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            Total Commission
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            Last Activity
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            Joined
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {referredUsers.map((referral) => (
                          <tr key={referral.id} className="border-b last:border-0">
                            <td className="py-3 px-4">{referral.referredUser.username}</td>
                            <td className="py-3 px-4 capitalize">{referral.referredUser.membershipPlan}</td>
                            <td className="py-3 px-4">
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                referral.status === 'active'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                              }`}>
                                {referral.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-medium text-[hsl(var(--wallet-earnings))]">
                              <CurrencyDisplay amountUSD={referral.totalCommissionEarned} />
                            </td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">
                              {referral.referredUser.lastActivity 
                                ? new Date(referral.referredUser.lastActivity).toLocaleDateString()
                                : 'Never'}
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
                        Page {currentPage} of {pagination.totalPages}
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
                              Previous
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
                              Next
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
        </>
      )}
    </PageLayout>
  );
};

export default Referrals;
