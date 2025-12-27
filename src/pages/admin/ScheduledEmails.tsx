import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Calendar, Clock, Trash2, Eye, PlayCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { format } from "date-fns";

interface ScheduledEmail {
  id: string;
  subject: string;
  body: string;
  recipient_filter: any;
  scheduled_for: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  created_by: string | null;
  template_id: string | null;
}

const ScheduledEmails = () => {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<ScheduledEmail | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      toast.error(t("toasts.admin.accessDenied"));
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate, t]);

  useEffect(() => {
    if (isAdmin) {
      loadScheduledEmails();
    }
  }, [isAdmin]);

  const loadScheduledEmails = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("scheduled_emails")
        .select("*")
        .order("scheduled_for", { ascending: true });

      if (error) throw error;

      setScheduledEmails(data || []);
    } catch (error: any) {
      console.error("Error loading scheduled emails:", error);
      toast.error(t("toasts.admin.failedToLoadScheduledEmails"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEmail) return;

    try {
      const { error } = await supabase
        .from("scheduled_emails")
        .delete()
        .eq("id", selectedEmail.id);

      if (error) throw error;

      toast.success(t("toasts.admin.scheduledEmailDeleted"));
      setDeleteDialogOpen(false);
      setSelectedEmail(null);
      loadScheduledEmails();
    } catch (error: any) {
      console.error("Error deleting scheduled email:", error);
      toast.error(t("toasts.admin.failedToDeleteScheduledEmail"));
    }
  };

  const handleCancel = async (email: ScheduledEmail) => {
    try {
      const { error } = await supabase
        .from("scheduled_emails")
        .update({ status: "cancelled" })
        .eq("id", email.id);

      if (error) throw error;

      toast.success(t("toasts.admin.scheduledEmailCancelled"));
      loadScheduledEmails();
    } catch (error: any) {
      console.error("Error cancelling scheduled email:", error);
      toast.error(t("toasts.admin.failedToCancelScheduledEmail"));
    }
  };

  const handleProcessNow = async () => {
    try {
      setProcessing(true);
      
      const { error } = await supabase.functions.invoke("process-scheduled-emails");

      if (error) throw error;

      toast.success(t("toasts.admin.scheduledEmailsProcessingTriggered"));
      
      // Reload after a delay to see updated statuses
      setTimeout(() => {
        loadScheduledEmails();
      }, 2000);
    } catch (error: any) {
      console.error("Error processing scheduled emails:", error);
      toast.error(t("toasts.admin.failedToProcessScheduledEmails"));
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      processing: "default",
      sent: "outline",
      failed: "destructive",
      cancelled: "secondary",
    };

    return (
      <Badge variant={variants[status] || "secondary"}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getRecipientSummary = (filter: any) => {
    if (!filter) return t("admin.scheduledEmails.recipientSummary.unknown");
    
    if (filter.type === "all") return t("admin.scheduledEmails.recipientSummary.allUsers");
    if (filter.type === "plan") return t("admin.scheduledEmails.recipientSummary.plan", { plan: filter.plan });
    if (filter.type === "country") return t("admin.scheduledEmails.recipientSummary.country", { country: filter.country });
    if (filter.type === "usernames") {
      const count = filter.usernames?.split(",").length || 0;
      return count === 1 
        ? t("admin.scheduledEmails.recipientSummary.specificUsers", { count })
        : t("admin.scheduledEmails.recipientSummary.specificUsersPlural", { count });
    }
    
    return t("admin.scheduledEmails.recipientSummary.custom");
  };

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text={t("admin.scheduledEmails.loadingScheduledEmails")} />
      </div>
    );
  }

  const pendingEmails = scheduledEmails.filter(e => e.status === "pending");
  const pastDueEmails = pendingEmails.filter(e => new Date(e.scheduled_for) < new Date());

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("admin.scheduledEmails.backToAdmin")}
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">{t("admin.scheduledEmails.title")}</h1>
              <p className="text-muted-foreground">
                {t("admin.scheduledEmails.subtitle")}
              </p>
            </div>
            
            <Button 
              onClick={handleProcessNow}
              disabled={processing || pastDueEmails.length === 0}
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              {t("admin.scheduledEmails.processDueEmails")} ({pastDueEmails.length})
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("admin.scheduledEmails.pending")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {scheduledEmails.filter(e => e.status === "pending").length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("admin.scheduledEmails.pastDue")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {pastDueEmails.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("admin.scheduledEmails.sent")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {scheduledEmails.filter(e => e.status === "sent").length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("admin.scheduledEmails.failed")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {scheduledEmails.filter(e => e.status === "failed").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Scheduled Emails Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.scheduledEmails.allScheduledEmails")}</CardTitle>
            <CardDescription>
              {scheduledEmails.length === 1 
                ? t("admin.scheduledEmails.scheduledEmailsCount", { count: scheduledEmails.length })
                : t("admin.scheduledEmails.scheduledEmailsCountPlural", { count: scheduledEmails.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.scheduledEmails.subject")}</TableHead>
                    <TableHead>{t("admin.scheduledEmails.recipients")}</TableHead>
                    <TableHead>{t("admin.scheduledEmails.scheduledFor")}</TableHead>
                    <TableHead>{t("admin.scheduledEmails.status")}</TableHead>
                    <TableHead>{t("admin.scheduledEmails.created")}</TableHead>
                    <TableHead className="text-right">{t("admin.scheduledEmails.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduledEmails.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {t("admin.scheduledEmails.noScheduledEmailsFound")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    scheduledEmails.map((email) => {
                      const isPastDue = new Date(email.scheduled_for) < new Date() && email.status === "pending";
                      
                      return (
                        <TableRow key={email.id}>
                          <TableCell className="font-medium max-w-[300px] truncate">
                            {email.subject}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {getRecipientSummary(email.recipient_filter)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {isPastDue && (
                                <Badge variant="destructive" className="text-xs">
                                  {t("admin.scheduledEmails.pastDueBadge")}
                                </Badge>
                              )}
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">
                                  {format(new Date(email.scheduled_for), "MMM dd, yyyy")}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(email.scheduled_for), "hh:mm a")}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(email.status)}
                            {email.sent_at && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {t("admin.scheduledEmails.sentAt", { date: format(new Date(email.sent_at), "MMM dd, hh:mm a") })}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(email.created_at), "MMM dd, yyyy")}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedEmail(email);
                                  setPreviewOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              
                              {email.status === "pending" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancel(email)}
                                >
                                  <XCircle className="h-4 w-4 text-orange-600" />
                                </Button>
                              )}
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedEmail(email);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("admin.scheduledEmails.deleteScheduledEmail")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("admin.scheduledEmails.deleteConfirmation")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                {t("common.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Preview Dialog */}
        <AlertDialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <AlertDialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>{t("admin.scheduledEmails.emailPreview")}</AlertDialogTitle>
              <AlertDialogDescription>
                {selectedEmail && t("admin.scheduledEmails.scheduledForDate", { date: format(new Date(selectedEmail.scheduled_for), "MMMM dd, yyyy 'at' hh:mm a") })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            {selectedEmail && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-1">{t("admin.scheduledEmails.subject")}:</p>
                  <p className="text-sm bg-muted p-2 rounded">{selectedEmail.subject}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium mb-1">{t("admin.scheduledEmails.recipients")}:</p>
                  <p className="text-sm text-muted-foreground">
                    {getRecipientSummary(selectedEmail.recipient_filter)}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium mb-2">Body:</p>
                  <div 
                    className="border rounded-lg p-4 bg-card prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
                  />
                </div>
              </div>
            )}
            
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setPreviewOpen(false)}>
                {t("common.close")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default ScheduledEmails;
