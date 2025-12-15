import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmailVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
  onVerificationSuccess: () => void;
}

export const EmailVerificationDialog = ({
  open,
  onOpenChange,
  userEmail,
  onVerificationSuccess,
}: EmailVerificationDialogProps) => {
  const [otpCode, setOtpCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  const handleSendOTP = async () => {
    setIsSending(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      console.log('[EMAIL-VERIFY] Sending OTP request...');
      const response = await supabase.functions.invoke('send-verification-otp', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      console.log('[EMAIL-VERIFY] Response received:', {
        hasError: !!response.error,
        hasData: !!response.data,
        data: response.data
      });

      // Check for invocation errors (network, timeout, etc.)
      if (response.error) {
        console.error('[EMAIL-VERIFY] Function invocation error:', response.error);
        const errorMsg = response.error.message || "Network error. Please check your connection and try again.";
        setError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      // Check for application-level errors
      if (!response.data) {
        console.error('[EMAIL-VERIFY] No response data received');
        setError("No response from server. Please try again.");
        toast.error("No response from server. Please try again.");
        return;
      }

      // Check for email delivery errors - prioritize email_error flag even if success is true
      if (response.data.email_error) {
        const errorMsg = response.data.error || response.data.message || "Email delivery failed";
        console.error('[EMAIL-VERIFY] Email delivery error:', errorMsg);
        console.error('[EMAIL-VERIFY] Full error details:', response.data);
        setError("Email delivery failed. Please check your email settings or contact support.");
        toast.error("Email delivery failed", {
          description: "The verification code was generated but couldn't be sent. Please try again or contact support.",
          duration: 5000
        });
        return;
      }

      // Check for other application-level errors
      if (response.data.success === false || response.data.error) {
        const errorMsg = response.data.error || response.data.message || "Failed to send verification code";
        console.error('[EMAIL-VERIFY] Application error:', errorMsg);
        console.error('[EMAIL-VERIFY] Full error details:', response.data);
        setError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      // Success - only if success is true AND no email_error flag
      if (response.data.success === true && !response.data.email_error) {
        console.log('[EMAIL-VERIFY] OTP sent successfully');
        setOtpSent(true);
        toast.success("Verification code sent! Check your email (including spam/junk folder).");
      } else {
        // Defensive: if success is not explicitly true, treat as error
        console.error('[EMAIL-VERIFY] Ambiguous response:', response.data);
        setError("Unexpected response from server. Please try again.");
        toast.error("Failed to send verification code. Please try again.");
      }
    } catch (err: any) {
      console.error("[EMAIL-VERIFY] Unexpected error:", err);
      const errorMessage = err.message || "Failed to send verification code";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otpCode.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke('verify-email-otp', {
        body: { otp_code: otpCode },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (response.error) {
        throw response.error;
      }

      if (!response.data?.success) {
        throw new Error(response.data?.error || "Invalid verification code");
      }

      toast.success("Email verified successfully!");
      onVerificationSuccess();
      onOpenChange(false);
      
      // Reset state
      setOtpCode("");
      setOtpSent(false);
      setError(null);
    } catch (err: any) {
      console.error("Error verifying OTP:", err);
      const errorMessage = err.message || "Failed to verify code";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setOtpCode("");
    setError(null);
    await handleSendOTP();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Verify Your Email
          </DialogTitle>
          <DialogDescription>
            {!otpSent ? (
              <>We'll send a 6-digit verification code to <strong>{userEmail}</strong></>
            ) : (
              <>Enter the 6-digit code sent to <strong>{userEmail}</strong></>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!otpSent ? (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Click the button below to receive your verification code via email.
                </AlertDescription>
              </Alert>
              
              <Button
                onClick={handleSendOTP}
                disabled={isSending}
                className="w-full"
              >
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Code...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Verification Code
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Alert className="mb-2">
                <Mail className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Didn't receive the code?</strong> Check your <strong>Spam/Junk</strong> folder and mark FineEarn emails as "Not spam" to ensure future deliveries reach your inbox.
                </AlertDescription>
              </Alert>

              <div className="flex flex-col items-center gap-4">
                <InputOTP
                  maxLength={6}
                  value={otpCode}
                  onChange={setOtpCode}
                  disabled={isLoading}
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

                <p className="text-xs text-muted-foreground text-center">
                  Code expires in 15 minutes
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleVerifyOTP}
                  disabled={isLoading || otpCode.length !== 6}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Verify Email
                    </>
                  )}
                </Button>

                <Button
                  variant="ghost"
                  onClick={handleResendOTP}
                  disabled={isSending}
                  className="w-full"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resending...
                    </>
                  ) : (
                    "Resend Code"
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
