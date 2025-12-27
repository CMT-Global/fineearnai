import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const MasterLogin = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"validating" | "success" | "error">("validating");

  useEffect(() => {
    const processMasterLogin = async () => {
      const startTime = Date.now();
      
      try {
        const token = searchParams.get("token");

        if (!token) {
          throw new Error("missing_token");
        }

        console.log("🔐 [MasterLogin] Processing master login", {
          token_preview: token.substring(0, 8) + '...',
          timestamp: new Date().toISOString()
        });

        // Validate the token
        console.log("📡 [MasterLogin] Calling validate-master-login-token edge function");
        const functionStartTime = Date.now();
        
        const { data, error } = await supabase.functions.invoke("validate-master-login-token", {
          body: { token },
        });

        const functionDuration = Date.now() - functionStartTime;
        console.log(`⏱️ [MasterLogin] Edge function completed in ${functionDuration}ms`);

        if (error) {
          console.error("❌ [MasterLogin] Edge function error:", error);
          throw error;
        }

        if (!data?.success || !data?.access_token || !data?.refresh_token) {
          console.error("❌ [MasterLogin] Invalid response from edge function:", {
            has_success: !!data?.success,
            has_access_token: !!data?.access_token,
            has_refresh_token: !!data?.refresh_token
          });
          throw new Error("invalid_auth_response");
        }

        console.log("✅ [MasterLogin] Tokens received", {
          user_id: data.userId,
          email_masked: data.userEmail?.substring(0, 3) + '***',
          has_access_token: !!data.access_token,
          has_refresh_token: !!data.refresh_token
        });

        // Set the session directly using tokens from backend
        console.log("🔐 [MasterLogin] Setting user session");
        const sessionStartTime = Date.now();
        
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });

        const sessionDuration = Date.now() - sessionStartTime;
        console.log(`⏱️ [MasterLogin] Session set in ${sessionDuration}ms`);

        if (sessionError) {
          console.error("❌ [MasterLogin] Session error:", sessionError);
          throw sessionError;
        }

        const totalDuration = Date.now() - startTime;
        console.log(`✅ [MasterLogin] Session created successfully - Total time: ${totalDuration}ms`);
        
        setStatus("success");
        toast.success(t("masterLogin.toasts.success"));

        // Redirect to dashboard after brief delay
        console.log("🔄 [MasterLogin] Redirecting to dashboard in 1s");
        setTimeout(() => {
          navigate("/dashboard");
        }, 1000);

      } catch (error: any) {
        const totalDuration = Date.now() - startTime;
        console.error(`❌ [MasterLogin] Error after ${totalDuration}ms:`, {
          message: error.message,
          error: error
        });
        
        setStatus("error");
        if (error?.message === "missing_token") {
          toast.error(t("masterLogin.errors.missingToken"));
        } else if (error?.message === "invalid_auth_response") {
          toast.error(t("masterLogin.errors.invalidResponse"));
        } else {
          toast.error(t("masterLogin.toasts.failed"));
        }

        // Redirect to login page after error
        console.log("🔄 [MasterLogin] Redirecting to login page in 3s");
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      }
    };

    processMasterLogin();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center space-y-4 text-center">
            {status === "validating" && (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <h2 className="text-xl font-semibold">{t("masterLogin.validating.title")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("masterLogin.validating.description")}
                </p>
              </>
            )}

            {status === "success" && (
              <>
                <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center">
                  <svg
                    className="h-5 w-5 text-white"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold">{t("masterLogin.success.title")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("masterLogin.success.description")}
                </p>
              </>
            )}

            {status === "error" && (
              <>
                <div className="h-8 w-8 rounded-full bg-red-500 flex items-center justify-center">
                  <svg
                    className="h-5 w-5 text-white"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold">{t("masterLogin.error.title")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("masterLogin.error.description")}
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MasterLogin;
