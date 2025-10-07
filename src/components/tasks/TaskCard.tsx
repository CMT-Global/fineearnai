import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, DollarSign, Zap } from "lucide-react";
import { formatCurrency } from "@/lib/wallet-utils";

interface TaskCardProps {
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  baseReward: number;
  timeEstimate: number;
  onStart: () => void;
  status?: string;
  isDisabled?: boolean;
}

const difficultyColors = {
  easy: "bg-green-500/10 text-green-500 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  hard: "bg-red-500/10 text-red-500 border-red-500/20",
};

export const TaskCard = ({
  title,
  description,
  difficulty,
  baseReward,
  timeEstimate,
  onStart,
  status,
  isDisabled,
}: TaskCardProps) => {
  return (
    <Card className="p-6 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold">{title}</h3>
            <Badge variant="outline" className={difficultyColors[difficulty]}>
              {difficulty}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1 text-[hsl(var(--wallet-earnings))]">
          <DollarSign className="h-4 w-4" />
          <span className="font-semibold">{formatCurrency(baseReward)}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{timeEstimate} mins</span>
        </div>
      </div>

      <Button
        onClick={onStart}
        disabled={isDisabled}
        className="w-full bg-gradient-to-r from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] text-white hover:opacity-90"
      >
        <Zap className="h-4 w-4 mr-2" />
        {status === "in_progress" ? "Continue Task" : "Start Task"}
      </Button>
    </Card>
  );
};
