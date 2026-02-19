import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupFormData } from "@/lib/auth-schema";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { validateReferralCode } from "@/lib/referral-utils";
import { useUsernameValidation } from "@/hooks/useUsernameValidation";
import { useInviteOnlyConfig } from "@/hooks/useInviteOnlyConfig";
import { cn } from "@/lib/utils";
import { useBranding } from "@/contexts/BrandingContext";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useTranslation } from "react-i18next";

const REFERRAL_COOKIE_NAME = "pending_referral_code";

function getReferralFromCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${REFERRAL_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]).trim() : null;
}

function setReferralCookie(code: string, maxAgeDays: number) {
  const maxAge = maxAgeDays * 86400;
  document.cookie = `${REFERRAL_COOKIE_NAME}=${encodeURIComponent(code)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/** Extract referral code from pasted invite link (URL with ?ref=CODE) or plain 8-char code */
function extractRefFromInviteInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      const ref = url.searchParams.get("ref")?.trim().toUpperCase() ?? null;
      return ref && validateReferralCode(ref) ? ref : null;
    }
    const ref = trimmed.toUpperCase();
    return validateReferralCode(ref) ? ref : null;
  } catch {
    const ref = trimmed.toUpperCase();
    return validateReferralCode(ref) ? ref : null;
  }
}

const Signup = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { platformName, platformLogoUrl } = useBranding();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const referralCodeFromUrl = searchParams.get("ref");
  const haveInviteParam = searchParams.get("have_invite") === "1";
  const requestInviteParam = searchParams.get("request_invite") === "1";
  const [referrerUsername, setReferrerUsername] = useState<string | null>(null);
  const [referrerDisplayName, setReferrerDisplayName] = useState<string | null>(null);

  const { config: inviteOnlyConfig, isInviteOnly, enableInviteRequests, isLoading: inviteConfigLoading } = useInviteOnlyConfig();
  const [inviteStep, setInviteStep] = useState<"form" | "otp" | "done">("form");
  const [inviteRequestId, setInviteRequestId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [requestCountry, setRequestCountry] = useState<string>("");
  const [requestCountryCode, setRequestCountryCode] = useState<string>("");
  const [requestInviteLoading, setRequestInviteLoading] = useState(false);
  const [verifyOtpLoading, setVerifyOtpLoading] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [otpVerificationFailedOnce, setOtpVerificationFailedOnce] = useState(false);
  const [resendOtpLoading, setResendOtpLoading] = useState(false);

  const refFromCookie = getReferralFromCookie();
  const refFromStorage = typeof window !== "undefined" ? localStorage.getItem(REFERRAL_COOKIE_NAME) : null;
  // When user explicitly requested invite (request_invite=1), ignore stored ref so we always show invite flow
  const effectiveRef =
    referralCodeFromUrl?.trim() ||
    (requestInviteParam ? null : refFromCookie || refFromStorage);
  const hasValidRef = Boolean(effectiveRef && validateReferralCode(effectiveRef.trim().toUpperCase()));

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: "",
      fullName: "",
      email: "",
      password: "",
      referralCode: referralCodeFromUrl ? referralCodeFromUrl.trim().toUpperCase() : "",
    },
  });

  const fetchReferrerInfo = async (code: string) => {
    try {
      const upperCode = code.trim().toUpperCase();
      const lowerCode = code.trim().toLowerCase();
      const { data, error } = await supabase
        .from("profiles")
        .select("username, full_name")
        .in("referral_code", upperCode === lowerCode ? [upperCode] : [upperCode, lowerCode])
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        setReferrerUsername(null);
        setReferrerDisplayName(null);
        return;
      }

      const displayName = (data.full_name || data.username || "").trim() || data.username;
      setReferrerUsername(data.username);
      setReferrerDisplayName(displayName);
    } catch (error) {
      console.error("[REFERRAL] Failed to fetch referrer info:", error);
      setReferrerUsername(null);
      setReferrerDisplayName(null);
    }
  };

  // When user explicitly requested invite, clear any stored ref so invite flow always shows
  useEffect(() => {
    if (!requestInviteParam) return;
    if (typeof window !== "undefined") localStorage.removeItem(REFERRAL_COOKIE_NAME);
    try {
      document.cookie = `${REFERRAL_COOKIE_NAME}=; path=/; max-age=0`;
    } catch {
      // ignore
    }
  }, [requestInviteParam]);

  // Store referral code from URL and sync form; fetch referrer name for display; set cookie when invite-only
  useEffect(() => {
    if (!referralCodeFromUrl) return;
    const upperCode = referralCodeFromUrl.trim().toUpperCase();
    if (!validateReferralCode(upperCode)) {
      toast({
        title: t("signup.invalidReferralCode"),
        description: t("signup.invalidReferralCodeFormat"),
        variant: "destructive",
      });
      return;
    }
    localStorage.setItem("pending_referral_code", upperCode);
    form.setValue("referralCode", upperCode);
    setReferralCookie(upperCode, inviteOnlyConfig.referral_cookie_duration_days || 30);
    fetchReferrerInfo(upperCode);
  }, [referralCodeFromUrl, inviteOnlyConfig.referral_cookie_duration_days]);

  // Pre-fill country for invite request form
  useEffect(() => {
    if (!isInviteOnly || !enableInviteRequests || inviteStep !== "form") return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("get-request-country", {});
        if (cancelled || !data) return;
        if (data.country) setRequestCountry(data.country);
        if (data.country_code) setRequestCountryCode(data.country_code);
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [isInviteOnly, enableInviteRequests, inviteStep]);

  // When user types a referral code in the form, fetch and show referrer name (same as referral link)
  const referralCodeInput = form.watch("referralCode");
  useEffect(() => {
    const raw = (referralCodeInput ?? "").trim();
    const upper = raw.toUpperCase();
    if (!raw) {
      setReferrerUsername(null);
      setReferrerDisplayName(null);
      return;
    }
    if (!validateReferralCode(upper)) {
      setReferrerDisplayName(null);
      setReferrerUsername(null);
      return;
    }
    const timer = setTimeout(() => {
      if (raw !== upper) form.setValue("referralCode", upper, { shouldValidate: false });
      fetchReferrerInfo(upper);
    }, 400);
    return () => clearTimeout(timer);
  }, [referralCodeInput]);

  // Real-time username validation
  const usernameValue = form.watch("username");
  const { isAvailable, isChecking, error: usernameError } = useUsernameValidation(usernameValue);

  const INVITE_STORAGE_KEY = "invite_request_id";
  const INVITE_EMAIL_KEY = "invite_request_email";
  const INVITE_PREFILL_NAME_KEY = "invite_prefill_name";
  const INVITE_PREFILL_EMAIL_KEY = "invite_prefill_email";

  const [requestName, setRequestName] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [inviteLinkInput, setInviteLinkInput] = useState("");
  const [inviteLinkSubmitLoading, setInviteLinkSubmitLoading] = useState(false);

  // Restore OTP step from sessionStorage (e.g. after refresh or when client showed error but server succeeded)
  useEffect(() => {
    if (!isInviteOnly || !enableInviteRequests) return;
    const storedId = sessionStorage.getItem(INVITE_STORAGE_KEY);
    const storedEmail = sessionStorage.getItem(INVITE_EMAIL_KEY);
    if (storedId && storedEmail) {
      setInviteRequestId(storedId);
      setRequestEmail(storedEmail);
      setInviteStep("otp");
      setOtpValue("");
    }
  }, [isInviteOnly, enableInviteRequests]);

  const handleRequestInvite = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const name = requestName.trim();
    const email = requestEmail.trim().toLowerCase();
    if (!name || !email) {
      toast({ title: "Required", description: "Please enter your name and email.", variant: "destructive" });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    setRequestInviteLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-invite", {
        body: { full_name: name, email, country: requestCountry || undefined, country_code: requestCountryCode || undefined },
      });
      const response = (data ?? null) as { error?: string; details?: string; invite_request_id?: string; data?: { invite_request_id?: string } } | null;
      const id = response?.invite_request_id ?? response?.data?.invite_request_id;
      if (id) {
        sessionStorage.setItem(INVITE_STORAGE_KEY, id);
        sessionStorage.setItem(INVITE_EMAIL_KEY, email);
        setInviteRequestId(id);
        setInviteStep("otp");
        setOtpValue("");
        toast({
          title: inviteOnlyConfig.request_submitted_success_message || "Check your email for a verification code.",
        });
        return;
      }
      if (error) {
        const msg = response?.details || response?.error || error.message || "Request failed";
        throw new Error(msg);
      }
      const err = response?.error;
      if (err) throw new Error(response?.details || err);
      throw new Error("No invite request id");
    } catch (err: unknown) {
      toast({
        title: "Request failed",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
      // Still show OTP section so user can verify if they received the email
      setInviteStep("otp");
    } finally {
      setRequestInviteLoading(false);
    }
  }, [requestName, requestEmail, requestCountry, requestCountryCode, inviteOnlyConfig.request_submitted_success_message, toast]);

  const handleVerifyOtp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpValue.replace(/\s/g, "").replace(/\D/g, "").slice(0, 6);
    if (!/^\d{6}$/.test(code)) {
      toast({ title: "Invalid code", description: "Enter the 6-digit code from your email.", variant: "destructive" });
      return;
    }
    let requestId = inviteRequestId;
    if (!requestId) {
      const emailForLookup = requestEmail.trim().toLowerCase();
      if (!emailForLookup || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForLookup)) {
        toast({ title: "Email required", description: "Enter the email you used to request the invite.", variant: "destructive" });
        return;
      }
      setVerifyOtpLoading(true);
      try {
        const { data: lookupData, error: lookupError } = await supabase.functions.invoke("lookup-invite-request", {
          body: { email: emailForLookup },
        });
        const lookupResp = lookupData as { error?: string; invite_request_id?: string } | null;
        if (lookupError || lookupResp?.error) {
          throw new Error(lookupResp?.error || lookupError?.message || "Could not find your invite request.");
        }
        requestId = lookupResp?.invite_request_id ?? null;
        if (!requestId) throw new Error("No pending invite found for this email. Request a new invite above.");
      } catch (err: unknown) {
        toast({
          title: "Verification failed",
          description: err instanceof Error ? err.message : "Could not find your invite request.",
          variant: "destructive",
        });
        setVerifyOtpLoading(false);
        return;
      }
    } else {
      setVerifyOtpLoading(true);
    }
    try {
      const { data, error } = await supabase.functions.invoke("verify-invite-otp", {
        body: { invite_request_id: requestId, otp_code: code },
      });
      if (error) throw new Error(error.message || "Verification failed");
      const err = (data as { error?: string })?.error;
      if (err) throw new Error(err);
      const link = (data as { invite_link?: string })?.invite_link;
      if (link) {
        sessionStorage.removeItem(INVITE_STORAGE_KEY);
        sessionStorage.removeItem(INVITE_EMAIL_KEY);
        // Store name and email so create-account page can pre-fill after they click the invite link
        const name = requestName.trim();
        const email = requestEmail.trim().toLowerCase();
        if (name) sessionStorage.setItem(INVITE_PREFILL_NAME_KEY, name);
        if (email) sessionStorage.setItem(INVITE_PREFILL_EMAIL_KEY, email);
        setInviteLink(link);
        setInviteStep("done");
      } else throw new Error("No invite link");
    } catch (err: unknown) {
      setOtpVerificationFailedOnce(true);
      toast({
        title: "Verification failed",
        description: err instanceof Error ? err.message : "Invalid or expired code.",
        variant: "destructive",
      });
    } finally {
      setVerifyOtpLoading(false);
    }
  }, [otpValue, inviteRequestId, requestEmail, requestName, toast]);

  const handleResendOtp = useCallback(async () => {
    let requestId = inviteRequestId;
    if (!requestId) {
      const emailForLookup = requestEmail.trim().toLowerCase();
      if (!emailForLookup || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForLookup)) {
        toast({ title: "Email required", description: "Enter the email you used to request the invite.", variant: "destructive" });
        return;
      }
      setResendOtpLoading(true);
      try {
        const { data: lookupData, error: lookupError } = await supabase.functions.invoke("lookup-invite-request", {
          body: { email: emailForLookup },
        });
        const lookupResp = lookupData as { error?: string; invite_request_id?: string } | null;
        if (lookupError || lookupResp?.error) {
          throw new Error(lookupResp?.error || lookupError?.message || "Could not find your invite request.");
        }
        requestId = lookupResp?.invite_request_id ?? null;
        if (!requestId) throw new Error("No pending invite found for this email.");
      } catch (err: unknown) {
        toast({
          title: "Resend failed",
          description: err instanceof Error ? err.message : "Could not find your invite request.",
          variant: "destructive",
        });
        setResendOtpLoading(false);
        return;
      }
    } else {
      setResendOtpLoading(true);
    }
    try {
      const { data, error } = await supabase.functions.invoke("resend-invite-otp-public", {
        body: { invite_request_id: requestId },
      });
      const errMsg = (data as { error?: string })?.error;
      if (error || errMsg) {
        throw new Error(errMsg || error?.message || "Resend failed");
      }
      setOtpValue("");
      toast({
        title: inviteOnlyConfig.request_submitted_success_message || "New code sent. Check your email.",
      });
    } catch (err: unknown) {
      toast({
        title: "Resend failed",
        description: err instanceof Error ? err.message : "Could not send a new code. Try again in a few minutes.",
        variant: "destructive",
      });
    } finally {
      setResendOtpLoading(false);
    }
  }, [inviteRequestId, requestEmail, inviteOnlyConfig.request_submitted_success_message, toast]);

  // When invite-only is enabled: new users (no valid ref) must only see the invite flow (Request invite / Enter invite link).
  // Create Account form is shown only when invite-only is off OR user has a valid invite (ref in URL or cookie).
  const showConfigLoading = inviteConfigLoading;
  const showInviteRequired =
    !inviteConfigLoading && isInviteOnly && !hasValidRef;
  // When have_invite=1, show "enter your invite link" form instead of "request invite"
  const showEnterInviteLink = showInviteRequired && haveInviteParam;
  // Only show Create Account when config is loaded AND (invite-only is off OR user has valid invite ref)
  const showNormalForm =
    !inviteConfigLoading && (!isInviteOnly || hasValidRef);

  const invitePrefillApplied = useRef(false);
  // Pre-fill create-account form with name/email from invite flow (URL params or sessionStorage)
  useEffect(() => {
    if (!showNormalForm || invitePrefillApplied.current) return;
    const fromUrl = {
      name: searchParams.get("invite_name"),
      email: searchParams.get("invite_email"),
    };
    const fromStorage = typeof window !== "undefined" ? {
      name: sessionStorage.getItem(INVITE_PREFILL_NAME_KEY),
      email: sessionStorage.getItem(INVITE_PREFILL_EMAIL_KEY),
    } : { name: null, email: null };
    const name = fromUrl.name?.trim() || fromStorage.name?.trim() || "";
    const email = fromUrl.email?.trim().toLowerCase() || fromStorage.email?.trim().toLowerCase() || "";
    if (name || email) {
      invitePrefillApplied.current = true;
      if (name) form.setValue("fullName", name, { shouldValidate: false });
      if (email) form.setValue("email", email, { shouldValidate: false });
      sessionStorage.removeItem(INVITE_PREFILL_NAME_KEY);
      sessionStorage.removeItem(INVITE_PREFILL_EMAIL_KEY);
    }
  }, [showNormalForm, searchParams, form]);

  const handleEnterInviteLinkSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const ref = extractRefFromInviteInput(inviteLinkInput);
      if (!ref) {
        toast({
          title: t("signup.invalidReferralCode"),
          description: t("signup.invalidReferralCodeFormat"),
          variant: "destructive",
        });
        return;
      }
      setInviteLinkSubmitLoading(true);
      try {
        setReferralCookie(ref, inviteOnlyConfig.referral_cookie_duration_days || 30);
        if (typeof window !== "undefined") localStorage.setItem(REFERRAL_COOKIE_NAME, ref);
        await fetchReferrerInfo(ref);
        form.setValue("referralCode", ref);
        // Navigate to same page with ref so hasValidRef becomes true and we show Create Account form
        navigate(`/signup?ref=${ref}`, { replace: true });
      } finally {
        setInviteLinkSubmitLoading(false);
      }
    },
    [inviteLinkInput, inviteOnlyConfig.referral_cookie_duration_days, toast, t, form, navigate]
  );

  const onSubmit = async (data: SignupFormData) => {
    // Block submission if username is not available
    if (isChecking) {
      toast({
        title: t("signup.pleaseWait"),
        description: t("signup.checkingUsername"),
        variant: "destructive",
      });
      return;
    }

    if (isAvailable === false) {
      toast({
        title: t("signup.usernameUnavailable"),
        description: t("signup.chooseDifferentUsername"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Get referral code from form or localStorage; normalize to uppercase (DB stores uppercase)
      const rawCode = data.referralCode || localStorage.getItem("pending_referral_code");
      const referralCode = rawCode ? String(rawCode).trim().toUpperCase() : undefined;

      const { data: authData, error: signupError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/profile-wizard`,
          data: {
            username: data.username,
            full_name: data.fullName,
            referral_code: referralCode,
          },
        },
      });

      if (signupError) {
        if (signupError.message.includes("already registered")) {
          toast({
            title: t("signup.accountExists"),
            description: t("signup.emailAlreadyRegistered"),
            variant: "destructive",
          });
        } else {
          toast({
            title: t("signup.signupFailed"),
            description: signupError.message,
            variant: "destructive",
          });
        }
        return;
      }

      // Track registration location (non-blocking)
      if (authData.user) {
        try {
          await supabase.functions.invoke("track-user-registration", {
            body: { userId: authData.user.id }
          });
        } catch (error) {
          console.error("Failed to track registration location:", error);
          // Don't block signup flow
        }
      }

      // Signup successful. Do NOT show a "check your email / we sent you a link to verify" toast:
      // email verification happens later via OTP when the user clicks "Verify Email" on the dashboard.
      console.log("✅ Signup successful");

      if (authData.user && referralCode) {
        console.log('[REFERRAL] ✅ Account created with referral code:', {
          userId: authData.user.id,
          referralCode: referralCode,
          referrerUsername: referrerUsername
        });
        localStorage.removeItem("pending_referral_code");
      }

      // Redirect to profile wizard (or dashboard when complete)
      setTimeout(() => navigate("/profile-wizard"), 2000);
    } catch (error: any) {
      console.error("Signup error:", error);
      
      // Check for specific duplicate username error
      const errorMessage = error?.message || "";
      const isUsernameConflict = 
        errorMessage.includes("duplicate key") && 
        (errorMessage.includes("username") || errorMessage.includes("profiles_username_key"));
      
      const isUsernameTakenError = errorMessage.includes("USERNAME_TAKEN");
      
      if (isUsernameConflict || isUsernameTakenError) {
        toast({
          title: t("signup.usernameAlreadyExists"),
          description: t("signup.usernameTaken", { username: data.username }),
          variant: "destructive",
        });
        
        // Focus the username field for user to retry
        const usernameField = document.querySelector('input[name="username"]') as HTMLInputElement;
        if (usernameField) {
          usernameField.focus();
          usernameField.select();
        }
      } else {
        toast({
          title: t("signup.error"),
          description: t("signup.unexpectedError"),
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <img src={platformLogoUrl} alt={`${platformName} Logo`} className="h-24 w-24 object-contain" />
          </div>
          {showConfigLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">{t("signup.loading")}</p>
            </div>
          ) : showInviteRequired ? (
            <>
              <h1 className="text-2xl font-bold">{inviteOnlyConfig.invite_required_message_title || "Invite Required"}</h1>
              <p className="text-muted-foreground">
                {inviteOnlyConfig.invite_required_message_description || "Registration is by invite only. Request an invite below or use your invite link to sign up."}
              </p>
              {showEnterInviteLink ? (
                <form onSubmit={handleEnterInviteLinkSubmit} className="space-y-4 mt-6 text-left">
                  <div>
                    <label className="text-sm font-medium">{t("signup.inviteLinkOrCode", "Invite link or code")}</label>
                    <Input
                      value={inviteLinkInput}
                      onChange={(e) => setInviteLinkInput(e.target.value)}
                      placeholder={t("signup.inviteLinkPlaceholder", "Paste your invite link or enter your 8-character code")}
                      className="mt-1 h-11"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={inviteLinkSubmitLoading}>
                    {inviteLinkSubmitLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("signup.continueToSignup", "Continue to sign up")}
                  </Button>
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    <Link to="/signup?request_invite=1" className="text-primary underline">{t("signup.backToRequestInvite", "Request an invite")}</Link>
                  </p>
                </form>
              ) : inviteStep === "form" && enableInviteRequests ? (
                <form onSubmit={handleRequestInvite} className="space-y-4 mt-6 text-left">
                  <div>
                    <label className="text-sm font-medium">Full name</label>
                    <Input
                      value={requestName}
                      onChange={(e) => setRequestName(e.target.value)}
                      placeholder="Your name"
                      className="mt-1 h-11"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      type="email"
                      value={requestEmail}
                      onChange={(e) => setRequestEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="mt-1 h-11"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Country</label>
                    <Input
                      value={requestCountry}
                      onChange={(e) => setRequestCountry(e.target.value)}
                      placeholder="Country"
                      className="mt-1 h-11"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={requestInviteLoading}>
                    {requestInviteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Request invite
                  </Button>
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    <Link to="/signup?have_invite=1" className="text-primary underline">{t("signup.iHaveInviteLink", "I already have an invite link")}</Link>
                  </p>
                </form>
              ) : null}
              {inviteStep === "otp" && (
                <form onSubmit={handleVerifyOtp} className="space-y-4 mt-6 text-left">
                  <p className="text-sm text-muted-foreground">
                    {inviteRequestId
                      ? (inviteOnlyConfig.request_submitted_success_message || "Enter the 6-digit code from your email.")
                      : "If you received the verification email, enter your email and the 6-digit code below."}
                  </p>
                  {!inviteRequestId && (
                    <div>
                      <label className="text-sm font-medium">Email</label>
                      <Input
                        type="email"
                        value={requestEmail}
                        onChange={(e) => setRequestEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="mt-1 h-11"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium">Verification code</label>
                    <Input
                      value={otpValue}
                      onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      className="mt-1 h-11 font-mono text-lg tracking-widest"
                      maxLength={6}
                      inputMode="numeric"
                    />
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={verifyOtpLoading}>
                    {verifyOtpLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Verify
                  </Button>
                  {otpVerificationFailedOnce && (
                    <p className="text-center text-sm text-muted-foreground">
                      Didn&apos;t get the code or it didn&apos;t work?{" "}
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={resendOtpLoading}
                        className="text-primary underline font-medium hover:no-underline disabled:opacity-50"
                      >
                        {resendOtpLoading ? "Sending…" : "Resend code"}
                      </button>
                    </p>
                  )}
                </form>
              )}
              {inviteStep === "done" && inviteLink && (
                <div className="space-y-4 mt-6">
                  <p className="text-muted-foreground">Check your email for the invite link, or use the button below.</p>
                  <Button asChild className="w-full h-11">
                    <a
                      href={(() => {
                        try {
                          const url = new URL(inviteLink, window.location.origin);
                          const name = requestName.trim();
                          const email = requestEmail.trim().toLowerCase();
                          if (name) url.searchParams.set("invite_name", name);
                          if (email) url.searchParams.set("invite_email", email);
                          return url.toString();
                        } catch {
                          return inviteLink;
                        }
                      })()}
                    >
                      Create your account
                    </a>
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">{t("signup.title")}</h1>
              <p className="text-muted-foreground">
                {t("signup.subtitle", { platform: platformName })}
              </p>
              {referrerDisplayName && (
                <div className="rounded-lg border-2 border-[hsl(var(--wallet-deposit))]/30 bg-[hsl(var(--wallet-deposit))]/5 px-4 py-2.5">
                  <p className="text-sm font-medium text-foreground">
                    {t("signup.invitedBy", { name: referrerDisplayName })}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {showNormalForm && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center justify-between">
                          <span>{t("signup.username")}</span>
                          {usernameValue && usernameValue.length >= 3 && (
                            <span className={cn(
                              "text-xs font-normal",
                              isChecking && "text-blue-500",
                              !isChecking && isAvailable === true && "text-green-600",
                              !isChecking && isAvailable === false && "text-destructive"
                            )}>
                              {isChecking && t("signup.usernameChecking")}
                              {!isChecking && isAvailable === true && t("signup.usernameAvailable")}
                              {!isChecking && isAvailable === false && t("signup.usernameTakenBadge")}
                            </span>
                          )}
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              placeholder={t("signup.usernamePlaceholder")}
                              disabled={isLoading}
                              className={cn(
                                "h-11 pr-10 transition-all duration-200",
                                usernameValue && usernameValue.length >= 3 && isAvailable === true && "border-green-500 bg-green-50/50 focus-visible:ring-green-500 dark:bg-green-950/20",
                                usernameValue && usernameValue.length >= 3 && isAvailable === false && "border-destructive bg-destructive/5 focus-visible:ring-destructive",
                                isChecking && "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                              )}
                              autoComplete="username"
                            />
                            {usernameValue && usernameValue.length >= 3 && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {isChecking && (
                                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                )}
                                {!isChecking && isAvailable === true && (
                                  <CheckCircle2 className="h-4 w-4 text-green-600 animate-in fade-in zoom-in duration-200" />
                                )}
                                {!isChecking && isAvailable === false && (
                                  <XCircle className="h-4 w-4 text-destructive animate-in fade-in zoom-in duration-200" />
                                )}
                              </div>
                            )}
                          </div>
                        </FormControl>
                        
                        {/* Helper text - always visible */}
                        {(!usernameValue || usernameValue.length < 3) && !usernameError && (
                          <p className="text-xs text-muted-foreground">
                            {t("signup.usernameHelper")}
                          </p>
                        )}
                        
                        {/* Validation feedback */}
                        {usernameValue && usernameValue.length >= 3 && !isChecking && usernameError && (
                          <p className="text-sm text-destructive font-medium animate-in slide-in-from-top-1 duration-200">
                            {usernameError}
                          </p>
                        )}
                        {usernameValue && usernameValue.length >= 3 && !isChecking && isAvailable === true && (
                          <p className="text-sm text-green-600 font-medium animate-in slide-in-from-top-1 duration-200">
                            {t("signup.usernameGreatChoice")}
                          </p>
                        )}
                        {isChecking && (
                          <p className="text-sm text-blue-600 font-medium animate-pulse">
                            {t("signup.usernameCheckingAvailability")}
                          </p>
                        )}
                        
                        <FormMessage />
                      </FormItem>
                    )}
                  />

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("signup.fullName")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("signup.fullNamePlaceholder")}
                      disabled={isLoading}
                      className="h-11"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("signup.email")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder={t("signup.emailPlaceholder")}
                      disabled={isLoading}
                      className="h-11"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("signup.password")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder={t("signup.passwordPlaceholder")}
                      disabled={isLoading}
                      className="h-11"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="referralCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("signup.referralCode")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("signup.referralCodePlaceholder")}
                      disabled={isLoading}
                      className="h-11"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              className="w-full h-11 bg-gradient-to-r from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] text-white hover:opacity-90 transition-all duration-200"
              disabled={isLoading || isChecking || (usernameValue?.length >= 3 && isAvailable === false)}
              title={
                isLoading ? "Creating your account..." :
                isChecking ? "Checking username availability..." :
                (usernameValue?.length >= 3 && isAvailable === false) ? "Please choose an available username" :
                "Create your ProfitChips account"
              }
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : isChecking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("signup.usernameChecking")}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t("signup.createAccount")}
                </>
              )}
            </Button>
          </form>
        </Form>
        )}

        {showNormalForm && (
          <p className="text-center text-sm text-muted-foreground">
            {t("signup.alreadyHaveAccount")}{" "}
            <Link 
              to={referralCodeFromUrl ? `/login?ref=${referralCodeFromUrl.trim().toUpperCase()}` : "/login"}
              className="text-[hsl(var(--wallet-deposit))] hover:underline font-medium"
            >
              {t("signup.signInLink")}
            </Link>
          </p>
        )}

        <p className="text-xs text-center text-muted-foreground">
          By signing up, you agree to our{" "}
          <a href="#" className="underline">Terms of Service</a>
          {" "}and{" "}
          <a href="#" className="underline">Privacy Policy</a>
        </p>
      </Card>
    </div>
  );
};

export default Signup;
