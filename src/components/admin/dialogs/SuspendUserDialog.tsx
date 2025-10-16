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
import { Textarea } from "@/components/ui/textarea";
import { useUserManagement } from "@/hooks/useUserManagement";
import { AlertCircle, UserX } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SuspendUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  username: string;
  currentStatus: string;
}

export const SuspendUserDialog = ({
  open,
  onOpenChange,
  userId,
  username,
  currentStatus,
}: SuspendUserDialogProps) => {
  const [reason, setReason] = useState("");
  
  const { suspendUser } = useUserManagement();
  const isSuspended = currentStatus === "suspended";

  const handleSubmit = () => {
    suspendUser.mutate(
      {
        userId,
        suspendReason: reason.trim() || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setReason("");
        },
      }
    );
  };

  const handleClose = () => {
    onOpenChange(false);
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5" />
            {isSuspended ? "Unsuspend User" : "Suspend User"}
          </DialogTitle>
          <DialogDescription>
            {isSuspended 
              ? `Restore access for ${username}` 
              : `Temporarily restrict ${username}'s access to the platform`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {isSuspended ? (
                <>
                  This will restore {username}'s account access. They will be able to:
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>Log in to their account</li>
                    <li>Complete tasks and earn</li>
                    <li>Make deposits and withdrawals</li>
                    <li>Access all platform features</li>
                  </ul>
                </>
              ) : (
                <>
                  This will suspend {username}'s account. They will not be able to:
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>Log in to their account</li>
                    <li>Complete tasks or earn</li>
                    <li>Make deposits or withdrawals</li>
                    <li>Access any platform features</li>
                  </ul>
                  <p className="mt-2 text-sm font-medium">
                    This action is reversible - you can unsuspend the user later.
                  </p>
                </>
              )}
            </AlertDescription>
          </Alert>

          {!isSuspended && (
            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason (Optional)
              </Label>
              <Textarea
                id="reason"
                placeholder="Explain why this user is being suspended..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {reason.length}/500 characters
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={suspendUser.isPending}>
            Cancel
          </Button>
          <Button 
            variant={isSuspended ? "default" : "destructive"}
            onClick={handleSubmit} 
            disabled={suspendUser.isPending}
          >
            {suspendUser.isPending 
              ? "Processing..." 
              : isSuspended 
                ? "Unsuspend User" 
                : "Suspend User"
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
