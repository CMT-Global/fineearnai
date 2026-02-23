import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, CheckCircle2, ArrowRight, ArrowLeft, InfoIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";

/** When invoke returns non-2xx, the body is not in data; get message from error.context (Response). */
async function getEdgeFunctionErrorMessage(fnError: unknown): Promise<string> {
  const resp = (fnError as { context?: Response })?.context;
  if (resp && typeof resp.json === "function") {
    try {
      const body = await resp.json();
      if (body && typeof body.error === "string") return body.error;
    } catch {
      // ignore
    }
  }
  return (fnError as Error)?.message ?? "Request failed";
}

const NOTE_TEXT =
  "You can only transfer funds you have deposited to your account to other users from your Deposit wallet to their Deposit wallet, so they can upgrade their account or make other in-platform purchases. You cannot transfer your earnings to another user.";

const OTP_COOLDOWN_STORAGE_KEY = "sendFundsOtpCooldownUntil";
const OTP_COOLDOWN_MINUTES = 15;

export interface RecipientInfo {
  id: string;
  full_name: string;
  username: string;
}

interface SendFundsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  depositBalance: number;
  minTransfer?: number;
  maxTransfer?: number;
  onSuccess: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

export function SendFundsDialog({
  open,
  onOpenChange,
  depositBalance,
  minTransfer = 1,
  maxTransfer = 100000,
  onSuccess,
}: SendFundsDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>(1);
  const [recipientInput, setRecipientInput] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [recipient, setRecipient] = useState<RecipientInfo | null>(null);
  const [userTransferId, setUserTransferId] = useState<string | null>(null);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [newBalance, setNewBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpCooldownUntil, setOtpCooldownUntil] = useState<number | null>(null);
  const [cooldownRemainingSec, setCooldownRemainingSec] = useState<number | null>(null);
  const [showResendOtp, setShowResendOtp] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const raw = sessionStorage.getItem(OTP_COOLDOWN_STORAGE_KEY);
    if (raw) {
      const ts = Number(raw);
      if (ts > Date.now()) setOtpCooldownUntil(ts);
      else sessionStorage.removeItem(OTP_COOLDOWN_STORAGE_KEY);
    }
  }, [open]);

  useEffect(() => {
    if (otpCooldownUntil == null || Date.now() >= otpCooldownUntil) {
      if (otpCooldownUntil != null) {
        setOtpCooldownUntil(null);
        setCooldownRemainingSec(null);
        sessionStorage.removeItem(OTP_COOLDOWN_STORAGE_KEY);
      }
      return;
    }
    const tick = () => {
      const rem = Math.max(0, Math.ceil((otpCooldownUntil - Date.now()) / 1000));
      setCooldownRemainingSec(rem);
      if (rem <= 0) {
        setOtpCooldownUntil(null);
        setCooldownRemainingSec(null);
        sessionStorage.removeItem(OTP_COOLDOWN_STORAGE_KEY);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [otpCooldownUntil]);

  const amountNum = parseFloat(amount) || 0;
  const validAmount =
    amountNum >= minTransfer &&
    amountNum <= maxTransfer &&
    amountNum <= depositBalance &&
    amountNum > 0;

  const reset = () => {
    setStep(1);
    setRecipientInput("");
    setAmount("");
    setNote("");
    setRecipient(null);
    setUserTransferId(null);
    setReferenceId(null);
    setOtpCode("");
    setOtpExpiresAt(null);
    setNewBalance(null);
    setError(null);
    setShowResendOtp(false);
    // Do not clear otpCooldownUntil so 15-min lockout persists across dialog close/reopen
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) reset();
    onOpenChange(isOpen);
  };

  const getSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    return session;
  };

  const handleLookup = async () => {
    const input = recipientInput.trim();
    if (!input) {
      setError("Enter recipient username or email.");
      return;
    }
    if (!validAmount) {
      setError(
        amountNum <= 0
          ? "Enter a valid amount."
          : amountNum > depositBalance
            ? "Amount exceeds your deposit balance."
            : amountNum < minTransfer
              ? `Minimum transfer is ${minTransfer}.`
              : `Maximum transfer is ${maxTransfer}.`
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const session = await getSession();
      const { data, error: fnError } = await supabase.functions.invoke(
        "lookup-transfer-recipient",
        {
          body: { recipientInput: input },
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      if (data?.error) throw new Error(data.error);
      if (fnError) throw fnError;
      if (!data?.recipient) throw new Error("Recipient not found.");
      if (data.recipient.id === session.user?.id) {
        setError("You cannot transfer to yourself.");
        return;
      }
      setRecipient({
        id: data.recipient.id,
        full_name: data.recipient.full_name || "",
        username: data.recipient.username || "",
      });
      setStep(2);
    } catch (e: any) {
      setError(e.message || "Failed to lookup recipient.");
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRecipient = () => setStep(3);
  const handleChangeRecipient = () => {
    setRecipient(null);
    setStep(1);
    setError(null);
  };

  const handleSendOtp = async () => {
    if (!recipient) return;
    setLoading(true);
    setError(null);
    try {
      const session = await getSession();
      const { data, error: fnError } = await supabase.functions.invoke(
        "send-user-transfer-otp",
        {
          body: {
            recipient_id: recipient.id,
            amount: amountNum,
            note: note.trim() || undefined,
          },
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      if (data?.error) throw new Error(data.error);
      if (fnError) throw new Error(await getEdgeFunctionErrorMessage(fnError));
      setUserTransferId(data.user_transfer_id);
      setReferenceId(data.reference_id);
      setOtpExpiresAt(Date.now() + (data.expires_in_seconds || 600) * 1000);
      setStep(4);
      toast.success("OTP sent to your email.");
    } catch (e: any) {
      setError(e.message || "Failed to send OTP.");
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndTransfer = async () => {
    const normalizedOtp = (otpCode || "").replace(/\D/g, "").slice(0, 6);
    if (normalizedOtp.length !== 6 || !userTransferId) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const session = await getSession();
      const { data, error: fnError } = await supabase.functions.invoke(
        "verify-user-transfer-otp-and-execute",
        {
          body: { user_transfer_id: userTransferId.trim(), otp_code: normalizedOtp },
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      if (data?.error) throw new Error(data.error);
      if (fnError) throw new Error(await getEdgeFunctionErrorMessage(fnError));
      setNewBalance(data.new_deposit_balance ?? depositBalance - amountNum);
      setShowResendOtp(false);
      setStep(5);
      onSuccess();
      toast.success("Transfer completed.");
    } catch (e: any) {
      const msg = e.message || "Transfer failed.";
      if (msg.includes("Maximum verification attempts exceeded") || msg.includes("maximum verification attempts")) {
        const until = Date.now() + OTP_COOLDOWN_MINUTES * 60 * 1000;
        setOtpCooldownUntil(until);
        sessionStorage.setItem(OTP_COOLDOWN_STORAGE_KEY, String(until));
        const cooldownMsg = t("wallet.sendFunds.otpCooldown") ?? "Too many failed attempts. Try again after 15 minutes.";
        setError(cooldownMsg);
        toast.error(cooldownMsg);
      } else {
        setShowResendOtp(true);
        if (msg.includes("Invalid OTP code") || msg.includes("Invalid or expired") || msg.includes("incorrect")) {
          const incorrectMsg = t("wallet.sendFunds.otpIncorrect") ?? "Incorrect OTP. Please check the code from your email and try again.";
          setError(incorrectMsg);
          toast.error(incorrectMsg);
        } else if (msg.includes("Failed to fetch") || msg.includes("Edge Function") || msg.includes("network") || msg.includes("503")) {
          const serviceMsg = t("wallet.sendFunds.otpServiceError") ?? "Service temporarily unavailable. Please try again or use Resend OTP below.";
          setError(serviceMsg);
          toast.error(serviceMsg);
        } else {
          setError(msg);
          toast.error(msg);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!userTransferId) return;
    setResendLoading(true);
    setError(null);
    try {
      const session = await getSession();
      const { data, error: fnError } = await supabase.functions.invoke("resend-user-transfer-otp", {
        body: { user_transfer_id: userTransferId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (data?.error) throw new Error(data.error);
      if (fnError) throw new Error(await getEdgeFunctionErrorMessage(fnError));
      setOtpCode("");
      setOtpExpiresAt(Date.now() + (data.expires_in_seconds ?? 600) * 1000);
      toast.success(t("wallet.sendFunds.otpResent") ?? "New code sent to your email.");
    } catch (e: any) {
      setError(e.message ?? "Failed to resend OTP.");
      toast.error(e.message);
    } finally {
      setResendLoading(false);
    }
  };

  const handleDone = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && (t("wallet.sendFunds.title") ?? "Send Funds")}
            {step === 2 && (t("wallet.sendFunds.confirmRecipient") ?? "Confirm recipient")}
            {step === 3 && (t("wallet.sendFunds.summary") ?? "Confirm transfer")}
            {step === 4 && (t("wallet.sendFunds.enterOtp") ?? "Enter OTP")}
            {step === 5 && (t("wallet.sendFunds.success") ?? "Transfer completed")}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && (t("wallet.sendFunds.step1Desc") ?? "Enter recipient and amount (Deposit Wallet only).")}
            {step === 2 && (t("wallet.sendFunds.step2Desc") ?? "Verify you are sending to the correct user.")}
            {step === 3 && (t("wallet.sendFunds.step3Desc") ?? "Review and request OTP.")}
            {step === 4 && (t("wallet.sendFunds.step4Desc") ?? "Enter the code sent to your email.")}
            {step === 5 && (t("wallet.sendFunds.step5Desc") ?? "Your transfer was successful.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Step 1 */}
          {step === 1 && (
            <>
              <Alert className="bg-muted/50">
                <InfoIcon className="h-4 w-4" />
                <AlertDescription className="text-xs">{NOTE_TEXT}</AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label>{t("wallet.sendFunds.recipient") ?? "Recipient (username or email)"}</Label>
                <Input
                  placeholder="Enter recipient username or email"
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("wallet.sendFunds.amount") ?? "Amount (USD)"}</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("wallet.sendFunds.available") ?? "Available:"}{" "}
                  <CurrencyDisplay amountUSD={depositBalance} />
                  {minTransfer > 0 && ` • Min: $${minTransfer} • Max: $${maxTransfer}`}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Note (optional)</Label>
                <Textarea
                  placeholder="Optional message"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>
              <Button className="w-full" onClick={handleLookup} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("wallet.sendFunds.continue") ?? "Continue"}
              </Button>
            </>
          )}

          {/* Step 2 */}
          {step === 2 && recipient && (
            <>
              <p className="text-sm">
                {t("wallet.sendFunds.youAreSendingTo") ?? "You are sending to:"}
                <br />
                <strong>
                  {recipient.full_name || "—"} (@{recipient.username})
                </strong>
              </p>
              <p className="text-sm text-muted-foreground">
                {amount} USD
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleChangeRecipient}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t("wallet.sendFunds.changeRecipient") ?? "Change recipient"}
                </Button>
                <Button className="flex-1" onClick={handleConfirmRecipient}>
                  {t("wallet.sendFunds.confirm") ?? "Confirm"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {/* Step 3 */}
          {step === 3 && recipient && (
            <>
              <p className="text-sm">
                <strong>{amount} USD</strong> to {recipient.full_name || "—"} (@{recipient.username})
              </p>
              <Alert className="bg-amber-500/10 border-amber-500/30">
                <AlertDescription>
                  Funds will be deducted from your Deposit Wallet and added to the recipient's Deposit Wallet. This transfer cannot be reversed.
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                  {t("common.cancel") ?? "Cancel"}
                </Button>
                <Button className="flex-1" onClick={handleSendOtp} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("wallet.sendFunds.sendOtp") ?? "Send OTP"}
                </Button>
              </div>
            </>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <>
              {otpCooldownUntil != null && Date.now() < otpCooldownUntil ? (
                <>
                  <Alert variant="destructive">
                    <AlertDescription>
                      {t("wallet.sendFunds.otpCooldown") ?? "Too many failed attempts. Try again after 15 minutes."}
                    </AlertDescription>
                  </Alert>
                  <p className="text-sm text-center text-muted-foreground">
                    {cooldownRemainingSec != null && cooldownRemainingSec > 0
                      ? (t("wallet.sendFunds.otpCooldownRemaining") ?? "Try again in {{time}}").replace(
                          "{{time}}",
                          `${Math.ceil(cooldownRemainingSec / 60)} min`
                        )
                      : (t("wallet.sendFunds.otpTryAgainAfter") ?? "Try again after 15 min")}
                  </p>
                  <div className="flex justify-center opacity-60 pointer-events-none">
                    <InputOTP maxLength={6} value={otpCode} onChange={() => {}}>
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
                  <Button className="w-full" disabled>
                    {t("wallet.sendFunds.confirmTransfer") ?? "Confirm transfer"}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Code sent to your email. Valid for 10 minutes. 3 attempts allowed.
                  </p>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={otpCode}
                      onChange={(v) => setOtpCode(v)}
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
                  {otpExpiresAt && (
                    <p className="text-xs text-center text-muted-foreground">
                      Expires: {new Date(otpExpiresAt).toLocaleTimeString()}
                    </p>
                  )}
                  <Button
                    className="w-full"
                    onClick={handleVerifyAndTransfer}
                    disabled={loading || otpCode.length !== 6}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {t("wallet.sendFunds.confirmTransfer") ?? "Confirm transfer"}
                  </Button>
                  {showResendOtp && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground"
                      onClick={handleResendOtp}
                      disabled={resendLoading || loading}
                    >
                      {resendLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {t("wallet.sendFunds.resendOtp") ?? "Resend OTP"}
                    </Button>
                  )}
                </>
              )}
            </>
          )}

          {/* Step 5 */}
          {step === 5 && (
            <>
              <div className="flex justify-center">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <p className="text-center font-medium">
                {t("wallet.sendFunds.transferCompleted") ?? "Transfer completed"}
              </p>
              {referenceId && (
                <p className="text-center text-sm text-muted-foreground">
                  Reference: <span className="font-mono">{referenceId}</span>
                </p>
              )}
              {newBalance != null && (
                <p className="text-center text-sm">
                  {t("wallet.sendFunds.newBalance") ?? "New balance:"}{" "}
                  <CurrencyDisplay amountUSD={newBalance} />
                </p>
              )}
              <Button className="w-full" onClick={handleDone}>
                {t("wallet.sendFunds.done") ?? "Done"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
