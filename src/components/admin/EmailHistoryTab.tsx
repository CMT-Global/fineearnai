import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { RefreshCw, Search, CheckCircle2, XCircle, Clock, Eye } from "lucide-react";
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
  
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    loadEmails();
  }, [currentPage, statusFilter, searchTerm, emailType]);

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
    </div>
  );
}