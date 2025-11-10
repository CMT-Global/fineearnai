import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const MasterLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"validating" | "success" | "error">("validating");

  useEffect(() => {
    const processMasterLogin = async () => {
      try {
        const token = searchParams.get("token");

        if (!token) {
          throw new Error("No token provided");
        }

        console.log("🔐 [MasterLogin] Processing master login with token");

        // Validate the token
        const { data, error } = await supabase.functions.invoke("validate-master-login-token", {
          body: { token },
        });

        if (error) throw error;

        if (!data?.success || !data?.access_token || !data?.refresh_token) {
          throw new Error("Invalid authentication response");
        }

        console.log("✅ [MasterLogin] Tokens received, setting session");

        // Set the session directly using tokens from backend
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });

        if (sessionError) throw sessionError;

        console.log("✅ [MasterLogin] Session created successfully");
        
        setStatus("success");
        toast.success("Master login successful! Redirecting...");

        // Redirect to dashboard after brief delay
        setTimeout(() => {
          navigate("/dashboard");
        }, 1000);

      } catch (error: any) {
        console.error("❌ [MasterLogin] Error:", error);
        setStatus("error");
        toast.error(error.message || "Master login failed");

        // Redirect to login page after error
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
                <h2 className="text-xl font-semibold">Validating Master Login</h2>
                <p className="text-sm text-muted-foreground">
                  Please wait while we authenticate your session...
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
                <h2 className="text-xl font-semibold">Login Successful</h2>
                <p className="text-sm text-muted-foreground">
                  Redirecting to dashboard...
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
                <h2 className="text-xl font-semibold">Authentication Failed</h2>
                <p className="text-sm text-muted-foreground">
                  The master login link is invalid or has expired. Redirecting to login...
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
