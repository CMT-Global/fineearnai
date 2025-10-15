import { Card } from "@/components/ui/card";
import { CheckCircle2, Zap, Wallet } from "lucide-react";

interface TaskStatsProps {
  tasksCompletedToday: number;
  dailyLimit: number;
  remainingTasks: number;
  earningsBalance: number;
}

export const TaskStats = ({
  tasksCompletedToday,
  dailyLimit,
  remainingTasks,
  earningsBalance,
}: TaskStatsProps) => {
  const progressPercentage = (tasksCompletedToday / dailyLimit) * 100;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Today's Progress */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-[hsl(var(--wallet-tasks))]/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-[hsl(var(--wallet-tasks))]" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Today's Progress</p>
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
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-[hsl(var(--wallet-referrals))]/10 flex items-center justify-center">
            <Zap className="h-6 w-6 text-[hsl(var(--wallet-referrals))]" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Remaining Tasks</p>
            <p className="text-2xl font-bold">{remainingTasks}</p>
          </div>
        </div>
      </Card>

      {/* Earnings Wallet */}
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-[hsl(var(--wallet-earnings))]/10 flex items-center justify-center">
            <Wallet className="h-6 w-6 text-[hsl(var(--wallet-earnings))]" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Earnings Wallet</p>
            <p className="text-2xl font-bold">${earningsBalance.toFixed(2)}</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
