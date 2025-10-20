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
import { ArrowLeft, Plus, Edit, Trash2, Settings } from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

interface PaymentProcessor {
  id?: string;
  name: string;
  processor_type: string;
  fee_percentage: number;
  fee_fixed: number;
  min_amount: number;
  max_amount: number;
  is_active: boolean;
  config?: any;
}

interface CPAYCheckout {
  id: string;
  checkout_id: string;
  checkout_url: string;
  currency: string;
  min_amount: number;
  max_amount: number;
  is_active: boolean;
}

const PaymentSettings = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [processors, setProcessors] = useState<PaymentProcessor[]>([]);
  const [cpayCheckouts, setCpayCheckouts] = useState<CPAYCheckout[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProcessor, setEditingProcessor] = useState<PaymentProcessor | null>(null);
  
  // Form state
  const [processorName, setProcessorName] = useState("");
  const [processorType, setProcessorType] = useState("");
  const [preset, setPreset] = useState("");
  const [selectedCheckoutId, setSelectedCheckoutId] = useState("");
  const [feePercentage, setFeePercentage] = useState("");
  const [feeFixed, setFeeFixed] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Helper function to safely parse numeric inputs
  const parseNumericInput = (value: string): number => {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Load CPAY checkouts
  const loadCpayCheckouts = async () => {
    try {
      const { data, error } = await supabase
        .from("cpay_checkouts")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCpayCheckouts(data || []);
    } catch (error: any) {
      console.error("Error loading CPAY checkouts:", error);
      toast.error("Failed to load CPAY checkouts");
    }
  };

  // Load payment processors and CPAY checkouts
  useEffect(() => {
    if (user && isAdmin) {
      loadProcessors();
      loadCpayCheckouts();
    }
  }, [user, isAdmin]);

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

  // Load all payment processors
  const loadProcessors = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("payment_processors")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setProcessors(data || []);
    } catch (error: any) {
      console.error("Error loading processors:", error);
      toast.error("Failed to load payment processors");
    } finally {
      setLoading(false);
    }
  };

  // Handle preset selection
  const handlePresetChange = (value: string) => {
    setPreset(value);
    
    if (value === "cpay_deposit") {
      setProcessorName("CPAY Deposit");
      setProcessorType("deposit");
      setFeePercentage("0");
      setFeeFixed("0");
    } else if (value === "cpay_withdrawal_usdt") {
      setProcessorName("CPAY Withdrawal - USDT TRC20");
      setProcessorType("withdrawal");
      setFeePercentage("0");
      setFeeFixed("1");
    } else {
      // Custom preset - clear fields
      setProcessorName("");
      setSelectedCheckoutId("");
    }
  };

  // Save processor (create or update)
  const handleSave = async () => {
    if (!processorName || !processorType) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate CPAY deposit requires checkout selection
    if (preset === "cpay_deposit" && !selectedCheckoutId) {
      toast.error("Please select a CPAY checkout for deposit processor");
      return;
    }

    try {
      setSaving(true);

      // Build config object for CPAY deposit
      let config = {};
      if (preset === "cpay_deposit" && selectedCheckoutId) {
        const selectedCheckout = cpayCheckouts.find(c => c.id === selectedCheckoutId);
        config = {
          processor: "cpay",
          display_name: processorName,
          cpay_checkout_id: selectedCheckoutId,
          currency: selectedCheckout?.currency || "USDT",
        };
      }

      const processorData = {
        name: processorName,
        processor_type: processorType,
        fee_percentage: parseNumericInput(feePercentage || "0"),
        fee_fixed: parseNumericInput(feeFixed || "0"),
        min_amount: parseNumericInput(minAmount || "0"),
        max_amount: parseNumericInput(maxAmount || "10000"),
        is_active: isActive,
        config: config,
      };

      if (editingProcessor) {
        // Update existing processor
        const { error } = await supabase
          .from("payment_processors")
          .update(processorData)
          .eq("id", editingProcessor.id);

        if (error) throw error;
        toast.success("Payment processor updated successfully");
      } else {
        // Create new processor
        const { error } = await supabase
          .from("payment_processors")
          .insert([processorData]);

        if (error) throw error;
        toast.success("Payment processor created successfully");
      }

      setDialogOpen(false);
      resetForm();
      loadProcessors();
    } catch (error: any) {
      console.error("Error saving processor:", error);
      toast.error(error.message || "Failed to save payment processor");
    } finally {
      setSaving(false);
    }
  };

  // Delete processor
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this payment processor?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("payment_processors")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Payment processor deleted");
      loadProcessors();
    } catch (error: any) {
      console.error("Error deleting processor:", error);
      toast.error("Failed to delete payment processor");
    }
  };

  // Toggle processor active status
  const handleToggleActive = async (processor: PaymentProcessor) => {
    try {
      const { error } = await supabase
        .from("payment_processors")
        .update({ is_active: !processor.is_active })
        .eq("id", processor.id);

      if (error) throw error;

      toast.success(`Payment processor ${!processor.is_active ? "activated" : "deactivated"}`);
      loadProcessors();
    } catch (error: any) {
      console.error("Error toggling processor:", error);
      toast.error("Failed to update payment processor");
    }
  };

  // Reset form
  const resetForm = () => {
    setProcessorName("");
    setProcessorType("");
    setPreset("");
    setSelectedCheckoutId("");
    setFeePercentage("");
    setFeeFixed("");
    setMinAmount("");
    setMaxAmount("");
    setIsActive(true);
    setEditingProcessor(null);
  };

  // Open dialog for editing
  const openEditDialog = (processor: PaymentProcessor) => {
    setEditingProcessor(processor);
    setProcessorName(processor.name);
    setProcessorType(processor.processor_type);
    setFeePercentage(processor.fee_percentage.toString());
    setFeeFixed(processor.fee_fixed.toString());
    setMinAmount(processor.min_amount.toString());
    setMaxAmount(processor.max_amount.toString());
    setIsActive(processor.is_active);
    
    // Load config if exists
    if (processor.config?.cpay_checkout_id) {
      setPreset("cpay_deposit");
      setSelectedCheckoutId(processor.config.cpay_checkout_id);
    }
    
    setDialogOpen(true);
  };

  // Open dialog for adding
  const openAddDialog = () => {
    setEditingProcessor(null);
    resetForm();
    setDialogOpen(true);
  };

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,98%)] flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading payment settings..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(0,0%,98%)]">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Payment Settings</h1>
            <p className="text-muted-foreground">Configure payment processors for deposits and withdrawals</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/admin/settings/cpay-checkouts")} variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Manage CPAY Checkouts
            </Button>
            <Button onClick={() => navigate("/admin")} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Payment Processors</CardTitle>
                <CardDescription>
                  Manage payment gateways and their configurations
                </CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openAddDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Processor
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingProcessor ? "Edit" : "Add"} Payment Processor
                    </DialogTitle>
                    <DialogDescription>
                      Configure payment gateway settings
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="preset">Preset Configuration</Label>
                      <select
                        id="preset"
                        value={preset}
                        onChange={(e) => handlePresetChange(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">Custom Configuration</option>
                        <option value="cpay_deposit">CPAY Deposit (Hosted Checkout)</option>
                        <option value="cpay_withdrawal_usdt">CPAY Withdrawal - USDT TRC20</option>
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Select a preset to auto-fill common configurations
                      </p>
                    </div>

                    {preset === "cpay_deposit" && (
                      <div>
                        <Label htmlFor="cpayCheckout">Select CPAY Checkout *</Label>
                        <select
                          id="cpayCheckout"
                          value={selectedCheckoutId}
                          onChange={(e) => setSelectedCheckoutId(e.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          required
                        >
                          <option value="">-- Select Checkout --</option>
                          {cpayCheckouts.map((checkout) => (
                            <option key={checkout.id} value={checkout.id}>
                              {checkout.currency} - {checkout.checkout_url.substring(0, 40)}...
                            </option>
                          ))}
                        </select>
                        {cpayCheckouts.length === 0 && (
                          <p className="text-xs text-destructive mt-1">
                            No active CPAY checkouts found. Please add one first.
                          </p>
                        )}
                      </div>
                    )}

                    <div>
                      <Label htmlFor="processorName">Processor Name *</Label>
                      <Input
                        id="processorName"
                        value={processorName}
                        onChange={(e) => setProcessorName(e.target.value)}
                        placeholder="e.g., PayPal USD"
                      />
                    </div>

                    <div>
                      <Label htmlFor="processorType">Processor Type *</Label>
                      <select
                        id="processorType"
                        value={processorType}
                        onChange={(e) => setProcessorType(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        required
                      >
                        <option value="">-- Select Type --</option>
                        <option value="deposit">Deposit</option>
                        <option value="withdrawal">Withdrawal</option>
                        <option value="both">Both</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="feePercentage">Fee Percentage (%)</Label>
                        <Input
                          id="feePercentage"
                          type="number"
                          step="0.01"
                          value={feePercentage}
                          onChange={(e) => setFeePercentage(e.target.value)}
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <Label htmlFor="feeFixed">Fixed Fee ($)</Label>
                        <Input
                          id="feeFixed"
                          type="number"
                          step="0.01"
                          value={feeFixed}
                          onChange={(e) => setFeeFixed(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="minAmount">Min Amount ($)</Label>
                        <Input
                          id="minAmount"
                          type="number"
                          step="0.01"
                          value={minAmount}
                          onChange={(e) => setMinAmount(e.target.value)}
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <Label htmlFor="maxAmount">Max Amount ($)</Label>
                        <Input
                          id="maxAmount"
                          type="number"
                          step="0.01"
                          value={maxAmount}
                          onChange={(e) => setMaxAmount(e.target.value)}
                          placeholder="10000"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isActive"
                        checked={isActive}
                        onCheckedChange={setIsActive}
                      />
                      <Label htmlFor="isActive">Active</Label>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? "Saving..." : editingProcessor ? "Update" : "Add"} Processor
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
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Limits</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No payment processors configured
                      </TableCell>
                    </TableRow>
                  ) : (
                    processors.map((processor) => (
                      <TableRow key={processor.id}>
                        <TableCell className="font-medium">
                          {processor.name}
                          {processor.config?.cpay_checkout_id && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              CPAY: {processor.config.currency}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{processor.processor_type}</Badge>
                        </TableCell>
                        <TableCell>
                          {processor.fee_percentage > 0 && `${processor.fee_percentage}%`}
                          {processor.fee_percentage > 0 && processor.fee_fixed > 0 && " + "}
                          {processor.fee_fixed > 0 && `$${processor.fee_fixed}`}
                          {processor.fee_percentage === 0 && processor.fee_fixed === 0 && "Free"}
                        </TableCell>
                        <TableCell>
                          ${processor.min_amount} - ${processor.max_amount}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={processor.is_active}
                              onCheckedChange={() => handleToggleActive(processor)}
                            />
                            <Badge variant={processor.is_active ? "default" : "secondary"}>
                              {processor.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(processor)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(processor.id!)}
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

export default PaymentSettings;