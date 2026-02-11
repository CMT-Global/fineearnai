import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useTranslation } from "react-i18next";
import { 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  Info, 
  Target, 
  Clock, 
  ListTodo, 
  HelpCircle, 
  TrendingUp, 
  Wallet, 
  ShieldCheck,
  Zap,
  Star,
  ArrowRight,
  LogOut,
  AlertCircle
} from "lucide-react";
import { useBranding } from "@/contexts/BrandingContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useMembershipPlans } from "@/hooks/useMembershipPlans";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const STEPS_COUNT = 10;

export default function ProfileWizard() {
  const { t } = useTranslation();
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { platformName, platformLogoUrl } = useBranding();
  const { toast } = useToast();
  const { plans, loading: plansLoading, earningPotentials } = useMembershipPlans();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [weeklyGoal, setWeeklyGoal] = useState("");
  const [weeklyTimeCommitment, setWeeklyTimeCommitment] = useState("");
  const [preferredCategories, setPreferredCategories] = useState<string[]>([]);
  const [weeklyRoutine, setWeeklyRoutine] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");

  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useQuery({
    queryKey: ["profile-wizard", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile) {
      setWeeklyGoal(profile.weekly_goal ?? "");
      setWeeklyTimeCommitment(profile.weekly_time_commitment ?? "");
      setPreferredCategories(profile.preferred_review_categories ?? []);
      setWeeklyRoutine(profile.weekly_routine ?? "");
      setSelectedPlanId(profile.selected_plan_id ?? "");
      
      // If onboarding is already completed, redirect to dashboard
      if (profile.profile_completed) {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [profile, navigate]);

  const save = async (opts: { complete?: boolean; planId?: string } = {}): Promise<{ ok: boolean }> => {
    setError(null);
    setSaving(true);
    try {
      const body: any = {
        weekly_goal: weeklyGoal,
        weekly_time_commitment: weeklyTimeCommitment,
        preferred_review_categories: preferredCategories,
        weekly_routine: weeklyRoutine,
        selected_plan_id: opts.planId || selectedPlanId || undefined,
        onboarding_version: "2.0",
      };

      if (opts.complete) {
        body.complete = true;
      }

      const { data, error: err } = await supabase.functions.invoke("save-profile-wizard", {
        body,
      });

      if (err) throw new Error(err.message ?? "Failed to save");
      
      if (opts.complete) {
        await queryClient.invalidateQueries({ queryKey: ["profile-completion", user?.id] });
        await queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
        toast({
          title: "Welcome to ProfitChips!",
          description: "Your profile has been set up successfully.",
        });
        navigate("/dashboard", { replace: true });
      }
      return { ok: true };
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
      return { ok: false };
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    // Validation for specific steps
    if (step === 2 && !weeklyGoal) {
      setError("Please select a weekly goal.");
      return;
    }
    if (step === 3 && !weeklyTimeCommitment) {
      setError("Please select your weekly time commitment.");
      return;
    }
    if (step === 4 && preferredCategories.length === 0) {
      setError("Please select at least one category.");
      return;
    }
    if (step === 9 && !selectedPlanId) {
      setError("Please select a plan to continue.");
      return;
    }

    const { ok } = await save();
    if (ok) {
      setStep((s) => Math.min(s + 1, STEPS_COUNT));
      window.scrollTo(0, 0);
    }
  };

  const handleBack = () => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo(0, 0);
  };

  const handleStartTrial = async () => {
    const freePlan = plans.find(p => p.account_type === 'free');
    if (freePlan) {
      setSelectedPlanId(freePlan.id);
      await save({ complete: true, planId: freePlan.id });
    } else {
      toast({
        title: "Error",
        description: "Free trial plan not found. Please contact support.",
        variant: "destructive",
      });
    }
  };

  const handleContinueWithPlan = async () => {
    if (!selectedPlanId) {
      setError("Please select a plan first.");
      return;
    }
    
    await save({ complete: true, planId: selectedPlanId });
  };

  if (authLoading || profileLoading || plansLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Preparing your experience..." />
      </div>
    );
  }

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-4">
              <div className="flex justify-center mb-6">
                <img src={platformLogoUrl} alt={platformName} className="h-20 w-20 object-contain" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Welcome to {platformName}</h1>
              <p className="text-xl text-muted-foreground">
                Earn online by analyzing real reviews and feedback—on your schedule.
              </p>
              <div className="bg-muted/50 p-6 rounded-xl border border-border mt-8">
                <p className="text-base leading-relaxed">
                  Answer a few quick questions so we can personalize your task experience and earning targets.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 pt-6">
              <Button size="lg" className="w-full text-lg h-14" onClick={handleNext}>
                Get Started
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-4 italic">
                Rewards vary by participation, accuracy, and task availability.
              </p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">What’s your weekly earning goal?</h2>
              <p className="text-muted-foreground">Pick a target so we can recommend the best plan and routine for you.</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {[
                { id: "small", label: "Extra Income - upto 250$ Monthly", icon: Zap },
                { id: "side", label: "Part-Time Side Hustle - upto 500$ monthly", icon: Target },
                { id: "serious", label: "Full Time Hustle - Over 1,000$ monthly", icon: TrendingUp },
                { id: "not_sure", label: "Not sure yet", icon: HelpCircle },
              ].map((opt) => (
                <Card 
                  key={opt.id} 
                  className={cn(
                    "cursor-pointer transition-all hover:border-primary/50",
                    weeklyGoal === opt.label ? "border-primary bg-primary/5" : ""
                  )}
                  onClick={() => setWeeklyGoal(opt.label)}
                >
                  <CardContent className="flex items-center p-6 gap-4">
                    <div className={cn(
                      "p-3 rounded-full",
                      weeklyGoal === opt.label ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}>
                      <opt.icon className="h-6 w-6" />
                    </div>
                    <span className="text-lg font-medium">{opt.label}</span>
                    {weeklyGoal === opt.label && <CheckCircle2 className="ml-auto h-6 w-6 text-primary" />}
                  </CardContent>
                </Card>
              ))}
            </div>
            <p className="text-xs text-center text-muted-foreground italic">Targets are personal—results vary.</p>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">How much time can you commit weekly?</h2>
              <p className="text-muted-foreground">This helps us estimate how many tasks you can comfortably complete.</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {["1–3 hours/week", "4–7 hours/week", "8–14 hours/week", "15+ hours/week"].map((opt) => (
                <Card 
                  key={opt} 
                  className={cn(
                    "cursor-pointer transition-all hover:border-primary/50",
                    weeklyTimeCommitment === opt ? "border-primary bg-primary/5" : ""
                  )}
                  onClick={() => setWeeklyTimeCommitment(opt)}
                >
                  <CardContent className="flex items-center p-6 gap-4">
                    <Clock className={cn("h-6 w-6", weeklyTimeCommitment === opt ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-lg font-medium">{opt}</span>
                    {weeklyTimeCommitment === opt && <CheckCircle2 className="ml-auto h-6 w-6 text-primary" />}
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <div className="space-y-4 pt-4 border-t">
              <Label className="text-base font-semibold">When do you prefer to work? (Optional)</Label>
              <div className="grid grid-cols-2 gap-2">
                {["Mornings", "Afternoons", "Evenings", "Weekends", "Flexible"].map((routine) => (
                  <Button
                    key={routine}
                    type="button"
                    variant={weeklyRoutine === routine ? "default" : "outline"}
                    className="justify-start"
                    onClick={() => setWeeklyRoutine(routine)}
                  >
                    {routine}
                  </Button>
                ))}
              </div>
            </div>

            <p className="text-xs text-center text-muted-foreground italic">Consistency helps, but outcomes vary.</p>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">What type of reviews do you want to analyze?</h2>
              <p className="text-muted-foreground">Choose what you’d enjoy most (you can change later).</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {[
                "Hospitality — Hotel Review Sentiment",
                "E-Commerce — Product Review Analysis",
                "Food & Dining — Restaurant Feedback Sentiment",
                "Social Platforms — Social Media Comment Analysis",
                "Mobile Apps — App Store Review Sentiment",
                "Professional Services — Service Provider Reviews",
                "I’m open to any category"
              ].map((category) => (
                <div 
                  key={category}
                  className={cn(
                    "flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors",
                    preferredCategories.includes(category) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  )}
                  onClick={() => {
                    if (category === "I’m open to any category") {
                      setPreferredCategories(["I’m open to any category"]);
                    } else {
                      const newCategories = preferredCategories.filter(c => c !== "I’m open to any category");
                      if (newCategories.includes(category)) {
                        setPreferredCategories(newCategories.filter(c => c !== category));
                      } else {
                        setPreferredCategories([...newCategories, category]);
                      }
                    }
                  }}
                >
                  <Checkbox 
                    checked={preferredCategories.includes(category)}
                    onCheckedChange={() => {}} // Handled by div onClick
                  />
                  <Label className="text-base cursor-pointer flex-1">{category}</Label>
                </div>
              ))}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold">Here’s what tasks look like</h2>
              <p className="text-muted-foreground">You’ll read short reviews/comments and answer simple questions like:</p>
            </div>
            <div className="space-y-4 bg-muted/30 p-6 rounded-xl border border-dashed border-primary/30">
              {[
                "Is the sentiment positive, negative, or mixed?",
                "What is the main complaint or praise?",
                "Is the comment angry, happy, or neutral?",
                "Is it a feature request, a bug report, or general feedback?"
              ].map((q, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <p className="text-lg">{q}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-4 py-4">
              <Badge variant="secondary" className="px-3 py-1 text-sm">Beginner-friendly</Badge>
              <Badge variant="secondary" className="px-3 py-1 text-sm">Clear instructions</Badge>
              <Badge variant="secondary" className="px-3 py-1 text-sm">No experience needed</Badge>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold">Your analysis makes feedback understandable</h2>
              <p className="text-muted-foreground">
                Companies and platforms use human review analysis to better understand customer experience and improve products and services. Your input helps organize real feedback into clear insights.
              </p>
            </div>
            <div className="space-y-4 pt-6">
              {[
                { title: "Real reviews across categories", icon: ListTodo },
                { title: "Consistent task rules", icon: ShieldCheck },
                { title: "Progress tracked in your dashboard", icon: TrendingUp },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-card border rounded-lg">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <span className="text-lg font-medium">{item.title}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-center text-muted-foreground italic">Task availability varies by region and time.</p>
          </div>
        );

      case 7:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold">How you earn rewards</h2>
              <p className="text-muted-foreground">You earn rewards by completing tasks accurately and consistently.</p>
            </div>
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg">What affects your results:</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <span>Task availability</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <span>Accuracy/quality</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <span>Your weekly participation</span>
                </div>
              </CardContent>
            </Card>
            <div className="bg-muted p-4 rounded-lg flex items-center gap-3">
              <Info className="h-5 w-5 text-primary shrink-0" />
              <p className="text-sm font-medium">You can track everything—tasks completed, accuracy, and earnings history.</p>
            </div>
            <p className="text-xs text-center text-muted-foreground italic">Rewards are not guaranteed and vary by availability and performance.</p>
          </div>
        );

      case 8:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold">Paid weekly</h2>
              <p className="text-muted-foreground">Your rewards go to your Earnings Wallet. Withdrawals are processed on a weekly schedule when withdrawals are open.</p>
            </div>
            <div className="space-y-4 pt-6">
              {[
                "Clear transaction history",
                "Status tracking: Pending / Processed",
                "Secure payout setup"
              ].map((bullet, i) => (
                <div key={i} className="flex items-center gap-3 p-4 bg-card border rounded-lg">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-lg">{bullet}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-center text-muted-foreground italic">Timing may vary based on verification and payout method.</p>
          </div>
        );

      case 9:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold">Choose a plan to unlock task access</h2>
              <p className="text-muted-foreground">Plans control your daily limits and earning potential. Based on your goal + time, we recommend a plan below.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
              {plans.map((plan) => (
                <Card 
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col transition-all cursor-pointer hover:border-primary",
                    selectedPlanId === plan.id ? "border-2 border-primary shadow-lg" : "border-border"
                  )}
                  onClick={() => setSelectedPlanId(plan.id)}
                >
                  {plan.display_name === 'Premium' && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500">Recommended</Badge>
                  )}
                  <CardHeader>
                    <CardTitle className="text-xl">{plan.display_name}</CardTitle>
                    <div className="text-2xl font-bold">
                      <CurrencyDisplay amountUSD={plan.price} />
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span>{plan.daily_task_limit} tasks/day</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span><CurrencyDisplay amountUSD={plan.earning_per_task} /> per task</span>
                      </div>
                    </div>
                    
                    {earningPotentials[plan.id] && (
                      <div className="pt-4 border-t">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-2">
                          <TrendingUp className="h-3.5 w-3.5" />
                          <span>Estimated earning potential (varies)</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-[200px] text-xs">
                                  Estimates depend on participation, accuracy, and task availability.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-muted-foreground">Monthly:</span>
                          <span><CurrencyDisplay amountUSD={earningPotentials[plan.id]?.monthly ?? 0} /></span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                  {selectedPlanId === plan.id && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 className="h-6 w-6 text-primary fill-primary text-white" />
                    </div>
                  )}
                </Card>
              ))}
            </div>
            <p className="text-xs text-center text-muted-foreground italic">Estimates are not guaranteed.</p>
          </div>
        );

      case 10:
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-4">
              <div className="flex justify-center mb-6">
                <div className="p-4 rounded-full bg-primary/10 text-primary">
                  <Star className="h-12 w-12" />
                </div>
              </div>
              <h2 className="text-3xl font-bold">Start Free for 3 days or choose your plan</h2>
              <p className="text-xl text-muted-foreground">
                Get access to tasks and your dashboard. Upgrade anytime to unlock more daily tasks and higher potential.
              </p>
            </div>
            
            <div className="bg-card border rounded-xl p-8 space-y-6">
              <div className="flex flex-col gap-4">
                <Button size="lg" className="w-full h-16 text-xl font-bold" onClick={handleStartTrial}>
                  Start Free Trial (3 Days)
                </Button>
                <Button variant="outline" size="lg" className="w-full h-16 text-xl" onClick={handleContinueWithPlan}>
                  Continue with Selected Plan
                </Button>
                <Button variant="ghost" size="lg" className="w-full" onClick={() => setStep(9)}>
                  Back to Plans
                </Button>
              </div>
            </div>

            <div className="pt-8 border-t space-y-4">
              <p className="text-xs text-center text-muted-foreground leading-relaxed">
                Rewards vary by participation, accuracy, and your commitment. Multiple accounts are not allowed and may lead to ban!
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="bg-card border-b border-border px-4 py-4 flex items-center justify-between sm:px-8 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <img src={platformLogoUrl} alt={`${platformName} Logo`} className="h-10 w-10 object-contain" />
          <div className="hidden sm:block">
            <span className="font-bold text-xl tracking-tight text-primary">{platformName}</span>
          </div>
        </div>
        
        <Button variant="ghost" size="sm" onClick={() => signOut()} className="text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </header>

      <main className="flex-1 container max-w-4xl mx-auto px-4 py-8 md:py-12">
        <div className="max-w-3xl mx-auto mb-12">
          <div className="flex justify-between text-xs font-medium text-muted-foreground mb-1.5 px-1">
            <span>Progress</span>
            <span>Step {step} of {STEPS_COUNT}</span>
          </div>
          <Progress value={(step / STEPS_COUNT) * 100} className="h-2" />
        </div>

        {error && (
          <Alert variant="destructive" className="mb-8 animate-in slide-in-from-top-2">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Action Required</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="max-w-3xl mx-auto">
          {renderStep()}

          {step > 1 && step < 10 && (
            <div className="flex justify-between items-center mt-12 pt-8 border-t">
              <Button variant="ghost" onClick={handleBack} disabled={saving} className="h-12 px-6 text-base">
                <ChevronLeft className="h-5 w-5 mr-2" />
                Back
              </Button>
              <Button onClick={handleNext} disabled={saving} className="h-12 px-8 text-base font-semibold min-w-[140px]">
                {saving ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-5 w-5 ml-2" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </main>

      <footer className="py-8 px-6 border-t bg-muted/30 w-full mt-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground w-full">
          <p>© 2026 {platformName}. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:underline">Terms of Service</a>
            <a href="#" className="hover:underline">Privacy Policy</a>
            <a href="#" className="hover:underline">Help Center</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
