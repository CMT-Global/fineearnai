import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Info, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmailBestPractices() {
  const { t } = useTranslation();
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          {t("admin.bulkEmail.bestPractices.title")}
        </CardTitle>
        <CardDescription>
          {t("admin.bulkEmail.bestPractices.subtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* SPF/DKIM Setup */}
        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            {t("admin.bulkEmail.bestPractices.domainVerification.title")}
          </h4>
          <Alert>
            <AlertDescription>
              <p className="mb-3" dangerouslySetInnerHTML={{ __html: t("admin.bulkEmail.bestPractices.domainVerification.description") }} />
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">{t("admin.bulkEmail.bestPractices.domainVerification.step1.title")}</p>
                    <p className="text-sm text-muted-foreground">{t("admin.bulkEmail.bestPractices.domainVerification.step1.description")}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">{t("admin.bulkEmail.bestPractices.domainVerification.step2.title")}</p>
                    <p className="text-sm text-muted-foreground">{t("admin.bulkEmail.bestPractices.domainVerification.step2.description")}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">{t("admin.bulkEmail.bestPractices.domainVerification.step3.title")}</p>
                    <p className="text-sm text-muted-foreground">{t("admin.bulkEmail.bestPractices.domainVerification.step3.description")}</p>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => window.open("https://resend.com/domains", "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {t("admin.bulkEmail.bestPractices.domainVerification.openResendDomains")}
              </Button>
            </AlertDescription>
          </Alert>
        </div>

        {/* Current Email Settings */}
        <div>
          <h4 className="font-semibold mb-3">{t("admin.bulkEmail.bestPractices.currentConfiguration.title")}</h4>
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t("admin.bulkEmail.bestPractices.currentConfiguration.fromAddress")}</span>
              <Badge variant="secondary">{t("admin.bulkEmail.bestPractices.currentConfiguration.dynamic")}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t("admin.bulkEmail.bestPractices.currentConfiguration.replyTo")}</span>
              <Badge variant="secondary">{t("admin.bulkEmail.bestPractices.currentConfiguration.dynamic")}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t("admin.bulkEmail.bestPractices.currentConfiguration.provider")}</span>
              <Badge variant="secondary">{t("admin.bulkEmail.bestPractices.currentConfiguration.resend")}</Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {t("admin.bulkEmail.bestPractices.currentConfiguration.note")}
          </p>
        </div>

        {/* Spam Prevention Tips */}
        <div>
          <h4 className="font-semibold mb-3">{t("admin.bulkEmail.bestPractices.spamPrevention.title")}</h4>
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>{t("admin.bulkEmail.bestPractices.spamPrevention.tip1")}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>{t("admin.bulkEmail.bestPractices.spamPrevention.tip2")}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>{t("admin.bulkEmail.bestPractices.spamPrevention.tip3")}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>{t("admin.bulkEmail.bestPractices.spamPrevention.tip4")}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>{t("admin.bulkEmail.bestPractices.spamPrevention.tip5")}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>{t("admin.bulkEmail.bestPractices.spamPrevention.tip6")}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>{t("admin.bulkEmail.bestPractices.spamPrevention.tip7")}</span>
            </div>
          </div>
        </div>

        {/* Email Content Guidelines */}
        <div>
          <h4 className="font-semibold mb-3">{t("admin.bulkEmail.bestPractices.contentGuidelines.title")}</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>{t("admin.bulkEmail.bestPractices.contentGuidelines.tip1")}</li>
            <li>{t("admin.bulkEmail.bestPractices.contentGuidelines.tip2")}</li>
            <li>{t("admin.bulkEmail.bestPractices.contentGuidelines.tip3")}</li>
            <li>{t("admin.bulkEmail.bestPractices.contentGuidelines.tip4")}</li>
            <li>{t("admin.bulkEmail.bestPractices.contentGuidelines.tip5")}</li>
            <li>{t("admin.bulkEmail.bestPractices.contentGuidelines.tip6")}</li>
          </ul>
        </div>

        {/* Monitoring */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>{t("admin.bulkEmail.bestPractices.monitoring.title")}</AlertTitle>
          <AlertDescription>
            {t("admin.bulkEmail.bestPractices.monitoring.description")}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}