import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import LandingWelcomeStep from "./onboarding/LandingWelcomeStep";
import LandingHowItWorksStep from "./onboarding/LandingHowItWorksStep";
import LandingTaskTypesStep from "./onboarding/LandingTaskTypesStep";
import LandingEarningPotentialStep from "./onboarding/LandingEarningPotentialStep";
import LandingSubscriptionPlansStep from "./onboarding/LandingSubscriptionPlansStep";
import LandingUpgradingStep from "./onboarding/LandingUpgradingStep";
import LandingReferralProgramStep from "./onboarding/LandingReferralProgramStep";
import LandingWithdrawalStep from "./onboarding/LandingWithdrawalStep";
import LandingWhyTrustUsStep from "./onboarding/LandingWhyTrustUsStep";
import LandingGetStartedStep from "./onboarding/LandingGetStartedStep";

interface OnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STEPS: { title: string; component: React.ComponentType<any> }[] = [
  { title: "Welcome", component: LandingWelcomeStep },
  { title: "How It Works", component: LandingHowItWorksStep },
  { title: "Task Types", component: LandingTaskTypesStep },
  { title: "Earnings", component: LandingEarningPotentialStep },
  { title: "Plans", component: LandingSubscriptionPlansStep },
  { title: "Upgrading", component: LandingUpgradingStep },
  { title: "Referrals", component: LandingReferralProgramStep },
  { title: "Withdrawals", component: LandingWithdrawalStep },
  { title: "Trust", component: LandingWhyTrustUsStep },
  { title: "Get Started", component: LandingGetStartedStep },
];

const OnboardingWizard = ({ open, onOpenChange }: OnboardingWizardProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    // Close the wizard and potentially redirect to signup
    onOpenChange(false);
    setCurrentStep(0);
    // Could add navigation to signup page here
  };

  const handleClose = () => {
    onOpenChange(false);
    setCurrentStep(0);
  };

  const CurrentStepComponent = STEPS[currentStep].component;
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0 gap-0 bg-background border-border" hideCloseButton>
        <DialogTitle className="sr-only">Onboarding Wizard - {STEPS[currentStep].title}</DialogTitle>
        
        {/* Header with Progress */}
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {STEPS.length}
            </span>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="flex gap-1">
            {STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  index < currentStep
                    ? "bg-primary"
                    : index === currentStep
                    ? "bg-primary/70"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Step Indicators */}
          <div className="hidden sm:flex justify-between mt-3 overflow-x-auto">
            {STEPS.map((step, index) => (
              <div
                key={index}
                className={`flex flex-col items-center min-w-[60px] ${
                  index === currentStep ? "opacity-100" : "opacity-50"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                    index < currentStep
                      ? "bg-primary text-primary-foreground"
                      : index === currentStep
                      ? "bg-primary/20 text-primary border border-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {index < currentStep ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    index + 1
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {isLastStep ? (
            <LandingGetStartedStep onComplete={handleComplete} />
          ) : (
            <CurrentStepComponent onComplete={handleComplete} />
          )}
        </div>

        {/* Footer Navigation */}
        {!isLastStep && (
          <div className="p-4 border-t border-border/50 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>

            <button
              onClick={() => {
                setCurrentStep(STEPS.length - 1);
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip to Sign Up
            </button>

            <Button onClick={handleNext} className="gap-2">
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingWizard;
