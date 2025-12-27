import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      toast.success(t("toasts.admin.rankCreated"));
      setEditDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || t("toasts.admin.failedToCreateRank"));
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
      toast.success(t("toasts.admin.rankUpdated"));
      setEditDialog(false);
      setSelectedRank(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || t("toasts.admin.failedToUpdateRank"));
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
      toast.success(t("toasts.admin.rankDeleted"));
      setDeleteDialog(false);
      setSelectedRank(null);
    },
    onError: (error: any) => {
      toast.error(error.message || t("toasts.admin.failedToDeleteRank"));
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
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Award className="h-8 w-8" />
            {t("admin.partnerRanks.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("admin.partnerRanks.subtitle")}
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t("admin.partnerRanks.addRank")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.partnerRanks.rankConfiguration")}</CardTitle>
          <CardDescription>
            {t("admin.partnerRanks.rankConfigurationDescription")}
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
                  <TableHead>{t("admin.partnerRanks.order")}</TableHead>
                  <TableHead>{t("admin.partnerRanks.rank")}</TableHead>
                  <TableHead>{t("admin.partnerRanks.salesTarget")}</TableHead>
                  <TableHead>{t("admin.partnerRanks.commissionRate")}</TableHead>
                  <TableHead>{t("admin.partnerRanks.actions")}</TableHead>
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
              <p className="text-muted-foreground">{t("admin.partnerRanks.noRanksConfigured")}</p>
              <Button onClick={handleCreate} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                {t("admin.partnerRanks.createFirstRank")}
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
              {selectedRank ? t("admin.partnerRanks.editRank") : t("admin.partnerRanks.createRank")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.partnerRanks.rankDetails")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{t("admin.partnerRanks.rankName")}</Label>
              <Input
                value={formData.rank_name}
                onChange={(e) => setFormData({ ...formData, rank_name: e.target.value })}
                placeholder={t("admin.partnerRanks.rankNamePlaceholder")}
              />
            </div>

            <div>
              <Label>{t("admin.partnerRanks.salesTarget")}</Label>
              <Input
                type="number"
                value={formData.daily_sales_target}
                onChange={(e) => setFormData({ ...formData, daily_sales_target: parseFloat(e.target.value) })}
                placeholder={t("admin.partnerRanks.salesTargetPlaceholder")}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("admin.partnerRanks.salesTargetHelp")}
              </p>
            </div>

            <div>
              <Label>{t("admin.partnerRanks.commissionRatePercent")}</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.commission_rate * 100}
                onChange={(e) => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) / 100 })}
                placeholder={t("admin.partnerRanks.commissionRatePlaceholder")}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("admin.partnerRanks.commissionRateHelp")}
              </p>
            </div>

            <div>
              <Label>{t("admin.partnerRanks.rankOrder")}</Label>
              <Input
                type="number"
                value={formData.rank_order}
                onChange={(e) => setFormData({ ...formData, rank_order: parseInt(e.target.value) })}
                placeholder={t("admin.partnerRanks.rankOrderPlaceholder")}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("admin.partnerRanks.rankOrderHelp")}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {selectedRank ? t("admin.partnerRanks.update") : t("admin.partnerRanks.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.partnerRanks.deleteRank")}</DialogTitle>
            <DialogDescription>
              {t("admin.partnerRanks.deleteRankConfirmation", { rankName: selectedRank?.rank_name })}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button 
              variant="destructive"
              onClick={() => selectedRank && deleteMutation.mutate(selectedRank.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PartnerRanks;
