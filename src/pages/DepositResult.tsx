import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const DepositResult = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const status = searchParams.get("deposit");
  const redirectSeconds = 10;

  useEffect(() => {
    // Auto-redirect after 10 seconds
    const timer = setTimeout(() => {
      navigate("/wallet");
    }, redirectSeconds * 1000);

    return () => clearTimeout(timer);
  }, [navigate, redirectSeconds]);

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
              ? t("depositResult.title.success")
              : status === "failed"
              ? t("depositResult.title.failed")
              : t("depositResult.title.processing")}
          </CardTitle>
          <CardDescription>
            {isSuccess
              ? t("depositResult.description.success")
              : status === "failed"
              ? t("depositResult.description.failed")
              : t("depositResult.description.processing")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-sm text-green-800">
                <strong>{t("depositResult.nextSteps.title")}</strong>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>{t("depositResult.nextSteps.step1")}</li>
                  <li>{t("depositResult.nextSteps.step2")}</li>
                  <li>{t("depositResult.nextSteps.step3")}</li>
                </ul>
              </div>
            </div>
          )}

          {status === "failed" && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-sm text-red-800">
                <strong>{t("depositResult.commonIssues.title")}</strong>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>{t("depositResult.commonIssues.issue1")}</li>
                  <li>{t("depositResult.commonIssues.issue2")}</li>
                  <li>{t("depositResult.commonIssues.issue3")}</li>
                </ul>
                <p className="mt-3">{t("depositResult.commonIssues.footer")}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => navigate("/wallet")}
              className="flex-1"
              variant={isSuccess ? "default" : "outline"}
            >
              {t("depositResult.actions.goToWallet")}
            </Button>
            {status === "failed" && (
              <Button
                onClick={() => navigate("/wallet")}
                className="flex-1"
              >
                {t("depositResult.actions.tryAgain")}
              </Button>
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            {t("depositResult.redirecting", { seconds: redirectSeconds })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DepositResult;
