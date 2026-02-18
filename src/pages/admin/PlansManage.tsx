import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Plus, Edit, Trash2, Users, DollarSign, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/wallet-utils";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageLoading } from "@/components/shared/PageLoading";
import { ACCOUNT_TYPES, FIELD_CONSTRAINTS, validateMembershipPlan } from "@/lib/membership-plan-validation";

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
  free_plan_expiry_days: number | null;
  free_trial_days: number;
  referral_eligible: boolean; // Phase 3: Control commission generation
  is_active: boolean;
  features: any;
  subscriber_count?: number;
  total_revenue?: number;
}

const PlansManage = () => {
  const { t } = useTranslation();
  useLanguageSync(); // Sync language and force re-render when language changes
  
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  
  // Force re-render when language changes
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
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
    free_plan_expiry_days: null as number | null,
    free_trial_days: "0",
    referral_eligible: true,
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
      toast.error(t("toasts.admin.accessDenied"));
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate, t]);

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
      toast.error(t("toasts.admin.failedToLoadMembershipPlans"));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      // Clear previous validation errors
      setValidationErrors([]);

      // Validate using comprehensive validation utility
      const validation = validateMembershipPlan(formData);
      if (!validation.isValid) {
        setValidationErrors(validation.errors);
        toast.error(t("toasts.admin.pleaseFixValidationErrors"));
        return;
      }

      let features;
      try {
        features = JSON.parse(formData.features);
        if (!Array.isArray(features)) {
          throw new Error("Features must be an array");
        }
      } catch {
        toast.error(t("toasts.admin.invalidJSONFormatForFeatures"));
        return;
      }

      // Phase 3: Enforce referral_eligible = false for default (free) tier
      const referralEligible = formData.account_type === 'free' ? false : formData.referral_eligible;

      const planData = {
        name: formData.name,
        display_name: formData.display_name,
        account_type: formData.account_type,
        price: formData.price,
        billing_period_days: formData.billing_period_days,
        daily_task_limit: formData.daily_task_limit,
        task_skip_limit_per_day: formData.task_skip_limit_per_day,
        earning_per_task: formData.earning_per_task,
        task_commission_rate: formData.task_commission_rate,
        deposit_commission_rate: formData.deposit_commission_rate,
        max_active_referrals: formData.max_active_referrals,
        min_withdrawal: formData.min_withdrawal,
        min_daily_withdrawal: formData.min_daily_withdrawal,
        max_daily_withdrawal: formData.max_daily_withdrawal,
        free_plan_expiry_days: formData.free_plan_expiry_days,
        free_trial_days: formData.account_type === 'free' ? 0 : (Number(formData.free_trial_days) || 0),
        referral_eligible: referralEligible, // Phase 3: Control commission generation
        is_active: formData.is_active,
        features,
      };

      const { data, error } = await supabase.functions.invoke("manage-membership-plan", {
        body: {
          action: editingPlan ? "update_plan" : "create_plan",
          planId: editingPlan?.id,
          planData,
        },
      });

      if (error) throw error;

      const count = data?.profilesUpdatedCount;
      if (editingPlan && typeof count === "number" && count > 0) {
        toast.success(t("toasts.admin.planUpdatedWithUsers", { count }));
      } else {
        toast.success(editingPlan ? t("toasts.admin.planUpdated") : t("toasts.admin.planCreated"));
      }
      setDialogOpen(false);
      setEditingPlan(null);
      resetForm();
      loadPlans();
    } catch (error: any) {
      console.error("Error saving plan:", error);
      toast.error(error.message || t("toasts.admin.failedToSaveMembershipPlan"));
    }
  };

  const handleDelete = async (plan: MembershipPlan) => {
    if (plan.subscriber_count && plan.subscriber_count > 0) {
      toast.error(t("toasts.admin.cannotDeletePlanWithSubscribers", { count: plan.subscriber_count }));
      return;
    }

    if (!confirm(t("admin.plansManage.confirmDeletePlan"))) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("manage-membership-plan", {
        body: {
          action: "delete_plan",
          planId: plan.id,
        },
      });

      if (error) throw error;

      toast.success(t("toasts.admin.membershipPlanDeleted"));
      loadPlans();
    } catch (error: any) {
      console.error("Error deleting plan:", error);
      toast.error(error.message || t("toasts.admin.failedToDeleteMembershipPlan"));
    }
  };

  const handleToggleActive = async (plan: MembershipPlan) => {
    try {
      const action = plan.is_active ? "deactivate_plan" : "activate_plan";
      
      const { data, error } = await supabase.functions.invoke("manage-membership-plan", {
        body: {
          action,
          planId: plan.id,
        },
      });

      if (error) throw error;

      toast.success(!plan.is_active ? t("toasts.admin.planActivated") : t("toasts.admin.planDeactivated"));
      loadPlans();
    } catch (error: any) {
      console.error("Error toggling plan:", error);
      toast.error(t("toasts.admin.failedToUpdatePlanStatus"));
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
      free_plan_expiry_days: null as number | null,
      free_trial_days: "0",
      referral_eligible: true, // Phase 3: Default to true
      is_active: true,
      features: "[]",
    });
    setValidationErrors([]);
  };

  const openEditDialog = (plan: MembershipPlan) => {
    setEditingPlan(plan);
    setValidationErrors([]);
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
      free_plan_expiry_days: plan.free_plan_expiry_days,
      free_trial_days: String((plan as any).free_trial_days ?? 0),
      referral_eligible: plan.referral_eligible, // Phase 3: Load existing value
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
    return <PageLoading text={t("admin.loadingPanel")} />;
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
                    {/* Validation Errors Display */}
                    {validationErrors.length > 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Validation Errors</AlertTitle>
                        <AlertDescription>
                          <ul className="list-disc list-inside space-y-1 mt-2">
                            {validationErrors.map((error, idx) => (
                              <li key={idx} className="text-sm">{error}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Plan Name (Internal) *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g., premium"
                        />
                        {editingPlan && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {t("admin.plansManage.planNameRenameHint")}
                          </p>
                        )}
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
                        <Select
                          value={formData.account_type}
                          onValueChange={(value) =>
                            setFormData({ ...formData, account_type: value })
                          }
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select account type" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            {ACCOUNT_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          {FIELD_CONSTRAINTS.price.help}
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="price">Price ($) *</Label>
                        <Input
                          id="price"
                          type="number"
                          min={FIELD_CONSTRAINTS.price.min}
                          max={FIELD_CONSTRAINTS.price.max}
                          step={FIELD_CONSTRAINTS.price.step}
                          value={formData.price}
                          onChange={(e) =>
                            setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
                          }
                          placeholder="0.00"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {FIELD_CONSTRAINTS.price.help}
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="billing_period">Billing Period (days)</Label>
                        <Input
                          id="billing_period"
                          type="number"
                          min={FIELD_CONSTRAINTS.billing_period_days.min}
                          max={FIELD_CONSTRAINTS.billing_period_days.max}
                          step={FIELD_CONSTRAINTS.billing_period_days.step}
                          value={formData.billing_period_days}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              billing_period_days: parseInt(e.target.value) || 1,
                            })
                          }
                          placeholder="30"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {FIELD_CONSTRAINTS.billing_period_days.help}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="daily_task_limit">Daily Task Limit</Label>
                        <Input
                          id="daily_task_limit"
                          type="number"
                          min={FIELD_CONSTRAINTS.daily_task_limit.min}
                          max={FIELD_CONSTRAINTS.daily_task_limit.max}
                          step={FIELD_CONSTRAINTS.daily_task_limit.step}
                          value={formData.daily_task_limit}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              daily_task_limit: parseInt(e.target.value) || 0,
                            })
                          }
                          placeholder="10"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {FIELD_CONSTRAINTS.daily_task_limit.help}
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="skip_limit">Daily Skip Limit</Label>
                        <Input
                          id="skip_limit"
                          type="number"
                          min={FIELD_CONSTRAINTS.task_skip_limit_per_day.min}
                          max={FIELD_CONSTRAINTS.task_skip_limit_per_day.max}
                          step={FIELD_CONSTRAINTS.task_skip_limit_per_day.step}
                          value={formData.task_skip_limit_per_day}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              task_skip_limit_per_day: parseInt(e.target.value) || 0,
                            })
                          }
                          placeholder="3"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {FIELD_CONSTRAINTS.task_skip_limit_per_day.help}
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="earning_per_task">Earning Per Task ($)</Label>
                        <Input
                          id="earning_per_task"
                          type="number"
                          min={FIELD_CONSTRAINTS.earning_per_task.min}
                          max={FIELD_CONSTRAINTS.earning_per_task.max}
                          step={FIELD_CONSTRAINTS.earning_per_task.step}
                          value={formData.earning_per_task}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              earning_per_task: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="0.50"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {FIELD_CONSTRAINTS.earning_per_task.help}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="task_commission">Task Commission (%)</Label>
                        <Input
                          id="task_commission"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={formData.task_commission_rate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              task_commission_rate: parseFloat(e.target.value),
                            })
                          }
                          placeholder="0-100"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Commission earned on referral task earnings
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="deposit_commission">Deposit Commission (%)</Label>
                        <Input
                          id="deposit_commission"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={formData.deposit_commission_rate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              deposit_commission_rate: parseFloat(e.target.value),
                            })
                          }
                          placeholder="0-100"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Commission earned on referral deposits
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="max_referrals">Max Active Referrals</Label>
                        <Input
                          id="max_referrals"
                          type="number"
                          min={FIELD_CONSTRAINTS.max_active_referrals.min}
                          max={FIELD_CONSTRAINTS.max_active_referrals.max}
                          step={FIELD_CONSTRAINTS.max_active_referrals.step}
                          value={formData.max_active_referrals}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              max_active_referrals: parseInt(e.target.value) || 0,
                            })
                          }
                          placeholder="100"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {FIELD_CONSTRAINTS.max_active_referrals.help}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="min_withdrawal">Min Withdrawal ($)</Label>
                        <Input
                          id="min_withdrawal"
                          type="number"
                          min={FIELD_CONSTRAINTS.min_withdrawal.min}
                          max={FIELD_CONSTRAINTS.min_withdrawal.max}
                          step={FIELD_CONSTRAINTS.min_withdrawal.step}
                          value={formData.min_withdrawal}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              min_withdrawal: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="10.00"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {FIELD_CONSTRAINTS.min_withdrawal.help}
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="min_daily">Min Daily Withdrawal ($)</Label>
                        <Input
                          id="min_daily"
                          type="number"
                          min={FIELD_CONSTRAINTS.min_daily_withdrawal.min}
                          max={FIELD_CONSTRAINTS.min_daily_withdrawal.max}
                          step={FIELD_CONSTRAINTS.min_daily_withdrawal.step}
                          value={formData.min_daily_withdrawal}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              min_daily_withdrawal: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="10.00"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {FIELD_CONSTRAINTS.min_daily_withdrawal.help}
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="max_daily">Max Daily Withdrawal ($)</Label>
                        <Input
                          id="max_daily"
                          type="number"
                          min={FIELD_CONSTRAINTS.max_daily_withdrawal.min}
                          max={FIELD_CONSTRAINTS.max_daily_withdrawal.max}
                          step={FIELD_CONSTRAINTS.max_daily_withdrawal.step}
                          value={formData.max_daily_withdrawal}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              max_daily_withdrawal: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="1000.00"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {FIELD_CONSTRAINTS.max_daily_withdrawal.help}
                        </p>
                      </div>
                    </div>

                    {/* Default (free tier) expiry days - Only shown for default tier */}
                    {formData.account_type === 'free' && (
                      <div>
                        <Label htmlFor="free_plan_expiry_days">Default Plan Expiry Days</Label>
                        <Input
                          id="free_plan_expiry_days"
                          type="number"
                          min="0"
                          max="365"
                          step="1"
                          value={formData.free_plan_expiry_days ?? ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setFormData({
                              ...formData,
                              free_plan_expiry_days: value === '' ? null : parseInt(value) || 0,
                            });
                          }}
                          placeholder="Leave empty for lifetime access"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Number of days before default (free tier) plan expires. Leave empty for lifetime access.
                        </p>
                      </div>
                    )}

                    {/* Free Trial Days - Only for paid plans; hidden for default (free) plan */}
                    {formData.account_type !== 'free' && (
                      <div>
                        <Label htmlFor="free_trial_days">Free Trial Days (Onboarding)</Label>
                        <Input
                          id="free_trial_days"
                          type="number"
                          min={0}
                          max={365}
                          step={1}
                          value={formData.free_trial_days}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              free_trial_days: e.target.value,
                            })
                          }
                          placeholder="0"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Days of free trial when user selects this plan in questionnaire step 10. 0 = hide trial option; show upgrade only.
                        </p>
                      </div>
                    )}

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

                    {/* Phase 3: Referral Eligible Toggle */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="referral_eligible"
                          checked={formData.referral_eligible}
                          disabled={formData.account_type === 'free'} // Disable for default (free) tier
                          onCheckedChange={(checked) =>
                            setFormData({ ...formData, referral_eligible: checked })
                          }
                        />
                        <Label htmlFor="referral_eligible">Referral Eligible</Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formData.account_type === 'free' 
                          ? "Default (free tier) plan cannot generate referral commissions for their upline"
                          : "When enabled, users on this plan can generate referral commissions for their upline. Disable to prevent commission generation."
                        }
                      </p>
                      {formData.referral_eligible === false && formData.account_type !== 'free' && (
                        <Alert className="mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            Users on this plan will NOT generate commissions for their upline, even if the upline has a paid plan.
                          </AlertDescription>
                        </Alert>
                      )}
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
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={plan.is_active}
                                onCheckedChange={() => handleToggleActive(plan)}
                              />
                              <Badge variant={plan.is_active ? "default" : "secondary"}>
                                {plan.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            {/* Phase 3: Referral Eligible Badge */}
                            <Badge 
                              variant={plan.referral_eligible ? "outline" : "destructive"}
                              className="text-xs w-fit"
                            >
                              {plan.referral_eligible ? "✓ Can Generate Commissions" : "✗ No Commissions"}
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
                              onClick={() => handleDelete(plan)}
                              disabled={plan.subscriber_count !== undefined && plan.subscriber_count > 0}
                              title={plan.subscriber_count && plan.subscriber_count > 0 ? "Cannot delete plan with active subscribers" : "Delete plan"}
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
