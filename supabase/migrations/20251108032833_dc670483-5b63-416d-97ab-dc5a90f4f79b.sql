-- ============================================
-- Phase 2A: PDF Documents Table Schema
-- ============================================

-- Create the how_it_works_pdf_documents table
CREATE TABLE IF NOT EXISTS public.how_it_works_pdf_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('generating', 'pending_review', 'approved', 'rejected')),
  file_url TEXT,
  file_size_bytes BIGINT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejected_reason TEXT,
  download_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT false,
  content_snapshot JSONB, -- Stores the steps content used for generation
  ai_prompt_used TEXT,
  generation_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_pdf_documents_active ON public.how_it_works_pdf_documents(is_active) WHERE is_active = true;
CREATE INDEX idx_pdf_documents_status ON public.how_it_works_pdf_documents(status);
CREATE INDEX idx_pdf_documents_generated_at ON public.how_it_works_pdf_documents(generated_at DESC);

-- Ensure only one active PDF at a time (unique constraint)
CREATE UNIQUE INDEX idx_one_active_pdf ON public.how_it_works_pdf_documents(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.how_it_works_pdf_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can manage all PDFs
CREATE POLICY "Admins can manage PDFs"
  ON public.how_it_works_pdf_documents
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policy: All authenticated users can view approved active PDFs
CREATE POLICY "Users can view approved PDFs"
  ON public.how_it_works_pdf_documents
  FOR SELECT
  TO authenticated
  USING (status = 'approved' AND is_active = true);

-- Trigger to auto-update updated_at timestamp
CREATE TRIGGER update_pdf_documents_timestamp
  BEFORE UPDATE ON public.how_it_works_pdf_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comments
COMMENT ON TABLE public.how_it_works_pdf_documents IS 'Stores AI-generated PDF documents for the How It Works guide. Admins generate PDFs using Lovable AI, review them, and publish one active version for all users to download.';
COMMENT ON COLUMN public.how_it_works_pdf_documents.version IS 'Version number of the PDF document';
COMMENT ON COLUMN public.how_it_works_pdf_documents.status IS 'Current status: generating, pending_review, approved, or rejected';
COMMENT ON COLUMN public.how_it_works_pdf_documents.is_active IS 'Only one PDF can be active at a time (enforced by unique index)';
COMMENT ON COLUMN public.how_it_works_pdf_documents.content_snapshot IS 'Snapshot of how_it_works_steps used to generate this PDF';
COMMENT ON COLUMN public.how_it_works_pdf_documents.download_count IS 'Number of times this PDF has been downloaded by users';