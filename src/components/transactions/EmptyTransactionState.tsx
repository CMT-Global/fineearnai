import { Card } from "@/components/ui/card";
import { Wallet } from "lucide-react";

interface EmptyTransactionStateProps {
  hasActiveFilters: boolean;
  onClearFilters?: () => void;
}

export const EmptyTransactionState = ({ hasActiveFilters, onClearFilters }: EmptyTransactionStateProps) => {
  return (
    <Card className="p-12 text-center">
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <Wallet className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">
            {hasActiveFilters ? "No transactions found" : "No transactions yet"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {hasActiveFilters
              ? "Try adjusting your filters to see more transactions."
              : "Your transaction history will appear here once you start earning, depositing, or making withdrawals."}
          </p>
        </div>
        {hasActiveFilters && onClearFilters && (
          <button
            onClick={onClearFilters}
            className="text-sm text-primary hover:underline"
          >
            Clear all filters
          </button>
        )}
      </div>
    </Card>
  );
};
