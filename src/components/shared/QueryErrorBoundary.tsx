import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface QueryErrorBoundaryProps {
  error: Error;
  reset?: () => void;
}

export const QueryErrorBoundary = ({ error, reset }: QueryErrorBoundaryProps) => {
  const isNetworkError = error.message.includes("fetch") || error.message.includes("network");
  const isAuthError = error.message.includes("JWT") || error.message.includes("auth");

  return (
    <div className="flex items-center justify-center p-8">
      <Alert variant="destructive" className="max-w-lg">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>
          {isNetworkError && "Network Error"}
          {isAuthError && "Authentication Error"}
          {!isNetworkError && !isAuthError && "Error Loading Data"}
        </AlertTitle>
        <AlertDescription className="space-y-3">
          <p className="text-sm">
            {isNetworkError && "Unable to connect to the server. Please check your internet connection."}
            {isAuthError && "Your session has expired. Please log in again."}
            {!isNetworkError && !isAuthError && error.message}
          </p>
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
