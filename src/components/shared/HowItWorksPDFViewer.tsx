import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, FileText, Info } from "lucide-react";
import { useState } from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { toast } from "sonner";

export const HowItWorksPDFViewer = () => {
  const [isPrinting, setIsPrinting] = useState(false);

  // Fetch the active PDF document
  const { data: pdfDocument, isLoading } = useQuery({
    queryKey: ["active-how-it-works-pdf"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("how_it_works_pdf_documents")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const handleDownload = async () => {
    if (!pdfDocument?.file_url) return;

    setIsPrinting(true);
    try {
      // Create a temporary link to download the PDF
      const link = document.createElement('a');
      link.href = pdfDocument.file_url;
      link.download = `how-it-works-v${pdfDocument.version}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('PDF download started');
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error('Failed to download PDF');
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePreview = () => {
    if (!pdfDocument?.file_url) return;
    
    // Open PDF in new window
    window.open(pdfDocument.file_url, '_blank');
  };

  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!pdfDocument) {
    return (
      <Alert className="border-muted bg-muted/50">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-muted-foreground">
          PDF guide is currently being prepared. Please check back soon!
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <FileText className="h-5 w-5 text-primary" />
            Complete Guide (PDF)
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreview}
              className="border-border hover:bg-accent"
            >
              <FileText className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleDownload}
              disabled={isPrinting}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-4 w-4 mr-2" />
              {isPrinting ? "Preparing..." : "Download PDF"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="prose prose-sm max-w-none text-muted-foreground">
          <p>
            Download our comprehensive guide to learn everything about FineEarn. 
            This PDF includes detailed information about earning, withdrawals, membership plans, 
            and the referral program.
          </p>
        </div>

        {/* PDF Preview Frame */}
        <div className="border border-border rounded-lg overflow-hidden bg-muted/20">
          <AspectRatio ratio={16 / 9}>
            <iframe 
              src={pdfDocument.file_url}
              className="w-full h-full"
              title="PDF Preview"
            />
          </AspectRatio>
        </div>
        
        <div className="text-center text-xs text-muted-foreground">
          Version {pdfDocument.version} • Generated on{" "}
          {new Date(pdfDocument.created_at).toLocaleDateString()}
        </div>

        <Alert className="border-info/20 bg-info/5">
          <Info className="h-4 w-4 text-info" />
          <AlertDescription className="text-sm text-muted-foreground">
            Click "Download PDF" to save a printable version to your device. 
            Use your browser's print-to-PDF function for the best results.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
