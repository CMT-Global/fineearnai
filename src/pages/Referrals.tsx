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
import { Users, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/wallet-utils";

const Referrals = () => {
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [referredUsers, setReferredUsers] = useState<any[]>([]);
  const [recentEarnings, setRecentEarnings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

      // Load referred users
      const { data: referredData } = await supabase
        .from("profiles")
        .select("id, username, created_at, tasks_completed_today, membership_plan")
        .eq("referred_by", user?.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (referredData) {
        setReferredUsers(referredData);
      }

      // Load recent referral earnings
      const { data: earningsData } = await supabase
        .from("referral_earnings")
        .select("*")
        .eq("referrer_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (earningsData) {
        setRecentEarnings(earningsData);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load referral data");
    } finally {
      setIsLoading(false);
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
              Invite friends and earn commission from their tasks
            </p>
          </div>

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Referral Code */}
          <ReferralCodeCard
            referralCode={profile.referral_code}
            username={profile.username}
          />

          {/* How It Works */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">How Referrals Work</h2>
            <ol className="space-y-3">
              <li className="flex gap-3">
                <div className="flex-shrink-0 h-6 w-6 rounded-full bg-[hsl(var(--wallet-referrals))]/10 flex items-center justify-center text-[hsl(var(--wallet-referrals))] text-sm font-semibold">
                  1
                </div>
                <p className="text-sm">Share your unique referral link with friends</p>
              </li>
              <li className="flex gap-3">
                <div className="flex-shrink-0 h-6 w-6 rounded-full bg-[hsl(var(--wallet-referrals))]/10 flex items-center justify-center text-[hsl(var(--wallet-referrals))] text-sm font-semibold">
                  2
                </div>
                <p className="text-sm">When they sign up and upgrade their account, you earn a deposit commission</p>
              </li>
              <li className="flex gap-3">
                <div className="flex-shrink-0 h-6 w-6 rounded-full bg-[hsl(var(--wallet-referrals))]/10 flex items-center justify-center text-[hsl(var(--wallet-referrals))] text-sm font-semibold">
                  3
                </div>
                <p className="text-sm">Earn ongoing commissions from tasks they complete daily</p>
              </li>
              <li className="flex gap-3">
                <div className="flex-shrink-0 h-6 w-6 rounded-full bg-[hsl(var(--wallet-referrals))]/10 flex items-center justify-center text-[hsl(var(--wallet-referrals))] text-sm font-semibold">
                  4
                </div>
                <p className="text-sm">Commission rates depend on your membership plan</p>
              </li>
            </ol>

            <div className="mt-4 p-4 bg-[hsl(var(--wallet-earnings))]/5 border border-[hsl(var(--wallet-earnings))]/20 rounded-lg">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-[hsl(var(--wallet-earnings))] flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Upgrade your account to unlock higher commission rates and more active referral slots
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Referred Users */}
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Your Referrals</h2>
          </div>

          {referredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No referrals yet. Share your link to get started!</p>
            </div>
          ) : (
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
                      Tasks Today
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {referredUsers.map((user) => (
                    <tr key={user.id} className="border-b last:border-0">
                      <td className="py-3 px-4">{user.username}</td>
                      <td className="py-3 px-4 capitalize">{user.membership_plan}</td>
                      <td className="py-3 px-4">{user.tasks_completed_today}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Recent Earnings */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Commission Earnings</h2>

          {recentEarnings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No commission earnings yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Type
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Base Amount
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Rate
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Commission
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentEarnings.map((earning) => (
                    <tr key={earning.id} className="border-b last:border-0">
                      <td className="py-3 px-4 capitalize">
                        {earning.earning_type.replace("_", " ")}
                      </td>
                      <td className="py-3 px-4">{formatCurrency(earning.base_amount)}</td>
                      <td className="py-3 px-4">{earning.commission_rate}%</td>
                      <td className="py-3 px-4 font-semibold text-[hsl(var(--wallet-earnings))]">
                        +{formatCurrency(earning.commission_amount)}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {new Date(earning.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        </div>
      </main>
    </div>
  );
};

export default Referrals;
