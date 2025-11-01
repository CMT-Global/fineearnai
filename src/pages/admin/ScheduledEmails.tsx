import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
      toast.error("Access denied. Admin privileges required.");
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate]);

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
      toast.error("Failed to load scheduled emails");
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

      toast.success("Scheduled email deleted");
      setDeleteDialogOpen(false);
      setSelectedEmail(null);
      loadScheduledEmails();
    } catch (error: any) {
      console.error("Error deleting scheduled email:", error);
      toast.error("Failed to delete scheduled email");
    }
  };

  const handleCancel = async (email: ScheduledEmail) => {
    try {
      const { error } = await supabase
        .from("scheduled_emails")
        .update({ status: "cancelled" })
        .eq("id", email.id);

      if (error) throw error;

      toast.success("Scheduled email cancelled");
      loadScheduledEmails();
    } catch (error: any) {
      console.error("Error cancelling scheduled email:", error);
      toast.error("Failed to cancel scheduled email");
    }
  };

  const handleProcessNow = async () => {
    try {
      setProcessing(true);
      
      const { error } = await supabase.functions.invoke("process-scheduled-emails");

      if (error) throw error;

      toast.success("Scheduled emails processing triggered");
      
      // Reload after a delay to see updated statuses
      setTimeout(() => {
        loadScheduledEmails();
      }, 2000);
    } catch (error: any) {
      console.error("Error processing scheduled emails:", error);
      toast.error("Failed to process scheduled emails");
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
    if (!filter) return "Unknown";
    
    if (filter.type === "all") return "All Users";
    if (filter.type === "plan") return `Plan: ${filter.plan}`;
    if (filter.type === "country") return `Country: ${filter.country}`;
    if (filter.type === "usernames") {
      const count = filter.usernames?.split(",").length || 0;
      return `${count} specific user${count !== 1 ? 's' : ''}`;
    }
    
    return "Custom";
  };

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,98%)] flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading scheduled emails..." />
      </div>
    );
  }

  const pendingEmails = scheduledEmails.filter(e => e.status === "pending");
  const pastDueEmails = pendingEmails.filter(e => new Date(e.scheduled_for) < new Date());

  return (
    <div className="min-h-screen bg-[hsl(0,0%,98%)]">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Scheduled Emails</h1>
              <p className="text-muted-foreground">
                Manage and monitor scheduled email campaigns
              </p>
            </div>
            
            <Button 
              onClick={handleProcessNow}
              disabled={processing || pastDueEmails.length === 0}
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              Process Due Emails ({pastDueEmails.length})
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending
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
                Past Due
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
                Sent
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
                Failed
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
            <CardTitle>All Scheduled Emails</CardTitle>
            <CardDescription>
              {scheduledEmails.length} scheduled email{scheduledEmails.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Recipients</TableHead>
                    <TableHead>Scheduled For</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduledEmails.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No scheduled emails found
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
                                  PAST DUE
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
                                Sent: {format(new Date(email.sent_at), "MMM dd, hh:mm a")}
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
              <AlertDialogTitle>Delete Scheduled Email</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this scheduled email? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Preview Dialog */}
        <AlertDialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <AlertDialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>Email Preview</AlertDialogTitle>
              <AlertDialogDescription>
                Scheduled for: {selectedEmail && format(new Date(selectedEmail.scheduled_for), "MMMM dd, yyyy 'at' hh:mm a")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            {selectedEmail && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-1">Subject:</p>
                  <p className="text-sm bg-muted p-2 rounded">{selectedEmail.subject}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium mb-1">Recipients:</p>
                  <p className="text-sm text-muted-foreground">
                    {getRecipientSummary(selectedEmail.recipient_filter)}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium mb-2">Body:</p>
                  <div 
                    className="border rounded-lg p-4 bg-white prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
                  />
                </div>
              </div>
            )}
            
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setPreviewOpen(false)}>
                Close
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default ScheduledEmails;
