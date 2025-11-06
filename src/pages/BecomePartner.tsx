import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { PageLayout } from "@/components/layout/PageLayout";
import { PartnerWizard } from "@/components/partner/PartnerWizard";
import { PartnerApplicationWizard } from "@/components/partner/PartnerApplicationWizard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useIsPartner, usePartnerApplication } from "@/hooks/usePartner";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, CheckCircle, Clock, XCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const BecomePartner = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const [showIntroWizard, setShowIntroWizard] = useState(false);
  const [showApplicationWizard, setShowApplicationWizard] = useState(false);
  
  const { data: isPartner, isLoading: checkingPartner } = useIsPartner();
  const { data: application, isLoading: loadingApplication } = usePartnerApplication();
  const { data: profile } = useProfile(user?.id || '');

  // Determine wizard visibility based on user status
  useEffect(() => {
    // Wait for data to load before making decisions
    if (loadingApplication || checkingPartner) {
      return;
    }

    // Priority 1: Redirect approved partners to dashboard
    if (isPartner) {
      navigate('/partner/dashboard');
      return;
    }

    // Priority 2: Redirect users with existing applications to status page
    if (application) {
      navigate('/partner/application-status');
      return;
    }

    // Priority 3: New users without application - show intro wizard
    if (!application && !isPartner) {
      setShowIntroWizard(true);
    }
  }, [application, isPartner, loadingApplication, checkingPartner, navigate]);

  const handleIntroWizardComplete = () => {
    setShowIntroWizard(false);
    setShowApplicationWizard(true);
  };

  const handleIntroWizardClose = () => {
    navigate('/dashboard');
  };

  const handleApplicationComplete = () => {
    // Invalidate queries to refresh data without page reload
    queryClient.invalidateQueries({ queryKey: ['partner-application'] });
    queryClient.invalidateQueries({ queryKey: ['is-partner'] });
    // Navigate to application status page
    navigate('/partner/application-status');
  };

  const handleApplicationCancel = () => {
    navigate('/dashboard');
  };

  if (checkingPartner || loadingApplication) {
    return (
      <PageLayout profile={profile} onSignOut={signOut}>
        <div className="flex justify-center items-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  // This will be handled by the redirect useEffect above

  return (
    <PageLayout profile={profile} onSignOut={signOut}>
      {/* Only render wizards after data has loaded and we've confirmed user status */}
      {!loadingApplication && !checkingPartner && (
        <>
          {/* Intro Wizard - Benefits of becoming a partner */}
          {showIntroWizard && !application && !isPartner && (
            <PartnerWizard
              open={showIntroWizard} 
              onComplete={handleIntroWizardComplete}
              onClose={handleIntroWizardClose}
            />
          )}

          {/* Application Wizard - Multi-step form */}
          {showApplicationWizard && !application && !isPartner && (
            <PartnerApplicationWizard
              onComplete={handleApplicationComplete}
              onCancel={handleApplicationCancel}
            />
          )}
        </>
      )}
    </PageLayout>
  );
};

export default BecomePartner;
