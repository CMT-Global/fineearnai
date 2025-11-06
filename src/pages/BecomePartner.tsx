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
  const [showIntroWizard, setShowIntroWizard] = useState(true);
  const [showApplicationWizard, setShowApplicationWizard] = useState(false);
  
  const { data: isPartner, isLoading: checkingPartner } = useIsPartner();
  const { data: application, isLoading: loadingApplication } = usePartnerApplication();
  const { data: profile } = useProfile(user?.id || '');

  useEffect(() => {
    if (isPartner) {
      navigate('/partner/dashboard');
    }
  }, [isPartner, navigate]);

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

  // If user has a submitted application (not currently filling wizard), redirect to status page
  useEffect(() => {
    if (application && !showApplicationWizard && !showIntroWizard) {
      navigate('/partner/application-status');
    }
  }, [application, showApplicationWizard, showIntroWizard, navigate]);

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
      {/* Intro Wizard - Benefits of becoming a partner */}
      {showIntroWizard && (
        <PartnerWizard
          open={showIntroWizard} 
          onComplete={handleIntroWizardComplete}
          onClose={handleIntroWizardClose}
        />
      )}

      {/* Application Wizard - Multi-step form */}
      {showApplicationWizard && (
        <PartnerApplicationWizard
          onComplete={handleApplicationComplete}
          onCancel={handleApplicationCancel}
        />
      )}
    </PageLayout>
  );
};

export default BecomePartner;
