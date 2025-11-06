import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Zap, 
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Shield,
  Wallet,
  Phone,
  Ticket,
  Globe,
  Heart,
  MessageCircle,
  BadgeCheck
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";

interface PartnerWizardProps {
  open: boolean;
  onComplete: () => void;
  onClose: () => void;
}

const steps = [
  {
    title: "Unlock Your Earning Potential",
    icon: Sparkles,
    content: (
      <div className="space-y-6 text-center">
        <div className="mx-auto w-20 h-20 bg-gradient-to-br from-primary to-purple-600 rounded-full flex items-center justify-center">
          <Sparkles className="h-10 w-10 text-white" />
        </div>
        <h2 className="text-3xl font-bold">Become a FineEarn Local Partner</h2>
        <p className="text-lg text-muted-foreground">
          Become a Local Partner in your country and start earning an average of{" "}
          <span className="inline-flex flex-wrap items-baseline gap-1">
            <CurrencyDisplay 
              amountUSD={1400} 
              className="font-bold text-primary"
              showTooltip={true}
            />
            <span className="text-xs text-muted-foreground">($1,400)</span>
            <span className="font-bold text-primary">weekly</span>
          </span>{" "}
          by helping people in your community learn more about FineEarn & upgrade their accounts with local support.
        </p>
        <div className="grid grid-cols-3 gap-4 pt-4">
          <Card className="border-primary/20">
            <CardContent className="pt-6 text-center">
              <DollarSign className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <p className="text-2xl font-bold">
                <CurrencyDisplay 
                  amountUSD={200} 
                  decimals={0}
                  showTooltip={true}
                />+
              </p>
              <p className="text-xs text-muted-foreground mb-1">($200+)</p>
              <p className="text-sm text-muted-foreground">Daily Average Profit</p>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="pt-6 text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <p className="text-2xl font-bold">10-20%</p>
              <p className="text-sm text-muted-foreground">Commission</p>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="pt-6 text-center">
              <Zap className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <p className="text-2xl font-bold">Instant</p>
              <p className="text-sm text-muted-foreground">Earnings</p>
            </CardContent>
          </Card>
        </div>
      </div>
    ),
  },
  {
    title: "How Regular Users Benefit",
    icon: Users,
    content: (
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold">How Regular Users Benefit</h2>
          <p className="text-lg text-muted-foreground">
            Our FineEarn Partner Network makes it easier than ever for our users to grow and succeed
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="space-y-4">
          {[
            {
              icon: Globe,
              emoji: "🌍",
              title: "Local Payment Options",
              description: "Upgrade your account easily using local payment methods through verified FineEarn Partners in your country."
            },
            {
              icon: Heart,
              emoji: "🤝",
              title: "Personal Support",
              description: "Get direct assistance and step-by-step guidance from your Local Partner whenever you need help."
            },
            {
              icon: MessageCircle,
              emoji: "💬",
              title: "Community Access",
              description: "Join local Telegram & WhatsApp groups managed by our Partners for updates, training, and shared opportunities."
            },
            {
              icon: Zap,
              emoji: "💸",
              title: "Fast & Hassle-Free Upgrades",
              description: "No need for crypto deposits — pay locally through the Authorised partners, and your FineEarn account is upgraded instantly."
            },
            {
              icon: BadgeCheck,
              emoji: "🧭",
              title: "Verified & Trusted Partners",
              description: "All FineEarn Partners are verified to ensure safe, transparent, and reliable transactions."
            },
            {
              icon: TrendingUp,
              emoji: "💪",
              title: "Grow Together",
              description: "Local Partners help you understand how to maximize your earnings and move up faster in FineEarn's earning plans."
            },
          ].map((item, idx) => (
            <div key={idx} className="flex gap-4 p-4 rounded-lg bg-muted/50 border hover:border-primary/20 transition-colors">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center text-2xl">
                {item.emoji}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1 flex items-center gap-2">
                  <item.icon className="h-5 w-5 text-primary" />
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Call-to-Action Footer */}
        <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 p-5 rounded-lg border-2 border-primary/20 text-center">
          <p className="font-bold text-lg mb-2">
            Join thousands of FineEarn users already benefiting from our Partner Network
          </p>
          <p className="text-sm text-muted-foreground">
            Partners make earning and upgrading accessible to everyone, everywhere 🌍
          </p>
        </div>
      </div>
    ),
  },
  {
    title: "What Do Local Partners Do?",
    icon: Users,
    content: (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-center">Your Role is Simple & Profitable</h2>
        <div className="space-y-4">
          {[
            {
              icon: DollarSign,
              title: "Buy Voucher Codes",
              description: "Purchase top-up vouchers at a discounted rate directly from your dashboard using your deposit wallet."
            },
            {
              icon: Users,
              title: "Sell to Your Network",
              description: "Sell Upgrade voucher codes to friends, family, and community members via WhatsApp, Telegram, in-person or on our Platform when users contact you."
            },
            {
              icon: TrendingUp,
              title: "Earn Instant Profit",
              description: "Keep the difference as your commission! No waiting, no complex processes—just pure profit."
            },
          ].map((item, idx) => (
            <div key={idx} className="flex gap-4 p-4 rounded-lg bg-muted/50 border">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <item.icon className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: "How Users Benefit & You Profit",
    icon: RefreshCw,
    content: (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">The Secure Agent Deposit Flow</h2>
          <p className="text-muted-foreground">
            See how users upgrade safely through you while you earn guaranteed profit
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: User Journey */}
          <div className="space-y-4">
            <h3 className="font-semibold text-center text-lg mb-4 text-primary">User's Journey</h3>
            <div className="space-y-3">
              {[
                {
                  icon: Wallet,
                  step: "1",
                  title: "User wants to upgrade",
                  description: "User needs $100 membership upgrade"
                },
                {
                  icon: Phone,
                  step: "2",
                  title: "Clicks 'Deposit via Agent'",
                  description: "Chooses local partner deposit option"
                },
                {
                  icon: DollarSign,
                  step: "3",
                  title: "Sends you cash/mobile money",
                  description: "User transfers $100 to you directly"
                },
                {
                  icon: Ticket,
                  step: "4",
                  title: "You send voucher code",
                  description: "Share the $100 voucher code instantly"
                },
                {
                  icon: CheckCircle,
                  step: "5",
                  title: "Account upgraded!",
                  description: "Deposit wallet credited, user upgrades"
                },
              ].map((item, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                    {item.step}
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2 mb-1">
                      <item.icon className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold text-sm">{item.title}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Partner Profit */}
          <div className="space-y-4">
            <h3 className="font-semibold text-center text-lg mb-4 text-green-600">Your Profit</h3>
            
            {/* Profit Calculation Card */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 p-5 rounded-lg border-2 border-green-200 dark:border-green-800">
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-green-200 dark:border-green-800">
                  <span className="text-sm font-medium">Customer pays you:</span>
                  <div className="text-right">
                    <div className="font-bold text-lg">
                      <CurrencyDisplay amountUSD={100} showTooltip={true} />
                    </div>
                    <div className="text-xs text-muted-foreground">($100)</div>
                  </div>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-green-200 dark:border-green-800">
                  <span className="text-sm font-medium">Your voucher cost:</span>
                  <div className="text-right">
                    <div className="font-bold text-lg text-blue-600">
                      <CurrencyDisplay amountUSD={90} showTooltip={true} />
                    </div>
                    <div className="text-xs text-muted-foreground">($90)</div>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-3 bg-green-600 dark:bg-green-700 -mx-5 -mb-5 px-5 py-4 rounded-b-lg">
                  <span className="font-bold text-white">Your instant profit:</span>
                  <div className="text-right">
                    <div className="font-bold text-2xl text-white">
                      <CurrencyDisplay amountUSD={10} showTooltip={true} className="text-white" />
                    </div>
                    <div className="text-xs text-green-100">($10)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Scale Examples */}
            <div className="space-y-3 pt-2">
              <div className="bg-muted/50 p-4 rounded-lg border">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">10 users per day:</span>
                  <div className="text-right">
                    <div className="font-bold text-lg text-green-600">
                      <CurrencyDisplay amountUSD={100} decimals={0} showTooltip={true} />
                    </div>
                    <div className="text-xs text-muted-foreground">($100/day)</div>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 p-4 rounded-lg border-2 border-green-300 dark:border-green-700">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold">20 users per day:</span>
                  <div className="text-right">
                    <div className="font-bold text-xl text-green-600">
                      <CurrencyDisplay amountUSD={200} decimals={0} showTooltip={true} />
                    </div>
                    <div className="text-xs text-muted-foreground">($200/day)</div>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-muted-foreground">Weekly:</span>
                    <div className="text-right">
                      <div className="font-bold text-sm text-green-600">
                        <CurrencyDisplay amountUSD={1400} decimals={0} showTooltip={true} />
                      </div>
                      <div className="text-xs text-muted-foreground">($1,400)</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Security Badge at Bottom */}
        <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-center sm:text-left">
            <Shield className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-blue-900 dark:text-blue-100">
                🔒 100% Secure: Funds held in escrow & verified instantly
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                No chargebacks • Instant settlement • Protected transactions
              </p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "How You Make Money",
    icon: DollarSign,
    content: (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-center">Crystal Clear Earnings</h2>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 p-6 rounded-lg border-2 border-green-200 dark:border-green-800">
          <h3 className="text-lg font-bold mb-4 text-center">Example: $100 Voucher Sale</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-muted-foreground">Voucher Face Value:</span>
              <div className="text-right">
                <div className="font-bold text-lg">
                  <CurrencyDisplay amountUSD={100} showTooltip={true} />
                </div>
                <div className="text-xs text-muted-foreground">($100.00)</div>
              </div>
            </div>
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-muted-foreground">Your Cost (10% discount):</span>
              <div className="text-right">
                <div className="font-bold text-lg text-blue-600">
                  -<CurrencyDisplay amountUSD={90} showTooltip={true} />
                </div>
                <div className="text-xs text-muted-foreground">(-$90.00)</div>
              </div>
            </div>
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-muted-foreground">You Sell For:</span>
              <div className="text-right">
                <div className="font-bold text-lg">
                  <CurrencyDisplay amountUSD={100} showTooltip={true} />
                </div>
                <div className="text-xs text-muted-foreground">($100.00)</div>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2 bg-green-100 dark:bg-green-900/30 -mx-6 px-6 py-3 rounded-b-lg">
              <span className="font-bold text-lg">Your Profit:</span>
              <div className="text-right">
                <div className="font-bold text-2xl text-green-600">
                  <CurrencyDisplay amountUSD={10} showTooltip={true} />
                </div>
                <div className="text-xs text-muted-foreground">($10.00)</div>
              </div>
            </div>
          </div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-lg">
            Sell just <span className="font-bold text-primary">20 vouchers per day</span> at this rate:
          </p>
          <div className="space-y-1">
            <p className="text-3xl font-bold text-green-600">
              <CurrencyDisplay amountUSD={200} decimals={0} showTooltip={true} />/day = <CurrencyDisplay amountUSD={1400} decimals={0} showTooltip={true} />/week!
            </p>
            <p className="text-sm text-muted-foreground">
              ($200/day = $1,400/week)
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Exclusive Partner Benefits",
    icon: CheckCircle,
    content: (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-center">What You Get as a Partner</h2>
        <div className="grid gap-4">
          {[
            {
              icon: TrendingUp,
              title: "Increasing Commission Rates",
              description: "Earn 10% as Bronze, up to 20% as Platinum. The more you sell, the more you earn per sale!",
              badge: "Up to 20%"
            },
            {
              icon: Zap,
              title: "Instant Commission",
              description: "No waiting periods. Your discount is applied immediately when you purchase vouchers.",
              badge: "Instant"
            },
            {
              icon: Users,
              title: "Marketing Support",
              description: "Get access to promotional materials, templates, and group support from our community.",
              badge: "Free Tools"
            },
            {
              icon: DollarSign,
              title: "Flexible Selling",
              description: "Sell online or offline, to anyone, at any time. You control your business completely.",
              badge: "Your Way"
            },
          ].map((item, idx) => (
            <div key={idx} className="flex gap-4 p-4 rounded-lg bg-muted/50 border hover:border-primary/50 transition-colors">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <item.icon className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-semibold">{item.title}</h3>
                  <Badge variant="secondary" className="ml-2">{item.badge}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: "Ready to Start Earning?",
    icon: Sparkles,
    content: (
      <div className="space-y-6 text-center">
        <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center animate-pulse">
          <CheckCircle className="h-10 w-10 text-white" />
        </div>
        <h2 className="text-3xl font-bold">You're Almost There!</h2>
        <p className="text-lg text-muted-foreground">
          Join our growing network of successful partners earning daily income. Application takes less than 2 minutes.
        </p>
        <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 p-6 rounded-lg border">
          <h3 className="font-bold mb-3">What Happens Next:</h3>
          <div className="space-y-2 text-left">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">1</div>
              <p className="text-sm">Fill out a quick application form</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">2</div>
              <p className="text-sm">Our team reviews within 24 hours</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">3</div>
              <p className="text-sm">Get approved & start buying vouchers instantly</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">4</div>
              <p className="text-sm">Start earning $200+ daily!</p>
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground italic">
          No fees. No hidden costs. Just pure earning potential.
        </p>
      </div>
    ),
  },
];

export const PartnerWizard = ({ open, onComplete, onClose }: PartnerWizardProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const currentStepData = steps[currentStep];
  const StepIcon = currentStepData.icon;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="space-y-6 py-4">
          {/* Progress Indicator */}
          <div className="flex justify-center gap-2">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 rounded-full transition-all ${
                  idx === currentStep 
                    ? 'w-8 bg-primary' 
                    : idx < currentStep 
                    ? 'w-2 bg-primary' 
                    : 'w-2 bg-muted'
                }`}
              />
            ))}
          </div>

          {/* Step Content */}
          <div className="min-h-[400px]">
            {currentStepData.content}
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={currentStep === 0 ? onClose : handleBack}
            >
              {currentStep === 0 ? (
                "Maybe Later"
              ) : (
                <>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </>
              )}
            </Button>
            <Button onClick={handleNext} size="lg" className="min-w-[150px]">
              {currentStep === steps.length - 1 ? (
                <>
                  Apply Now
                  <Sparkles className="h-4 w-4 ml-2" />
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
