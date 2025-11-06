import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CheckCircle2, 
  Circle, 
  User, 
  CreditCard, 
  ShoppingCart, 
  Users, 
  BookOpen,
  X,
  Sparkles
} from "lucide-react";
import { usePartnerOnboarding, useUpdateOnboardingStep, useDismissOnboarding } from "@/hooks/usePartnerOnboarding";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface ChecklistStep {
  key: keyof import("@/hooks/usePartnerOnboarding").OnboardingSteps;
  title: string;
  description: string;
  icon: any;
  actionLabel: string;
  actionPath?: string;
  externalLink?: string;
}

const ONBOARDING_STEPS: ChecklistStep[] = [
  {
    key: "profile_completed",
    title: "Complete Your Profile",
    description: "Add your contact information and verify your email",
    icon: User,
    actionLabel: "Go to Settings",
    actionPath: "/settings"
  },
  {
    key: "payment_methods_set",
    title: "Set Up Payment Methods",
    description: "Configure how you'll receive your commissions",
    icon: CreditCard,
    actionLabel: "Add Payment Method",
    actionPath: "/partner/dashboard"
  },
  {
    key: "first_voucher_created",
    title: "Create Your First Voucher",
    description: "Generate a voucher to start earning commissions",
    icon: ShoppingCart,
    actionLabel: "Create Voucher",
    actionPath: "/partner/dashboard"
  },
  {
    key: "community_joined",
    title: "Join Partner Community",
    description: "Connect with other partners for tips and support",
    icon: Users,
    actionLabel: "Join Community",
    externalLink: "https://t.me/fineearn_partners" // Replace with actual link
  },
  {
    key: "guidelines_read",
    title: "Read Partner Guidelines",
    description: "Understand best practices and program policies",
    icon: BookOpen,
    actionLabel: "Read Guidelines",
    actionPath: "/partner/dashboard"
  }
];

export const PartnerOnboardingChecklist = () => {
  const navigate = useNavigate();
  const { data: onboarding, isLoading } = usePartnerOnboarding();
  const updateStep = useUpdateOnboardingStep();
  const dismissOnboarding = useDismissOnboarding();
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 flex-1">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-6 w-64 mb-2" />
                <Skeleton className="h-4 w-96" />
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-2 w-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 rounded-lg border-2 border-border">
              <div className="flex items-start gap-3">
                <Skeleton className="h-5 w-5 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }
  
  // Don't show if onboarding doesn't exist, is completed, or is dismissed
  if (!onboarding || onboarding.setup_completed || onboarding.dismissed_at) {
    return null;
  }

  const stepsCompleted = Object.values(onboarding.steps_completed).filter(Boolean).length;
  const totalSteps = Object.keys(onboarding.steps_completed).length;
  const progressPercentage = (stepsCompleted / totalSteps) * 100;

  const handleStepAction = async (step: ChecklistStep) => {
    if (step.externalLink) {
      window.open(step.externalLink, '_blank');
      handleMarkComplete(step.key);
    } else if (step.actionPath) {
      navigate(step.actionPath);
    }
  };

  const handleMarkComplete = async (stepKey: string) => {
    try {
      await updateStep.mutateAsync({ step: stepKey, value: true });
      toast.success("Step marked as complete!");
    } catch (error) {
      toast.error("Failed to update step");
      console.error(error);
    }
  };

  const handleDismiss = async () => {
    try {
      await dismissOnboarding.mutateAsync();
      toast.success("Onboarding checklist dismissed");
    } catch (error) {
      toast.error("Failed to dismiss checklist");
      console.error(error);
    }
  };

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Welcome to the Partner Program! 🎉</CardTitle>
              <CardDescription className="mt-1">
                Complete these steps to get started and maximize your earnings
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{stepsCompleted} of {totalSteps} steps completed</span>
            <Badge variant={stepsCompleted === totalSteps ? "default" : "secondary"}>
              {Math.round(progressPercentage)}%
            </Badge>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {ONBOARDING_STEPS.map((step) => {
          const isCompleted = onboarding.steps_completed[step.key];
          const isExpanded = expandedStep === step.key;
          const Icon = step.icon;

          return (
            <div
              key={step.key}
              className={`p-4 rounded-lg border-2 transition-all ${
                isCompleted
                  ? 'border-green-500/30 bg-green-500/5'
                  : 'border-border hover:border-primary/30 bg-card'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 mt-0.5 ${isCompleted ? 'text-green-500' : 'text-muted-foreground'}`}>
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <h4 className={`font-semibold ${isCompleted ? 'text-muted-foreground line-through' : ''}`}>
                        {step.title}
                      </h4>
                    </div>
                    {!isCompleted && (
                      <Button
                        size="sm"
                        onClick={() => handleStepAction(step)}
                        className="flex-shrink-0"
                      >
                        {step.actionLabel}
                      </Button>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground mt-1">
                    {step.description}
                  </p>

                  {!isCompleted && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkComplete(step.key)}
                      disabled={updateStep.isPending}
                      className="mt-2 h-7 text-xs"
                    >
                      Mark as Complete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {stepsCompleted === totalSteps && (
          <div className="mt-4 p-4 bg-primary/10 rounded-lg text-center">
            <p className="font-semibold text-primary">
              🎊 Congratulations! You've completed all onboarding steps!
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              You're all set to start earning commissions as a partner.
            </p>
            <Button
              onClick={handleDismiss}
              className="mt-3"
              size="sm"
            >
              Got It!
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};