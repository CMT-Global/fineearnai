import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sidebar } from "@/components/layout/Sidebar";
import { ReferralCodeCard } from "@/components/referrals/ReferralCodeCard";
import { ReferralStatsCard } from "@/components/referrals/ReferralStatsCard";
import { ReferralQRCode } from "@/components/referrals/ReferralQRCode";
import { SocialShareButtons } from "@/components/referrals/SocialShareButtons";
import { UplineInfoCard } from "@/components/referrals/UplineInfoCard";
import { CommissionHistoryList } from "@/components/referrals/CommissionHistoryList";
import { CommissionStructureCard } from "@/components/referrals/CommissionStructureCard";
import { Users, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/wallet-utils";
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
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [referredUsers, setReferredUsers] = useState<any[]>([]);
  const [recentEarnings, setRecentEarnings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadPaginatedReferrals(currentPage);
    }
  }, [user, currentPage]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // Load referral stats
      const { data: statsData, error: statsError } = await supabase
        .rpc("get_referral_stats", { user_uuid: user?.id });

      if (statsError) {
        console.error("Error loading stats:", statsError);
      } else if (statsData && statsData.length > 0) {
        setStats(statsData[0]);
      }

    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load referral data");
    } finally {
      setIsLoading(false);
    }
  };

  const loadPaginatedReferrals = async (page: number) => {
    try {
      const { data, error } = await supabase.functions.invoke("get-paginated-referrals", {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: {
          page,
          limit: 20,
        },
      });

      if (error) {
        console.error("Error loading paginated referrals:", error);
        toast.error("Failed to load referrals");
        return;
      }

      if (data?.success) {
        setReferredUsers(data.data);
        setTotalPages(data.pagination.totalPages);
        setTotalReferrals(data.pagination.totalCount);
        setHasNextPage(data.pagination.hasNextPage);
        setHasPreviousPage(data.pagination.hasPreviousPage);
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load referrals");
    }
  };

  if (loading || isLoading || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      <Sidebar profile={profile} isAdmin={isAdmin} onSignOut={signOut} />
      
      <main className="flex-1 overflow-auto lg:mt-0 mt-16">
        {/* Header */}
        <header className="bg-card border-b px-4 lg:px-8 py-6">
          <div className="flex-1 mb-4">
            <h1 className="text-2xl font-bold">Referral Program</h1>
            <p className="text-muted-foreground">
              Invite friends and earn commissions from their activities.
            </p>
          </div>

          {/* Upline Info - Compact Banner */}
          <UplineInfoCard userId={user?.id || ""} />

          {/* Stats */}
          <ReferralStatsCard
            totalReferrals={stats?.total_referrals || 0}
            activeReferrals={stats?.active_referrals || 0}
            totalEarnings={parseFloat(stats?.total_earnings || 0)}
            taskCommissionEarnings={parseFloat(stats?.task_commission_earnings || 0)}
          />
        </header>

        {/* Main Content */}
        <div className="p-4 lg:p-8">
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
                  referralUrl={`${window.location.origin}?ref=${profile.referral_code}`}
                  username={profile.username}
                />
              </div>

              <SocialShareButtons
                referralUrl={`${window.location.origin}?ref=${profile.referral_code}`}
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
            {totalReferrals > 0 && (
              <span className="text-sm text-muted-foreground">
                Total: {totalReferrals} referral{totalReferrals !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {referredUsers.length === 0 ? (
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
                          {formatCurrency(referral.totalCommissionEarned)}
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
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </p>
                  
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={!hasPreviousPage}
                          className="gap-1"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                      </PaginationItem>

                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
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
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={!hasNextPage}
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
      </main>
    </div>
  );
};

export default Referrals;
