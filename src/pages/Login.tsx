import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormData } from "@/lib/auth-schema";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { PlatformMigrationBanner } from "@/components/shared/PlatformMigrationBanner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const referralCode = searchParams.get("ref");

  useEffect(() => {
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
  }, [navigate, referralCode]);

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
            title: "Login failed",
            description: "Invalid email or password. Please try again.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Login failed",
            description: error.message,
            variant: "destructive",
          });
        }
        return;
      }

      // Get the session to extract user ID
      const { data: { session } } = await supabase.auth.getSession();
      
      // Track login location (non-blocking)
      if (session?.user) {
        // ✅ NEW: Set login message trigger flag for Dashboard
        const triggerKey = `loginMessageTrigger_${session.user.id}`;
        sessionStorage.setItem(triggerKey, 'true');
        console.info(`[LoginMessage] Trigger set for user ${session.user.id}`);
        
        supabase.functions.invoke("track-user-login", {
          body: { userId: session.user.id }
        }).catch(err => console.error("Failed to track login:", err));
        
        // Prefetch profile data immediately after login
        queryClient.prefetchQuery({
          queryKey: ['profile', session.user.id],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            if (error) throw error;
            
            // Cache in localStorage for instant future loads
            try {
              const cacheData = {
                userId: session.user.id,
                data,
                timestamp: Date.now(),
                version: '1.0'
              };
              localStorage.setItem(`fineearn_profile_cache_${session.user.id}`, JSON.stringify(cacheData));
            } catch (err) {
              console.error('Error caching profile:', err);
            }
            
            return data;
          },
          staleTime: 5 * 60 * 1000,
        });
      }

      toast({
        title: "Welcome back!",
        description: "Redirecting to dashboard...",
      });

      navigate("/dashboard");
    } catch (error: any) {
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
    <>
      {/* Platform Migration Banner - Only visible on login page before authentication */}
      <PlatformMigrationBanner />
      
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4 pt-24 sm:pt-8">
        <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Welcome Back</h1>
          <p className="text-muted-foreground">Sign in to FineEarn - Continue earning with AI tasks</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      placeholder="Enter your password"
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
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </Form>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link
            to={referralCode ? `/signup?ref=${referralCode}` : "/signup"}
            className="text-[hsl(var(--wallet-deposit))] hover:underline font-medium"
          >
            Sign up
          </Link>
        </p>
      </Card>
    </div>
    </>
  );
};

export default Login;
