import { TransactionSkeleton } from "./TransactionSkeleton";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

interface TransactionListLoadingProps {
  count?: number;
  isInitialLoad?: boolean;
}

export const TransactionListLoading = ({ 
  count = 5, 
  isInitialLoad = true 
}: TransactionListLoadingProps) => {
  if (isInitialLoad) {
    return (
      <div className="space-y-3">
        {[...Array(count)].map((_, i) => (
          <TransactionSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex justify-center py-8">
      <LoadingSpinner size="md" text="Loading more transactions..." />
    </div>
  );
};
