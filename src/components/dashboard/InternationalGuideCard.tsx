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
