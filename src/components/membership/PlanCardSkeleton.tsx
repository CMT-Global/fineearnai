import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function PlanCardSkeleton() {
  return (
    <Card className="relative flex flex-col">
      <CardHeader>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-24 mt-2" />
      </CardHeader>

      <CardContent className="space-y-4 flex-1">
        {/* Earning Potential Skeleton */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <Skeleton className="h-4 w-32" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>

        {/* Features Skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </CardContent>

      <CardFooter>
        <Skeleton className="h-10 w-full" />
      </CardFooter>
    </Card>
  );
}
