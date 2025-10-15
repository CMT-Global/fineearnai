import { memo } from "react";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Zap, Wallet, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface TaskStatsProps {
  tasksCompletedToday: number;
  dailyLimit: number;
  remainingTasks: number;
  earningsBalance: number;
  isLoading?: boolean;
  isSyncing?: boolean;
}

const TaskStatsComponent = ({
  tasksCompletedToday,
  dailyLimit,
  remainingTasks,
  earningsBalance,
  isLoading = false,
  isSyncing = false,
}: TaskStatsProps) => {
  const progressPercentage = (tasksCompletedToday / dailyLimit) * 100;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
          <Skeleton className="h-2 w-full mt-3" />
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-12" />
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Today's Progress */}
      <Card className={`p-6 ${isSyncing ? 'opacity-70 transition-opacity' : ''}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-[hsl(var(--wallet-tasks))]/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-[hsl(var(--wallet-tasks))]" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                Today's Progress
                {isSyncing && <Loader2 className="h-3 w-3 animate-spin" />}
              </p>
              <p className="text-2xl font-bold">
                {tasksCompletedToday}/{dailyLimit}
              </p>
            </div>
          </div>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-[hsl(var(--wallet-tasks))] h-2 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(progressPercentage, 100)}%` }}
          />
        </div>
      </Card>

      {/* Remaining Tasks */}
      <Card className={`p-6 ${isSyncing ? 'opacity-70 transition-opacity' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-[hsl(var(--wallet-referrals))]/10 flex items-center justify-center">
            <Zap className="h-6 w-6 text-[hsl(var(--wallet-referrals))]" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              Remaining Tasks
              {isSyncing && <Loader2 className="h-3 w-3 animate-spin" />}
            </p>
            <p className="text-2xl font-bold">{remainingTasks}</p>
          </div>
        </div>
      </Card>

      {/* Earnings Wallet */}
      <Card className={`p-6 ${isSyncing ? 'opacity-70 transition-opacity' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-[hsl(var(--wallet-earnings))]/10 flex items-center justify-center">
            <Wallet className="h-6 w-6 text-[hsl(var(--wallet-earnings))]" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              Earnings Wallet
              {isSyncing && <Loader2 className="h-3 w-3 animate-spin" />}
            </p>
            <p className="text-2xl font-bold">${earningsBalance.toFixed(2)}</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export const TaskStats = memo(TaskStatsComponent);
