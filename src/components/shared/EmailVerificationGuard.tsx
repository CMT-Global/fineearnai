import { Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useAdmin } from "@/hooks/useAdmin";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useTranslation } from "react-i18next";
import VerifyEmailRequired from "@/pages/VerifyEmailRequired";

/**
 * For /tasks and /tasks-4opt: if the user has not verified their email, shows a dedicated
 * "Verify email to access tasks" page instead of the task list. Once verified, the task list is shown.
 */
export function EmailVerificationGuard() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id ?? undefined);

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

  // Admins can access tasks without email verification
  if (isAdmin) {
    return <Outlet />;
  }

  // Unverified (or profile not loaded): show dedicated page explaining they must verify email via Dashboard
  if (!profile?.email_verified) {
    return <VerifyEmailRequired />;
  }

  return <Outlet />;
}
