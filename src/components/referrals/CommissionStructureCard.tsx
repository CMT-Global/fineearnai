import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, AlertCircle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface CommissionStructureCardProps {
  userPlan: string;
}

interface PlanCommissions {
  taskCommissionRate: number;
  depositCommissionRate: number;
}

export const CommissionStructureCard = ({ userPlan }: CommissionStructureCardProps) => {
  const navigate = useNavigate();
  const [commissions, setCommissions] = useState<PlanCommissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCommissionRates();
  }, [userPlan]);

  const loadCommissionRates = async () => {
    try {
      const { data, error } = await supabase
        .from("membership_plans")
        .select("task_commission_rate, deposit_commission_rate")
        .eq("name", userPlan)
        .single();

      if (error) throw error;

      if (data) {
        setCommissions({
          taskCommissionRate: Number(data.task_commission_rate),
          depositCommissionRate: Number(data.deposit_commission_rate),
        });
      }
    } catch (error) {
      console.error("Error loading commission rates:", error);
      toast.error("Failed to load commission rates");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Loading commission structure...</p>
      </Card>
    );
  }

  const isEligible = userPlan !== "free";

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5" />
        <h3 className="font-semibold">Your Commission Structure</h3>
      </div>

      {!isEligible ? (
        <div className="space-y-4">
          <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-1">
                  Referral Income Not Available For Free Accounts
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  You need to upgrade your account to start earning commissions.
                </p>
              </div>
            </div>
          </div>

          <Button 
            onClick={() => navigate("/plans")}
            className="w-full gap-2"
          >
            Upgrade to Start Earning
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
              <p className="text-sm text-muted-foreground mb-1">Task Commission</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {(commissions?.taskCommissionRate * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Earn from every task your referrals complete
              </p>
            </div>

            <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
              <p className="text-sm text-muted-foreground mb-1">Deposit Commission</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {(commissions?.depositCommissionRate * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Earn when referrals upgrade their plans
              </p>
            </div>
          </div>

          <div className="p-4 bg-accent/50 border rounded-lg">
            <p className="text-sm font-medium mb-2">Current Plan: {userPlan.toUpperCase()}</p>
            <p className="text-xs text-muted-foreground">
              Upgrade to a higher tier plan to unlock better commission rates and more active referral slots.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate("/plans")}
              className="mt-3 gap-2"
            >
              View Plans
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
