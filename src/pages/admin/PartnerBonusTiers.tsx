import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit, Trash2, DollarSign, Award, TrendingUp } from "lucide-react";

interface BonusTier {
  id: string;
  tier_name: string;
  min_weekly_sales: number;
  max_weekly_sales: number;
  bonus_percentage: number;
  tier_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function PartnerBonusTiers() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<BonusTier | null>(null);
  const [formData, setFormData] = useState({
    tier_name: "",
    min_weekly_sales: "",
    max_weekly_sales: "",
    bonus_percentage: "",
    tier_order: "",
    is_active: true,
  });

  // Fetch bonus tiers
  const { data: tiers, isLoading } = useQuery({
    queryKey: ["partner-bonus-tiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_bonus_tiers")
        .select("*")
        .order("tier_order", { ascending: true });

      if (error) throw error;
      return data as BonusTier[];
    },
  });

  // Create tier mutation
  const createTierMutation = useMutation({
    mutationFn: async (data: Partial<BonusTier>) => {
      const { error } = await supabase
        .from("partner_bonus_tiers")
        .insert({
          tier_name: data.tier_name,
          min_weekly_sales: data.min_weekly_sales,
          max_weekly_sales: data.max_weekly_sales,
          bonus_percentage: Number(data.bonus_percentage) / 100, // Convert % to decimal
          tier_order: data.tier_order,
          is_active: data.is_active,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-bonus-tiers"] });
      toast.success("Bonus tier created successfully");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(`Failed to create tier: ${error.message}`);
    },
  });

  // Update tier mutation
  const updateTierMutation = useMutation({
    mutationFn: async (data: Partial<BonusTier> & { id: string }) => {
      const { error } = await supabase
        .from("partner_bonus_tiers")
        .update({
          tier_name: data.tier_name,
          min_weekly_sales: data.min_weekly_sales,
          max_weekly_sales: data.max_weekly_sales,
          bonus_percentage: Number(data.bonus_percentage) / 100,
          tier_order: data.tier_order,
          is_active: data.is_active,
        })
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-bonus-tiers"] });
      toast.success("Bonus tier updated successfully");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(`Failed to update tier: ${error.message}`);
    },
  });

  // Delete tier mutation
  const deleteTierMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("partner_bonus_tiers")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-bonus-tiers"] });
      toast.success("Bonus tier deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete tier: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      tier_name: "",
      min_weekly_sales: "",
      max_weekly_sales: "",
      bonus_percentage: "",
      tier_order: "",
      is_active: true,
    });
    setEditingTier(null);
  };

  const handleEdit = (tier: BonusTier) => {
    setEditingTier(tier);
    setFormData({
      tier_name: tier.tier_name,
      min_weekly_sales: tier.min_weekly_sales.toString(),
      max_weekly_sales: tier.max_weekly_sales.toString(),
      bonus_percentage: (tier.bonus_percentage * 100).toString(), // Convert decimal to %
      tier_order: tier.tier_order.toString(),
      is_active: tier.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.tier_name || !formData.min_weekly_sales || !formData.max_weekly_sales || !formData.bonus_percentage || !formData.tier_order) {
      toast.error("Please fill in all required fields");
      return;
    }

    const minSales = Number(formData.min_weekly_sales);
    const maxSales = Number(formData.max_weekly_sales);
    const bonusPercentage = Number(formData.bonus_percentage);

    if (maxSales <= minSales) {
      toast.error("Maximum sales must be greater than minimum sales");
      return;
    }

    if (bonusPercentage < 0 || bonusPercentage > 100) {
      toast.error("Bonus percentage must be between 0 and 100");
      return;
    }

    const tierData = {
      tier_name: formData.tier_name,
      min_weekly_sales: minSales,
      max_weekly_sales: maxSales,
      bonus_percentage: bonusPercentage,
      tier_order: Number(formData.tier_order),
      is_active: formData.is_active,
    };

    if (editingTier) {
      updateTierMutation.mutate({ ...tierData, id: editingTier.id });
    } else {
      createTierMutation.mutate(tierData);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this bonus tier? This action cannot be undone.")) {
      deleteTierMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Partner Bonus Tiers</h1>
        <p className="text-muted-foreground">Configure weekly bonus tiers and percentages</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tiers</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tiers?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Active: {tiers?.filter(t => t.is_active).length || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Highest Bonus</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tiers && tiers.length > 0 
                ? `${(Math.max(...tiers.map(t => t.bonus_percentage)) * 100).toFixed(1)}%`
                : "0%"
              }
            </div>
            <p className="text-xs text-muted-foreground">Maximum earning rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Tier Threshold</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tiers && tiers.length > 0
                ? `$${Math.max(...tiers.filter(t => t.max_weekly_sales < 999999999).map(t => t.min_weekly_sales)).toFixed(0)}`
                : "$0"
              }
            </div>
            <p className="text-xs text-muted-foreground">Weekly sales required</p>
          </CardContent>
        </Card>
      </div>

      {/* Tiers Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Bonus Tiers</CardTitle>
              <CardDescription>Manage weekly bonus tier thresholds and percentages</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Tier
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingTier ? "Edit Bonus Tier" : "Create Bonus Tier"}</DialogTitle>
                  <DialogDescription>
                    Configure the weekly sales thresholds and bonus percentage
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="tier_name">Tier Name *</Label>
                      <Input
                        id="tier_name"
                        placeholder="e.g., Bronze, Silver, Gold"
                        value={formData.tier_name}
                        onChange={(e) => setFormData({ ...formData, tier_name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="min_weekly_sales">Min Weekly Sales ($) *</Label>
                        <Input
                          id="min_weekly_sales"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0"
                          value={formData.min_weekly_sales}
                          onChange={(e) => setFormData({ ...formData, min_weekly_sales: e.target.value })}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="max_weekly_sales">Max Weekly Sales ($) *</Label>
                        <Input
                          id="max_weekly_sales"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="999999"
                          value={formData.max_weekly_sales}
                          onChange={(e) => setFormData({ ...formData, max_weekly_sales: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bonus_percentage">Bonus Percentage (%) *</Label>
                        <Input
                          id="bonus_percentage"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          placeholder="1.5"
                          value={formData.bonus_percentage}
                          onChange={(e) => setFormData({ ...formData, bonus_percentage: e.target.value })}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="tier_order">Tier Order *</Label>
                        <Input
                          id="tier_order"
                          type="number"
                          min="1"
                          placeholder="1"
                          value={formData.tier_order}
                          onChange={(e) => setFormData({ ...formData, tier_order: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                      />
                      <Label htmlFor="is_active">Active</Label>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createTierMutation.isPending || updateTierMutation.isPending}
                    >
                      {editingTier ? "Update" : "Create"} Tier
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Loading tiers...</div>
              </div>
            ) : tiers && tiers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Tier Name</TableHead>
                    <TableHead>Sales Range</TableHead>
                    <TableHead>Bonus %</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tiers.map((tier) => (
                    <TableRow key={tier.id}>
                      <TableCell className="font-medium">{tier.tier_order}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Award className="h-4 w-4 text-primary" />
                          {tier.tier_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        ${tier.min_weekly_sales.toFixed(0)} - ${tier.max_weekly_sales >= 999999999 ? '∞' : tier.max_weekly_sales.toFixed(0)}
                      </TableCell>
                      <TableCell className="font-semibold text-primary">
                        {(tier.bonus_percentage * 100).toFixed(2)}%
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          tier.is_active 
                            ? 'bg-success/10 text-success' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {tier.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(tier)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(tier.id)}
                            disabled={deleteTierMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Award className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Bonus Tiers</h3>
                <p className="text-muted-foreground mb-4">Get started by creating your first bonus tier</p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Tier
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

      {/* Tier Visualization */}
      {tiers && tiers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tier Visualization</CardTitle>
            <CardDescription>Visual representation of bonus tier thresholds</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tiers.filter(t => t.is_active).map((tier, index) => (
                <div key={tier.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{tier.tier_name}</span>
                    <span className="text-muted-foreground">
                      ${tier.min_weekly_sales.toFixed(0)} - ${tier.max_weekly_sales >= 999999999 ? '∞' : tier.max_weekly_sales.toFixed(0)}
                    </span>
                  </div>
                  <div className="h-8 rounded-lg bg-gradient-to-r from-primary/20 to-primary flex items-center justify-center text-sm font-semibold text-primary-foreground">
                    {(tier.bonus_percentage * 100).toFixed(1)}% Bonus
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
