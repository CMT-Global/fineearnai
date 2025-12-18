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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Edit, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

interface CPAYCheckout {
  id: string;
  checkout_id: string;
  checkout_url: string;
  currency: string;
  min_amount: number;
  max_amount: number;
  is_active: boolean;
  created_at: string;
}

const CPAYCheckouts = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [checkouts, setCheckouts] = useState<CPAYCheckout[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCheckout, setEditingCheckout] = useState<CPAYCheckout | null>(null);
  const [formData, setFormData] = useState({
    checkout_id: "",
    checkout_url: "",
    currency: "USDT",
    min_amount: 10,
    max_amount: 10000,
    is_active: true,
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
      loadCheckouts();
    }
  }, [isAdmin]);

  const loadCheckouts = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("cpay_checkouts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setCheckouts(data || []);
    } catch (error: any) {
      console.error("Error loading checkouts:", error);
      toast.error("Failed to load CPAY checkouts");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!formData.checkout_id || !formData.checkout_url) {
        toast.error("Please fill in all required fields");
        return;
      }

      // Validate URL format
      try {
        new URL(formData.checkout_url);
      } catch {
        toast.error("Invalid checkout URL format");
        return;
      }

      if (editingCheckout) {
        const { error } = await supabase
          .from("cpay_checkouts")
          .update({
            checkout_url: formData.checkout_url,
            currency: formData.currency,
            min_amount: formData.min_amount || 0,
            max_amount: formData.max_amount || 10000,
            is_active: formData.is_active,
          })
          .eq("id", editingCheckout.id);

        if (error) throw error;
        toast.success("CPAY checkout updated successfully");
      } else {
        const { error } = await supabase
          .from("cpay_checkouts")
          .insert([{
            ...formData,
            min_amount: formData.min_amount || 0,
            max_amount: formData.max_amount || 10000,
          }]);

        if (error) throw error;
        toast.success("CPAY checkout added successfully");
      }

      setDialogOpen(false);
      setEditingCheckout(null);
      resetForm();
      loadCheckouts();
    } catch (error: any) {
      console.error("Error saving checkout:", error);
      toast.error(error.message || "Failed to save CPAY checkout");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this CPAY checkout?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("cpay_checkouts")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("CPAY checkout deleted");
      loadCheckouts();
    } catch (error: any) {
      console.error("Error deleting checkout:", error);
      toast.error("Failed to delete CPAY checkout");
    }
  };

  const handleToggleActive = async (checkout: CPAYCheckout) => {
    try {
      const { error } = await supabase
        .from("cpay_checkouts")
        .update({ is_active: !checkout.is_active })
        .eq("id", checkout.id);

      if (error) throw error;

      toast.success(`CPAY checkout ${!checkout.is_active ? "activated" : "deactivated"}`);
      loadCheckouts();
    } catch (error: any) {
      console.error("Error toggling checkout:", error);
      toast.error("Failed to update CPAY checkout");
    }
  };

  const resetForm = () => {
    setFormData({
      checkout_id: "",
      checkout_url: "",
      currency: "USDT",
      min_amount: 10,
      max_amount: 10000,
      is_active: true,
    });
  };

  const openEditDialog = (checkout: CPAYCheckout) => {
    setEditingCheckout(checkout);
    setFormData({
      checkout_id: checkout.checkout_id,
      checkout_url: checkout.checkout_url,
      currency: checkout.currency,
      min_amount: checkout.min_amount,
      max_amount: checkout.max_amount,
      is_active: checkout.is_active,
    });
    setDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingCheckout(null);
    resetForm();
    setDialogOpen(true);
  };

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading CPAY checkouts..." />
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

          <h1 className="text-3xl font-bold mb-2">CPAY Checkout Configuration</h1>
          <p className="text-muted-foreground">
            Manage pre-configured CPAY checkout pages for deposits
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>CPAY Checkouts</CardTitle>
                <CardDescription>
                  Add checkouts created in your CPAY dashboard
                </CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openAddDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Checkout
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingCheckout ? "Edit" : "Add"} CPAY Checkout
                    </DialogTitle>
                    <DialogDescription>
                      Configure a pre-generated checkout from your CPAY dashboard
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="checkout_id">Checkout ID *</Label>
                      <Input
                        id="checkout_id"
                        value={formData.checkout_id}
                        onChange={(e) => setFormData({ ...formData, checkout_id: e.target.value })}
                        placeholder="e.g., a55901c9-7cab-44a5-adf9-5a1562056256"
                        disabled={!!editingCheckout}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        From CPAY dashboard checkout URL
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="checkout_url">Full Checkout URL *</Label>
                      <Input
                        id="checkout_url"
                        value={formData.checkout_url}
                        onChange={(e) => setFormData({ ...formData, checkout_url: e.target.value })}
                        placeholder="https://checkouts.fineearn.com/checkout/{id}"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Use custom domain URL for better branding
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="currency">Currency</Label>
                      <Input
                        id="currency"
                        value={formData.currency}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                        placeholder="USDT"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="min_amount">Min Amount ($)</Label>
                        <Input
                          id="min_amount"
                          type="number"
                          step="0.01"
                          value={formData.min_amount || 0}
                          onChange={(e) =>
                            setFormData({ ...formData, min_amount: parseFloat(e.target.value) || 0 })
                          }
                        />
                      </div>

                      <div>
                        <Label htmlFor="max_amount">Max Amount ($)</Label>
                        <Input
                          id="max_amount"
                          type="number"
                          step="0.01"
                          value={formData.max_amount || 10000}
                          onChange={(e) =>
                            setFormData({ ...formData, max_amount: parseFloat(e.target.value) || 10000 })
                          }
                        />
                      </div>
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
                      {editingCheckout ? "Update" : "Add"} Checkout
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
                    <TableHead>Checkout ID</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Limits</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checkouts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No CPAY checkouts configured
                      </TableCell>
                    </TableRow>
                  ) : (
                    checkouts.map((checkout) => (
                      <TableRow key={checkout.id}>
                        <TableCell className="font-mono text-sm">
                          {checkout.checkout_id.substring(0, 8)}...
                          <a
                            href={checkout.checkout_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 inline-flex items-center text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{checkout.currency}</Badge>
                        </TableCell>
                        <TableCell>
                          ${checkout.min_amount} - ${checkout.max_amount}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={checkout.is_active}
                              onCheckedChange={() => handleToggleActive(checkout)}
                            />
                            <Badge variant={checkout.is_active ? "default" : "secondary"}>
                              {checkout.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(checkout)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(checkout.id)}
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

export default CPAYCheckouts;
