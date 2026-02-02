import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { TrendingUp, User, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";

interface CommissionHistoryListProps {
  userId: string;
}

interface CommissionEarning {
  id: string;
  earning_type: string;
  base_amount: number;
  commission_rate: number;
  commission_amount: number;
  created_at: string;
  referred_user_id: string;
  metadata: any;
}

interface UserProfile {
  id: string;
  username: string;
}

export const CommissionHistoryList = ({ userId }: CommissionHistoryListProps) => {
  const { t } = useTranslation();
  const [earnings, setEarnings] = useState<CommissionEarning[]>([]);
  const [users, setUsers] = useState<Map<string, UserProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    loadCommissionHistory();
  }, [userId]);

  const loadCommissionHistory = async () => {
    try {
      // Load referral earnings
      const { data: earningsData, error } = await supabase
        .from("referral_earnings")
        .select("*")
        .eq("referrer_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      if (earningsData) {
        setEarnings(earningsData);

        // Load user profiles for referred users
        const userIds = [...new Set(earningsData.map(e => e.referred_user_id))];
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, username")
            .in("id", userIds);

          if (profilesData) {
            const userMap = new Map(profilesData.map(p => [p.id, p]));
            setUsers(userMap);
          }
        }
      }
    } catch (error) {
      console.error("Error loading commission history:", error);
      toast.error(t("referrals.toasts.failedToLoadCommissionHistory"));
    } finally {
      setLoading(false);
    }
  };

  const filteredEarnings = filter === "all" 
    ? earnings 
    : earnings.filter(e => e.earning_type === filter);

  const getEarningTypeLabel = (type: string) => {
    return type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Loading commission history...</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5" />
        <h2 className="text-xl font-semibold">Commission History</h2>
      </div>

      <Tabs value={filter} onValueChange={setFilter} className="w-full">
        <div className="w-full overflow-x-auto pb-1 scrollbar-none">
          <TabsList className="inline-flex w-full min-w-[400px] sm:min-w-0 sm:grid sm:grid-cols-3">
            <TabsTrigger value="all" className="whitespace-nowrap">
              {t("wallet.all")}
            </TabsTrigger>
            <TabsTrigger value="task_commission" className="whitespace-nowrap">
              {t("membershipPlans.taskCommission")}
            </TabsTrigger>
            <TabsTrigger value="deposit_commission" className="whitespace-nowrap">
              {t("membershipPlans.depositCommission")}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={filter} className="mt-4">
          {filteredEarnings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No commission earnings yet</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {filteredEarnings.map((earning) => {
                  const referredUser = users.get(earning.referred_user_id);
                  
                  return (
                    <div
                      key={earning.id}
                      className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium capitalize">
                              {getEarningTypeLabel(earning.earning_type)}
                            </span>
                            {earning.earning_type === "task_commission" && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                Task
                              </span>
                            )}
                            {earning.earning_type === "deposit_commission" && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                Deposit
                              </span>
                            )}
                          </div>
                          
                          {referredUser && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span>{referredUser.username}</span>
                            </div>
                          )}
                        </div>

                        <div className="text-right">
                          <p className="font-semibold text-lg text-[hsl(var(--wallet-earnings))]">
                            +<CurrencyDisplay amountUSD={earning.commission_amount} />
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {earning.commission_rate}% of <CurrencyDisplay amountUSD={earning.base_amount} />
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(earning.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
};
