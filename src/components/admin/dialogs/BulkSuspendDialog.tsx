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
import { UserX, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BulkSuspendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUserIds: string[];
  onComplete: () => void;
}

export const BulkSuspendDialog = ({
  open,
  onOpenChange,
  selectedUserIds,
  onComplete,
}: BulkSuspendDialogProps) => {
  const [reason, setReason] = useState("");
  
  const { bulkSuspend } = useUserManagement();

  const handleSubmit = () => {
    bulkSuspend.mutate(
      {
        userIds: selectedUserIds,
        suspendReason: reason.trim() || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onComplete();
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
            Bulk Suspend Users
          </DialogTitle>
          <DialogDescription>
            Suspend {selectedUserIds.length} selected user{selectedUserIds.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This will suspend all selected users. They will not be able to:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Log in to their accounts</li>
                <li>Complete tasks or earn</li>
                <li>Make deposits or withdrawals</li>
                <li>Access any platform features</li>
              </ul>
              <p className="mt-2 text-sm font-medium">
                This action is reversible - you can unsuspend users later.
              </p>
            </AlertDescription>
          </Alert>

          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Users to suspend:</span>
              <span className="font-medium">{selectedUserIds.length}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-reason">
              Reason (Optional)
            </Label>
            <Textarea
              id="bulk-reason"
              placeholder="Explain why these users are being suspended..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {reason.length}/500 characters
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={bulkSuspend.isPending}>
            Cancel
          </Button>
          <Button 
            variant="destructive"
            onClick={handleSubmit} 
            disabled={bulkSuspend.isPending}
          >
            {bulkSuspend.isPending 
              ? "Suspending..." 
              : `Suspend ${selectedUserIds.length} User${selectedUserIds.length !== 1 ? 's' : ''}`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
