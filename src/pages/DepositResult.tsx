import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

const DepositResult = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const status = searchParams.get("deposit");

  useEffect(() => {
    // Auto-redirect after 10 seconds
    const timer = setTimeout(() => {
      navigate("/wallet");
    }, 10000);

    return () => clearTimeout(timer);
  }, [navigate]);

  const isSuccess = status === "success";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {isSuccess ? (
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
            ) : status === "failed" ? (
              <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                <XCircle className="h-10 w-10 text-red-600" />
              </div>
            ) : (
              <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
                <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl">
            {isSuccess
              ? "Deposit Successful!"
              : status === "failed"
              ? "Deposit Failed"
              : "Processing Deposit"}
          </CardTitle>
          <CardDescription>
            {isSuccess
              ? "Your deposit has been processed successfully. Your balance will be updated shortly."
              : status === "failed"
              ? "We couldn't process your deposit. Please try again or contact support."
              : "Your deposit is being processed. This may take a few minutes."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                <strong>Next Steps:</strong>
                <br />
                • Check your deposit wallet balance
                <br />
                • Use funds for account upgrades
                <br />
                • View transaction history
              </p>
            </div>
          )}

          {status === "failed" && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                <strong>Common Issues:</strong>
                <br />
                • Payment was cancelled
                <br />
                • Insufficient funds
                <br />
                • Network timeout
                <br />
                <br />
                Please try again or contact support if the problem persists.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => navigate("/wallet")}
              className="flex-1"
              variant={isSuccess ? "default" : "outline"}
            >
              Go to Wallet
            </Button>
            {status === "failed" && (
              <Button
                onClick={() => navigate("/wallet")}
                className="flex-1"
              >
                Try Again
              </Button>
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Redirecting to wallet in 10 seconds...
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DepositResult;
