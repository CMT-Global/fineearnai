import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownToLine, ArrowUpFromLine, Sparkles } from "lucide-react";
import { useState } from "react";
import { ProcessorSelectionDialog } from "./ProcessorSelectionDialog";
import { PaymentGuideDialog } from "./PaymentGuideDialog";
import { PAYMENT_GUIDES } from "@/data/payment-guides";
import { PaymentProcessorGuide, GuideType } from "@/types/payment-guides";
import { useBranding } from "@/contexts/BrandingContext";

interface InternationalGuideCardProps {
  title?: string;
  description?: string;
}

export const InternationalGuideCard = ({
  title = "💳 Deposit & Withdrawal Quick Guides",
  description = "Learn how to fund your account and withdraw earnings using various payment methods globally",
}: InternationalGuideCardProps) => {
  const { platformName } = useBranding();
  const [isProcessorSelectionOpen, setIsProcessorSelectionOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [selectedGuideType, setSelectedGuideType] = useState<GuideType>('deposit');
  const [selectedProcessor, setSelectedProcessor] = useState<PaymentProcessorGuide | null>(null);

  // Apply dynamic platform name to guide data
  const dynamicProcessors = PAYMENT_GUIDES.map(p => ({
    ...p,
    description: p.description.replace(/\{\{platform\}\}/g, platformName),
    depositSteps: p.depositSteps.map(s => ({
      ...s,
      instruction: s.instruction.replace(/\{\{platform\}\}/g, platformName),
      highlights: s.highlights.map(h => h.replace(/\{\{platform\}\}/g, platformName))
    })),
    withdrawalSteps: p.withdrawalSteps.map(s => ({
      ...s,
      instruction: s.instruction.replace(/\{\{platform\}\}/g, platformName),
      highlights: s.highlights.map(h => h.replace(/\{\{platform\}\}/g, platformName))
    })),
    depositAlertMessage: p.depositAlertMessage?.replace(/\{\{platform\}\}/g, platformName),
    withdrawalAlertMessage: p.withdrawalAlertMessage?.replace(/\{\{platform\}\}/g, platformName)
  }));

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
            {title}
            <Badge variant="outline" className="text-xs animate-fade-in">Worldwide</Badge>
          </CardTitle>
          <CardDescription>
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Deposit Card */}
            <Card 
              className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border-2 border-green-500/20 hover:border-primary bg-card/50 hover:bg-card focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2"
              onClick={handleDepositClick}
            >
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-2 p-3 bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <ArrowDownToLine className="h-8 w-8 text-primary transition-transform duration-300 group-hover:translate-y-1" />
                </div>
                <CardTitle className="text-xl transition-colors duration-200 group-hover:text-primary">
                  💸 How to Deposit
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Fund your account using multiple payment methods
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Badge variant="secondary" className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 group-hover:shadow-md">
                  Click to View Options
                </Badge>
              </CardContent>
            </Card>

            {/* Withdraw Card */}
            <Card 
              className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border-2 border-blue-500/20 hover:border-blue-500 bg-card/50 hover:bg-card focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2"
              onClick={handleWithdrawClick}
            >
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-2 p-3 bg-blue-500/10 rounded-full w-16 h-16 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <ArrowUpFromLine className="h-8 w-8 text-blue-500 transition-transform duration-300 group-hover:-translate-y-1" />
                </div>
                <CardTitle className="text-xl transition-colors duration-200 group-hover:text-blue-500">
                  💰 How to Withdraw
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Cash out earnings using multiple withdrawal methods
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Badge variant="secondary" className="bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200 group-hover:shadow-md group-hover:scale-105">
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
        processors={dynamicProcessors}
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
