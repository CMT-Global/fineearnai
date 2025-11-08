import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PaymentProcessorGuide, GuideType } from "@/types/payment-guides";
import { CheckCircle2 } from "lucide-react";

interface PaymentGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processor: PaymentProcessorGuide | null;
  type: GuideType;
}

export const PaymentGuideDialog = ({
  open,
  onOpenChange,
  processor,
  type
}: PaymentGuideDialogProps) => {
  if (!processor) return null;

  const isDeposit = type === 'deposit';
  const steps = isDeposit ? processor.depositSteps : processor.withdrawalSteps;
  const alertMessage = isDeposit ? processor.depositAlertMessage : processor.withdrawalAlertMessage;
  
  const colorClass = isDeposit ? 'text-green-700 dark:text-green-300' : 'text-blue-700 dark:text-blue-300';
  const bgClass = isDeposit ? 'bg-green-100 dark:bg-green-900/30' : 'bg-blue-100 dark:bg-blue-900/30';
  const stepBgClass = isDeposit ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400';
  const hoverBgClass = isDeposit ? 'hover:bg-green-50/50 dark:hover:bg-green-950/10' : 'hover:bg-blue-50/50 dark:hover:bg-blue-950/10';
  const badgeBgClass = isDeposit ? 'bg-green-600 hover:bg-green-600' : 'bg-blue-600 hover:bg-blue-600';
  const alertBgClass = isDeposit ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800';
  const alertTextClass = isDeposit ? 'text-green-800 dark:text-green-200' : 'text-blue-800 dark:text-blue-200';
  const alertIconClass = isDeposit ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400';

  const renderStepText = (instruction: string, highlights: string[]) => {
    if (highlights.length === 0) {
      return <span className="text-sm leading-relaxed">{instruction}</span>;
    }

    let parts: (string | JSX.Element)[] = [instruction];
    
    highlights.forEach((highlight, index) => {
      const newParts: (string | JSX.Element)[] = [];
      parts.forEach(part => {
        if (typeof part === 'string') {
          const splitParts = part.split(highlight);
          splitParts.forEach((splitPart, i) => {
            newParts.push(splitPart);
            if (i < splitParts.length - 1) {
              newParts.push(
                <strong key={`${index}-${i}`} className={colorClass}>
                  {highlight}
                </strong>
              );
            }
          });
        } else {
          newParts.push(part);
        }
      });
      parts = newParts;
    });

    return <p className="text-sm leading-relaxed">{parts}</p>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-2xl animate-fade-in">
            {isDeposit ? '💸' : '💰'} How to {isDeposit ? 'Deposit' : 'Withdraw'} {isDeposit ? 'Using' : 'to'} {processor.displayName}
            <Badge variant="default" className={`${badgeBgClass} animate-fade-in`}>
              {processor.flag} {processor.countryName}
            </Badge>
          </DialogTitle>
          <DialogDescription className="animate-fade-in">
            Follow these simple steps to {isDeposit ? 'deposit funds using' : 'withdraw your earnings to'} {processor.displayName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 scroll-smooth">
          {steps.map((step) => (
            <div
              key={step.stepNumber}
              className={`flex gap-3 animate-fade-in ${hoverBgClass} p-2 rounded-lg transition-colors duration-200`}
              style={{ animationDelay: step.delay || '0s' }}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full ${bgClass} ${stepBgClass} font-bold flex items-center justify-center shadow-sm`}>
                {step.stepNumber}
              </div>
              <div className="flex-1 pt-1">
                {renderStepText(step.instruction, step.highlights)}
              </div>
            </div>
          ))}

          {alertMessage && (
            <Alert 
              className={`${alertBgClass} animate-fade-in shadow-sm`}
              style={{ animationDelay: `${steps.length * 0.1}s` }}
            >
              <CheckCircle2 className={`h-4 w-4 ${alertIconClass} animate-pulse`} />
              <AlertDescription className={`${alertTextClass} font-semibold text-sm`}>
                {alertMessage}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
