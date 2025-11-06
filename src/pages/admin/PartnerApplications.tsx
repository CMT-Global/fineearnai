import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePartnerApplications, useManagePartnerApplication } from "@/hooks/usePartnerManagement";
import { Loader2, CheckCircle, XCircle, Clock, Users, Sparkles, MessageSquare, Globe, Calendar, HeartHandshake, DollarSign, Shield } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const PartnerApplications = () => {
  const [activeTab, setActiveTab] = useState("pending");
  const { data: applications, isLoading } = usePartnerApplications(activeTab);
  const manageMutation = useManagePartnerApplication();

  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [customCommission, setCustomCommission] = useState("");

  const handleAction = (application: any, action: 'approve' | 'reject') => {
    setSelectedApplication(application);
    setActionType(action);
    setRejectionReason("");
    setCustomCommission("");
  };

  const handleConfirm = () => {
    if (!selectedApplication || !actionType) return;

    const payload: any = {
      application_id: selectedApplication.id,
      action: actionType,
    };

    if (actionType === 'reject' && rejectionReason) {
      payload.rejection_reason = rejectionReason;
    }

    if (actionType === 'approve' && customCommission) {
      payload.custom_commission_rate = parseFloat(customCommission) / 100;
    }

    manageMutation.mutate(payload, {
      onSuccess: () => {
        setSelectedApplication(null);
        setActionType(null);
      },
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any; label: string }> = {
      pending: { variant: "secondary", icon: Clock, label: "Pending" },
      approved: { variant: "default", icon: CheckCircle, label: "Approved" },
      rejected: { variant: "destructive", icon: XCircle, label: "Rejected" },
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const pendingCount = applications?.filter((a: any) => a.status === 'pending').length || 0;

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Partner Applications</h1>
          </div>
          <p className="text-muted-foreground">
            Review and manage partner applications
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Applications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{applications?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Approval Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {applications?.length
                  ? Math.round((applications.filter((a: any) => a.status === 'approved').length / applications.length) * 100)
                  : 0}%
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending">
              Pending
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : applications && applications.length > 0 ? (
              <div className="grid gap-4">
                {applications.map((app: any) => (
                  <Card key={app.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">
                            {app.profiles?.full_name || app.profiles?.username || 'Unknown User'}
                          </CardTitle>
                          <CardDescription>
                            @{app.profiles?.username} • {app.profiles?.email}
                          </CardDescription>
                        </div>
                        {getStatusBadge(app.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {/* Basic Contact Information */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <MessageSquare className="h-4 w-4 text-primary" />
                            Contact Information
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm pl-6">
                            <div>
                              <span className="text-muted-foreground">Preferred Contact:</span>
                              <p className="font-medium capitalize">{app.preferred_contact_method || 'Not specified'}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Applied:</span>
                              <p className="font-medium">
                                {formatDistanceToNow(new Date(app.created_at), { addSuffix: true })}
                              </p>
                            </div>
                            {app.whatsapp_number && (
                              <div>
                                <span className="text-muted-foreground">WhatsApp:</span>
                                <p className="font-medium">{app.whatsapp_number}</p>
                              </div>
                            )}
                            {app.telegram_username && (
                              <div>
                                <span className="text-muted-foreground">Telegram:</span>
                                <p className="font-medium">@{app.telegram_username}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Network & Experience */}
                        <div className="space-y-3 border-t pt-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Globe className="h-4 w-4 text-primary" />
                            Network & Experience
                          </div>
                          <div className="space-y-3 pl-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Manages Community:</span>
                                <p className="font-medium">
                                  {app.manages_community ? (
                                    <Badge variant="default" className="ml-2">Yes</Badge>
                                  ) : (
                                    <Badge variant="secondary" className="ml-2">No</Badge>
                                  )}
                                </p>
                              </div>
                              {app.community_member_count && (
                                <div>
                                  <span className="text-muted-foreground">Community Size:</span>
                                  <p className="font-medium">{app.community_member_count} members</p>
                                </div>
                              )}
                              <div>
                                <span className="text-muted-foreground">Has Promoted Platforms:</span>
                                <p className="font-medium">
                                  {app.promoted_platforms ? (
                                    <Badge variant="default" className="ml-2">Yes</Badge>
                                  ) : (
                                    <Badge variant="secondary" className="ml-2">No</Badge>
                                  )}
                                </p>
                              </div>
                              {app.expected_monthly_onboarding && (
                                <div>
                                  <span className="text-muted-foreground">Monthly Onboarding:</span>
                                  <p className="font-medium">{app.expected_monthly_onboarding} users</p>
                                </div>
                              )}
                              {app.weekly_time_commitment && (
                                <div>
                                  <span className="text-muted-foreground">Time Commitment:</span>
                                  <p className="font-medium">{app.weekly_time_commitment} hours/week</p>
                                </div>
                              )}
                            </div>

                            {app.platform_promotion_details && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Platform Promotion Details:</span>
                                <p className="mt-1 p-3 bg-muted/50 rounded-lg">{app.platform_promotion_details}</p>
                              </div>
                            )}

                            {app.network_description && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Network Description:</span>
                                <p className="mt-1 p-3 bg-muted/50 rounded-lg">{app.network_description}</p>
                              </div>
                            )}

                            {app.community_group_links && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Community Links:</span>
                                <p className="mt-1 p-3 bg-muted/50 rounded-lg break-all">{app.community_group_links}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Local Support & Capabilities */}
                        <div className="space-y-3 border-t pt-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <HeartHandshake className="h-4 w-4 text-primary" />
                            Support & Capabilities
                          </div>
                          <div className="space-y-3 pl-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Can Provide Local Support:</span>
                                <p className="font-medium">
                                  {app.can_provide_local_support ? (
                                    <Badge variant="default" className="ml-2">Yes</Badge>
                                  ) : (
                                    <Badge variant="secondary" className="ml-2">No</Badge>
                                  )}
                                </p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Can Organize Training:</span>
                                <p className="font-medium">
                                  {app.organize_training_sessions ? (
                                    <Badge variant="default" className="ml-2">Yes</Badge>
                                  ) : (
                                    <Badge variant="secondary" className="ml-2">No</Badge>
                                  )}
                                </p>
                              </div>
                              {app.support_preference && (
                                <div>
                                  <span className="text-muted-foreground">Support Method:</span>
                                  <p className="font-medium capitalize">{app.support_preference}</p>
                                </div>
                              )}
                            </div>

                            {app.local_payment_methods && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Local Payment Methods:</span>
                                <p className="mt-1 p-3 bg-muted/50 rounded-lg">{app.local_payment_methods}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Motivation & Agreement */}
                        {app.motivation_text && (
                          <div className="space-y-3 border-t pt-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                              <Shield className="h-4 w-4 text-primary" />
                              Motivation & Agreement
                            </div>
                            <div className="text-sm pl-6">
                              <span className="text-muted-foreground">Why they want to be a partner:</span>
                              <p className="mt-1 p-3 bg-muted/50 rounded-lg">{app.motivation_text}</p>
                            </div>
                            <div className="text-sm pl-6">
                              <span className="text-muted-foreground">Agreed to Guidelines:</span>
                              <p className="font-medium">
                                {app.agrees_to_guidelines ? (
                                  <Badge variant="default" className="ml-2">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Yes
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="ml-2">No</Badge>
                                )}
                              </p>
                            </div>
                          </div>
                        )}

                        {app.status === 'pending' && (
                          <div className="flex gap-2 pt-4 border-t">
                            <Button
                              onClick={() => handleAction(app, 'approve')}
                              className="flex-1"
                              disabled={manageMutation.isPending}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              onClick={() => handleAction(app, 'reject')}
                              variant="destructive"
                              className="flex-1"
                              disabled={manageMutation.isPending}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </div>
                        )}

                        {app.status === 'rejected' && app.rejection_reason && (
                          <div className="text-sm bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                            <span className="text-muted-foreground">Rejection Reason:</span>
                            <p className="mt-1">{app.rejection_reason}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No applications found</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Approval/Rejection Dialog */}
      <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve' : 'Reject'} Partner Application
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve'
                ? `Approve ${selectedApplication?.profiles?.username} as a partner`
                : `Reject ${selectedApplication?.profiles?.username}'s application`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {actionType === 'approve' && (
              <div className="space-y-2">
                <Label>Custom Commission Rate (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="10"
                    value={customCommission}
                    onChange={(e) => setCustomCommission(e.target.value)}
                    min="0"
                    max="50"
                    step="0.1"
                  />
                  <span className="flex items-center text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave empty to use global default (10%)
                </p>
              </div>
            )}

            {actionType === 'reject' && (
              <div className="space-y-2">
                <Label>Rejection Reason *</Label>
                <Textarea
                  placeholder="Please provide a reason for rejection..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedApplication(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              variant={actionType === 'approve' ? 'default' : 'destructive'}
              disabled={
                manageMutation.isPending ||
                (actionType === 'reject' && !rejectionReason.trim())
              }
            >
              {manageMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm {actionType === 'approve' ? 'Approval' : 'Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default PartnerApplications;
