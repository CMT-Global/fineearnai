import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
            {isSuspended ? t("admin.dialogs.suspendUser.unsuspendTitle") : t("admin.dialogs.suspendUser.title")}
          </DialogTitle>
          <DialogDescription>
            {isSuspended 
              ? t("admin.dialogs.suspendUser.unsuspendDescription", { username })
              : t("admin.dialogs.suspendUser.suspendDescription", { username })
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {isSuspended ? (
                <>
                  {t("admin.dialogs.suspendUser.restoreAccess", { username })}
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>{t("admin.dialogs.suspendUser.restoreAccessItem1")}</li>
                    <li>{t("admin.dialogs.suspendUser.restoreAccessItem2")}</li>
                    <li>{t("admin.dialogs.suspendUser.restoreAccessItem3")}</li>
                    <li>{t("admin.dialogs.suspendUser.restoreAccessItem4")}</li>
                  </ul>
                </>
              ) : (
                <>
                  {t("admin.dialogs.suspendUser.suspendAccess", { username })}
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>{t("admin.dialogs.suspendUser.suspendAccessItem1")}</li>
                    <li>{t("admin.dialogs.suspendUser.suspendAccessItem2")}</li>
                    <li>{t("admin.dialogs.suspendUser.suspendAccessItem3")}</li>
                    <li>{t("admin.dialogs.suspendUser.suspendAccessItem4")}</li>
                  </ul>
                  <p className="mt-2 text-sm font-medium">
                    {t("admin.dialogs.suspendUser.reversible")}
                  </p>
                </>
              )}
            </AlertDescription>
          </Alert>

          {!isSuspended && (
            <div className="space-y-2">
              <Label htmlFor="reason">
                {t("admin.dialogs.suspendUser.reasonLabel")}
              </Label>
              <Textarea
                id="reason"
                placeholder={t("admin.dialogs.suspendUser.reasonPlaceholder")}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {t("admin.dialogs.suspendUser.reasonCharacterCount", { count: reason.length })}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={suspendUser.isPending}>
            {t("admin.dialogs.suspendUser.cancel")}
          </Button>
          <Button 
            variant={isSuspended ? "default" : "destructive"}
            onClick={handleSubmit} 
            disabled={suspendUser.isPending}
          >
            {suspendUser.isPending 
              ? t("admin.dialogs.suspendUser.processing")
              : isSuspended 
                ? t("admin.dialogs.suspendUser.unsuspendButton")
                : t("admin.dialogs.suspendUser.suspendButton")
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
