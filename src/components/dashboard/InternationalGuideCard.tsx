import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownToLine, ArrowUpFromLine, Sparkles, ArrowRight } from "lucide-react";
import { useState } from "react";
import { ProcessorSelectionDialog } from "./ProcessorSelectionDialog";
import { PaymentGuideDialog } from "./PaymentGuideDialog";
import { PAYMENT_GUIDES } from "@/data/payment-guides";
import { PaymentProcessorGuide, GuideType } from "@/types/payment-guides";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { getRecommendedProcessors, getBadgeConfig } from "@/lib/payment-processor-recommendations";

export const InternationalGuideCard = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const [isProcessorSelectionOpen, setIsProcessorSelectionOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [selectedGuideType, setSelectedGuideType] = useState<GuideType>('deposit');
  const [selectedProcessor, setSelectedProcessor] = useState<PaymentProcessorGuide | null>(null);

  // Get user's country (prioritize registration country, fallback to country field)
  const userCountry = profile?.registration_country || profile?.country || null;
  
  // Get top 3 recommended processors
  const recommendations = getRecommendedProcessors(PAYMENT_GUIDES, userCountry, 3);

  const handleDepositClick = () => {
    setSelectedGuideType('deposit');
    setIsProcessorSelectionOpen(true);
  };

  const handleWithdrawClick = () => {
    setSelectedGuideType('withdrawal');
    setIsProcessorSelectionOpen(true);
  };

  const handleProcessorSelect = (processor: PaymentProcessorGuide) => {
    setSelectedProcessor(processor);
    setIsProcessorSelectionOpen(false);
    setIsGuideOpen(true);
  };

  return (
    <>
      <Card className="w-full animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500 animate-pulse" />
            💳 Deposit & Withdrawal Quick Guides
            <Badge variant="outline" className="text-xs animate-fade-in">Worldwide</Badge>
          </CardTitle>
          <CardDescription>
            Learn how to fund your account and withdraw earnings using various payment methods globally
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Recommended Processors Section */}
          {recommendations.length > 0 && (
            <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border border-primary/20 animate-fade-in">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                <h4 className="font-semibold text-foreground">Recommended for You</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {recommendations.map((rec, index) => (
                  <button
                    key={rec.processor.id}
                    onClick={() => {
                      setSelectedProcessor(rec.processor);
                      setSelectedGuideType('deposit');
                      setIsGuideOpen(true);
                    }}
                    className="group relative p-3 rounded-lg bg-card border border-border hover:border-primary/50 transition-all duration-300 text-left hover:shadow-lg"
                  >
                    {/* Rank Badge */}
                    {index === 0 && (
                      <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-scale-in">
                        #1
                      </div>
                    )}
                    
                    <div className="flex items-start gap-3 mb-2">
                      <span className="text-2xl">{rec.processor.flag}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                          {rec.processor.displayName}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {rec.processor.countryName}
                        </div>
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {rec.badges.slice(0, 2).map((badge) => {
                        const config = getBadgeConfig(badge);
                        return (
                          <Badge 
                            key={badge} 
                            variant="outline" 
                            className={`text-xs ${config.color} border`}
                          >
                            {config.icon} {config.label}
                          </Badge>
                        );
                      })}
                    </div>

                    {/* Top Reason */}
                    {rec.reasons[0] && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {rec.reasons[0]}
                      </p>
                    )}

                    <ArrowRight className="absolute bottom-3 right-3 h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Based on your location and transaction preferences
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Deposit Card */}
            <Card 
              className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border-2 hover:border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 focus-within:ring-2 focus-within:ring-green-400 focus-within:ring-offset-2"
              onClick={handleDepositClick}
            >
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-2 p-3 bg-green-100 dark:bg-green-900/30 rounded-full w-16 h-16 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <ArrowDownToLine className="h-8 w-8 text-green-600 dark:text-green-400 transition-transform duration-300 group-hover:translate-y-1" />
                </div>
                <CardTitle className="text-xl transition-colors duration-200 group-hover:text-green-600 dark:group-hover:text-green-400">
                  💸 How to Deposit
                </CardTitle>
                <CardDescription className="text-sm">
                  Fund your account using multiple payment methods
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Badge variant="secondary" className="bg-green-600 hover:bg-green-700 text-white transition-all duration-200 group-hover:shadow-md">
                  Click to View Options
                </Badge>
              </CardContent>
            </Card>

            {/* Withdraw Card */}
            <Card 
              className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border-2 hover:border-blue-400 bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/20 dark:to-sky-950/20 focus-within:ring-2 focus-within:ring-blue-400 focus-within:ring-offset-2"
              onClick={handleWithdrawClick}
            >
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-2 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full w-16 h-16 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <ArrowUpFromLine className="h-8 w-8 text-blue-600 dark:text-blue-400 transition-transform duration-300 group-hover:-translate-y-1" />
                </div>
                <CardTitle className="text-xl transition-colors duration-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  💰 How to Withdraw
                </CardTitle>
                <CardDescription className="text-sm">
                  Cash out earnings using multiple withdrawal methods
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Badge variant="secondary" className="bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 group-hover:shadow-md">
                  Click to View Options
                </Badge>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Processor Selection Dialog */}
      <ProcessorSelectionDialog
        open={isProcessorSelectionOpen}
        onOpenChange={setIsProcessorSelectionOpen}
        type={selectedGuideType}
        processors={PAYMENT_GUIDES}
        onProcessorSelect={handleProcessorSelect}
      />

      {/* Payment Guide Dialog */}
      <PaymentGuideDialog
        open={isGuideOpen}
        onOpenChange={setIsGuideOpen}
        processor={selectedProcessor}
        type={selectedGuideType}
      />
    </>
  );
};
