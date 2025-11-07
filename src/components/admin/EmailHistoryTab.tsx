import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { RefreshCw, Search, CheckCircle2, XCircle, Clock, Eye, Mail, Send, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EmailLog {
  id: string;
  recipient_email: string;
  subject: string;
  body: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  metadata: any;
  sent_by: string;
}

interface BatchStats {
  batch_id: string;
  total: number;
  successful: number;
  failed: number;
}

interface BulkEmailJob {
  id: string;
  batch_id: string;
  subject: string;
  body: string;
  recipient_filter: any;
  total_recipients: number;
  processed_count: number;
  successful_count: number;
  failed_count: number;
  status: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  last_processed_at: string | null;
  estimated_completion_at: string | null;
  error_message: string | null;
  created_by: string | null;
  processing_metadata: any;
}

interface EmailHistoryTabProps {
  emailType?: string; // For filtering specific email types (e.g., 'bulk', 'influencer_invite', 'user_invite')
}

export function EmailHistoryTab({ emailType }: EmailHistoryTabProps) {
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState<string | null>(null);
  const [batchStats, setBatchStats] = useState<Record<string, BatchStats>>({});
  
  // Bulk email jobs state
  const [queuedJobs, setQueuedJobs] = useState<BulkEmailJob[]>([]);
  const [processingJobs, setProcessingJobs] = useState<BulkEmailJob[]>([]);
  const [completedJobs, setCompletedJobs] = useState<BulkEmailJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("email-logs");
  
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    loadEmails();
    loadBulkEmailJobs();
  }, [currentPage, statusFilter, searchTerm, emailType]);

  // Realtime subscription for bulk email jobs
  useEffect(() => {
    const channel = supabase
      .channel('bulk-email-jobs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bulk_email_jobs'
        },
        (payload) => {
          console.log('📡 [Realtime] Bulk email job update:', payload);
          loadBulkEmailJobs(); // Reload jobs on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadEmails = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from("email_logs")
        .select("*", { count: "exact" })
        .order("sent_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);

      // Filter by status
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      // Filter by email type if specified
      if (emailType) {
        query = query.eq("metadata->>email_type", emailType);
      }

      // Search filter
      if (searchTerm) {
        query = query.or(
          `recipient_email.ilike.%${searchTerm}%,subject.ilike.%${searchTerm}%`
        );
      }

      const { data, error, count } = await query;

      if (error) throw error;

      setEmails(data || []);
      setTotalCount(count || 0);

      // Load batch statistics for bulk emails
      if (data && data.length > 0) {
        const batchIds = [...new Set(
          data
            .filter(email => {
              const metadata = email.metadata as any;
              return metadata?.batch_id;
            })
            .map(email => (email.metadata as any).batch_id as string)
        )];

        if (batchIds.length > 0) {
          const { data: allBatchEmails } = await supabase
            .from("email_logs")
            .select("status, metadata")
            .in("metadata->>batch_id", batchIds);

          if (allBatchEmails) {
            const stats: Record<string, BatchStats> = {};
            
            batchIds.forEach(batchId => {
              const batchEmails = allBatchEmails.filter(email => {
                const metadata = email.metadata as any;
                return metadata?.batch_id === batchId;
              });
              
              const total = batchEmails.length;
              const successful = batchEmails.filter(e => e.status === "sent").length;
              const failed = batchEmails.filter(e => e.status === "failed").length;
              
              stats[batchId] = { batch_id: batchId, total, successful, failed };
            });

            setBatchStats(stats);
          }
        }
      }
    } catch (error: any) {
      console.error("Error loading email history:", error);
      toast.error("Failed to load email history");
    } finally {
      setLoading(false);
    }
  };

  const loadBulkEmailJobs = async () => {
    try {
      setJobsLoading(true);

      // Load queued jobs
      const { data: queuedData, error: queuedError } = await supabase
        .from("bulk_email_jobs")
        .select("*")
        .eq("status", "queued")
        .order("created_at", { ascending: false });

      if (queuedError) throw queuedError;
      setQueuedJobs(queuedData || []);

      // Load processing jobs
      const { data: processingData, error: processingError } = await supabase
        .from("bulk_email_jobs")
        .select("*")
        .eq("status", "processing")
        .order("started_at", { ascending: false });

      if (processingError) throw processingError;
      setProcessingJobs(processingData || []);

      // Load completed/failed jobs (last 50)
      const { data: completedData, error: completedError } = await supabase
        .from("bulk_email_jobs")
        .select("*")
        .in("status", ["completed", "failed", "cancelled"])
        .order("completed_at", { ascending: false })
        .limit(50);

      if (completedError) throw completedError;
      setCompletedJobs(completedData || []);

    } catch (error: any) {
      console.error("Error loading bulk email jobs:", error);
      toast.error("Failed to load bulk email jobs");
    } finally {
      setJobsLoading(false);
    }
  };

  const checkDeliveryStatus = async (emailId: string) => {
    try {
      setCheckingStatus(emailId);
      
      const { data, error } = await supabase.functions.invoke(
        "check-email-delivery-status",
        {
          body: { emailLogId: emailId },
        }
      );

      if (error) throw error;

      toast.success("Delivery status updated");
      loadEmails(); // Refresh the list
    } catch (error: any) {
      console.error("Error checking delivery status:", error);
      toast.error(error.message || "Failed to check delivery status");
    } finally {
      setCheckingStatus(null);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('bulk_email_jobs')
        .update({ 
          status: 'cancelled',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId)
        .in('status', ['queued', 'processing']);

      if (error) throw error;
      toast.success('Job cancelled successfully');
      loadBulkEmailJobs();
    } catch (error: any) {
      console.error('Error cancelling job:', error);
      toast.error('Failed to cancel job: ' + error.message);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      // PHASE 4 FIX: Fetch job details to calculate remaining recipients
      const { data: jobData, error: fetchError } = await supabase
        .from('bulk_email_jobs')
        .select('total_recipients, processed_count, successful_count, failed_count, processing_metadata')
        .eq('id', jobId)
        .single();

      if (fetchError) throw fetchError;
      if (!jobData) throw new Error('Job not found');

      // Calculate remaining recipients
      const metadata = jobData.processing_metadata as any;
      const sentIds = metadata?.sent_recipient_ids || [];
      const remainingRecipients = jobData.total_recipients - sentIds.length;

      if (remainingRecipients <= 0) {
        toast.info('No remaining recipients to process');
        return;
      }

      // Show confirmation dialog
      const confirmed = window.confirm(
        `This will retry sending to ${remainingRecipients} remaining recipients.\n\n` +
        `Progress so far:\n` +
        `- Total: ${jobData.total_recipients}\n` +
        `- Sent: ${sentIds.length}\n` +
        `- Successful: ${jobData.successful_count}\n` +
        `- Failed: ${jobData.failed_count}\n\n` +
        `Continue?`
      );

      if (!confirmed) return;

      // PHASE 4 FIX: Only reset status, error, timestamps, and worker tracking
      // DO NOT reset counts - they will continue from where they left off
      const { error } = await supabase
        .from('bulk_email_jobs')
        .update({ 
          status: 'queued',
          error_message: null,
          started_at: null,
          completed_at: null,
          last_processed_at: null,
          processing_worker_id: null,
          last_heartbeat: null,
          cancel_requested: false
        })
        .eq('id', jobId);

      if (error) throw error;
      toast.success(`Job queued for retry (${remainingRecipients} recipients remaining)`);
      loadBulkEmailJobs();
    } catch (error: any) {
      console.error('Error retrying job:', error);
      toast.error('Failed to retry job: ' + error.message);
    }
  };

  const handleManualTrigger = async () => {
    try {
      toast.info('Triggering queue processing...');
      const { data, error } = await supabase.functions.invoke('process-bulk-email-queue');
      
      if (error) throw error;
      toast.success('Queue processing triggered manually');
      setTimeout(() => loadBulkEmailJobs(), 2000); // Reload after 2 seconds
    } catch (error: any) {
      console.error('Error triggering queue:', error);
      toast.error('Failed to trigger queue: ' + error.message);
    }
  };

  const getJobStatusBadge = (status: string) => {
    switch (status) {
      case "queued":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Queued</Badge>;
      case "processing":
        return <Badge className="bg-blue-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
      case "completed":
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case "cancelled":
        return <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusBadge = (status: string, metadata: any) => {
    const deliveryStatus = metadata?.delivery_status?.last_event;
    
    if (deliveryStatus) {
      switch (deliveryStatus) {
        case "delivered":
          return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Delivered</Badge>;
        case "bounced":
          return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Bounced</Badge>;
        case "complained":
          return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Spam</Badge>;
        case "opened":
          return <Badge className="bg-blue-500"><Eye className="h-3 w-3 mr-1" />Opened</Badge>;
        default:
          return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{deliveryStatus}</Badge>;
      }
    }

    switch (status) {
      case "sent":
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Sent</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  if (loading && emails.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" text="Loading email history..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs for Email Logs and Bulk Email Jobs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="email-logs">
            <Mail className="h-4 w-4 mr-2" />
            Email Logs
          </TabsTrigger>
          <TabsTrigger value="queue">
            <Clock className="h-4 w-4 mr-2" />
            Queue ({queuedJobs.length})
          </TabsTrigger>
          <TabsTrigger value="processing">
            <Send className="h-4 w-4 mr-2" />
            Processing ({processingJobs.length})
          </TabsTrigger>
          <TabsTrigger value="complete">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Complete ({completedJobs.length})
          </TabsTrigger>
        </TabsList>

        {/* Email Logs Tab */}
        <TabsContent value="email-logs" className="space-y-6">
          {/* Filters */}
          <Card>
        <CardHeader>
          <CardTitle>Email History</CardTitle>
          <CardDescription>
            View and track all emails sent from the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or subject..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={loadEmails} variant="outline" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="text-sm text-muted-foreground">
        Showing {emails.length} of {totalCount} emails
      </div>

      {/* Email Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Success Rate</TableHead>
                  <TableHead>Resend ID</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No emails found
                    </TableCell>
                  </TableRow>
                ) : (
                  emails.map((email) => {
                    const metadata = email.metadata as any;
                    const batchId = metadata?.batch_id;
                    const stats = batchId ? batchStats[batchId] : null;
                    
                    return (
                      <TableRow key={email.id}>
                        <TableCell className="whitespace-nowrap">
                          {email.sent_at
                            ? format(new Date(email.sent_at), "MMM dd, yyyy HH:mm")
                            : "Not sent"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {email.recipient_email}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate">
                          {email.subject}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(email.status, email.metadata)}
                        </TableCell>
                        <TableCell>
                          {stats ? (
                            <Badge variant="outline" className="font-mono">
                              {stats.successful}/{stats.total}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs max-w-[150px] truncate">
                          {email.metadata?.resend_id || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedEmail(email);
                                setViewDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {email.metadata?.resend_id && email.status === "sent" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => checkDeliveryStatus(email.id)}
                                disabled={checkingStatus === email.id}
                              >
                                {checkingStatus === email.id ? (
                                  <LoadingSpinner size="sm" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                              </Button>
                            )}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

          {/* Email Details Dialog */}
          <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Details</DialogTitle>
            <DialogDescription>
              Full email information and delivery status
            </DialogDescription>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-1">Recipient</h4>
                <p className="text-sm">{selectedEmail.recipient_email}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">Subject</h4>
                <p className="text-sm">{selectedEmail.subject}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">Status</h4>
                {getStatusBadge(selectedEmail.status, selectedEmail.metadata)}
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">Sent At</h4>
                <p className="text-sm">
                  {selectedEmail.sent_at
                    ? format(new Date(selectedEmail.sent_at), "PPpp")
                    : "Not sent yet"}
                </p>
              </div>
              {selectedEmail.metadata?.resend_id && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Resend ID</h4>
                  <p className="text-sm font-mono">{selectedEmail.metadata.resend_id}</p>
                </div>
              )}
              {selectedEmail.metadata?.delivery_status && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Delivery Status</h4>
                  <div className="text-sm space-y-1">
                    <p><strong>Last Event:</strong> {selectedEmail.metadata.delivery_status.last_event}</p>
                    <p><strong>Checked:</strong> {format(new Date(selectedEmail.metadata.delivery_status.checked_at), "PPpp")}</p>
                  </div>
                </div>
              )}
              {selectedEmail.error_message && (
                <div>
                  <h4 className="text-sm font-medium mb-1 text-destructive">Error Message</h4>
                  <p className="text-sm text-destructive">{selectedEmail.error_message}</p>
                </div>
              )}
              <div>
                <h4 className="text-sm font-medium mb-2">Email Body</h4>
                <div 
                  className="border rounded-md p-4 bg-muted/50 max-h-[400px] overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
                />
              </div>
            </div>
          )}
        </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Queue Tab */}
        <TabsContent value="queue" className="space-y-6">
          {queuedJobs.length > 0 && (
            <div className="flex justify-end">
              <Button 
                onClick={handleManualTrigger}
                variant="default"
                size="sm"
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                Process Queue Now
              </Button>
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Queued Jobs</CardTitle>
              <CardDescription>
                Bulk email jobs waiting to be processed
              </CardDescription>
            </CardHeader>
            <CardContent>
              {jobsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner size="lg" text="Loading queued jobs..." />
                </div>
              ) : queuedJobs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No jobs in queue</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {queuedJobs.map((job) => (
                    <Card key={job.id} className="border-l-4 border-l-yellow-500">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{job.subject}</h4>
                              {getJobStatusBadge(job.status)}
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Total Recipients:</span>
                                <span className="font-semibold ml-2">{job.total_recipients.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Created:</span>
                                <span className="ml-2">{format(new Date(job.created_at), "MMM dd, HH:mm")}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Batch ID:</span>
                                <span className="font-mono text-xs ml-2">{job.batch_id}</span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelJob(job.id)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Processing Tab */}
        <TabsContent value="processing" className="space-y-6">
          {processingJobs.length > 0 && (
            <div className="flex justify-end">
              <Button 
                onClick={handleManualTrigger}
                variant="default"
                size="sm"
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                Process Queue Now
              </Button>
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Processing Jobs</CardTitle>
              <CardDescription>
                Bulk email jobs currently being sent
              </CardDescription>
            </CardHeader>
            <CardContent>
              {jobsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner size="lg" text="Loading processing jobs..." />
                </div>
              ) : processingJobs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No jobs currently processing</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {processingJobs.map((job) => {
                    const progress = job.total_recipients > 0 
                      ? (job.processed_count / job.total_recipients) * 100 
                      : 0;
                    const successRate = job.processed_count > 0
                      ? (job.successful_count / job.processed_count) * 100
                      : 0;

                    return (
                      <Card key={job.id} className="border-l-4 border-l-blue-500">
                        <CardContent className="pt-6">
                          <div className="space-y-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold">{job.subject}</h4>
                                  {getJobStatusBadge(job.status)}
                                </div>
                                <p className="text-sm text-muted-foreground">Batch ID: {job.batch_id}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelJob(job.id)}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Cancel
                              </Button>
                            </div>

                            {/* Progress Bar */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Progress</span>
                                <span className="font-semibold">{progress.toFixed(1)}%</span>
                              </div>
                              <Progress value={progress} className="h-2" />
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{job.processed_count.toLocaleString()} / {job.total_recipients.toLocaleString()}</span>
                                <span>{(job.total_recipients - job.processed_count).toLocaleString()} remaining</span>
                              </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                              <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">{job.successful_count.toLocaleString()}</div>
                                <div className="text-xs text-muted-foreground">Successful</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-red-600">{job.failed_count.toLocaleString()}</div>
                                <div className="text-xs text-muted-foreground">Failed</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">{successRate.toFixed(1)}%</div>
                                <div className="text-xs text-muted-foreground">Success Rate</div>
                              </div>
                            </div>

                            {/* Timing Info */}
                            <div className="text-xs text-muted-foreground space-y-1">
                              {job.started_at && (
                                <div>Started: {format(new Date(job.started_at), "MMM dd, HH:mm:ss")}</div>
                              )}
                              {job.last_processed_at && (
                                <div>Last update: {format(new Date(job.last_processed_at), "MMM dd, HH:mm:ss")}</div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Complete Tab */}
        <TabsContent value="complete" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Completed Jobs</CardTitle>
              <CardDescription>
                Bulk email jobs that have finished processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              {jobsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner size="lg" text="Loading completed jobs..." />
                </div>
              ) : completedJobs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No completed jobs yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {completedJobs.map((job) => {
                    const successRate = job.total_recipients > 0
                      ? (job.successful_count / job.total_recipients) * 100
                      : 0;
                    const isSuccess = job.status === "completed";

                    return (
                      <Card key={job.id} className={`border-l-4 ${isSuccess ? 'border-l-green-500' : 'border-l-red-500'}`}>
                        <CardContent className="pt-6">
                          <div className="space-y-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold">{job.subject}</h4>
                                  {getJobStatusBadge(job.status)}
                                </div>
                                <p className="text-sm text-muted-foreground">Batch ID: {job.batch_id}</p>
                              </div>
                              {job.status === 'failed' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRetryJob(job.id)}
                                  className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                                >
                                  <RefreshCw className="h-4 w-4 mr-1" />
                                  Retry
                                </Button>
                              )}
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-4 gap-4 pt-2 border-t">
                              <div className="text-center">
                                <div className="text-xl font-bold">{job.total_recipients.toLocaleString()}</div>
                                <div className="text-xs text-muted-foreground">Total</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xl font-bold text-green-600">{job.successful_count.toLocaleString()}</div>
                                <div className="text-xs text-muted-foreground">Successful</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xl font-bold text-red-600">{job.failed_count.toLocaleString()}</div>
                                <div className="text-xs text-muted-foreground">Failed</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xl font-bold text-blue-600">{successRate.toFixed(1)}%</div>
                                <div className="text-xs text-muted-foreground">Success Rate</div>
                              </div>
                            </div>

                            {/* Timing Info */}
                            <div className="text-xs text-muted-foreground space-y-1">
                              <div>Created: {format(new Date(job.created_at), "MMM dd, HH:mm")}</div>
                              {job.started_at && (
                                <div>Started: {format(new Date(job.started_at), "MMM dd, HH:mm")}</div>
                              )}
                              {job.completed_at && (
                                <div>Completed: {format(new Date(job.completed_at), "MMM dd, HH:mm")}</div>
                              )}
                              {job.started_at && job.completed_at && (
                                <div>
                                  Duration: {Math.round((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000 / 60)} minutes
                                </div>
                              )}
                            </div>

                            {/* Error Message */}
                            {job.error_message && (
                              <div className="pt-2 border-t">
                                <p className="text-sm text-destructive font-semibold">Error:</p>
                                <p className="text-xs text-destructive mt-1">{job.error_message}</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}