-- ============================================================================
-- Content Rewards Program: Video Submission Table
-- Phase 1: Save submissions for admin review (no wallet crediting yet)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.content_reward_submissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Submission Details
  video_url        TEXT NOT NULL,
  platform         TEXT NOT NULL CHECK (platform IN ('youtube','tiktok','instagram','facebook','twitter','other')),
  video_title      TEXT,
  follower_count   TEXT,         -- self-reported, e.g. "12K"
  additional_notes TEXT,

  -- Admin Review
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by      UUID REFERENCES auth.users(id),
  reviewed_at      TIMESTAMP WITH TIME ZONE,

  -- Phase 2: reward crediting (present in schema, unused in Phase 1)
  reward_amount    NUMERIC NOT NULL DEFAULT 0,

  -- Timestamps
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_reward_user_id
  ON public.content_reward_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_content_reward_status
  ON public.content_reward_submissions(status);
CREATE INDEX IF NOT EXISTS idx_content_reward_created
  ON public.content_reward_submissions(created_at DESC);

-- RLS
ALTER TABLE public.content_reward_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own submissions" ON public.content_reward_submissions;
CREATE POLICY "Users can view their own submissions"
  ON public.content_reward_submissions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own submissions" ON public.content_reward_submissions;
CREATE POLICY "Users can create their own submissions"
  ON public.content_reward_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all submissions" ON public.content_reward_submissions;
CREATE POLICY "Admins can view all submissions"
  ON public.content_reward_submissions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update submissions" ON public.content_reward_submissions;
CREATE POLICY "Admins can update submissions"
  ON public.content_reward_submissions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Auto updated_at trigger
DROP TRIGGER IF EXISTS update_content_reward_submissions_updated_at
  ON public.content_reward_submissions;
CREATE TRIGGER update_content_reward_submissions_updated_at
  BEFORE UPDATE ON public.content_reward_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- COMPLETE: content_reward_submissions table ready for Phase 1
-- ============================================================================
