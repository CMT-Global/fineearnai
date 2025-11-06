import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
    // Refresh the page to show the application status
    window.location.reload();
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

  if (application) {
    const statusConfig = {
      pending: {
        icon: Clock,
        color: "text-yellow-600",
        bg: "bg-yellow-50 dark:bg-yellow-950/20",
        border: "border-yellow-200 dark:border-yellow-800",
        title: "Application Under Review",
        message: "We're reviewing your application! Our team typically responds within 24 hours. You'll receive an email notification once we've made a decision."
      },
      approved: {
        icon: CheckCircle,
        color: "text-green-600",
        bg: "bg-green-50 dark:bg-green-950/20",
        border: "border-green-200 dark:border-green-800",
        title: "Congratulations! You're Approved!",
        message: "Your partner application has been approved. You can now access your partner dashboard and start earning!"
      },
      rejected: {
        icon: XCircle,
        color: "text-red-600",
        bg: "bg-red-50 dark:bg-red-950/20",
        border: "border-red-200 dark:border-red-800",
        title: "Application Not Approved",
        message: application.rejection_reason || "Unfortunately, your application was not approved at this time. You can reapply after 30 days."
      }
    };

    const config = statusConfig[application.status as keyof typeof statusConfig];
    const StatusIcon = config.icon;

    return (
      <PageLayout profile={profile} onSignOut={signOut}>
        <div className="container max-w-2xl mx-auto px-4 py-12">
          <Card className={`${config.bg} ${config.border} border-2`}>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full ${config.bg} flex items-center justify-center`}>
                  <StatusIcon className={`h-8 w-8 ${config.color}`} />
                </div>
                <div>
                  <CardTitle className="text-2xl">{config.title}</CardTitle>
                  <Badge variant={application.status === 'approved' ? 'default' : 'secondary'}>
                    {application.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg">{config.message}</p>
              
              {application.status === 'approved' && (
                <Button size="lg" onClick={() => navigate('/partner/dashboard')} className="w-full">
                  Go to Partner Dashboard
                  <Sparkles className="h-5 w-5 ml-2" />
                </Button>
              )}

              {application.status === 'pending' && (
                <Button variant="outline" onClick={() => navigate('/dashboard')} className="w-full">
                  Return to Dashboard
                </Button>
              )}

              {application.status === 'rejected' && (
                <div className="space-y-2">
                  <Button variant="outline" onClick={() => navigate('/dashboard')} className="w-full">
                    Return to Dashboard
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    );
  }

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
