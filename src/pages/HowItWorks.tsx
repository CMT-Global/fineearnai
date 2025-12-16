import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCurrencyConversion } from "@/hooks/useCurrencyConversion";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useDashboardData } from "@/hooks/useDashboardData";
import { PageLayout } from "@/components/layout/PageLayout";
import {
  Sparkles,
  DollarSign,
  ListChecks,
  Calendar,
  Wallet,
  TrendingUp,
  Users,
  Rocket,
  X,
  Info
} from "lucide-react";

const HowItWorks = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [showBanner, setShowBanner] = useState(
    localStorage.getItem("howItWorksBannerDismissed") !== "true"
  );
  const navigate = useNavigate();
  const { formatAmount } = useCurrencyConversion();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { data } = useDashboardData(user?.id);
  const { profile } = data || {};

  const totalSteps = 8;

  // Step-specific color themes with gradients
  const stepThemes: Record<number, { gradient: string; bg: string }> = {
    1: { gradient: "from-blue-500 to-cyan-500", bg: "bg-gradient-to-br from-blue-500 to-cyan-500" },
    2: { gradient: "from-green-500 to-emerald-500", bg: "bg-gradient-to-br from-green-500 to-emerald-500" },
    3: { gradient: "from-purple-500 to-pink-500", bg: "bg-gradient-to-br from-purple-500 to-pink-500" },
    4: { gradient: "from-orange-500 to-amber-500", bg: "bg-gradient-to-br from-orange-500 to-amber-500" },
    5: { gradient: "from-teal-500 to-cyan-500", bg: "bg-gradient-to-br from-teal-500 to-cyan-500" },
    6: { gradient: "from-indigo-500 to-purple-500", bg: "bg-gradient-to-br from-indigo-500 to-purple-500" },
    7: { gradient: "from-rose-500 to-pink-500", bg: "bg-gradient-to-br from-rose-500 to-pink-500" },
    8: { gradient: "from-violet-500 to-fuchsia-500", bg: "bg-gradient-to-br from-violet-500 to-fuchsia-500" }
  };

  const dismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem("howItWorksBannerDismissed", "true");
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleGoToDashboard = () => {
    navigate("/dashboard");
  };

  const steps = [
    {
      id: 1,
      icon: Sparkles,
      title: "What Is ProfitChips?",
      subtitle: "Your Gateway to Earning with AI",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            ProfitChips is a revolutionary platform that connects you with AI training tasks, 
            enabling you to earn real money by contributing to the advancement of artificial intelligence.
          </p>
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
            <h4 className="font-semibold text-primary">Why ProfitChips?</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>No specialized skills required - just basic comprehension and attention to detail</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Work from anywhere with an internet connection</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Flexible hours - work at your own pace</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Transparent earnings and straightforward payment system</span>
              </li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 2,
      icon: DollarSign,
      title: "How You Earn",
      subtitle: "Simple Tasks, Real Rewards",
      content: (
        <div className="space-y-4">
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground mb-2">Earning Potential</p>
            <p className="text-3xl font-bold text-green-600 mb-1">
              Up to {formatAmount(240)}
            </p>
            <p className="text-xs text-muted-foreground">per week with an upgraded account</p>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Every task you complete correctly earns you money that goes directly into your earnings wallet. 
            Your earning rate depends on your membership plan.
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm font-semibold text-primary">1</span>
              </div>
              <div>
                <h5 className="font-medium mb-1">Complete AI Tasks</h5>
                <p className="text-sm text-muted-foreground">Review AI responses and select the best answer</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm font-semibold text-primary">2</span>
              </div>
              <div>
                <h5 className="font-medium mb-1">Earn Instantly</h5>
                <p className="text-sm text-muted-foreground">Get paid immediately for correct answers</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm font-semibold text-primary">3</span>
              </div>
              <div>
                <h5 className="font-medium mb-1">Withdraw Weekly</h5>
                <p className="text-sm text-muted-foreground">Cash out your earnings on designated payout days</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 3,
      icon: ListChecks,
      title: "Types of Tasks",
      subtitle: "Variety of AI Microtasks",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            ProfitChips offers diverse AI training tasks that help improve machine learning models. 
            Each task is simple but contributes to advancing AI technology.
          </p>
          <div className="grid gap-3">
            <div className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
              <h5 className="font-semibold mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                Chatbot Training
              </h5>
              <p className="text-sm text-muted-foreground">
                Evaluate AI responses to conversations and select the most natural, helpful answers.
              </p>
            </div>
            <div className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
              <h5 className="font-semibold mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                Sentiment Analysis
              </h5>
              <p className="text-sm text-muted-foreground">
                Review text snippets and help AI understand human emotions and opinions accurately.
              </p>
            </div>
            <div className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
              <h5 className="font-semibold mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                Content Classification
              </h5>
              <p className="text-sm text-muted-foreground">
                Categorize and label content to help AI learn to organize information effectively.
              </p>
            </div>
            <div className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
              <h5 className="font-semibold mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                Data Quality Review
              </h5>
              <p className="text-sm text-muted-foreground">
                Validate AI-generated responses for accuracy, relevance, and appropriateness.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 4,
      icon: Calendar,
      title: "When You Get Paid",
      subtitle: "Real-Time Tracking & Weekly Payouts",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            Your earnings are tracked in real-time and available for withdrawal on designated payout days. 
            Watch your wallet grow with every completed task!
          </p>
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Task Completed</span>
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                Instant Credit
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Earnings Updated</span>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                Real-Time
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Withdrawal Available</span>
              <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20">
                Weekly
              </Badge>
            </div>
          </div>
          <div className="border-l-4 border-primary pl-4 py-2">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Pro Tip:</strong> Complete more tasks daily to maximize 
              your weekly earnings. Higher-tier membership plans offer increased daily task limits and 
              higher earnings per task.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 5,
      icon: Wallet,
      title: "Withdrawals",
      subtitle: "Easy & Convenient Cashouts",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            Withdrawing your earnings is simple and secure. Choose from multiple payment methods 
            and receive your money quickly.
          </p>
          <div className="space-y-3">
            <div className="bg-muted/50 rounded-lg p-4">
              <h5 className="font-semibold mb-2 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                Minimum Withdrawal
              </h5>
              <p className="text-sm text-muted-foreground">
                Varies by membership plan - Free accounts may have higher minimums while 
                premium plans enjoy lower thresholds.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <h5 className="font-semibold mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Payout Schedule
              </h5>
              <p className="text-sm text-muted-foreground">
                Withdrawals are processed on designated days each week. Check your dashboard 
                for the next available withdrawal date.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <h5 className="font-semibold mb-2 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                Payment Methods
              </h5>
              <p className="text-sm text-muted-foreground">
                Multiple secure payment options available including cryptocurrency (USDT) 
                and other payment processors configured by our platform.
              </p>
            </div>
          </div>
          <Alert className="bg-yellow-500/10 border-yellow-500/20">
            <Info className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-sm text-muted-foreground">
              Always double-check your withdrawal address before confirming. Cryptocurrency 
              transactions are irreversible.
            </AlertDescription>
          </Alert>
        </div>
      ),
    },
    {
      id: 6,
      icon: TrendingUp,
      title: "Upgrading Your Account",
      subtitle: "Boost Your Earning Potential",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            Upgrade your membership to unlock higher earnings, more daily tasks, and exclusive benefits. 
            Invest in your earning potential today!
          </p>
          <div className="grid gap-3">
            <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="bg-blue-500/20 text-blue-600">Personal</Badge>
              </div>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="text-blue-600">✓</span>
                  Increased daily task limits
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-600">✓</span>
                  Higher earnings per task
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-600">✓</span>
                  Lower withdrawal minimums
                </li>
              </ul>
            </div>
            <div className="bg-gradient-to-r from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="bg-purple-500/20 text-purple-600">Business</Badge>
              </div>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="text-purple-600">✓</span>
                  Maximum daily task capacity
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-600">✓</span>
                  Premium earnings rate
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-600">✓</span>
                  Higher daily withdrawal limits
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-600">✓</span>
                  Enhanced referral commissions
                </li>
              </ul>
            </div>
            <div className="bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="bg-amber-500/20 text-amber-600">Group</Badge>
              </div>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="text-amber-600">✓</span>
                  Ultimate task limits
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-600">✓</span>
                  Highest earnings per task
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-600">✓</span>
                  Maximum withdrawal flexibility
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-600">✓</span>
                  Top-tier referral benefits
                </li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 7,
      icon: Users,
      title: "Invite & Earn",
      subtitle: "Build Your Team",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            Grow your income by referring others to ProfitChips. Earn commissions from your referrals' 
            activities and build a sustainable passive income stream.
          </p>
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
            <h5 className="font-semibold text-primary">Referral Benefits:</h5>
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Task Commission</p>
                  <p className="text-xs text-muted-foreground">
                    Earn a percentage of your referrals' task earnings
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Deposit Bonus</p>
                  <p className="text-xs text-muted-foreground">
                    Get rewarded when your referrals upgrade their accounts
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Unlimited Network</p>
                  <p className="text-xs text-muted-foreground">
                    Build a team of active earners (limits vary by plan)
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="border-l-4 border-primary pl-4 py-2">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Share Your Link:</strong> Use your unique referral 
              code to invite friends, family, and your network. Track all your referrals and earnings 
              from the Referrals page.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 8,
      icon: Rocket,
      title: "Ready to Start?",
      subtitle: "Begin Your Journey",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground leading-relaxed text-center">
            You're all set! Head to your dashboard to start completing tasks and earning money. 
            Remember to check out the membership plans to maximize your earning potential.
          </p>
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/20 rounded-lg p-6 text-center space-y-4">
            <Rocket className="w-16 h-16 mx-auto text-primary" />
            <div>
              <h4 className="text-xl font-bold mb-2">Start Earning Today!</h4>
              <p className="text-sm text-muted-foreground">
                Complete your first task and watch your earnings grow. The AI revolution needs your help!
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <ListChecks className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium">Complete Tasks</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium">Track Earnings</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <Wallet className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium">Withdraw Weekly</p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const currentStepData = steps[currentStep - 1];
  const Icon = currentStepData.icon;
  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <PageLayout profile={profile} isAdmin={isAdmin} onSignOut={signOut}>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-8 px-4">
        <div className="container max-w-4xl mx-auto">
          {showBanner && (
            <Alert className="mb-6 bg-blue-500/10 border-blue-500/20 shadow-sm">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">
                  Take a quick tour to learn how ProfitChips works and start earning today!
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={dismissBanner}
                  className="flex-shrink-0 h-6 w-6 p-0 hover:bg-blue-500/20"
                >
                  <X className="h-4 w-4" />
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Card className="shadow-xl overflow-hidden rounded-xl bg-card">
          {/* Colored Header Section */}
          <div className={`${stepThemes[currentStep].bg} text-white p-8 md:p-10`}>
            {/* Large Icon Circle */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                <Icon className="w-8 h-8 md:w-10 md:h-10 text-white" />
              </div>
            </div>
            
            {/* Title & Subtitle */}
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">{currentStepData.title}</h2>
            <p className="text-white/90 text-center text-base md:text-lg">{currentStepData.subtitle}</p>
          </div>

          {/* Content Section */}
          <CardContent className="p-8 md:p-10 space-y-6 bg-card">
            <div className="mb-6">
              <Progress value={progressPercentage} className="h-2" />
              <p className="text-center text-sm text-muted-foreground mt-2">
                Step {currentStep} of {totalSteps}
              </p>
            </div>
            
            <div className="min-h-[300px] sm:min-h-[400px]">
              {currentStepData.content}
            </div>

            <div className="flex items-center justify-between gap-4 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className="min-w-[100px]"
              >
                Previous
              </Button>

              {currentStep < totalSteps ? (
                <Button onClick={handleNext} className="min-w-[100px]">
                  Next
                </Button>
              ) : (
                <Button onClick={handleGoToDashboard} className="min-w-[140px]">
                  Go To Dashboard
                </Button>
              )}
            </div>

            {/* Circular Step Indicator Dots */}
            <div className="flex justify-center items-center gap-2 pt-6">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
                <button
                  key={step}
                  onClick={() => {
                    setCurrentStep(step);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    step === currentStep
                      ? `${stepThemes[currentStep].bg} scale-125`
                      : step < currentStep
                      ? "bg-primary/60"
                      : "bg-gray-300"
                  }`}
                  aria-label={`Go to step ${step}`}
                />
              ))}
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </PageLayout>
  );
};

export default HowItWorks;
