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
import { Checkbox } from "@/components/ui/checkbox";
import { useUserManagement } from "@/hooks/useUserManagement";
import { Trash2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  username: string;
  onSuccess?: () => void;
}

export const DeleteUserDialog = ({
  open,
  onOpenChange,
  userId,
  username,
  onSuccess,
}: DeleteUserDialogProps) => {
  const { t } = useTranslation();
  const [confirmed, setConfirmed] = useState(false);

  const { deleteUser } = useUserManagement();

  const handleSubmit = () => {
    if (!confirmed) {
      toast.error(t("admin.dialogs.deleteUser.confirmRequired"));
      return;
    }

    deleteUser.mutate(userId, {
      onSuccess: () => {
        onOpenChange(false);
        setConfirmed(false);
        onSuccess?.();
      },
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setConfirmed(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            {t("admin.dialogs.deleteUser.title")}
          </DialogTitle>
          <DialogDescription>
            {t("admin.dialogs.deleteUser.description", { username })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>{t("admin.dialogs.deleteUser.warningTitle")}</strong>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>{t("admin.dialogs.deleteUser.warning1")}</li>
                <li>{t("admin.dialogs.deleteUser.warning2")}</li>
                <li>{t("admin.dialogs.deleteUser.warning3")}</li>
                <li>{t("admin.dialogs.deleteUser.warning4")}</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("admin.dialogs.deleteUser.usernameLabel")}</span>
              <span className="font-medium">{username}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("admin.dialogs.deleteUser.userIdLabel")}</span>
              <span className="font-mono text-xs">{userId.slice(0, 8)}...</span>
            </div>
          </div>

          <div className="flex items-start space-x-2 rounded-lg border-2 border-destructive/50 bg-destructive/5 p-4">
            <Checkbox
              id="confirm-delete"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked as boolean)}
            />
            <Label
              htmlFor="confirm-delete"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              {t("admin.dialogs.deleteUser.confirmLabel")}
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={deleteUser.isPending}>
            {t("admin.dialogs.deleteUser.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!confirmed || deleteUser.isPending}
          >
            {deleteUser.isPending
              ? t("admin.dialogs.deleteUser.processing")
              : t("admin.dialogs.deleteUser.deleteButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
