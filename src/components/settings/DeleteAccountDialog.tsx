import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { AlertTriangle, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [understood, setUnderstood] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  const resetDialog = () => {
    setStep(1);
    setUnderstood(false);
    setOtpCode("");
    setLoading(false);
    setSendingOtp(false);
  };

  const handleClose = () => {
    if (!loading && !sendingOtp) {
      resetDialog();
      onOpenChange(false);
    }
  };

  const handleSendOtp = async () => {
    if (!understood) {
      toast.error("Please confirm you understand this action is irreversible");
      return;
    }

    setSendingOtp(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-account-deletion-otp', {
        body: {}
      });

      if (error) throw error;

      if (data?.error) {
        if (data.rate_limited) {
          toast.error("Too many requests", {
            description: data.error
          });
        } else {
          toast.error(data.error);
        }
        return;
      }

      toast.success("Verification code sent!", {
        description: "Check your email for the 6-digit code"
      });
      setStep(2);
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      toast.error("Failed to send verification code", {
        description: error.message || "Please try again"
      });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyAndDelete = async () => {
    if (otpCode.length !== 6) {
      toast.error("Please enter the complete 6-digit code");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-deletion-otp-and-delete', {
        body: { otp_code: otpCode }
      });

      if (error) throw error;

      if (data?.error) {
        toast.error("Verification failed", {
          description: data.error
        });
        setLoading(false);
        return;
      }

      // Success - account deleted
      toast.success("Account deleted successfully", {
        description: "You will be logged out shortly..."
      });

      // Wait 2 seconds before logout to show success message
      setTimeout(async () => {
        await signOut();
        navigate("/login?deleted=true");
      }, 2000);
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      toast.error("Failed to delete account", {
        description: error.message || "Please try again"
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
                <DialogTitle className="text-xl">Delete Your Account</DialogTitle>
              </div>
              <DialogDescription>
                This action is permanent and cannot be undone
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong className="block mb-2">The following will be permanently deleted:</strong>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Your profile and account credentials</li>
                    <li>All earnings and wallet balances</li>
                    <li>Complete transaction history</li>
                    <li>Referral network and commissions</li>
                    <li>Task completion records</li>
                    <li>Any pending withdrawals or deposits</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <Alert>
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Before proceeding:</strong> Make sure you've withdrawn all available funds 
                  and there are no pending transactions on your account.
                </AlertDescription>
              </Alert>

              <div className="flex items-start space-x-3 pt-2">
                <Checkbox
                  id="understand"
                  checked={understood}
                  onCheckedChange={(checked) => setUnderstood(checked as boolean)}
                  disabled={sendingOtp}
                />
                <label
                  htmlFor="understand"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  I understand this action is permanent and cannot be undone
                </label>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={sendingOtp}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleSendOtp}
                disabled={!understood || sendingOtp}
                className="w-full sm:w-auto"
              >
                {sendingOtp ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Code...
                  </>
                ) : (
                  "Continue to Verification"
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
                <DialogTitle className="text-xl">Enter Verification Code</DialogTitle>
              </div>
              <DialogDescription>
                We've sent a 6-digit code to your email. Enter it below to confirm deletion.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-6">
              <div className="space-y-3">
                <Label htmlFor="otp" className="text-center block">
                  Verification Code
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
                  Code expires in 15 minutes
                </p>
              </div>

              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Once you verify this code, your account will be <strong>immediately and permanently deleted</strong>. 
                  This cannot be undone.
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
                Back
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
                    Deleting Account...
                  </>
                ) : (
                  "Delete My Account"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
