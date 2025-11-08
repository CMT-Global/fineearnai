import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaymentProcessorGuide, GuideType } from "@/types/payment-guides";
import { ArrowDownToLine, ArrowUpFromLine, Globe, Smartphone, Building2, Wallet, Sparkles } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { getProcessorRecommendation, getBadgeConfig } from "@/lib/payment-processor-recommendations";

interface ProcessorSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: GuideType;
  processors: PaymentProcessorGuide[];
  onProcessorSelect: (processor: PaymentProcessorGuide) => void;
}

const getCategoryIcon = (category: PaymentProcessorGuide['category']) => {
  switch (category) {
    case 'mobile_wallet':
      return <Smartphone className="h-4 w-4" />;
    case 'exchange':
      return <Globe className="h-4 w-4" />;
    case 'bank':
      return <Building2 className="h-4 w-4" />;
    case 'crypto_wallet':
      return <Wallet className="h-4 w-4" />;
    default:
      return <Wallet className="h-4 w-4" />;
  }
};

const getCategoryLabel = (category: PaymentProcessorGuide['category']) => {
  switch (category) {
    case 'mobile_wallet':
      return 'Mobile Wallet';
    case 'exchange':
      return 'Exchange';
    case 'bank':
      return 'Bank';
    case 'crypto_wallet':
      return 'Crypto Wallet';
    default:
      return 'Wallet';
  }
};

export const ProcessorSelectionDialog = ({
  open,
  onOpenChange,
  type,
  processors,
  onProcessorSelect
}: ProcessorSelectionDialogProps) => {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const isDeposit = type === 'deposit';
  const icon = isDeposit ? <ArrowDownToLine className="h-5 w-5" /> : <ArrowUpFromLine className="h-5 w-5" />;
  const colorClass = isDeposit ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400';
  const bgClass = isDeposit ? 'bg-green-50 dark:bg-green-950/20' : 'bg-blue-50 dark:bg-blue-950/20';
  const borderClass = isDeposit ? 'border-green-200 dark:border-green-800' : 'border-blue-200 dark:border-blue-800';
  const hoverBorderClass = isDeposit ? 'hover:border-green-400' : 'hover:border-blue-400';

  // Get user's country for recommendations
  const userCountry = profile?.registration_country || profile?.country || null;
  
  // Calculate recommendations for each processor
  const processorsWithRecommendations = processors.map(processor => ({
    processor,
    recommendation: getProcessorRecommendation(processor, userCountry)
  })).sort((a, b) => b.recommendation.score - a.recommendation.score); // Sort by score

  // Separate P2P guide from regular processors
  const p2pGuide = processors.find(p => p.id === 'binance-p2p-fiat');
  const regularProcessors = processorsWithRecommendations.filter(
    ({ processor }) => processor.id !== 'binance-p2p-fiat'
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl animate-fade-in">
            {icon}
            {isDeposit ? 'Select Deposit Method' : 'Select Withdrawal Method'}
          </DialogTitle>
          <DialogDescription className="animate-fade-in">
            Choose a payment processor to view the step-by-step guide
          </DialogDescription>
        </DialogHeader>

        {/* Binance P2P Guide - Prominent Section */}
        {p2pGuide && (
          <div className="mb-4 animate-fade-in">
            <Card 
              className={`cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.01] border-2 ${
                isDeposit ? 'border-green-300 dark:border-green-700' : 'border-blue-300 dark:border-blue-700'
              } ${bgClass}`}
              onClick={() => onProcessorSelect(p2pGuide)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">🌍</span>
                      <CardTitle className={`text-lg ${colorClass}`}>
                        {isDeposit ? '💵 Buy Crypto with Bank/Mobile Money' : '💰 Sell Crypto for Cash'}
                      </CardTitle>
                    </div>
                    <CardDescription className="text-sm">
                      {isDeposit 
                        ? 'Learn how to buy cryptocurrency using your local bank or mobile money via Binance P2P - works worldwide!' 
                        : 'Learn how to convert your crypto earnings to cash in your bank or mobile money via Binance P2P'}
                    </CardDescription>
                  </div>
                  <Badge variant="default" className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
                    Beginner Friendly
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge className={`${isDeposit ? 'bg-green-600' : 'bg-blue-600'} text-white`}>
                    View Complete Guide →
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {isDeposit ? '9 easy steps' : '8 easy steps'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2 scroll-smooth">
          {regularProcessors.map(({ processor, recommendation }, index) => {
            const isTopRecommendation = index === 0 && recommendation.score >= 100;
            
            return (
              <Card
                key={processor.id}
                className={`group cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border-2 ${
                  isTopRecommendation 
                    ? 'border-primary/50 hover:border-primary' 
                    : `${hoverBorderClass} ${bgClass}`
                } focus-within:ring-2 focus-within:ring-offset-2 animate-fade-in relative`}
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => onProcessorSelect(processor)}
              >
                {/* Top Recommendation Badge */}
                {isTopRecommendation && (
                  <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold rounded-full px-2 py-1 flex items-center gap-1 shadow-lg z-10 animate-scale-in">
                    <Sparkles className="h-3 w-3" />
                    Best Match
                  </div>
                )}

                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-3xl" role="img" aria-label={processor.countryName}>
                        {processor.flag}
                      </span>
                      <div>
                        <CardTitle className={`text-lg ${colorClass} transition-colors duration-200`}>
                          {processor.displayName}
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {processor.countryName}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="flex items-center gap-1 text-xs">
                      {getCategoryIcon(processor.category)}
                      {getCategoryLabel(processor.category)}
                    </Badge>
                  </div>

                  {/* Recommendation Badges */}
                  {recommendation.badges.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {recommendation.badges.map((badge) => {
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
                  )}
                </CardHeader>
                <CardContent>
                  {/* Show top recommendation reason or description */}
                  <p className="text-sm text-muted-foreground">
                    {recommendation.reasons[0] || processor.description}
                  </p>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <Badge 
                      variant="secondary" 
                      className={`${isDeposit ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white transition-all duration-200 group-hover:shadow-md text-xs`}
                    >
                      View Guide →
                    </Badge>
                    {processor.isGlobal && (
                      <Badge variant="outline" className="text-xs">
                        <Globe className="h-3 w-3 mr-1" />
                        Global
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
