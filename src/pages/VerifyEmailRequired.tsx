import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Mail, ArrowRight, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Shown when an unverified user visits /tasks or /tasks-4opt.
 * Explains they must verify email via the Verification button on Dashboard (OTP sent to registered email).
 */
export default function VerifyEmailRequired() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const goToDashboardAndVerify = () => {
    navigate("/dashboard", { state: { openEmailVerification: true }, replace: false });
  };

  return (
    <div className="relative w-full min-h-[calc(100vh-5rem)] flex items-center justify-center px-4 py-10">
      {/* Subtle ambient glow behind card */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% 50%, hsl(145 60% 45% / 0.08) 0%, transparent 60%)",
        }}
      />
      <Card
        className="relative w-full max-w-2xl rounded-2xl border-2 shadow-2xl transition-shadow shrink-0"
        style={{
          background: "linear-gradient(145deg, hsl(160 35% 12%) 0%, hsl(160 30% 8%) 100%)",
          borderColor: "hsl(145 60% 45% / 0.35)",
          boxShadow:
            "0 0 0 1px hsl(145 60% 45% / 0.2), 0 8px 32px hsl(160 30% 4% / 0.6), 0 0 80px hsl(145 60% 45% / 0.08)",
        }}
      >
        <CardHeader className="text-center space-y-4 pb-2 pt-10">
          <div
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full text-primary"
            style={{
              background: "hsl(145 60% 45% / 0.18)",
              boxShadow: "0 0 24px hsl(145 60% 45% / 0.2)",
            }}
          >
            <Mail className="h-9 w-9" strokeWidth={1.8} />
          </div>
          <div className="space-y-1.5">
            <CardTitle className="text-3xl font-semibold tracking-tight text-foreground">
              {t("tasks.verifyEmailRequiredPage.title")}
            </CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              {t("tasks.verifyEmailRequiredPage.subtitle")}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pb-10 px-8 sm:px-10">
          <div
            className="rounded-xl p-5 flex gap-4 items-start border border-primary/10"
            style={{ background: "hsl(160 30% 14% / 0.8)" }}
          >
            <ShieldCheck
              className="h-5 w-5 text-primary flex-shrink-0 mt-0.5"
              strokeWidth={2}
            />
            <p className="text-base text-muted-foreground leading-relaxed">
              {t("tasks.verifyEmailRequiredPage.description")}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              onClick={goToDashboardAndVerify}
              className="bg-gradient-to-r from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] text-white hover:opacity-95 shadow-lg hover:shadow-[0_0_24px_hsl(145_60%_45%_/_0.25)] transition-all duration-200 border-0"
            >
              <Mail className="h-4 w-4 mr-2" />
              {t("tasks.verifyEmailRequiredPage.goToDashboard")}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/dashboard")}
              className="border border-border bg-transparent hover:bg-muted/60 text-foreground hover:text-foreground"
            >
              {t("tasks.verifyEmailRequiredPage.dashboardOnly")}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
