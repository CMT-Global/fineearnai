import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Info, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmailBestPractices() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          Email Deliverability Best Practices
        </CardTitle>
        <CardDescription>
          Ensure your emails reach recipients and avoid spam filters
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* SPF/DKIM Setup */}
        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Required: Domain Verification (SPF/DKIM)
          </h4>
          <Alert>
            <AlertDescription>
              <p className="mb-3">
                To prevent emails from going to spam, you <strong>must</strong> verify your domain with Resend and configure SPF/DKIM records.
              </p>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">1. Add your domain in Resend</p>
                    <p className="text-sm text-muted-foreground">Go to Resend Dashboard → Domains → Add Domain</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">2. Add DNS records to your domain</p>
                    <p className="text-sm text-muted-foreground">Add the SPF, DKIM, and DMARC records provided by Resend</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">3. Wait for verification</p>
                    <p className="text-sm text-muted-foreground">DNS propagation can take up to 48 hours</p>
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
                Open Resend Domains
              </Button>
            </AlertDescription>
          </Alert>
        </div>

        {/* Current Email Settings */}
        <div>
          <h4 className="font-semibold mb-3">Current Email Configuration</h4>
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">From Address:</span>
              <Badge variant="secondary">Dynamic (from platform config)</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Reply-To:</span>
              <Badge variant="secondary">Dynamic (from platform config)</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Provider:</span>
              <Badge variant="secondary">Resend</Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Email settings are configured in Email Settings under Communications
          </p>
        </div>

        {/* Spam Prevention Tips */}
        <div>
          <h4 className="font-semibold mb-3">Spam Prevention Checklist</h4>
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Use a verified domain (not onboarding@resend.dev)</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Include unsubscribe links in marketing emails</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Maintain good text-to-image ratio in email body</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Avoid spam trigger words (FREE, URGENT, ACT NOW, etc.)</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Send from a consistent sender name and address</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Warm up new domains gradually (start with small batches)</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Monitor bounce rates and remove invalid addresses</span>
            </div>
          </div>
        </div>

        {/* Email Content Guidelines */}
        <div>
          <h4 className="font-semibold mb-3">Content Best Practices</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>Write clear, relevant subject lines (avoid ALL CAPS)</li>
            <li>Personalize with recipient's name using variables</li>
            <li>Include your company name and address in footer</li>
            <li>Balance HTML with plain text alternative</li>
            <li>Test emails before sending to large groups</li>
            <li>Keep email size under 100KB for best deliverability</li>
          </ul>
        </div>

        {/* Monitoring */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Monitor Your Email Performance</AlertTitle>
          <AlertDescription>
            Use the History tab to track delivery status, monitor bounce rates, and identify issues.
            Check delivery status regularly using the Resend API integration.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}