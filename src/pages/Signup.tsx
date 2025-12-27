import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupFormData } from "@/lib/auth-schema";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { validateReferralCode } from "@/lib/referral-utils";
import { useUsernameValidation } from "@/hooks/useUsernameValidation";
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

const Signup = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { platformName, platformLogoUrl } = useBranding();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const referralCodeFromUrl = searchParams.get("ref");
  const [referrerUsername, setReferrerUsername] = useState<string | null>(null);

  // Store referral code in localStorage when page loads with ref parameter
  useEffect(() => {
    if (referralCodeFromUrl) {
      const upperCode = referralCodeFromUrl.toUpperCase();
      console.log('[REFERRAL] 🔗 Detected referral code from URL:', upperCode);
      
      // Validate format
      if (validateReferralCode(upperCode)) {
        localStorage.setItem("pending_referral_code", upperCode);
        console.log('[REFERRAL] ✅ Valid referral code stored in localStorage');
        
        // Fetch and display referrer info
        fetchReferrerInfo(upperCode);
      } else {
        console.error('[REFERRAL] ❌ Invalid referral code format:', upperCode);
        toast({
          title: t("signup.invalidReferralCode"),
          description: t("signup.invalidReferralCodeFormat"),
          variant: "destructive",
        });
      }
    }
  }, [referralCodeFromUrl]);

  const fetchReferrerInfo = async (code: string) => {
    try {
      console.log('[REFERRAL] 🔍 Fetching referrer info for code:', code);
      
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("referral_code", code)
        .single();

      if (error || !data) {
        console.error('[REFERRAL] ❌ Referral code not found in database:', { code, error });
        // Silently handle - the database trigger will validate during signup
        localStorage.removeItem("pending_referral_code");
        return;
      }

      console.log('[REFERRAL] ✅ Found referrer:', data.username);
      setReferrerUsername(data.username);
    } catch (error) {
      console.error('[REFERRAL] 💥 Exception while fetching referrer info:', error);
    }
  };

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: "",
      fullName: "",
      email: "",
      password: "",
      referralCode: referralCodeFromUrl || "",
    },
  });

  // Real-time username validation
  const usernameValue = form.watch("username");
  const { isAvailable, isChecking, error: usernameError } = useUsernameValidation(usernameValue);

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
      // Get referral code from form or localStorage
      const referralCode = data.referralCode || localStorage.getItem("pending_referral_code");

      // Create the account - referral code passed in metadata for trigger processing
      const { data: authData, error: signupError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            username: data.username,
            full_name: data.fullName,
            referral_code: referralCode || undefined, // Passed to handle_new_user trigger
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

      // PHASE 6A: Email verification logging and notification
      console.log("✅ Signup successful - email verification required");
      
      // If signup successful and we have a referral code, link will be handled by database trigger
      if (authData.user && referralCode) {
        console.log('[REFERRAL] ✅ Account created with referral code:', {
          userId: authData.user.id,
          referralCode: referralCode,
          referrerUsername: referrerUsername
        });
        
        toast({
          title: t("signup.accountCreated"),
          description: referrerUsername 
            ? t("signup.accountCreatedWithReferrer", { platform: platformName, referrer: referrerUsername })
            : t("signup.checkEmail"),
        });
        
        // Clear the stored referral code
        console.log('[REFERRAL] 🧹 Clearing stored referral code from localStorage');
        localStorage.removeItem("pending_referral_code");
      } else {
        toast({
          title: t("signup.accountCreated"),
          description: t("signup.checkEmail"),
        });
      }

      // PHASE 6A: Redirect to dashboard where verification banner will show
      setTimeout(() => navigate("/dashboard"), 2000);
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
          <h1 className="text-2xl font-bold">{t("signup.title")}</h1>
          <p className="text-muted-foreground">
            {referrerUsername 
              ? t("signup.subtitleWithReferrer", { referrer: referrerUsername, platform: platformName })
              : t("signup.subtitle", { platform: platformName })}
          </p>
        </div>

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

        <p className="text-center text-sm text-muted-foreground">
          {t("signup.alreadyHaveAccount")}{" "}
          <Link 
            to={referralCodeFromUrl ? `/login?ref=${referralCodeFromUrl}` : "/login"}
            className="text-[hsl(var(--wallet-deposit))] hover:underline font-medium"
          >
            {t("signup.signInLink")}
          </Link>
        </p>

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
