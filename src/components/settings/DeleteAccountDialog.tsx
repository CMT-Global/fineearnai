import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2, ShieldAlert, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [understood, setUnderstood] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<string>("");

  const resetDialog = () => {
    setStep(1);
    setUnderstood(false);
    setOtpCode("");
    setLoading(false);
    setSendingOtp(false);
    setRateLimitedUntil(null);
    setCountdown("");
  };

  // Countdown timer for rate limiting
  useEffect(() => {
    if (!rateLimitedUntil) {
      setCountdown("");
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const timeLeft = rateLimitedUntil.getTime() - now;

      if (timeLeft <= 0) {
        setRateLimitedUntil(null);
        setCountdown("");
        return;
      }

      const minutes = Math.floor(timeLeft / 60000);
      const seconds = Math.floor((timeLeft % 60000) / 1000);
      setCountdown(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [rateLimitedUntil]);

  const handleClose = () => {
    if (!loading && !sendingOtp) {
      resetDialog();
      onOpenChange(false);
    }
  };

  const handleSendOtp = async () => {
    if (!understood) {
      toast.error(t("settings.deleteAccountDialog.errors.pleaseConfirm"));
      return;
    }

    setSendingOtp(true);
    try {
      console.log('[DELETE-ACCOUNT] Sending OTP request...');
      
      const { data, error } = await supabase.functions.invoke('send-account-deletion-otp', {
        body: {}
      });

      // 🔍 DIAGNOSTIC LOGGING
      console.log('[DELETE-ACCOUNT] Response received:', {
        hasError: !!error,
        hasData: !!data,
        dataContent: data,
        errorContent: error
      });

      // Handle Supabase client errors (network, timeout, etc.)
      if (error) {
        console.error('[DELETE-ACCOUNT] Function invocation error:', error);
        toast.error(t("settings.deleteAccountDialog.errors.failedToSend"), {
          description: t("settings.deleteAccountDialog.errors.networkError")
        });
        return;
      }

      // Handle application-level errors from backend
      if (data?.error) {
        console.warn('[DELETE-ACCOUNT] Application error:', data.error);
        if (data.rate_limited) {
          // Calculate when user can try again (15 minutes from now)
          const retryTime = new Date(Date.now() + 15 * 60 * 1000);
          setRateLimitedUntil(retryTime);
          
          toast.error(t("settings.deleteAccountDialog.errors.tooManyRequestsError"), {
            description: t("settings.deleteAccountDialog.errors.tooManyRequestsDescription"),
            duration: 5000
          });
        } else {
          toast.error(data.error);
        }
        return;
      }

      // ✅ SUCCESS - Backend returns { success: true, message: '...', expires_at: '...' }
      console.log('[DELETE-ACCOUNT] OTP sent successfully');
      toast.success(t("settings.deleteAccountDialog.errors.verificationCodeSent"), {
        description: t("settings.deleteAccountDialog.errors.checkEmail")
      });
      setStep(2);
      
    } catch (error: any) {
      // This should rarely be hit - only for unexpected exceptions
      console.error("[DELETE-ACCOUNT] Unexpected error:", error);
      toast.error(t("settings.deleteAccountDialog.errors.failedToSend"), {
        description: t("settings.deleteAccountDialog.errors.networkError")
      });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyAndDelete = async () => {
    if (otpCode.length !== 6) {
      toast.error(t("settings.deleteAccountDialog.errors.pleaseEnterCompleteCode"));
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-deletion-otp-and-delete', {
        body: { otp_code: otpCode }
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(t("settings.deleteAccountDialog.errors.verificationFailed"), {
          description: data.error
        });
        setLoading(false);
        return;
      }

      // Success - account deleted
      toast.success(t("settings.deleteAccountDialog.errors.accountDeletedSuccess"), {
        description: t("settings.deleteAccountDialog.errors.loggedOutShortly")
      });

      // Wait 2 seconds before logout to show success message
      setTimeout(async () => {
        await signOut();
        navigate("/login?deleted=true");
      }, 2000);
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      toast.error(t("settings.deleteAccountDialog.errors.failedToDelete"), {
        description: error.message || t("settings.deleteAccountDialog.errors.pleaseTryAgain")
      });
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {step === 1 ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-destructive/10 rounded-full">
                  <Trash2 className="h-5 w-5 text-destructive" />
                </div>
                <DialogTitle className="text-xl">{t("settings.deleteAccountDialog.title")}</DialogTitle>
              </div>
              <DialogDescription>
                {t("settings.deleteAccountDialog.description")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong className="block mb-2">{t("settings.deleteAccountDialog.willBeDeleted")}</strong>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>{t("settings.deleteAccountDialog.item1")}</li>
                    <li>{t("settings.deleteAccountDialog.item2")}</li>
                    <li>{t("settings.deleteAccountDialog.item3")}</li>
                    <li>{t("settings.deleteAccountDialog.item4")}</li>
                    <li>{t("settings.deleteAccountDialog.item5")}</li>
                    <li>{t("settings.deleteAccountDialog.item6")}</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <Alert>
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>{t("settings.deleteAccountDialog.beforeProceeding")}</strong> {t("settings.deleteAccountDialog.beforeProceedingDescription")}
                </AlertDescription>
              </Alert>

              <div className="flex items-start space-x-3 pt-2">
                <Checkbox
                  id="understand"
                  checked={understood}
                  onCheckedChange={(checked) => setUnderstood(checked as boolean)}
                  disabled={sendingOtp || !!rateLimitedUntil}
                />
                <label
                  htmlFor="understand"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {t("settings.deleteAccountDialog.understandCheckbox")}
                </label>
              </div>

              {rateLimitedUntil && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{t("settings.deleteAccountDialog.tooManyAttempts")}</strong>
                    <p className="mt-1">
                      {t("settings.deleteAccountDialog.tryAgainIn", { countdown: <span className="font-mono font-semibold">{countdown}</span> })}
                    </p>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={sendingOtp}
                className="w-full sm:w-auto"
              >
                {t("settings.deleteAccountDialog.cancel")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleSendOtp}
                disabled={!understood || sendingOtp || !!rateLimitedUntil}
                className="w-full sm:w-auto"
              >
                {sendingOtp ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("settings.deleteAccountDialog.sendingCode")}
                  </>
                ) : rateLimitedUntil ? (
                  t("settings.deleteAccountDialog.tryAgainInCountdown", { countdown })
                ) : (
                  t("settings.deleteAccountDialog.continueToVerification")
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-destructive/10 rounded-full">
                  <ShieldAlert className="h-5 w-5 text-destructive" />
                </div>
                <DialogTitle className="text-xl">{t("settings.deleteAccountDialog.enterVerificationCode")}</DialogTitle>
              </div>
              <DialogDescription>
                {t("settings.deleteAccountDialog.verificationCodeDescription")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-6">
              <div className="space-y-3">
                <Label htmlFor="otp" className="text-center block">
                  {t("settings.deleteAccountDialog.verificationCode")}
                </Label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otpCode}
                    onChange={setOtpCode}
                    disabled={loading}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {t("settings.deleteAccountDialog.codeExpiresIn")}
                </p>
                
                {/* Resend Code Button */}
                <div className="flex justify-center pt-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleSendOtp}
                            disabled={sendingOtp || !!rateLimitedUntil || loading}
                            className="text-xs"
                          >
                            {sendingOtp ? (
                              <>
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="mr-1 h-3 w-3" />
                                {t("settings.deleteAccountDialog.resendCode")}
                              </>
                            )}
                          </Button>
                        </div>
                      </TooltipTrigger>
                      {rateLimitedUntil && (
                        <TooltipContent>
                          <p className="text-xs">
                            {t("settings.deleteAccountDialog.errors.tooManyRequests", { countdown })}
                          </p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {rateLimitedUntil && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <strong>{t("settings.deleteAccountDialog.tooManyAttempts")}</strong>
                    <p className="mt-1">
                      {t("settings.deleteAccountDialog.tryAgainIn", { countdown: <span className="font-mono font-semibold">{countdown}</span> })}
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {t("settings.deleteAccountDialog.finalWarning")}
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {t("settings.deleteAccountDialog.back")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleVerifyAndDelete}
                disabled={otpCode.length !== 6 || loading}
                className="w-full sm:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("settings.deleteAccountDialog.deletingAccount")}
                  </>
                ) : (
                  t("settings.deleteAccountDialog.deleteMyAccount")
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
