import { useState, useEffect } from "react";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUserManagement } from "@/hooks/useUserManagement";
import { useMembershipPlans } from "@/hooks/useMembershipPlans";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Award, TrendingUp, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ChangePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  username: string;
  currentPlan: string;
  currentExpiry: string | null;
}

export const ChangePlanDialog = ({
  open,
  onOpenChange,
  userId,
  username,
  currentPlan,
  currentExpiry,
}: ChangePlanDialogProps) => {
  const [selectedPlan, setSelectedPlan] = useState(currentPlan);
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(
    currentExpiry ? new Date(currentExpiry) : undefined
  );
  
  const { changeMembershipPlan } = useUserManagement();
  const { plans, loading: plansLoading } = useMembershipPlans();

  useEffect(() => {
    setSelectedPlan(currentPlan);
  }, [currentPlan]);

  const handleSubmit = () => {
    if (!selectedPlan) return;

    changeMembershipPlan.mutate(
      {
        userId,
        planData: {
          plan_name: selectedPlan,
          expires_at: expiryDate?.toISOString(),
        },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const selectedPlanData = plans?.find((p) => p.name === selectedPlan);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Change Membership Plan
          </DialogTitle>
          <DialogDescription>
            Update {username}'s membership plan and expiry date
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Plan Info */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current Plan:</span>
              <Badge variant="default">{currentPlan}</Badge>
            </div>
            {currentExpiry && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-muted-foreground">Current Expiry:</span>
                <span className="text-sm font-medium">
                  {format(new Date(currentExpiry), "PPP")}
                </span>
              </div>
            )}
          </div>

          {/* Plan Selection */}
          <div className="space-y-3">
            <Label>Select New Plan</Label>
            {plansLoading ? (
              <div className="text-sm text-muted-foreground">Loading plans...</div>
            ) : (
              <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan}>
                <div className="space-y-2">
                  {plans?.map((plan) => (
                    <div
                      key={plan.id}
                      className={cn(
                        "flex items-start space-x-3 border rounded-lg p-4 hover:bg-accent/50 cursor-pointer transition-colors",
                        selectedPlan === plan.name && "border-primary bg-primary/5"
                      )}
                    >
                      <RadioGroupItem value={plan.name} id={plan.name} className="mt-1" />
                      <Label htmlFor={plan.name} className="flex-1 cursor-pointer">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold">{plan.display_name}</span>
                          <Badge variant="outline">{plan.account_type}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            ${plan.price}/{plan.billing_period_value} {plan.billing_period_unit}(s)
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            ${plan.earning_per_task}/task
                          </div>
                          <div>Daily Limit: {plan.daily_task_limit} tasks</div>
                          <div>Skip Limit: {plan.task_skip_limit_per_day}/day</div>
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            )}
          </div>

          {/* Expiry Date Selection */}
          <div className="space-y-2">
            <Label>Plan Expiry Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expiryDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expiryDate ? format(expiryDate, "PPP") : "Select expiry date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expiryDate}
                  onSelect={setExpiryDate}
                  initialFocus
                  className="pointer-events-auto"
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Leave empty for no expiry date. Plans without expiry won't auto-renew.
            </p>
          </div>

          {/* Plan Comparison */}
          {selectedPlanData && (
            <div className="rounded-lg border bg-accent/50 p-4 space-y-2">
              <h4 className="font-medium text-sm">New Plan Benefits</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Daily Tasks:</span>
                  <span className="ml-1 font-medium">{selectedPlanData.daily_task_limit}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Earning/Task:</span>
                  <span className="ml-1 font-medium">${selectedPlanData.earning_per_task}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Task Commission:</span>
                  <span className="ml-1 font-medium">{(selectedPlanData.task_commission_rate * 100).toFixed(0)}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Deposit Commission:</span>
                  <span className="ml-1 font-medium">{(selectedPlanData.deposit_commission_rate * 100).toFixed(0)}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Task Skip Limit:</span>
                  <span className="ml-1 font-medium">{selectedPlanData.task_skip_limit_per_day}/day</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Free Plan Expiry:</span>
                  <span className="ml-1 font-medium">
                    {selectedPlanData.free_plan_expiry_days ? `${selectedPlanData.free_plan_expiry_days} days` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            disabled={changeMembershipPlan.isPending}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedPlan || changeMembershipPlan.isPending}
          >
            {changeMembershipPlan.isPending ? "Updating..." : "Update Plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
