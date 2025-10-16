import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useUserManagement } from "@/hooks/useUserManagement";
import { useMembershipPlans } from "@/hooks/useMembershipPlans";
import { Badge } from "@/components/ui/badge";
import { Users, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BulkUpdatePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUserIds: string[];
  onComplete: () => void;
}

export const BulkUpdatePlanDialog = ({
  open,
  onOpenChange,
  selectedUserIds,
  onComplete,
}: BulkUpdatePlanDialogProps) => {
  const [selectedPlan, setSelectedPlan] = useState("");
  
  const { bulkUpdatePlan } = useUserManagement();
  const { plans, loading: plansLoading } = useMembershipPlans();

  const handleSubmit = () => {
    if (!selectedPlan) return;

    bulkUpdatePlan.mutate(
      {
        userIds: selectedUserIds,
        planName: selectedPlan,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onComplete();
          setSelectedPlan("");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Update Membership Plans
          </DialogTitle>
          <DialogDescription>
            Update membership plans for {selectedUserIds.length} selected user{selectedUserIds.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This will update the membership plan for all selected users. Their plan expiry dates will be extended based on the new plan's billing period.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <Label>Select Plan</Label>
            {plansLoading ? (
              <div className="text-sm text-muted-foreground">Loading plans...</div>
            ) : (
              <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan}>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {plans?.map((plan) => (
                    <div
                      key={plan.id}
                      className="flex items-start space-x-3 border rounded-lg p-3 hover:bg-accent/50 cursor-pointer"
                    >
                      <RadioGroupItem value={plan.name} id={`bulk-${plan.name}`} className="mt-1" />
                      <Label htmlFor={`bulk-${plan.name}`} className="flex-1 cursor-pointer">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm">{plan.display_name}</span>
                          <Badge variant="outline" className="text-xs">{plan.account_type}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <div>${plan.price}/{plan.billing_period_value} {plan.billing_period_unit}(s)</div>
                          <div>{plan.daily_task_limit} tasks/day · ${plan.earning_per_task}/task</div>
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            )}
          </div>

          <div className="rounded-lg border bg-muted/50 p-3 space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Selected Users:</span>
              <span className="font-medium">{selectedUserIds.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">New Plan:</span>
              <span className="font-medium">{selectedPlan || "Not selected"}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            disabled={bulkUpdatePlan.isPending}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedPlan || bulkUpdatePlan.isPending}
          >
            {bulkUpdatePlan.isPending ? "Updating..." : `Update ${selectedUserIds.length} User${selectedUserIds.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
