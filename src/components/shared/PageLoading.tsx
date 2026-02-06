import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

interface PageLoadingProps {
  text: string;
}

/**
 * Consistent full-page loading state: centered in the middle of the viewport.
 * Use with page-specific loading text (e.g. "Loading dashboard...", "Loading wallet...").
 */
export const PageLoading = ({ text }: PageLoadingProps) => (
  <div className="flex items-center justify-center min-h-screen w-full">
    <LoadingSpinner size="lg" text={text} />
  </div>
);
