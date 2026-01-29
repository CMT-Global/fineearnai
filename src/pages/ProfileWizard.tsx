import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { countries, getCountryName } from "@/lib/countries";
import { getPhoneCountryOptions } from "@/lib/phone-country-codes";
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES } from "@/lib/country-language-map";
import { isValidBep20Address } from "@/lib/validation";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { useTranslation } from "react-i18next";
import { HelpCircle, LogOut, ChevronRight, ChevronLeft, Wallet, Phone, User, Settings } from "lucide-react";
import { useBranding } from "@/contexts/BrandingContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const STEPS = [
  { id: "identity", labelKey: "profileWizard.stepIdentity", icon: User },
  { id: "payout", labelKey: "profileWizard.stepPayout", icon: Wallet },
  { id: "phone", labelKey: "profileWizard.stepPhone", icon: Phone },
  { id: "preferences", labelKey: "profileWizard.stepPreferences", icon: Settings },
] as const;

const EARNING_GOALS = ["$50/week", "$100/week", "$200/week", "$200/month", "$500/month", "Other"];
const MOTIVATIONS = ["Extra income", "Full-time", "Learning AI", "New online side hustle", "Other"];
const HOW_DID_YOU_HEAR = ["Social media", "Search", "Friend / referral", "Advertisement", "Other"];

