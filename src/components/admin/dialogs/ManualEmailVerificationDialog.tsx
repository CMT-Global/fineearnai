import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const action = currentStatus ? "unverify" : "verify";
  const actionLabel = currentStatus ? t("admin.dialogs.manualEmailVerification.unverifyButton") : t("admin.dialogs.manualEmailVerification.verifyButton");

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error(t("admin.dialogs.manualEmailVerification.reasonRequiredError"));
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
        toast.success(data.message || (currentStatus ? t("admin.dialogs.manualEmailVerification.emailUnverifiedSuccess") : t("admin.dialogs.manualEmailVerification.emailVerifiedSuccess")));
        onSuccess();
        onOpenChange(false);
        setReason("");
      } else {
        throw new Error(data?.error || (currentStatus ? t("admin.dialogs.manualEmailVerification.failedToUnverify") : t("admin.dialogs.manualEmailVerification.failedToVerify")));
      }
    } catch (error: any) {
      console.error(`Error ${action}ing email:`, error);
      toast.error(error.message || (currentStatus ? t("admin.dialogs.manualEmailVerification.failedToUnverify") : t("admin.dialogs.manualEmailVerification.failedToVerify")));
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
            {currentStatus ? t("admin.dialogs.manualEmailVerification.unverifyTitle", { username }) : t("admin.dialogs.manualEmailVerification.verifyTitle", { username })}
          </DialogTitle>
          <DialogDescription>
            {currentStatus
              ? t("admin.dialogs.manualEmailVerification.unverifyDescription")
              : t("admin.dialogs.manualEmailVerification.verifyDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">
              {t("admin.dialogs.manualEmailVerification.reasonLabel", { action: actionLabel })}
              <span className="text-destructive">{t("admin.dialogs.manualEmailVerification.reasonRequired")}</span>
            </Label>
            <Textarea
              id="reason"
              placeholder={t("admin.dialogs.manualEmailVerification.reasonPlaceholder", { action })}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {t("admin.dialogs.manualEmailVerification.reasonHint")}
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
            {t("admin.dialogs.manualEmailVerification.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !reason.trim()}
            variant={currentStatus ? "destructive" : "default"}
          >
            {isLoading ? t("admin.dialogs.manualEmailVerification.processing") : actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
