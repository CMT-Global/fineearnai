import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles, CheckCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormData } from "@/lib/auth-schema";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useBranding } from "@/contexts/BrandingContext";
import { PlatformMigrationBanner } from "@/components/shared/PlatformMigrationBanner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useTranslation } from "react-i18next";

const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { platformName, platformLogoUrl } = useBranding();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [showDeletedMessage, setShowDeletedMessage] = useState(false);
  const referralCode = searchParams.get("ref");
  const accountDeleted = searchParams.get("deleted");

  useEffect(() => {
    // Show deleted account success message
    if (accountDeleted === "true") {
      setShowDeletedMessage(true);
      // Auto-hide after 10 seconds
      const timer = setTimeout(() => {
        setShowDeletedMessage(false);
      }, 10000);
      return () => clearTimeout(timer);
    }

    // Store referral code in localStorage if present
    if (referralCode) {
      localStorage.setItem("pending_referral_code", referralCode.toUpperCase());
    }

    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate, referralCode, accountDeleted]);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast({
            title: t("login.loginFailed"),
            description: t("login.invalidCredentials"),
            variant: "destructive",
          });
        } else {
          toast({
            title: t("login.loginFailed"),
            description: error.message,
            variant: "destructive",
          });
        }
        return;
      }

      // Get the session to extract user ID
      const { data: { session } } = await supabase.auth.getSession();
      
      let isProfileCompleted = false;

      // Track login location (non-blocking)
      if (session?.user) {
        // ✅ NEW: Set login message trigger flag for Dashboard
        const triggerKey = `loginMessageTrigger_${session.user.id}`;
        sessionStorage.setItem(triggerKey, 'true');
        console.info(`[LoginMessage] Trigger set for user ${session.user.id}`);
        
        supabase.functions.invoke("track-user-login", {
          body: { userId: session.user.id }
        }).catch(err => console.error("Failed to track login:", err));
        
        // Check profile completion status to determine toast and navigation
        const { data: completionData } = await (supabase
          .from('profiles')
          .select('profile_completed, profile_completed_at, payout_configured, phone_verified')
          .eq('id', session.user.id)
          .single() as any);
        
        isProfileCompleted = completionData?.profile_completed ?? false;

        // Prefetch profile for wizard/dashboard
        queryClient.prefetchQuery({
          queryKey: ['profile', session.user.id],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            if (error) throw error;
            try {
              const cacheData = { userId: session.user.id, data, timestamp: Date.now(), version: '1.0' };
              localStorage.setItem(`ProfitChips_profile_cache_${session.user.id}`, JSON.stringify(cacheData));
            } catch (err) {
              console.error('Error caching profile:', err);
            }
            return data;
          },
          staleTime: 5 * 60 * 1000,
        });

        if (completionData) {
          queryClient.setQueryData(['profile-completion', session.user.id], {
            id: session.user.id,
            ...completionData
          });
        }
      }

      if (isProfileCompleted) {
        toast({
          title: t("login.welcomeBack"),
          description: t("login.redirecting"),
        });
        navigate("/dashboard");
      } else {
        toast({
          title: t("login.welcomeBack"),
          description: t("profileWizard.profileIncomplete"),
        });
        navigate("/profile-wizard");
      }
    } catch (error: any) {
      toast({
        title: t("login.error"),
        description: t("login.unexpectedError"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Platform Migration Banner - Only visible on login page before authentication */}
      <PlatformMigrationBanner />
      
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4 pt-24 sm:pt-8">
        <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <img src={platformLogoUrl} alt={`${platformName} Logo`} className="h-24 w-24 object-contain" />
          </div>
          <h1 className="text-2xl font-bold">{t("login.title")}</h1>
          <p className="text-muted-foreground">{t("login.subtitle", { platform: platformName })}</p>
        </div>

        {/* Account Deleted Success Message */}
        {showDeletedMessage && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertTitle className="text-green-800 dark:text-green-200">{t("login.accountDeleted")}</AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-300">
              {t("login.accountDeletedDescription")}
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("login.email")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder={t("login.emailPlaceholder")}
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
                  <FormLabel>{t("login.password")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder={t("login.passwordPlaceholder")}
                      disabled={isLoading}
                      className="h-11"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm text-muted-foreground hover:text-[hsl(var(--wallet-deposit))] transition-colors"
              >
                {t("login.forgotPassword")}
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] text-white hover:opacity-90"
              disabled={isLoading}
            >
              {isLoading ? t("login.signingIn") : t("login.signIn")}
            </Button>
          </form>
        </Form>

        <p className="text-center text-sm text-muted-foreground">
          {t("login.noAccount")}{" "}
          <Link
            to={referralCode ? `/signup?ref=${referralCode}` : "/signup"}
            className="text-[hsl(var(--wallet-deposit))] hover:underline font-medium"
          >
            {t("login.signUp")}
          </Link>
        </p>
      </Card>
    </div>
    </>
  );
};

export default Login;
