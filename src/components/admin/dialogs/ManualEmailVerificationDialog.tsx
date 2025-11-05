import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck, ShieldX } from "lucide-react";

interface ManualEmailVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  username: string;
  currentStatus: boolean;
  onSuccess: () => void;
}

export function ManualEmailVerificationDialog({
  open,
  onOpenChange,
  userId,
  username,
  currentStatus,
  onSuccess,
}: ManualEmailVerificationDialogProps) {
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const action = currentStatus ? "unverify" : "verify";
  const actionLabel = currentStatus ? "Unverify" : "Verify";

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for this action");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("admin-verify-email", {
        body: {
          userId,
          action,
          reason: reason.trim(),
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(data.message || `Email ${actionLabel.toLowerCase()}ed successfully`);
        onSuccess();
        onOpenChange(false);
        setReason("");
      } else {
        throw new Error(data?.error || `Failed to ${action} email`);
      }
    } catch (error: any) {
      console.error(`Error ${action}ing email:`, error);
      toast.error(error.message || `Failed to ${action} email`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {currentStatus ? (
              <ShieldX className="h-5 w-5 text-destructive" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-success" />
            )}
            {actionLabel} Email for {username}
          </DialogTitle>
          <DialogDescription>
            {currentStatus
              ? "This will mark the user's email as unverified. They will need to verify their email again."
              : "This will manually verify the user's email without requiring them to enter an OTP code."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason for {actionLabel.toLowerCase()}ication <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder={`Enter the reason for ${action}ing this email...`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This reason will be logged in the audit trail for compliance purposes.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setReason("");
            }}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !reason.trim()}
            variant={currentStatus ? "destructive" : "default"}
          >
            {isLoading ? "Processing..." : `${actionLabel} Email`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
