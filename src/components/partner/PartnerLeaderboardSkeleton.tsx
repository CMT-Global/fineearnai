import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const PartnerLeaderboardSkeleton = () => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-4 w-full max-w-2xl" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 rounded-lg border-2 border-border hover:border-primary/30 transition-colors"
            >
              {/* Position Indicator */}
              <div className="flex-shrink-0 w-12 flex justify-center">
                <Skeleton className="h-10 w-10 rounded-full" />
              </div>

              {/* User Info */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-4 w-48" />
              </div>

              {/* Stats */}
              <div className="flex gap-6 text-right">
                <div className="space-y-1">
                  <Skeleton className="h-3 w-24 ml-auto" />
                  <Skeleton className="h-5 w-20 ml-auto" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-3 w-24 ml-auto" />
                  <Skeleton className="h-5 w-20 ml-auto" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Legend Skeleton */}
        <div className="mt-6 pt-6 border-t">
          <Skeleton className="h-5 w-40 mb-3" />
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
