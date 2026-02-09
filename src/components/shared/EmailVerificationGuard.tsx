import { useEffect } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useAdmin } from "@/hooks/useAdmin";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

/**
 * Blocks access to the Tasks page (and task detail) when the user has not verified their email.
 * Redirects to dashboard and shows a toast with a "Verify Email" action that opens the verification dialog.
 */
export function EmailVerificationGuard() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id ?? undefined);
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || adminLoading || profileLoading || !user) return;

    // Admins can access tasks without email verification
    if (isAdmin) return;

    const emailVerified = profile?.email_verified === true;
    if (!emailVerified) {
      toast.error(t("tasks.requireEmailVerification"), {
        action: {
          label: t("tasks.verifyEmailButton"),
          onClick: () => navigate("/dashboard", { state: { openEmailVerification: true }, replace: false }),
        },
      });
      navigate("/dashboard", { replace: true });
    }
  }, [user, authLoading, adminLoading, profileLoading, profile?.email_verified, isAdmin, navigate, t]);

  if (authLoading || adminLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text={t("tasks.loadingTasks")} />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Redirecting: don't render outlet
  if (!isAdmin && profile && profile.email_verified !== true) {
    return null;
  }

  return <Outlet />;
}
