import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Mail, Info } from "lucide-react";

interface EmailVerificationBannerProps {
  onVerifyClick: () => void;
}

export const EmailVerificationBanner = ({ onVerifyClick }: EmailVerificationBannerProps) => {
  return (
    <Alert className="bg-card border-border">
      <Info className="h-4 w-4 text-muted-foreground" />
      <AlertTitle className="text-foreground">
        Email Verification Required
      </AlertTitle>
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-muted-foreground">
        <span>
          Please verify your email address to unlock all features and ensure account security.
        </span>
        <Button 
          size="sm" 
          onClick={onVerifyClick}
          className="bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0"
        >
          <Mail className="h-4 w-4 mr-2" />
          Verify Email
        </Button>
      </AlertDescription>
    </Alert>
  );
};
