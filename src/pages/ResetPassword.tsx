import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema, type ChangePasswordFormData } from "@/lib/auth-schema";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Lock, CheckCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [tokenError, setTokenError] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  const token = searchParams.get('token');

  const form = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    // Verify the reset token from URL query parameter
    const verifyToken = async () => {
      if (!token) {
        console.error('No token found in URL');
        setIsValidToken(false);
        setTokenError("No reset token provided");
        toast.error("Invalid reset link");
        setTimeout(() => navigate("/forgot-password"), 3000);
        return;
      }

      console.log('Verifying reset token...');

      try {
        const { data: result, error } = await supabase.functions.invoke('verify-reset-token', {
          body: { token },
        });

        if (error) {
          console.error('Token verification error:', error);
          throw error;
        }

        if (!result?.success) {
          console.error('Token verification failed:', result);
          setIsValidToken(false);
          
          // Set specific error messages based on error type
          if (result?.error === 'token_expired') {
            setTokenError("This reset link has expired. Please request a new password reset.");
          } else if (result?.error === 'token_used') {
            setTokenError("This reset link has already been used. Please request a new password reset.");
          } else if (result?.error === 'invalid_token') {
            setTokenError("This reset link is invalid. Please request a new password reset.");
          } else {
            setTokenError(result?.message || "Invalid reset link");
          }
          
          toast.error(result?.message || "Invalid reset link");
          setTimeout(() => navigate("/forgot-password"), 5000);
          return;
        }

        console.log('Token verified successfully:', result.data);
        setIsValidToken(true);
        setUserEmail(result.data.email);
        setTimeRemaining(result.data.timeRemainingMinutes || 0);
        
      } catch (error: any) {
        console.error('Unexpected error during token verification:', error);
        setIsValidToken(false);
        setTokenError("An error occurred while verifying your reset link. Please try again.");
        toast.error("Failed to verify reset link");
        setTimeout(() => navigate("/forgot-password"), 3000);
      }
    };

    verifyToken();
  }, [token, navigate]);

  const onSubmit = async (data: ChangePasswordFormData) => {
    if (!token) {
      toast.error("No reset token found");
      return;
    }

    try {
      console.log('Submitting password reset...');

      // Call custom backend function to reset password
      const { data: result, error } = await supabase.functions.invoke('reset-password-with-token', {
        body: {
          token: token,
          newPassword: data.newPassword,
        },
      });

      if (error) {
        console.error('Password reset error:', error);
        throw error;
      }

      if (!result?.success) {
        console.error('Password reset failed:', result);
        
        // Handle specific error cases
        if (result?.error === 'token_expired') {
          toast.error("This reset link has expired. Please request a new password reset.");
          setTimeout(() => navigate("/forgot-password"), 2000);
          return;
        } else if (result?.error === 'token_used') {
          toast.error("This reset link has already been used.");
          setTimeout(() => navigate("/forgot-password"), 2000);
          return;
        } else if (result?.error === 'weak_password') {
          toast.error("Password must be at least 6 characters long");
          return;
        }
        
        throw new Error(result?.message || 'Failed to reset password');
      }

      console.log('Password reset successful');
      setIsSuccess(true);
      toast.success("Password changed successfully! You can now login with your new password.");
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (error: any) {
      console.error('Unexpected error during password reset:', error);
      toast.error(error.message || 'Failed to change password. Please try again.');
    }
  };

  if (isValidToken === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Verifying reset link..." />
      </div>
    );
  }

  if (isValidToken === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <CardTitle className="text-2xl font-bold text-destructive">Invalid Link</CardTitle>
            </div>
            <CardDescription>
              {tokenError || "This password reset link is invalid or has expired."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Redirecting you to request a new password reset link...
                </AlertDescription>
              </Alert>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/forgot-password")}
              >
                Request New Reset Link
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <img src="/logo_without_bg_text.png" alt="ProfitChips Logo" className="h-24 w-24 object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
          <CardDescription>
            {isSuccess
              ? "Your password has been changed successfully"
              : `Create a new password for ${userEmail}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSuccess ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-6">
                <CheckCircle className="h-16 w-16 text-primary mb-4" />
                <p className="text-center text-muted-foreground">
                  Redirecting to login page...
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/login")}
              >
                Go to Login Now
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {timeRemaining > 0 && (
                  <Alert>
                    <AlertDescription className="text-sm">
                      ⏱️ This link expires in <strong>{timeRemaining} minutes</strong>
                    </AlertDescription>
                  </Alert>
                )}
                
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type="password"
                            placeholder="Enter new password"
                            className="pl-10"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type="password"
                            placeholder="Confirm new password"
                            className="pl-10"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? "Changing Password..." : "Change Password"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
