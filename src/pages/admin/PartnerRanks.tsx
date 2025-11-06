import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Edit, Trash2, Award, TrendingUp } from "lucide-react";

interface PartnerRank {
  id: string;
  rank_name: string;
  daily_sales_target: number;
  commission_rate: number;
  rank_order: number;
  created_at: string;
  updated_at: string;
}

const PartnerRanks = () => {
  const queryClient = useQueryClient();
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [selectedRank, setSelectedRank] = useState<PartnerRank | null>(null);
  
  const [formData, setFormData] = useState({
    rank_name: "",
    daily_sales_target: 0,
    commission_rate: 0.10,
    rank_order: 1,
  });

  const { data: ranks, isLoading } = useQuery({
    queryKey: ['partner-ranks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_ranks')
        .select('*')
        .order('rank_order', { ascending: true });

      if (error) throw error;
      return data as PartnerRank[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('partner_ranks')
        .insert([data]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-ranks'] });
      toast.success("Rank created successfully");
      setEditDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create rank");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from('partner_ranks')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-ranks'] });
      toast.success("Rank updated successfully");
      setEditDialog(false);
      setSelectedRank(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update rank");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('partner_ranks')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-ranks'] });
      toast.success("Rank deleted successfully");
      setDeleteDialog(false);
      setSelectedRank(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete rank");
    },
  });

  const resetForm = () => {
    setFormData({
      rank_name: "",
      daily_sales_target: 0,
      commission_rate: 0.10,
      rank_order: 1,
    });
  };

  const handleCreate = () => {
    setSelectedRank(null);
    resetForm();
    setEditDialog(true);
  };

  const handleEdit = (rank: PartnerRank) => {
    setSelectedRank(rank);
    setFormData({
      rank_name: rank.rank_name,
      daily_sales_target: rank.daily_sales_target,
      commission_rate: rank.commission_rate,
      rank_order: rank.rank_order,
    });
    setEditDialog(true);
  };

  const handleDelete = (rank: PartnerRank) => {
    setSelectedRank(rank);
    setDeleteDialog(true);
  };

  const handleSubmit = () => {
    if (selectedRank) {
      updateMutation.mutate({ id: selectedRank.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getRankColor = (rankName: string) => {
    const colors: Record<string, string> = {
      bronze: "bg-orange-500",
      silver: "bg-gray-400",
      gold: "bg-yellow-500",
      platinum: "bg-purple-500",
    };
    return colors[rankName.toLowerCase()] || "bg-blue-500";
  };

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Award className="h-8 w-8" />
              Partner Ranks
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure rank tiers, sales targets, and commission rates
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Rank
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Rank Configuration</CardTitle>
            <CardDescription>
              Partners automatically upgrade based on total sales milestones
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : ranks && ranks.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Rank</TableHead>
                    <TableHead>Sales Target</TableHead>
                    <TableHead>Commission Rate</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranks.map((rank) => (
                    <TableRow key={rank.id}>
                      <TableCell>
                        <Badge variant="outline">{rank.rank_order}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getRankColor(rank.rank_name)} text-white`}>
                          <Award className="h-3 w-3 mr-1" />
                          {rank.rank_name.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          ${rank.daily_sales_target.toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-green-600">
                          {(rank.commission_rate * 100).toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(rank)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(rank)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <Award className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No ranks configured yet</p>
                <Button onClick={handleCreate} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Rank
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit/Create Dialog */}
        <Dialog open={editDialog} onOpenChange={setEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedRank ? "Edit Rank" : "Create Rank"}
              </DialogTitle>
              <DialogDescription>
                Configure rank details and requirements
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Rank Name</Label>
                <Input
                  value={formData.rank_name}
                  onChange={(e) => setFormData({ ...formData, rank_name: e.target.value })}
                  placeholder="e.g., Bronze, Silver, Gold"
                />
              </div>

              <div>
                <Label>Sales Target ($)</Label>
                <Input
                  type="number"
                  value={formData.daily_sales_target}
                  onChange={(e) => setFormData({ ...formData, daily_sales_target: parseFloat(e.target.value) })}
                  placeholder="Total sales needed to reach this rank"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Total cumulative sales required to achieve this rank
                </p>
              </div>

              <div>
                <Label>Commission Rate (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.commission_rate * 100}
                  onChange={(e) => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) / 100 })}
                  placeholder="e.g., 10"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Commission rate for partners at this rank
                </p>
              </div>

              <div>
                <Label>Rank Order</Label>
                <Input
                  type="number"
                  value={formData.rank_order}
                  onChange={(e) => setFormData({ ...formData, rank_order: parseInt(e.target.value) })}
                  placeholder="1 = lowest, higher = better"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lower numbers appear first (e.g., Bronze = 1, Silver = 2)
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {selectedRank ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Rank</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the {selectedRank?.rank_name} rank?
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialog(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={() => selectedRank && deleteMutation.mutate(selectedRank.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default PartnerRanks;
