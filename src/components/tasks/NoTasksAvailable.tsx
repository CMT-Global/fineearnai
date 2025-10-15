import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Info, RefreshCw } from "lucide-react";

interface NoTasksAvailableProps {
  onRefresh: () => void;
}

export const NoTasksAvailable = ({ onRefresh }: NoTasksAvailableProps) => {
  return (
    <Card className="border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-background">
      <CardHeader className="text-center space-y-4 pb-4">
        <div className="mx-auto w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center">
          <Info className="h-8 w-8 text-blue-500" />
        </div>
        <div>
          <CardTitle className="text-2xl font-bold">
            No Tasks Available Right Now
          </CardTitle>
          <CardDescription className="text-base mt-2">
            All available tasks have been completed. New tasks will be added soon.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-center pb-6">
        <p className="text-sm text-muted-foreground">
          Please check back later for new AI training tasks.
        </p>
        <Button onClick={onRefresh} variant="outline" className="mt-2">
          <RefreshCw className="mr-2 h-4 w-4" />
          Check Again
        </Button>
      </CardContent>
    </Card>
  );
};
