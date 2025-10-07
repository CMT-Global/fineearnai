import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface MembershipPlan {
  id: string;
  name: string;
  display_name: string;
  account_type: string;
  price: number;
  billing_period_days: number;
  daily_task_limit: number;
  earning_per_task: number;
  task_skip_limit_per_day: number;
  features: any;
  task_commission_rate: number;
  deposit_commission_rate: number;
}

export default function MembershipPlans() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
    loadUserProfile();
  }, []);

  const loadPlans = async () => {
    const { data, error } = await supabase
      .from("membership_plans")
      .select("*")
      .eq("is_active", true)
      .order("price", { ascending: true });

    if (error) {
      toast.error("Failed to load membership plans");
      console.error(error);
    } else {
      setPlans(data || []);
    }
    setLoading(false);
  };

  const loadUserProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("membership_plan")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error(error);
    } else {
      setCurrentPlan(data?.membership_plan || "free");
    }
  };

  const handleUpgrade = async (plan: MembershipPlan) => {
    if (!user) {
      toast.error("Please login to upgrade");
      navigate("/login");
      return;
    }

    if (plan.name === currentPlan) {
      toast.info("You are already on this plan");
      return;
    }

    setUpgrading(plan.id);

    try {
      // Check deposit wallet balance
      const { data: profile } = await supabase
        .from("profiles")
        .select("deposit_wallet_balance")
        .eq("id", user.id)
        .single();

      if (!profile || profile.deposit_wallet_balance < plan.price) {
        toast.error(`Insufficient balance. You need $${plan.price} in your deposit wallet.`);
        setUpgrading(null);
        return;
      }

      // Calculate new balance and expiry date
      const newBalance = profile.deposit_wallet_balance - plan.price;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + plan.billing_period_days);

      // Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          membership_plan: plan.name,
          plan_expires_at: expiresAt.toISOString(),
          deposit_wallet_balance: newBalance,
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      // Create transaction record
      const { error: txError } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          type: "plan_upgrade",
          amount: plan.price,
          wallet_type: "deposit",
          status: "completed",
          new_balance: newBalance,
          description: `Upgraded to ${plan.display_name}`,
        });

      if (txError) console.error("Transaction log error:", txError);

      toast.success(`Successfully upgraded to ${plan.display_name}!`);
      setCurrentPlan(plan.name);
    } catch (error) {
      console.error("Upgrade error:", error);
      toast.error("Failed to upgrade plan. Please try again.");
    } finally {
      setUpgrading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Membership Plans</h1>
        <p className="text-muted-foreground text-lg">
          Choose the perfect plan to maximize your earnings
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`relative ${
              plan.name === currentPlan ? "border-primary shadow-lg" : ""
            }`}
          >
            {plan.name === currentPlan && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                Current Plan
              </Badge>
            )}
            
            <CardHeader>
              <CardTitle className="text-2xl">{plan.display_name}</CardTitle>
              <CardDescription className="text-3xl font-bold mt-2">
                ${plan.price}
                <span className="text-sm font-normal text-muted-foreground">
                  /{plan.billing_period_days} days
                </span>
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm">{plan.daily_task_limit} tasks/day</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm">${plan.earning_per_task} per task</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm">{plan.task_skip_limit_per_day} skips/day</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm">{plan.task_commission_rate}% task commission</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm">{plan.deposit_commission_rate}% deposit commission</span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-1">
                {Array.isArray(plan.features) && plan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>

            <CardFooter>
              <Button
                className="w-full"
                onClick={() => handleUpgrade(plan)}
                disabled={plan.name === currentPlan || upgrading === plan.id}
                variant={plan.name === currentPlan ? "outline" : "default"}
              >
                {upgrading === plan.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Upgrading...
                  </>
                ) : plan.name === currentPlan ? (
                  "Current Plan"
                ) : plan.name === "free" ? (
                  "Downgrade"
                ) : (
                  "Upgrade Now"
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
