import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Mail, AlertTriangle } from "lucide-react";

interface EmailVerificationBannerProps {
  onVerifyClick: () => void;
}

export const EmailVerificationBanner = ({ onVerifyClick }: EmailVerificationBannerProps) => {
  return (
    <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-900 dark:text-amber-100">
        Email Verification Required
      </AlertTitle>
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-amber-800 dark:text-amber-200">
        <span>
          Please verify your email address to unlock all features and ensure account security.
        </span>
        <Button 
          size="sm" 
          onClick={onVerifyClick}
          className="bg-amber-600 hover:bg-amber-700 text-white flex-shrink-0"
        >
          <Mail className="h-4 w-4 mr-2" />
          Verify Email
        </Button>
      </AlertDescription>
    </Alert>
  );
};
