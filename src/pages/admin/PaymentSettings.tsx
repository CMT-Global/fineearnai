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
import { ArrowLeft, Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

interface PaymentProcessor {
  id: string;
  name: string;
  processor_type: string;
  is_active: boolean;
  fee_percentage: number;
  fee_fixed: number;
  min_amount: number;
  max_amount: number;
  config: any;
}

const PaymentSettings = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [processors, setProcessors] = useState<PaymentProcessor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProcessor, setEditingProcessor] = useState<PaymentProcessor | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    processor_type: "",
    is_active: true,
    fee_percentage: 0,
    fee_fixed: 0,
    min_amount: 0,
    max_amount: 10000,
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
      loadProcessors();
    }
  }, [isAdmin]);

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

  const handleSave = async () => {
    try {
      if (!formData.name || !formData.processor_type) {
        toast.error("Please fill in all required fields");
        return;
      }

      if (editingProcessor) {
        const { error } = await supabase
          .from("payment_processors")
          .update(formData)
          .eq("id", editingProcessor.id);

        if (error) throw error;
        toast.success("Payment processor updated successfully");
      } else {
        const { error } = await supabase
          .from("payment_processors")
          .insert([formData]);

        if (error) throw error;
        toast.success("Payment processor added successfully");
      }

      setDialogOpen(false);
      setEditingProcessor(null);
      resetForm();
      loadProcessors();
    } catch (error: any) {
      console.error("Error saving processor:", error);
      toast.error(error.message || "Failed to save payment processor");
    }
  };

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

  const resetForm = () => {
    setFormData({
      name: "",
      processor_type: "",
      is_active: true,
      fee_percentage: 0,
      fee_fixed: 0,
      min_amount: 0,
      max_amount: 10000,
    });
  };

  const openEditDialog = (processor: PaymentProcessor) => {
    setEditingProcessor(processor);
    setFormData({
      name: processor.name,
      processor_type: processor.processor_type,
      is_active: processor.is_active,
      fee_percentage: processor.fee_percentage,
      fee_fixed: processor.fee_fixed,
      min_amount: processor.min_amount,
      max_amount: processor.max_amount,
    });
    setDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingProcessor(null);
    resetForm();
    setDialogOpen(true);
  };

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading payment settings..." />
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

          <h1 className="text-3xl font-bold mb-2">Payment Processor Configuration</h1>
          <p className="text-muted-foreground">
            Configure payment methods, fees, and limits
          </p>
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
                <DialogContent>
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
                      <Label htmlFor="name">Processor Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Payeer, PayPal"
                      />
                    </div>

                    <div>
                      <Label htmlFor="type">Processor Type *</Label>
                      <Input
                        id="type"
                        value={formData.processor_type}
                        onChange={(e) =>
                          setFormData({ ...formData, processor_type: e.target.value })
                        }
                        placeholder="e.g., crypto, bank_transfer, paypal"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="fee_percentage">Fee Percentage (%)</Label>
                        <Input
                          id="fee_percentage"
                          type="number"
                          step="0.01"
                          value={formData.fee_percentage}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              fee_percentage: parseFloat(e.target.value),
                            })
                          }
                        />
                      </div>

                      <div>
                        <Label htmlFor="fee_fixed">Fixed Fee ($)</Label>
                        <Input
                          id="fee_fixed"
                          type="number"
                          step="0.01"
                          value={formData.fee_fixed}
                          onChange={(e) =>
                            setFormData({ ...formData, fee_fixed: parseFloat(e.target.value) })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="min_amount">Min Amount ($)</Label>
                        <Input
                          id="min_amount"
                          type="number"
                          step="0.01"
                          value={formData.min_amount}
                          onChange={(e) =>
                            setFormData({ ...formData, min_amount: parseFloat(e.target.value) })
                          }
                        />
                      </div>

                      <div>
                        <Label htmlFor="max_amount">Max Amount ($)</Label>
                        <Input
                          id="max_amount"
                          type="number"
                          step="0.01"
                          value={formData.max_amount}
                          onChange={(e) =>
                            setFormData({ ...formData, max_amount: parseFloat(e.target.value) })
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
                      {editingProcessor ? "Update" : "Add"} Processor
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
                        <TableCell className="font-medium">{processor.name}</TableCell>
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
                              onClick={() => handleDelete(processor.id)}
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
