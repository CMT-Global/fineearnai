import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface QueryErrorBoundaryProps {
  error: Error;
  reset?: () => void;
  customMessage?: string;
}

export const QueryErrorBoundary = ({ error, reset, customMessage }: QueryErrorBoundaryProps) => {
  const isNetworkError = error.message.includes("fetch") || 
                         error.message.includes("network") || 
                         error.message.includes("Failed to fetch");
  const isAuthError = error.message.includes("JWT") || 
                      error.message.includes("auth") || 
                      error.message.includes("Unauthorized") ||
                      error.message.includes("session");

  const getErrorMessage = () => {
    if (customMessage) return customMessage;
    if (isNetworkError) return "Unable to connect to the server. Please check your internet connection and try again.";
    if (isAuthError) return "Your session has expired. Please refresh the page or log in again.";
    return error.message || "An unexpected error occurred. Please try again.";
  };

  const getErrorTitle = () => {
    if (isNetworkError) return "Connection Error";
    if (isAuthError) return "Session Expired";
    return "Error Loading Data";
  };

  return (
    <div className="flex items-center justify-center p-8">
      <Alert variant="destructive" className="max-w-lg">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{getErrorTitle()}</AlertTitle>
        <AlertDescription className="space-y-3">
          <p className="text-sm">{getErrorMessage()}</p>
          {reset && (
            <Button onClick={reset} variant="outline" size="sm" className="mt-2">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
};
