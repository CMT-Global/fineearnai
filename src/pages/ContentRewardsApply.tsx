import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Video, ChevronLeft, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import { fetchContentRewardsConfig, CONTENT_REWARDS_QUERY_KEY } from "@/lib/content-rewards-config";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageLayout } from "@/components/layout/PageLayout";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { toast } from "sonner";

const STEPS = 7;

export default function ContentRewardsApply() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: CONTENT_REWARDS_QUERY_KEY,
    queryFn: fetchContentRewardsConfig,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("referral_code, username").eq("id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("complete_content_rewards_onboarding");
      if (error) throw error;
      const result = data as { success?: boolean; message?: string };
      if (!result?.success) throw new Error(result?.message ?? "Failed");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("You're approved! Redirecting to your Creator Dashboard.");
      navigate("/content-rewards/dashboard", { replace: true });
    },
    onError: (e: Error) => {
      toast.error(e.message ?? "Something went wrong.");
    },
  });

  const wizard = config?.wizard_steps;
  const referralUrl = typeof window !== "undefined" && profile?.referral_code
    ? `${window.location.origin}/signup?ref=${profile.referral_code}`
    : "";

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  if (configLoading || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  const handleNext = () => {
    if (step === STEPS) {
      completeMutation.mutate();
    } else {
      setStep((s) => Math.min(s + 1, STEPS));
    }
  };

  const handleBack = () => setStep((s) => Math.max(1, s - 1));

  return (
    <PageLayout profile={null} isAdmin={false} onSignOut={() => {}}>
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center gap-2 text-primary mb-6">
          <Video className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Content Rewards</h1>
        </div>
        <Progress value={(step / STEPS) * 100} className="h-2 mb-8" />

        <Card>
          <CardHeader>
            <CardTitle>
              {step === 1 && wizard?.step1_welcome?.title}
              {step === 2 && wizard?.step2_what_to_post?.title}
              {step === 3 && wizard?.step3_how_earnings_work?.title}
              {step === 4 && wizard?.step4_goal_setting?.title}
              {step === 5 && wizard?.step5_get_link?.title}
              {step === 6 && wizard?.step6_posting_checklist?.title}
              {step === 7 && wizard?.step7_finish?.title}
            </CardTitle>
            <CardDescription>
              {step === 1 && wizard?.step1_welcome?.description}
              {step === 3 && wizard?.step3_how_earnings_work?.description}
              {step === 5 && wizard?.step5_get_link?.description}
              {step === 4 && wizard?.step4_goal_setting?.message}
              {step === 7 && wizard?.step7_finish?.message}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 2 && wizard?.step2_what_to_post?.examples && (
              <ul className="space-y-2">
                {wizard.step2_what_to_post.examples.map((ex: string, i: number) => (
                  <li key={i} className="flex gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    <span>{ex}</span>
                  </li>
                ))}
              </ul>
            )}

            {step === 5 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{wizard?.step5_get_link?.description}</p>
                <div className="flex gap-2">
                  <code className="flex-1 p-3 rounded bg-muted text-sm break-all font-mono">{referralUrl || "Loading..."}</code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(referralUrl);
                      toast.success("Link copied");
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            )}

            {step === 6 && wizard?.step6_posting_checklist && (
              <div className="grid gap-4">
                <div>
                  <p className="font-medium mb-2">Do</p>
                  <ul className="space-y-1">
                    {(wizard.step6_posting_checklist.dos || []).map((d: string, i: number) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-medium mb-2">Don't</p>
                  <ul className="space-y-1">
                    {(wizard.step6_posting_checklist.donts || []).map((d: string, i: number) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-sm text-muted-foreground">
                  Compliant example: {wizard.step6_posting_checklist.compliant_language}
                </p>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={handleBack} disabled={step === 1}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button onClick={handleNext} disabled={completeMutation.isPending}>
                {step === STEPS ? "Finish & Go to Dashboard" : "Next"}
                {step < STEPS && <ChevronRight className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
