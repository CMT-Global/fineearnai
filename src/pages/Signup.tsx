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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const Signup = () => {
  const navigate = useNavigate();
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
          title: "Invalid referral code",
          description: "The referral code format is invalid.",
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
        title: "Please wait",
        description: "Checking username availability...",
        variant: "destructive",
      });
      return;
    }

    if (isAvailable === false) {
      toast({
        title: "Username unavailable",
        description: "Please choose a different username",
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
            title: "Account exists",
            description: "This email is already registered. Please login instead.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Signup failed",
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
          title: "Account created!",
          description: referrerUsername 
            ? `Welcome to ProfitChips! You've been referred by ${referrerUsername}. Please check your email to verify your account.`
            : "Account created! Please check your email to verify.",
        });
        
        // Clear the stored referral code
        console.log('[REFERRAL] 🧹 Clearing stored referral code from localStorage');
        localStorage.removeItem("pending_referral_code");
      } else {
        toast({
          title: "Account created!",
          description: "Please check your email to verify your account.",
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
          title: "Username already exists",
          description: `The username "${data.username}" is already taken. Please try another.`,
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
          title: "Error",
          description: "An unexpected error occurred. Please try again.",
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
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="text-muted-foreground">
            {referrerUsername 
              ? `Invited by ${referrerUsername}. Join ProfitChips and start earning!`
              : "Join ProfitChips - Start earning with AI tasks in minutes"}
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
                          <span>Username</span>
                          {usernameValue && usernameValue.length >= 3 && (
                            <span className={cn(
                              "text-xs font-normal",
                              isChecking && "text-blue-500",
                              !isChecking && isAvailable === true && "text-green-600",
                              !isChecking && isAvailable === false && "text-destructive"
                            )}>
                              {isChecking && "Checking..."}
                              {!isChecking && isAvailable === true && "✓ Available"}
                              {!isChecking && isAvailable === false && "✗ Taken"}
                            </span>
                          )}
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              placeholder="Choose a unique username"
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
                            3-30 characters • Letters, numbers, and underscores only
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
                            ✓ Great choice! This username is available
                          </p>
                        )}
                        {isChecking && (
                          <p className="text-sm text-blue-600 font-medium animate-pulse">
                            ⏳ Checking availability...
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
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter your first name"
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
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="Enter your email"
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
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="Create a strong password"
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
                  <FormLabel>Referral Code (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter referral code if you have one"
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
                  Validating username...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Create Account
                </>
              )}
            </Button>
          </form>
        </Form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link 
            to={referralCodeFromUrl ? `/login?ref=${referralCodeFromUrl}` : "/login"}
            className="text-[hsl(var(--wallet-deposit))] hover:underline font-medium"
          >
            Sign in
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
