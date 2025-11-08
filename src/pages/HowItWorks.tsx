import { useState } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  UserPlus, 
  Settings, 
  CreditCard, 
  Brain, 
  TrendingUp, 
  Users, 
  Rocket, 
  Wallet,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  InfoIcon,
  X,
  HelpCircle,
  BookOpen,
  Globe,
  DollarSign,
  Activity,
  Award,
  Target,
  Zap,
  Gift,
  ShieldCheck,
  Star
} from "lucide-react";
import { useCurrencyConversion } from "@/hooks/useCurrencyConversion";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Icon mapping for dynamic icon loading
const iconMap: Record<string, any> = {
  UserPlus,
  Settings,
  CreditCard,
  Brain,
  TrendingUp,
  Users,
  Rocket,
  Wallet,
  CheckCircle,
  Star,
  Award,
  Target,
  Zap,
  Gift,
  ShieldCheck,
  HelpCircle,
  BookOpen,
  Globe,
  DollarSign,
  Activity,
};

const HowItWorks = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [showBanner, setShowBanner] = useState(true);
  const { formatAmount } = useCurrencyConversion();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { data } = useDashboardData(user?.id);
  const { profile } = data || {};

  // Fetch steps from database
  const { data: steps, isLoading } = useQuery({
    queryKey: ["how-it-works-steps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("how_it_works_steps")
        .select("*")
        .eq("is_active", true)
        .order("step_number", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const currentStepData = steps?.[currentStep];
  const StepIcon = currentStepData ? iconMap[currentStepData.icon_name] || HelpCircle : HelpCircle;
  const progress = steps ? ((currentStep + 1) / steps.length) * 100 : 0;

  const handleNext = () => {
    if (steps && currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    setCurrentStep(stepIndex);
  };

  if (isLoading) {
    return (
      <PageLayout profile={profile} isAdmin={isAdmin} onSignOut={signOut}>
        <div className="container mx-auto px-4 py-6 max-w-5xl">
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
            <p className="mt-4 text-muted-foreground">Loading guide...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!steps || steps.length === 0) {
    return (
      <PageLayout profile={profile} isAdmin={isAdmin} onSignOut={signOut}>
        <div className="container mx-auto px-4 py-6 max-w-5xl">
          <div className="text-center py-12">
            <p className="text-muted-foreground">No steps available at the moment.</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout profile={profile} isAdmin={isAdmin} onSignOut={signOut}>
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Info Banner */}
        {showBanner && (
          <Alert className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950/20">
            <InfoIcon className="h-5 w-5 text-blue-600" />
            <AlertDescription className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>Welcome to FineEarn!</strong> Follow these {steps.length} simple steps to start earning up to{" "}
                  <span className="font-semibold">{formatAmount(240)}/week</span> by training AI. 
                  Complete the guide to maximize your earnings potential.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBanner(false)}
                className="ml-4 h-6 w-6 p-0 text-blue-600 hover:text-blue-900 hover:bg-blue-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Step {currentStepData.step_number} of {steps.length}
            </span>
            <span className="text-sm font-medium text-primary">
              {Math.round(progress)}% Complete
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Current Step Card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                <StepIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{currentStepData.title}</h2>
                <p className="text-sm text-muted-foreground">
                  Step {currentStepData.step_number}
                </p>
              </div>
            </div>

            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="text-muted-foreground leading-relaxed">
                {currentStepData.description}
              </p>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center mt-6 pt-6 border-t">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              <div className="text-sm text-muted-foreground">
                {currentStep + 1} / {steps.length}
              </div>

              {currentStep < steps.length - 1 ? (
                <Button onClick={handleNext}>
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={() => window.location.href = '/dashboard'}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Get Started
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Step Navigator */}
        <Card>
          <CardContent className="p-4">
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {steps.map((step, index) => {
              const Icon = iconMap[step.icon_name] || HelpCircle;
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;
              
              return (
                <button
                  key={step.id}
                  onClick={() => handleStepClick(index)}
                  className={`
                    relative flex flex-col items-center justify-center p-3 rounded-lg transition-all
                    ${isCurrent 
                      ? "bg-primary text-primary-foreground shadow-md scale-105" 
                      : isCompleted 
                        ? "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-950/50" 
                        : "bg-muted hover:bg-muted/80"
                    }
                  `}
                >
                  {isCompleted && (
                    <CheckCircle className="absolute -top-1 -right-1 w-4 h-4 text-green-600 dark:text-green-400 bg-white dark:bg-background rounded-full" />
                  )}
                  <Icon className={`w-5 h-5 mb-1 ${isCurrent ? "" : "opacity-70"}`} />
                  <span className="text-xs font-medium">{step.step_number}</span>
                </button>
              );
            })}
          </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
};

export default HowItWorks;