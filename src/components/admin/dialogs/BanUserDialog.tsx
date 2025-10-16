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
import { Checkbox } from "@/components/ui/checkbox";
import { useUserManagement } from "@/hooks/useUserManagement";
import { ShieldX, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BanUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  username: string;
  email: string;
}

export const BanUserDialog = ({
  open,
  onOpenChange,
  userId,
  username,
  email,
}: BanUserDialogProps) => {
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  
  const { banUser } = useUserManagement();

  const handleSubmit = () => {
    if (!reason.trim() || !confirmed) return;

    banUser.mutate(
      {
        userId,
        banReason: reason.trim(),
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setReason("");
          setConfirmed(false);
        },
      }
    );
  };

  const handleClose = () => {
    onOpenChange(false);
    setReason("");
    setConfirmed(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldX className="h-5 w-5" />
            Ban User Permanently
          </DialogTitle>
          <DialogDescription>
            This is a serious action that will permanently ban {username} from the platform
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning Alert */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning: This action is severe and should only be used for serious violations.</strong>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>The user will be immediately logged out</li>
                <li>They cannot log in or access their account</li>
                <li>All pending transactions will be cancelled</li>
                <li>Wallet balances will be frozen</li>
                <li>Referral relationships will remain but be inactive</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* User Info */}
          <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Username:</span>
              <span className="font-medium">{username}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium">{email}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">User ID:</span>
              <span className="font-mono text-xs">{userId.slice(0, 8)}...</span>
            </div>
          </div>

          {/* Ban Reason */}
          <div className="space-y-2">
            <Label htmlFor="ban-reason">
              Ban Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="ban-reason"
              placeholder="Provide a detailed reason for banning this user (e.g., terms of service violation, fraud, abuse)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={5}
              maxLength={1000}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {reason.length}/1000 characters - This reason will be logged and may be reviewed
            </p>
          </div>

          {/* Confirmation Checkbox */}
          <div className="flex items-start space-x-2 rounded-lg border-2 border-destructive/50 bg-destructive/5 p-4">
            <Checkbox 
              id="confirm-ban" 
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked as boolean)}
            />
            <Label
              htmlFor="confirm-ban"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              I understand this is a permanent ban and I have documented a valid reason. I confirm that I want to ban this user.
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={banUser.isPending}>
            Cancel
          </Button>
          <Button 
            variant="destructive"
            onClick={handleSubmit} 
            disabled={!reason.trim() || !confirmed || banUser.isPending}
          >
            {banUser.isPending ? "Banning User..." : "Ban User Permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
