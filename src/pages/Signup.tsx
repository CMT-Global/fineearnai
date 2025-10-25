import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupFormData } from "@/lib/auth-schema";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { validateReferralCode } from "@/lib/referral-utils";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

const Signup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingReferrer, setIsLoadingReferrer] = useState(false);
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
    if (!code || code.trim().length === 0) {
      console.log('[REFERRAL] ⚠️ Empty referral code, skipping fetch');
      return;
    }

    setIsLoadingReferrer(true);
    
    try {
      // Normalize referral code: trim whitespace and convert to uppercase
      const normalizedCode = code.trim().toUpperCase();
      console.log('[REFERRAL] 🔍 Fetching referrer info:', {
        original: code,
        normalized: normalizedCode
      });
      
      // Call secure RPC function that bypasses RLS
      const { data, error } = await supabase
        .rpc("get_username_by_referral_code", { p_referral_code: normalizedCode });

      console.log('[REFERRAL] 📦 RPC Response:', { data, error });

      if (error) {
        console.error('[REFERRAL] ❌ Database error while fetching referrer:', { code: normalizedCode, error });
        setReferrerUsername(null);
        setIsLoadingReferrer(false);
        toast({
          title: "Error loading referrer",
          description: "Unable to verify referral code. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Check if data is a valid non-empty string
      const isValidUsername = typeof data === 'string' && data.trim().length > 0;
      
      if (!isValidUsername) {
        console.warn('[REFERRAL] ⚠️ Referral code not found:', normalizedCode);
        setReferrerUsername(null);
        setIsLoadingReferrer(false);
        toast({
          title: "Referral code not found",
          description: "The referral code you entered does not exist.",
          variant: "destructive",
        });
        localStorage.removeItem("pending_referral_code");
        return;
      }

      console.log('[REFERRAL] ✅ Found referrer:', data);
      setReferrerUsername(data);
      setIsLoadingReferrer(false);
    } catch (error) {
      console.error('[REFERRAL] 💥 Exception while fetching referrer info:', error);
      setReferrerUsername(null);
      setIsLoadingReferrer(false);
      toast({
        title: "Unexpected error",
        description: "Failed to load referrer information.",
        variant: "destructive",
      });
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

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);

    try {
      // Get referral code from form or localStorage
      const referralCode = data.referralCode || localStorage.getItem("pending_referral_code");

      // Create the account
      const { data: authData, error: signupError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            username: data.username,
            full_name: data.fullName,
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

      // If signup successful and we have a referral code, link the user to referrer
      if (authData.user && referralCode) {
        console.log('[REFERRAL] 🚀 Starting referral linking process:', {
          userId: authData.user.id,
          referralCode: referralCode,
          referrerUsername: referrerUsername
        });

        try {
          const { data: linkData, error: linkError } = await supabase.functions.invoke(
            "link-user-to-referrer",
            {
              body: {
                userId: authData.user.id,
                referralCode: referralCode.toUpperCase(),
              },
            }
          );

          console.log('[REFERRAL] 📡 Edge function response:', {
            success: linkData?.success,
            error: linkError,
            data: linkData
          });

          if (linkError) {
            console.error('[REFERRAL] ❌ Edge function error:', {
              message: linkError.message,
              status: linkError.status,
              details: linkError
            });
            toast({
              title: "Referral link failed",
              description: "Your account was created, but we couldn't link the referral code.",
              variant: "destructive",
            });
          } else if (linkData?.success) {
            console.log('[REFERRAL] ✅ Referral link successful:', {
              referrer: linkData?.referrer,
              signupBonus: linkData?.signupBonus
            });
            toast({
              title: "Account created!",
              description: referrerUsername 
                ? `Welcome to FineEarn! You've been referred by ${referrerUsername}.`
                : "Welcome to FineEarn! Referral link successful.",
            });
          } else {
            console.warn('[REFERRAL] ⚠️ Unexpected response format:', linkData);
          }
        } catch (linkErr) {
          console.error('[REFERRAL] 💥 Exception during referral linking:', {
            error: linkErr,
            message: linkErr instanceof Error ? linkErr.message : 'Unknown error',
            stack: linkErr instanceof Error ? linkErr.stack : undefined
          });
          // Don't block the signup flow for referral errors
        } finally {
          // Clear the stored referral code
          console.log('[REFERRAL] 🧹 Clearing stored referral code from localStorage');
          localStorage.removeItem("pending_referral_code");
        }
      } else {
        toast({
          title: "Account created!",
          description: "Welcome to FineEarn. Redirecting to dashboard...",
        });
      }

      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
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
              ? `Invited by ${referrerUsername}. Start earning in minutes!`
              : "Start earning in minutes"}
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Choose a unique username"
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
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter your full name"
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

        {/* Referred By Display Field */}
        <FormItem>
          <FormLabel>Referred By</FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                disabled
                value={
                  isLoadingReferrer 
                    ? "Loading..." 
                    : referrerUsername 
                    ? referrerUsername 
                    : "No Upline"
                }
                className={
                  isLoadingReferrer 
                    ? "bg-muted text-muted-foreground" 
                    : referrerUsername 
                    ? "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800" 
                    : "bg-muted text-muted-foreground"
                }
              />
              {referrerUsername && !isLoadingReferrer && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
              )}
            </div>
          </FormControl>
          <FormDescription>
            {referrerUsername 
              ? `You were invited by ${referrerUsername}` 
              : "You can still enter a referral code below"}
          </FormDescription>
        </FormItem>
        
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
              className="w-full h-11 bg-gradient-to-r from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] text-white hover:opacity-90"
              disabled={isLoading}
            >
              {isLoading ? "Creating account..." : "Create Account"}
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
