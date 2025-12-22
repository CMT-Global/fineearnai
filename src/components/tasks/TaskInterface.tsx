import { memo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";

interface AITask {
  id: string;
  prompt: string;
  response_a: string;
  response_b: string;
  category: string;
  difficulty: string;
  reward: number;
}

interface Feedback {
  isCorrect: boolean;
  correctAnswer: string;
  earnedAmount: number;
  newBalance: number;
}

interface TaskInterfaceProps {
  task: AITask;
  onSubmit: (response: string) => Promise<void>;
  onSkip: () => Promise<void>;
  isSubmitting: boolean;
  feedback: Feedback | null;
  selectedResponse: string;
  onResponseChange: (value: string) => void;
}

const difficultyColors = {
  easy: "bg-green-500/10 text-green-500 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  hard: "bg-red-500/10 text-red-500 border-red-500/20",
};

const TaskInterfaceComponent = ({
  task,
  onSubmit,
  onSkip,
  isSubmitting,
  feedback,
  selectedResponse,
  onResponseChange,
}: TaskInterfaceProps) => {
  const handleSubmit = async () => {
    if (!selectedResponse) return;
    await onSubmit(selectedResponse);
  };

  return (
    <Card className="p-6 lg:p-8">
      {/* Task Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            {task.category}
          </Badge>
          <Badge 
            variant="outline" 
            className={`capitalize ${difficultyColors[task.difficulty as keyof typeof difficultyColors] || ''}`}
          >
            {task.difficulty}
          </Badge>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Reward</p>
          <p className="text-lg font-bold text-[hsl(var(--wallet-earnings))]">
            <CurrencyDisplay 
              amountUSD={task.reward}
              showSymbol={true}
              showSeparator={true}
              decimals={2}
              showTooltip={true}
            />
          </p>
        </div>
      </div>

      {/* Task Prompt */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Task Question:</h2>
        <p className="text-lg leading-relaxed">{task.prompt}</p>
      </div>

      {/* Feedback Display */}
      {feedback ? (
        <div
          className={`p-6 rounded-lg mb-6 ${
            feedback.isCorrect
              ? "bg-[hsl(var(--success))]/10 border-2 border-[hsl(var(--success))]/20"
              : "bg-[hsl(var(--destructive))]/10 border-2 border-[hsl(var(--destructive))]/20"
          }`}
        >
          <div className="flex items-center gap-3 mb-4">
            {feedback.isCorrect ? (
              <>
                <CheckCircle2 className="h-6 w-6 text-[hsl(var(--success))]" />
                <div>
                  <p className="font-semibold text-[hsl(var(--success))] text-lg">
                    Correct Answer!
                  </p>
                  <p className="text-sm text-[hsl(var(--success))]/80">
                    You earned <CurrencyDisplay 
                      amountUSD={feedback.earnedAmount}
                      showSymbol={true}
                      decimals={2}
                      showTooltip={false}
                      className="inline"
                    />
                  </p>
                </div>
              </>
            ) : (
              <>
                <XCircle className="h-6 w-6 text-[hsl(var(--destructive))]" />
                <div>
                  <p className="font-semibold text-[hsl(var(--destructive))] text-lg">
                    Incorrect Answer
                  </p>
                  <p className="text-sm text-[hsl(var(--destructive))]/80">
                    No earnings for this task
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div
              className={`p-4 rounded border-2 ${
                selectedResponse === "a"
                  ? feedback.correctAnswer === "a"
                    ? "border-[hsl(var(--success))] bg-[hsl(var(--success))]/10"
                    : "border-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10"
                  : "border-transparent bg-muted/30"
              }`}
            >
              <p className="font-medium text-sm mb-1">Option A:</p>
              <p className="text-sm">{task.response_a}</p>
              {selectedResponse === "a" && (
                <Badge className="mt-2" variant="secondary">
                  Your Answer
                </Badge>
              )}
              {feedback.correctAnswer === "a" && (
                <Badge className="mt-2 bg-[hsl(var(--success))] text-[hsl(var(--primary-foreground))]">
                  Correct Answer
                </Badge>
              )}
            </div>

            <div
              className={`p-4 rounded border-2 ${
                selectedResponse === "b"
                  ? feedback.correctAnswer === "b"
                    ? "border-[hsl(var(--success))] bg-[hsl(var(--success))]/10"
                    : "border-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10"
                  : "border-transparent bg-muted/30"
              }`}
            >
              <p className="font-medium text-sm mb-1">Option B:</p>
              <p className="text-sm">{task.response_b}</p>
              {selectedResponse === "b" && (
                <Badge className="mt-2" variant="secondary">
                  Your Answer
                </Badge>
              )}
              {feedback.correctAnswer === "b" && (
                <Badge className="mt-2 bg-[hsl(var(--success))] text-[hsl(var(--primary-foreground))]">
                  Correct Answer
                </Badge>
              )}
            </div>
          </div>

          <p className="mt-4 text-sm text-center text-muted-foreground">
            Loading next task...
          </p>
        </div>
      ) : (
        <>
          {/* Response Options */}
          <div className="mb-6">
            <p className="text-sm text-muted-foreground mb-4">
              Choose the best response from the options below:
            </p>

            <RadioGroup value={selectedResponse} onValueChange={onResponseChange}>
              <div className="space-y-4">
                {/* Option A */}
                <div className="flex items-start space-x-3 p-4 rounded-lg border-2 hover:bg-muted/50 cursor-pointer transition-colors">
                  <RadioGroupItem value="a" id="option-a" className="mt-1" />
                  <Label htmlFor="option-a" className="cursor-pointer flex-1">
                    <p className="font-medium text-primary mb-2">Option A</p>
                    <p className="text-sm leading-relaxed">{task.response_a}</p>
                  </Label>
                </div>

                {/* Option B */}
                <div className="flex items-start space-x-3 p-4 rounded-lg border-2 hover:bg-muted/50 cursor-pointer transition-colors">
                  <RadioGroupItem value="b" id="option-b" className="mt-1" />
                  <Label htmlFor="option-b" className="cursor-pointer flex-1">
                    <p className="font-medium text-green-600 dark:text-green-400 mb-2">
                      Option B
                    </p>
                    <p className="text-sm leading-relaxed">{task.response_b}</p>
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={onSkip}
              disabled={isSubmitting}
              className="flex-1"
              size="lg"
            >
              Skip Task
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedResponse}
              className="flex-1 bg-gradient-to-r from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] text-white hover:opacity-90"
              size="lg"
            >
              {isSubmitting ? "Submitting..." : "Submit Answer"}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
};

export const TaskInterface = memo(TaskInterfaceComponent);
