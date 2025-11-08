-- ============================================
-- Phase 2B: Storage RLS Policies for PDF Documents
-- ============================================

-- Note: The storage bucket 'how-it-works-pdfs' will be created programmatically
-- These RLS policies will be applied to storage.objects for that bucket

-- RLS Policy: Admins can upload PDFs to how-it-works-pdfs bucket
CREATE POLICY "Admins can upload How It Works PDFs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'how-it-works-pdfs' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

-- RLS Policy: Admins can update PDFs in how-it-works-pdfs bucket
CREATE POLICY "Admins can update How It Works PDFs"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'how-it-works-pdfs' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

-- RLS Policy: Admins can delete PDFs from how-it-works-pdfs bucket
CREATE POLICY "Admins can delete How It Works PDFs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'how-it-works-pdfs' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

-- RLS Policy: All authenticated users can download PDFs from how-it-works-pdfs bucket
CREATE POLICY "Users can download How It Works PDFs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'how-it-works-pdfs');