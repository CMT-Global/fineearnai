import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const TransactionSkeleton = () => {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <div className="text-right space-y-2">
          <Skeleton className="h-5 w-24 ml-auto" />
          <Skeleton className="h-3 w-32 ml-auto" />
          <Skeleton className="h-3 w-16 ml-auto" />
        </div>
      </div>
    </Card>
  );
};
