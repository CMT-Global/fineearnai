import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { usePartnerStatus } from "@/hooks/usePartner";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { 
  CheckCircle, 
  Clock, 
  XCircle, 
  ArrowLeft,
  MessageSquare,
  Globe,
  HeartHandshake,
  Shield,
  AlertCircle,
  Sparkles
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState, useEffect, useRef } from "react";
import { PartnerWizard } from "@/components/partner/PartnerWizard";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { QueryErrorBoundary } from "@/components/shared/QueryErrorBoundary";
import { PartnerErrorBoundary } from "@/components/partner/PartnerErrorBoundary";
import { generateCorrelationId } from "@/lib/utils";
import { toast } from "sonner";

const PartnerApplicationStatus = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile(user?.id || '');
  const [showWizard, setShowWizard] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [correlationId, setCorrelationId] = useState<string>("");

  // Phase 3: useRef guard to prevent duplicate correlation ID generation in React Strict Mode
  const correlationIdInitialized = useRef(false);

  // Phase 3: Generate correlation ID on mount with useRef guard to prevent duplicates in Strict Mode
  useEffect(() => {
    // Phase 3: Check ref guard - only generate once per mount
    if (user && !correlationId && !correlationIdInitialized.current) {
      correlationIdInitialized.current = true; // Mark as initialized
      
      const newCorrelationId = generateCorrelationId();
      setCorrelationId(newCorrelationId);
      
      console.log('🆔 [ApplicationStatus] Correlation ID generated:', newCorrelationId);
      
      // Display Debug ID in toast for easy tracking (only in dev mode or with ?debug=true)
      const isDevelopment = import.meta.env.DEV;
      const hasDebugParam = new URLSearchParams(window.location.search).get('debug') === 'true';
      
      if (isDevelopment || hasDebugParam) {
        toast.info(`Debug ID: ${newCorrelationId}`, {
          description: "Use this ID to track your application status in backend logs",
          duration: 10000, // Show for 10 seconds
          id: 'correlation-id-toast-status', // Prevent duplicates
        });
      }
    }
  }, [user, correlationId]);

  // Phase 2: Use unified hook to fetch both partner status and application in one request
  const { 
    data: partnerStatus, 
    isSuccess: partnerStatusSuccess, 
    error: partnerStatusError, 
    refetch: refetchPartnerStatus 
  } = usePartnerStatus(correlationId);

  // Destructure partner status for convenience
  const isPartner = partnerStatus?.isPartner ?? false;
  const application = partnerStatus?.application ?? null;

  // Phase 4: Align ready state computation with BecomePartner
  const ready = !!user && partnerStatusSuccess;

  // Phase 4: Compute pendingRedirect gate - redirect if partner or no application
  const pendingRedirect = ready && !isNavigating && (isPartner || !application);

  // Debug logging for troubleshooting
  console.log('🔍 [ApplicationStatus] Component Render State:', {
    timestamp: new Date().toISOString(),
    userId: user?.id,
    ready,
    hasUser: !!user,
    isPartner,
    hasApplication: !!application,
    applicationId: application?.id,
    applicationStatus: application?.status,
    isNavigating,
    pendingRedirect,
    profileLoaded: !!profile
  });

  // Phase 4: Effect-driven redirects - minimal dependencies, only runs after data is settled
  useEffect(() => {
    console.log('🔄 [ApplicationStatus] useEffect triggered:', { 
      ready, 
      isPartner, 
      hasApplication: !!application 
    });
    
    if (!ready) {
      console.log('⏳ [ApplicationStatus] Not ready yet, waiting...');
      return;
    }
    
    console.log('✅ [ApplicationStatus] Ready! Checking redirect conditions...');
    
    // Redirect approved partners to dashboard
    if (isPartner) {
      console.log('✅ [ApplicationStatus] PARTNER APPROVED - Redirecting to dashboard');
      setIsNavigating(true);
      navigate('/partner/dashboard', { replace: true });
      return;
    }
    
    // Redirect users without application to become-partner
    if (!application) {
      console.log('⚠️ [ApplicationStatus] NO APPLICATION FOUND - Redirecting to become-partner');
      setIsNavigating(true);
      navigate('/become-partner', { replace: true });
      return;
    }
    
    console.log('📋 [ApplicationStatus] Has application, showing status page');
  }, [ready, isPartner, application, navigate]);

  // Phase 4: Handle errors first
  if (partnerStatusError) {
    return (
      <PageLayout profile={profile} onSignOut={signOut}>
        <QueryErrorBoundary 
          error={partnerStatusError} 
          reset={() => {
            refetchPartnerStatus();
          }}
        />
      </PageLayout>
    );
  }

  // Phase 4: Early return for navigation state
  if (isNavigating) {
    return (
      <PageLayout profile={profile} onSignOut={signOut}>
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" text="Redirecting..." />
        </div>
      </PageLayout>
    );
  }

  // Phase 4: Show loading state while data is being fetched
  if (!ready) {
    return (
      <PageLayout profile={profile} onSignOut={signOut}>
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" text="Loading application status..." />
        </div>
      </PageLayout>
    );
  }

  // Phase 4: Early return for pendingRedirect - prevents flicker before redirect
  if (pendingRedirect) {
    return (
      <PageLayout profile={profile} onSignOut={signOut}>
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" text="Redirecting..." />
        </div>
      </PageLayout>
    );
  }

  // Phase 4: At this point, we know we have an application to display
  // TypeScript safety: application is guaranteed to exist here due to pendingRedirect gate

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { 
      variant: any; 
      icon: any; 
      label: string;
      color: string;
      description: string;
    }> = {
      pending: { 
        variant: "secondary", 
        icon: Clock, 
        label: "Pending Review",
        color: "text-yellow-600",
        description: "Your application is under review. We typically respond within 24-48 hours."
      },
      approved: { 
        variant: "default", 
        icon: CheckCircle, 
        label: "Approved",
        color: "text-green-600",
        description: "Congratulations! Your partner application has been approved."
      },
      rejected: { 
        variant: "destructive", 
        icon: XCircle, 
        label: "Not Approved",
        color: "text-destructive",
        description: "Your application was not approved at this time."
      },
    };

    return configs[status] || configs.pending;
  };

  const statusConfig = getStatusConfig(application.status);
  const StatusIcon = statusConfig.icon;

  return (
    <PartnerErrorBoundary
      fallbackMessage="There was an error loading your partner application status. Please try again."
      onReset={() => {
        refetchPartnerStatus();
      }}
    >
      <PageLayout profile={profile} onSignOut={signOut}>
        <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Partner Application Status</h1>
          </div>
          <p className="text-muted-foreground">
            View your partner application details and current status
          </p>
        </div>

        {/* Partner Info Wizard Dialog */}
        {showWizard && (
          <PartnerWizard
            open={showWizard}
            onComplete={() => setShowWizard(false)}
            onClose={() => setShowWizard(false)}
          />
        )}

        {/* Status Alert */}
        <Alert className={`mb-6 ${application.status === 'approved' ? 'border-green-600' : application.status === 'rejected' ? 'border-destructive' : 'border-yellow-600'}`}>
          <StatusIcon className={`h-5 w-5 ${statusConfig.color}`} />
          <AlertDescription className="ml-2">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="font-semibold mb-1">{statusConfig.label}</div>
                <p className="text-sm">{statusConfig.description}</p>
              </div>
              <Badge variant={statusConfig.variant} className="shrink-0">
                {statusConfig.label}
              </Badge>
            </div>
          </AlertDescription>
        </Alert>

        {/* Rejection Reason */}
        {application.status === 'rejected' && application.rejection_reason && (
          <Card className="mb-6 border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Reason for Rejection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{application.rejection_reason}</p>
            </CardContent>
          </Card>
        )}

        {/* Application Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Application Details</CardTitle>
            <CardDescription>
              Submitted {formatDistanceToNow(new Date(application.created_at), { addSuffix: true })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Contact Information */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <MessageSquare className="h-4 w-4 text-primary" />
                Contact Information
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm pl-6">
                <div>
                  <span className="text-muted-foreground">Preferred Contact:</span>
                  <p className="font-medium capitalize">{application.preferred_contact_method}</p>
                </div>
                {application.whatsapp_number && (
                  <div>
                    <span className="text-muted-foreground">WhatsApp:</span>
                    <p className="font-medium">{application.whatsapp_number}</p>
                  </div>
                )}
                {application.telegram_username && (
                  <div>
                    <span className="text-muted-foreground">Telegram:</span>
                    <p className="font-medium">@{application.telegram_username}</p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Network & Experience */}
            {(application.manages_community || application.promoted_platforms || application.network_description) && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Globe className="h-4 w-4 text-primary" />
                    Network & Experience
                  </div>
                  <div className="space-y-3 pl-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {application.manages_community !== null && (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Manages Community:</span>
                            {application.manages_community ? (
                              <Badge variant="default">Yes</Badge>
                            ) : (
                              <Badge variant="secondary">No</Badge>
                            )}
                          </div>
                        </div>
                      )}
                      {application.community_member_count && (
                        <div>
                          <span className="text-muted-foreground">Community Size:</span>
                          <p className="font-medium">{application.community_member_count} members</p>
                        </div>
                      )}
                      {application.promoted_platforms !== null && (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Has Promoted Platforms:</span>
                            {application.promoted_platforms ? (
                              <Badge variant="default">Yes</Badge>
                            ) : (
                              <Badge variant="secondary">No</Badge>
                            )}
                          </div>
                        </div>
                      )}
                      {application.expected_monthly_onboarding && (
                        <div>
                          <span className="text-muted-foreground">Monthly Onboarding:</span>
                          <p className="font-medium">{application.expected_monthly_onboarding} users</p>
                        </div>
                      )}
                      {application.weekly_time_commitment && (
                        <div>
                          <span className="text-muted-foreground">Time Commitment:</span>
                          <p className="font-medium">{application.weekly_time_commitment} hours/week</p>
                        </div>
                      )}
                    </div>

                    {application.platform_promotion_details && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Platform Promotion Details:</span>
                        <p className="mt-1 p-3 bg-muted/50 rounded-lg">{application.platform_promotion_details}</p>
                      </div>
                    )}

                    {application.network_description && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Network Description:</span>
                        <p className="mt-1 p-3 bg-muted/50 rounded-lg">{application.network_description}</p>
                      </div>
                    )}

                    {application.community_group_links && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Community Links:</span>
                        <p className="mt-1 p-3 bg-muted/50 rounded-lg break-all">{application.community_group_links}</p>
                      </div>
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Support & Capabilities */}
            {(application.can_provide_local_support !== null || application.organize_training_sessions !== null || application.local_payment_methods) && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <HeartHandshake className="h-4 w-4 text-primary" />
                    Support & Capabilities
                  </div>
                  <div className="space-y-3 pl-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {application.can_provide_local_support !== null && (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Can Provide Local Support:</span>
                            {application.can_provide_local_support ? (
                              <Badge variant="default">Yes</Badge>
                            ) : (
                              <Badge variant="secondary">No</Badge>
                            )}
                          </div>
                        </div>
                      )}
                      {application.organize_training_sessions !== null && (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Can Organize Training:</span>
                            {application.organize_training_sessions ? (
                              <Badge variant="default">Yes</Badge>
                            ) : (
                              <Badge variant="secondary">No</Badge>
                            )}
                          </div>
                        </div>
                      )}
                      {application.support_preference && (
                        <div>
                          <span className="text-muted-foreground">Support Method:</span>
                          <p className="font-medium capitalize">{application.support_preference}</p>
                        </div>
                      )}
                    </div>

                    {application.local_payment_methods && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Local Payment Methods:</span>
                        <p className="mt-1 p-3 bg-muted/50 rounded-lg">{application.local_payment_methods}</p>
                      </div>
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Motivation & Agreement */}
            {application.motivation_text && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Shield className="h-4 w-4 text-primary" />
                  Motivation & Agreement
                </div>
                <div className="space-y-3 pl-6">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Why I want to be a partner:</span>
                    <p className="mt-1 p-3 bg-muted/50 rounded-lg">{application.motivation_text}</p>
                  </div>
                  <div className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Agreed to Guidelines:</span>
                      {application.agrees_to_guidelines ? (
                        <Badge variant="default">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Yes
                        </Badge>
                      ) : (
                        <Badge variant="secondary">No</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard')}
            className="flex-1"
          >
            Return to Dashboard
          </Button>
          
          {/* NEW: How It Works button */}
          <Button
            variant="outline"
            onClick={() => setShowWizard(true)}
            className="flex-1"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            How It Works
          </Button>
          
          {application.status === 'pending' && (
            <Button
              variant="secondary"
              disabled
              className="flex-1 cursor-not-allowed"
              title="You cannot edit your application while it's under review"
            >
              Application Under Review
            </Button>
          )}
          {application.status === 'approved' && (
            <Button
              variant="default"
              onClick={() => navigate('/partner/dashboard')}
              className="flex-1"
            >
              Go to Partner Dashboard
            </Button>
          )}
        </div>
      </div>
    </PageLayout>
    </PartnerErrorBoundary>
  );
};

export default PartnerApplicationStatus;
