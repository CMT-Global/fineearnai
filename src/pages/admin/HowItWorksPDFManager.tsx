import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
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
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { 
  FileText, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Eye,
  Download,
  Clock,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const HowItWorksPDFManager = () => {
  const queryClient = useQueryClient();
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  // Fetch PDF documents
  const { data: documents, isLoading } = useQuery({
    queryKey: ['how-it-works-pdfs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('how_it_works_pdf_documents')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Generate PDF mutation
  const generatePDF = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('generate-how-it-works-pdf', {
        body: { admin_id: user.id }
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      toast.success('PDF generation started successfully');
      queryClient.invalidateQueries({ queryKey: ['how-it-works-pdfs'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to generate PDF');
    },
  });

  // Approve PDF mutation
  const approvePDF = useMutation({
    mutationFn: async (docId: string) => {
      // First, set all other documents to inactive
      await supabase
        .from('how_it_works_pdf_documents')
        .update({ is_active: false })
        .neq('id', docId);

      // Then approve and activate the selected document
      const { error } = await supabase
        .from('how_it_works_pdf_documents')
        .update({ 
          status: 'approved',
          is_active: true,
          approved_at: new Date().toISOString()
        })
        .eq('id', docId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('PDF approved and set as active');
      queryClient.invalidateQueries({ queryKey: ['how-it-works-pdfs'] });
      setReviewDialogOpen(false);
      setSelectedDoc(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve PDF');
    },
  });

  // Reject PDF mutation
  const rejectPDF = useMutation({
    mutationFn: async ({ docId, reason }: { docId: string; reason: string }) => {
      const { error } = await supabase
        .from('how_it_works_pdf_documents')
        .update({ 
          status: 'rejected',
          rejection_reason: reason
        })
        .eq('id', docId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('PDF rejected');
      queryClient.invalidateQueries({ queryKey: ['how-it-works-pdfs'] });
      setReviewDialogOpen(false);
      setSelectedDoc(null);
      setRejectionReason('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject PDF');
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_review':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending Review</Badge>;
      case 'approved':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const pendingDocs = documents?.filter(doc => doc.status === 'pending_review') || [];
  const historyDocs = documents?.filter(doc => doc.status !== 'pending_review') || [];

  const handlePreview = (doc: any) => {
    setSelectedDoc(doc);
    setPreviewDialogOpen(true);
  };

  const handleReview = (doc: any) => {
    setSelectedDoc(doc);
    setReviewDialogOpen(true);
  };

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <AdminBreadcrumb 
          items={[
            { label: "Communications", path: "/admin/communications/email-settings" },
            { label: "How It Works PDFs" }
          ]}
        />

        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <FileText className="h-8 w-8" />
                How It Works PDF Generator
              </h1>
              <p className="text-muted-foreground mt-2">
                Generate AI-powered PDF documents from How It Works content
              </p>
            </div>
            <Button 
              onClick={() => generatePDF.mutate()}
              disabled={generatePDF.isPending}
              size="lg"
            >
              {generatePDF.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generate New PDF
                </>
              )}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList>
            <TabsTrigger value="pending">
              Pending Review {pendingDocs.length > 0 && `(${pendingDocs.length})`}
            </TabsTrigger>
            <TabsTrigger value="history">
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Pending Review</CardTitle>
                <CardDescription>
                  Review and approve generated PDFs before making them active
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : pendingDocs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No pending PDFs to review
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Version</TableHead>
                        <TableHead>Generated</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingDocs.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium">
                            v{doc.version}
                          </TableCell>
                          <TableCell>
                            {format(new Date(doc.created_at), 'MMM dd, yyyy HH:mm')}
                          </TableCell>
                          <TableCell>{getStatusBadge(doc.status)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePreview(doc)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Preview
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleReview(doc)}
                              >
                                Review
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>PDF History</CardTitle>
                <CardDescription>
                  All generated PDFs and their status
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : historyDocs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No PDF history available
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Version</TableHead>
                        <TableHead>Generated</TableHead>
                        <TableHead>Reviewed</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyDocs.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium">
                            v{doc.version}
                          </TableCell>
                          <TableCell>
                            {format(new Date(doc.created_at), 'MMM dd, yyyy HH:mm')}
                          </TableCell>
                          <TableCell>
                            {doc.approved_at 
                              ? format(new Date(doc.approved_at), 'MMM dd, yyyy HH:mm')
                              : '-'
                            }
                          </TableCell>
                          <TableCell>{getStatusBadge(doc.status)}</TableCell>
                          <TableCell>
                            {doc.is_active && (
                              <Badge variant="default" className="bg-blue-500">Active</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePreview(doc)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Preview
                              </Button>
                              {doc.file_url && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(doc.file_url, '_blank')}
                                >
                                  <Download className="h-4 w-4 mr-1" />
                                  Download
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review PDF Document</DialogTitle>
            <DialogDescription>
              Review the generated PDF and approve or reject it
            </DialogDescription>
          </DialogHeader>
          
          {selectedDoc && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Version:</span>
                  <span className="ml-2 font-medium">v{selectedDoc.version}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Generated:</span>
                  <span className="ml-2 font-medium">
                    {format(new Date(selectedDoc.created_at), 'MMM dd, yyyy HH:mm')}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Rejection Reason (required if rejecting)</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide a reason for rejection..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReviewDialogOpen(false);
                setRejectionReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!rejectionReason.trim()) {
                  toast.error('Please provide a rejection reason');
                  return;
                }
                rejectPDF.mutate({ 
                  docId: selectedDoc.id, 
                  reason: rejectionReason 
                });
              }}
              disabled={rejectPDF.isPending}
            >
              {rejectPDF.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Reject
            </Button>
            <Button
              onClick={() => approvePDF.mutate(selectedDoc.id)}
              disabled={approvePDF.isPending}
            >
              {approvePDF.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Approve & Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>PDF Preview - v{selectedDoc?.version}</DialogTitle>
            <DialogDescription>
              Preview of the AI-generated HTML content
            </DialogDescription>
          </DialogHeader>
          
          <div className="overflow-y-auto max-h-[60vh] border rounded-lg p-4">
            {selectedDoc?.file_url ? (
              <iframe 
                src={selectedDoc.file_url} 
                className="w-full h-[500px] border-0"
                title="PDF Preview"
              />
            ) : (
              <div 
                dangerouslySetInnerHTML={{ __html: selectedDoc?.content_snapshot || '' }}
                className="prose max-w-none"
              />
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPreviewDialogOpen(false)}
            >
              Close
            </Button>
            {selectedDoc?.file_url && (
              <Button
                onClick={() => window.open(selectedDoc.file_url, '_blank')}
              >
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default HowItWorksPDFManager;