export default function ProfileWizard() {
  const { t } = useTranslation();
  const { user, signOut, loading: authLoading } = useAuth();
  const { profileCompleted, loading: profileLoading, refetch } = useProfileCompletion(user?.id ?? undefined);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { platformName, platformLogoUrl } = useBranding();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");
  const [timezone, setTimezone] = useState("");
  const [skipPayout, setSkipPayout] = useState(true);
  const [usdtBep20, setUsdtBep20] = useState("");
  const [payoutConfirm, setPayoutConfirm] = useState(false);
  const [phoneCountryCode, setPhoneCountryCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("");
  const [earningGoal, setEarningGoal] = useState("");
  const [motivation, setMotivation] = useState("");
  const [howDidYouHear, setHowDidYouHear] = useState("");

  const phoneOptions = getPhoneCountryOptions(countries);

  const { data: profile } = useQuery({
    queryKey: ["profile-wizard", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name ?? "");
      setLastName(profile.last_name ?? "");
      setCountry(profile.country ?? profile.registration_country ?? "");
      setTimezone(profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
      setUsdtBep20(profile.usdt_bep20_address ?? "");
      setPreferredLanguage(profile.preferred_language ?? "");
      setEarningGoal(profile.earning_goal ?? "");
      setMotivation(profile.motivation ?? "");
      setHowDidYouHear(profile.how_did_you_hear ?? "");
      const pc = profile.phone_country_code;
      if (pc) setPhoneCountryCode(pc);
    }
  }, [profile]);

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user) {
      navigate("/login");
      return;
    }
    if (profileCompleted) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, authLoading, profileCompleted, profileLoading, navigate]);

  const save = async (opts: { complete?: boolean; forceSkipPayout?: boolean }): Promise<{ ok: boolean }> => {
    setError(null);
    setSaving(true);
    const useSkipPayout = opts.forceSkipPayout ?? skipPayout;
    try {
      const { data, error: err } = await supabase.functions.invoke("save-profile-wizard", {
        body: {
          complete: opts.complete ?? false,
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          country: country.trim() || undefined,
          timezone: timezone.trim() || undefined,
          skip_payout: useSkipPayout,
          usdt_bep20_address: useSkipPayout ? undefined : usdtBep20.trim() || undefined,
          payout_confirmation: payoutConfirm,
          phone_country_code: phoneCountryCode || undefined,
          phone_number: phoneNumber.trim() || undefined,
          preferred_language: preferredLanguage || undefined,
          earning_goal: earningGoal || undefined,
          motivation: motivation || undefined,
          how_did_you_hear: howDidYouHear || undefined,
        },
      });
      if (err) throw new Error(err.message ?? "Failed to save");
      const res = data as { error?: string; message?: string; success?: boolean; profile_completed?: boolean };
      if (res.error) throw new Error(res.message ?? res.error);
      if (opts.complete && res.profile_completed) {
        await queryClient.invalidateQueries({ queryKey: ["profile-completion", user?.id] });
        await refetch();
        toast({
          title: t("login.welcomeBack"),
          description: t("login.redirecting"),
        });
        navigate("/dashboard", { replace: true });
        return { ok: true };
      }
      return { ok: true };
    } catch (e: any) {
      const msg = e?.message ?? "Something went wrong";
      setError(msg);
      return { ok: false };
    } finally {
      setSaving(false);
    }
  };

  const validateStepA = () => {
    if (!firstName.trim()) return t("profileWizard.requiredFirstName");
    if (!lastName.trim()) return t("profileWizard.requiredLastName");
    if (!country.trim()) return t("profileWizard.requiredCountry");
    if (!timezone.trim()) return t("profileWizard.requiredTimezone");
    return null;
  };

  const validateStepB = () => {
    if (skipPayout) return null;
    if (!usdtBep20.trim()) return t("profileWizard.requiredBep20");
    if (!isValidBep20Address(usdtBep20.trim())) return t("profileWizard.invalidBep20");
    if (!payoutConfirm) return t("profileWizard.confirmBep20");
    return null;
  };

  const handleNext = async () => {
    if (step === 0) {
      const v = validateStepA();
      if (v) {
        setError(v);
        return;
      }
      const { ok } = await save({ complete: false });
      if (!ok) return;
      setStep(1);
      setError(null);
      return;
    }
    if (step === 1) {
      const v = validateStepB();
      if (v) {
        setError(v);
        return;
      }
      const { ok } = await save({ complete: false });
      if (!ok) return;
      setStep(2);
      setError(null);
      return;
    }
    if (step === 2) {
      const { ok } = await save({ complete: false });
      if (!ok) return;
      setStep(3);
      setError(null);
      return;
    }
  };

  const handleSkip = async () => {
    if (step === 1) setSkipPayout(true);
    const { ok } = await save({ complete: false, forceSkipPayout: step === 1 });
    if (!ok) return;
    setStep((s) => Math.min(s + 1, 3));
    setError(null);
  };

  const handleFinish = async () => {
    const v = validateStepA();
    if (v) {
      setError(v);
      return;
    }
    await save({ complete: true });
  };

  const handleBack = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  if (authLoading || profileLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <img src={platformLogoUrl} alt={`${platformName} Logo`} className="h-12 w-12 object-contain sm:h-14 sm:w-14" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg sm:text-xl">{platformName}</span>
            <span className="text-muted-foreground text-sm">{t("profileWizard.title")}</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => signOut()}>
          <LogOut className="h-4 w-4 mr-2" />
          {t("profileWizard.logout")}
        </Button>
      </header>

      <main className="flex-1 container max-w-2xl mx-auto px-4 py-8">
        <div className="flex gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={cn(
                "flex-1 h-1.5 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {(() => {
                const Icon = STEPS[step].icon;
                return <Icon className="h-5 w-5" />;
              })()}
              {t(STEPS[step].labelKey)}
            </CardTitle>
            <CardDescription>
              {step === 0 && t("profileWizard.descIdentity")}
              {step === 1 && t("profileWizard.descPayout")}
              {step === 2 && t("profileWizard.descPhone")}
              {step === 3 && t("profileWizard.descPreferences")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {step === 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("profileWizard.firstName")}</Label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("profileWizard.lastName")}</Label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("profileWizard.country")}</Label>
                  <Select value={country || undefined} onValueChange={setCountry}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name} ({c.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {profile?.registration_country && !country && (
                    <p className="text-xs text-muted-foreground">Detected: {getCountryName(profile.registration_country)}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{t("profileWizard.timezone")}</Label>
                  <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="e.g. America/New_York" />
                  <p className="text-xs text-muted-foreground">
                    Auto-detected: {Intl.DateTimeFormat().resolvedOptions().timeZone}. You can change it.
                  </p>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <Alert>
                  <HelpCircle className="h-4 w-4" />
                  <AlertTitle>USDT on BEP20 (BSC)</AlertTitle>
                  <AlertDescription>
                    {t("profileWizard.usdtBep20Help")}{" "}
                    {t("profileWizard.usdtBep20Example")} <code className="text-xs bg-muted px-1 rounded">0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1</code>
                  </AlertDescription>
                </Alert>
                <div className="flex items-center gap-2">
                  <Checkbox id="skip-payout" checked={skipPayout} onCheckedChange={(v) => setSkipPayout(!!v)} />
                  <Label htmlFor="skip-payout">{t("profileWizard.skipPayoutLabel")}</Label>
                </div>
                {!skipPayout && (
                  <>
                    <div className="space-y-2">
                      <Label>{t("profileWizard.usdtBep20Address")}</Label>
                      <Input
                        value={usdtBep20}
                        onChange={(e) => setUsdtBep20(e.target.value)}
                        placeholder="0x..."
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="payout-confirm" checked={payoutConfirm} onCheckedChange={(v) => setPayoutConfirm(!!v)} />
                      <Label htmlFor="payout-confirm">{t("profileWizard.payoutConfirmLabel")}</Label>
                    </div>
                  </>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Optional. Add your phone number; you can verify later.</p>
                <div className="flex gap-2">
                  <Select value={phoneCountryCode || undefined} onValueChange={setPhoneCountryCode}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Code" />
                    </SelectTrigger>
                    <SelectContent>
                      {phoneOptions.map((o) => (
                        <SelectItem key={o.code} value={o.dial}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="flex-1"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Phone number"
                    type="tel"
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Preferred language</Label>
                  <Select value={preferredLanguage || undefined} onValueChange={setPreferredLanguage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LANGUAGES.map((l) => (
                        <SelectItem key={l} value={l}>
                          {LANGUAGE_NAMES[l]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Earning goal</Label>
                  <Select value={earningGoal || undefined} onValueChange={setEarningGoal}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {EARNING_GOALS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Motivation</Label>
                  <Select value={motivation || undefined} onValueChange={setMotivation}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOTIVATIONS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>How did you hear about us?</Label>
                  <Select value={howDidYouHear || undefined} onValueChange={setHowDidYouHear}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {HOW_DID_YOU_HEAR.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={handleBack} disabled={step === 0 || saving}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t("profileWizard.back")}
              </Button>
              <div className="flex gap-2">
                {step < 3 && (
                  <>
                    {(step === 1 || step === 2) && (
                      <Button variant="ghost" onClick={handleSkip} disabled={saving}>
                        {t("profileWizard.skip")}
                      </Button>
                    )}
                    <Button onClick={handleNext} disabled={saving}>
                      {saving ? t("profileWizard.saving") : t("profileWizard.next")}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </>
                )}
                {step === 3 && (
                  <Button onClick={handleFinish} disabled={saving}>
                    {saving ? t("profileWizard.saving") : t("profileWizard.finish")}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
