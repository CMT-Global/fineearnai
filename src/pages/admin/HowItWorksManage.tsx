import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Save, X, MoveUp, MoveDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface HowItWorksStep {
  id: string;
  step_number: number;
  title: string;
  description: string;
  icon_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface StepFormData {
  title: string;
  description: string;
  icon_name: string;
  is_active: boolean;
}

const AVAILABLE_ICONS = [
  'UserPlus', 'Settings', 'CreditCard', 'Brain', 'TrendingUp', 
  'Users', 'Rocket', 'Wallet', 'CheckCircle', 'Star',
  'Award', 'Target', 'Zap', 'Gift', 'ShieldCheck',
  'HelpCircle', 'BookOpen', 'Globe', 'DollarSign', 'Activity'
];

const HowItWorksManage = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<HowItWorksStep | null>(null);
  const [formData, setFormData] = useState<StepFormData>({
    title: "",
    description: "",
    icon_name: "HelpCircle",
    is_active: true,
  });

  const queryClient = useQueryClient();

  // Fetch all steps (including inactive for admin)
  const { data: steps, isLoading } = useQuery({
    queryKey: ["how-it-works-steps-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("how_it_works_steps")
        .select("*")
        .order("step_number", { ascending: true });

      if (error) throw error;
      return data as HowItWorksStep[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: StepFormData & { step_number: number }) => {
      const { error } = await supabase
        .from("how_it_works_steps")
        .insert([data]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["how-it-works-steps-admin"] });
      queryClient.invalidateQueries({ queryKey: ["how-it-works-steps"] });
      toast.success("Step created successfully");
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(`Failed to create step: ${error.message}`);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<StepFormData> }) => {
      const { error } = await supabase
        .from("how_it_works_steps")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["how-it-works-steps-admin"] });
      queryClient.invalidateQueries({ queryKey: ["how-it-works-steps"] });
      toast.success("Step updated successfully");
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(`Failed to update step: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("how_it_works_steps")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["how-it-works-steps-admin"] });
      queryClient.invalidateQueries({ queryKey: ["how-it-works-steps"] });
      toast.success("Step deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete step: ${error.message}`);
    },
  });

  // Reorder mutation
  const reorderMutation = useMutation({
    mutationFn: async ({ id, newStepNumber }: { id: string; newStepNumber: number }) => {
      const { error } = await supabase
        .from("how_it_works_steps")
        .update({ step_number: newStepNumber })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["how-it-works-steps-admin"] });
      queryClient.invalidateQueries({ queryKey: ["how-it-works-steps"] });
      toast.success("Step reordered successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to reorder step: ${error.message}`);
    },
  });

  const handleOpenDialog = (step?: HowItWorksStep) => {
    if (step) {
      setEditingStep(step);
      setFormData({
        title: step.title,
        description: step.description,
        icon_name: step.icon_name,
        is_active: step.is_active,
      });
    } else {
      setEditingStep(null);
      setFormData({
        title: "",
        description: "",
        icon_name: "HelpCircle",
        is_active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingStep(null);
    setFormData({
      title: "",
      description: "",
      icon_name: "HelpCircle",
      is_active: true,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingStep) {
      updateMutation.mutate({ id: editingStep.id, data: formData });
    } else {
      const nextStepNumber = steps ? Math.max(...steps.map(s => s.step_number)) + 1 : 1;
      createMutation.mutate({ ...formData, step_number: nextStepNumber });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this step?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleReorder = (step: HowItWorksStep, direction: 'up' | 'down') => {
    if (!steps) return;

    const currentIndex = steps.findIndex(s => s.id === step.id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= steps.length) return;

    const targetStep = steps[targetIndex];

    // Swap step numbers
    reorderMutation.mutate({ id: step.id, newStepNumber: targetStep.step_number });
    reorderMutation.mutate({ id: targetStep.id, newStepNumber: step.step_number });
  };

  return (
    <AdminLayout>
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">How It Works Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage the steps shown in the "How It Works" guide
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Add Step
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Steps Overview</CardTitle>
            <CardDescription>
              Total Steps: {steps?.length || 0} | Active: {steps?.filter(s => s.is_active).length || 0}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading steps...</div>
            ) : steps && steps.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Step #</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Icon</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[200px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {steps.map((step, index) => (
                    <TableRow key={step.id}>
                      <TableCell className="font-medium">{step.step_number}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{step.title}</div>
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {step.description}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{step.icon_name}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={step.is_active ? "default" : "secondary"}>
                          {step.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleReorder(step, 'up')}
                            disabled={index === 0}
                          >
                            <MoveUp className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleReorder(step, 'down')}
                            disabled={index === steps.length - 1}
                          >
                            <MoveDown className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenDialog(step)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(step.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No steps found. Click "Add Step" to create your first step.
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingStep ? "Edit Step" : "Add New Step"}
              </DialogTitle>
              <DialogDescription>
                {editingStep 
                  ? "Update the details of this step" 
                  : "Create a new step for the How It Works guide"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Step Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Create Your Account"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed description of this step..."
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="icon_name">Icon Name</Label>
                <select
                  id="icon_name"
                  value={formData.icon_name}
                  onChange={(e) => setFormData({ ...formData, icon_name: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                >
                  {AVAILABLE_ICONS.map((icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-muted-foreground">
                  Choose an icon from Lucide React icons
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label htmlFor="is_active">Active (visible to users)</Label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingStep ? "Update Step" : "Create Step"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default HowItWorksManage;