import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Edit, Trash2, Users, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/wallet-utils";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

interface MembershipPlan {
  id: string;
  name: string;
  display_name: string;
  account_type: string;
  price: number;
  billing_period_days: number;
  daily_task_limit: number;
  task_skip_limit_per_day: number;
  earning_per_task: number;
  task_commission_rate: number;
  deposit_commission_rate: number;
  max_active_referrals: number;
  min_withdrawal: number;
  min_daily_withdrawal: number;
  max_daily_withdrawal: number;
  is_active: boolean;
  features: any;
  subscriber_count?: number;
  total_revenue?: number;
}

const PlansManage = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    display_name: "",
    account_type: "",
    price: 0,
    billing_period_days: 30,
    daily_task_limit: 10,
    task_skip_limit_per_day: 3,
    earning_per_task: 0,
    task_commission_rate: 0,
    deposit_commission_rate: 0,
    max_active_referrals: 0,
    min_withdrawal: 10,
    min_daily_withdrawal: 10,
    max_daily_withdrawal: 1000,
    is_active: true,
    features: "[]",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      toast.error("Access denied. Admin privileges required.");
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadPlans();
    }
  }, [isAdmin]);

  const loadPlans = async () => {
    try {
      setLoading(true);

      const { data: plansData, error: plansError } = await supabase
        .from("membership_plans")
        .select("*")
        .order("price", { ascending: true });

      if (plansError) throw plansError;

      // Get subscriber counts
      const plansWithStats = await Promise.all(
        (plansData || []).map(async (plan) => {
          const { count } = await supabase
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .eq("membership_plan", plan.name);

          // Calculate total revenue (subscribers * price)
          const totalRevenue = (count || 0) * parseFloat(String(plan.price));

          return {
            ...plan,
            subscriber_count: count || 0,
            total_revenue: totalRevenue,
          };
        })
      );

      setPlans(plansWithStats);
    } catch (error: any) {
      console.error("Error loading plans:", error);
      toast.error("Failed to load membership plans");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!formData.name || !formData.display_name || !formData.account_type) {
        toast.error("Please fill in all required fields");
        return;
      }

      let features;
      try {
        features = JSON.parse(formData.features);
      } catch {
        toast.error("Invalid JSON format for features");
        return;
      }

      const planData = {
        ...formData,
        features,
      };

      if (editingPlan) {
        const { error } = await supabase
          .from("membership_plans")
          .update(planData)
          .eq("id", editingPlan.id);

        if (error) throw error;
        toast.success("Membership plan updated successfully");
      } else {
        const { error } = await supabase
          .from("membership_plans")
          .insert([planData]);

        if (error) throw error;
        toast.success("Membership plan created successfully");
      }

      setDialogOpen(false);
      setEditingPlan(null);
      resetForm();
      loadPlans();
    } catch (error: any) {
      console.error("Error saving plan:", error);
      toast.error(error.message || "Failed to save membership plan");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this membership plan?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("membership_plans")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Membership plan deleted");
      loadPlans();
    } catch (error: any) {
      console.error("Error deleting plan:", error);
      toast.error("Failed to delete membership plan");
    }
  };

  const handleToggleActive = async (plan: MembershipPlan) => {
    try {
      const { error } = await supabase
        .from("membership_plans")
        .update({ is_active: !plan.is_active })
        .eq("id", plan.id);

      if (error) throw error;

      toast.success(`Plan ${!plan.is_active ? "activated" : "deactivated"}`);
      loadPlans();
    } catch (error: any) {
      console.error("Error toggling plan:", error);
      toast.error("Failed to update plan status");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      display_name: "",
      account_type: "",
      price: 0,
      billing_period_days: 30,
      daily_task_limit: 10,
      task_skip_limit_per_day: 3,
      earning_per_task: 0,
      task_commission_rate: 0,
      deposit_commission_rate: 0,
      max_active_referrals: 0,
      min_withdrawal: 10,
      min_daily_withdrawal: 10,
      max_daily_withdrawal: 1000,
      is_active: true,
      features: "[]",
    });
  };

  const openEditDialog = (plan: MembershipPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      display_name: plan.display_name,
      account_type: plan.account_type,
      price: plan.price,
      billing_period_days: plan.billing_period_days,
      daily_task_limit: plan.daily_task_limit,
      task_skip_limit_per_day: plan.task_skip_limit_per_day,
      earning_per_task: plan.earning_per_task,
      task_commission_rate: plan.task_commission_rate,
      deposit_commission_rate: plan.deposit_commission_rate,
      max_active_referrals: plan.max_active_referrals,
      min_withdrawal: plan.min_withdrawal,
      min_daily_withdrawal: plan.min_daily_withdrawal,
      max_daily_withdrawal: plan.max_daily_withdrawal,
      is_active: plan.is_active,
      features: JSON.stringify(plan.features || [], null, 2),
    });
    setDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingPlan(null);
    resetForm();
    setDialogOpen(true);
  };

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading plans..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Button>

          <h1 className="text-3xl font-bold mb-2">Membership Plan Management</h1>
          <p className="text-muted-foreground">
            Configure membership tiers, pricing, and commission rates
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Plans
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{plans.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {plans.filter((p) => p.is_active).length} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Subscribers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">
                  {plans.reduce((sum, p) => sum + (p.subscriber_count || 0), 0)}
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">
                  {formatCurrency(
                    plans.reduce((sum, p) => sum + (p.total_revenue || 0), 0)
                  )}
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Membership Plans</CardTitle>
                <CardDescription>Manage pricing tiers and plan features</CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openAddDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Plan
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingPlan ? "Edit" : "Create"} Membership Plan
                    </DialogTitle>
                    <DialogDescription>
                      Configure plan details and pricing
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Plan Name (Internal) *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g., premium"
                        />
                      </div>

                      <div>
                        <Label htmlFor="display_name">Display Name *</Label>
                        <Input
                          id="display_name"
                          value={formData.display_name}
                          onChange={(e) =>
                            setFormData({ ...formData, display_name: e.target.value })
                          }
                          placeholder="e.g., Premium Plan"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="account_type">Account Type *</Label>
                        <Input
                          id="account_type"
                          value={formData.account_type}
                          onChange={(e) =>
                            setFormData({ ...formData, account_type: e.target.value })
                          }
                          placeholder="e.g., Standard"
                        />
                      </div>

                      <div>
                        <Label htmlFor="price">Price ($) *</Label>
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          value={formData.price}
                          onChange={(e) =>
                            setFormData({ ...formData, price: parseFloat(e.target.value) })
                          }
                        />
                      </div>

                      <div>
                        <Label htmlFor="billing_period">Billing Period (days)</Label>
                        <Input
                          id="billing_period"
                          type="number"
                          value={formData.billing_period_days}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              billing_period_days: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="daily_task_limit">Daily Task Limit</Label>
                        <Input
                          id="daily_task_limit"
                          type="number"
                          value={formData.daily_task_limit}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              daily_task_limit: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>

                      <div>
                        <Label htmlFor="skip_limit">Daily Skip Limit</Label>
                        <Input
                          id="skip_limit"
                          type="number"
                          value={formData.task_skip_limit_per_day}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              task_skip_limit_per_day: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>

                      <div>
                        <Label htmlFor="earning_per_task">Earning Per Task ($)</Label>
                        <Input
                          id="earning_per_task"
                          type="number"
                          step="0.01"
                          value={formData.earning_per_task}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              earning_per_task: parseFloat(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="task_commission">Task Commission (%)</Label>
                        <Input
                          id="task_commission"
                          type="number"
                          step="0.01"
                          value={formData.task_commission_rate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              task_commission_rate: parseFloat(e.target.value),
                            })
                          }
                        />
                      </div>

                      <div>
                        <Label htmlFor="deposit_commission">Deposit Commission (%)</Label>
                        <Input
                          id="deposit_commission"
                          type="number"
                          step="0.01"
                          value={formData.deposit_commission_rate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              deposit_commission_rate: parseFloat(e.target.value),
                            })
                          }
                        />
                      </div>

                      <div>
                        <Label htmlFor="max_referrals">Max Active Referrals</Label>
                        <Input
                          id="max_referrals"
                          type="number"
                          value={formData.max_active_referrals}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              max_active_referrals: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="min_withdrawal">Min Withdrawal ($)</Label>
                        <Input
                          id="min_withdrawal"
                          type="number"
                          step="0.01"
                          value={formData.min_withdrawal}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              min_withdrawal: parseFloat(e.target.value),
                            })
                          }
                        />
                      </div>

                      <div>
                        <Label htmlFor="min_daily">Min Daily Withdrawal ($)</Label>
                        <Input
                          id="min_daily"
                          type="number"
                          step="0.01"
                          value={formData.min_daily_withdrawal}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              min_daily_withdrawal: parseFloat(e.target.value),
                            })
                          }
                        />
                      </div>

                      <div>
                        <Label htmlFor="max_daily">Max Daily Withdrawal ($)</Label>
                        <Input
                          id="max_daily"
                          type="number"
                          step="0.01"
                          value={formData.max_daily_withdrawal}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              max_daily_withdrawal: parseFloat(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="features">Features (JSON Array)</Label>
                      <Textarea
                        id="features"
                        value={formData.features}
                        onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                        placeholder='["Feature 1", "Feature 2"]'
                        rows={4}
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, is_active: checked })
                        }
                      />
                      <Label htmlFor="is_active">Active</Label>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave}>
                      {editingPlan ? "Update" : "Create"} Plan
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Task Limit</TableHead>
                    <TableHead>Earnings</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Subscribers</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        No membership plans found
                      </TableCell>
                    </TableRow>
                  ) : (
                    plans.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{plan.display_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {plan.account_type}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(plan.price)}
                        </TableCell>
                        <TableCell>{plan.daily_task_limit}/day</TableCell>
                        <TableCell>{formatCurrency(plan.earning_per_task)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>Tasks: {plan.task_commission_rate}%</div>
                            <div>Deposits: {plan.deposit_commission_rate}%</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{plan.subscriber_count || 0}</Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(plan.total_revenue || 0)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={plan.is_active}
                              onCheckedChange={() => handleToggleActive(plan)}
                            />
                            <Badge variant={plan.is_active ? "default" : "secondary"}>
                              {plan.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(plan)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(plan.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PlansManage;
