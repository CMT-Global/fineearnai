import { memo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { useTranslation } from "react-i18next";
import type { TaskDisplayOption } from "@/lib/task-options-order";

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

export interface TaskInterfaceProps {
  task: AITask;
  /** Display order for options (randomized per task); correctness is by key "a"|"b" */
  displayOrder: TaskDisplayOption[];
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

const OPTION_LABELS = ["optionA", "optionB"] as const;

const TaskInterfaceComponent = ({
  task,
  displayOrder,
  onSubmit,
  onSkip,
  isSubmitting,
  feedback,
  selectedResponse,
  onResponseChange,
}: TaskInterfaceProps) => {
  const { t } = useTranslation();
  
  const handleSubmit = async () => {
    if (!selectedResponse) return;
    await onSubmit(selectedResponse);
  };

  return (
    <Card className="p-6 lg:p-8 overflow-visible">
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
          <p className="text-sm text-muted-foreground">{t("tasks.interface.reward")}</p>
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
        <h2 className="text-xl font-semibold mb-2">{t("tasks.interface.taskQuestion")}</h2>
        <p className="text-lg leading-relaxed break-words whitespace-normal overflow-visible">{task.prompt}</p>
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
                    {t("tasks.interface.correctAnswer")}
                  </p>
                  <p className="text-sm text-[hsl(var(--success))]/80">
                    {t("tasks.interface.youEarned")} <CurrencyDisplay 
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
                    {t("tasks.interface.incorrectAnswer")}
                  </p>
                  <p className="text-sm text-[hsl(var(--destructive))]/80">
                    {t("tasks.interface.noEarnings")}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {displayOrder.map((opt, idx) => (
              <div
                key={opt.key}
                className={`p-4 rounded border-2 break-words ${
                  selectedResponse === opt.key
                    ? feedback.correctAnswer === opt.key
                      ? "border-[hsl(var(--success))] bg-[hsl(var(--success))]/10"
                      : "border-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10"
                    : "border-transparent bg-muted/30"
                }`}
              >
                <p className="font-medium text-sm mb-1">{t(`tasks.interface.${OPTION_LABELS[idx]}`)}:</p>
                <p className="text-sm break-words whitespace-normal overflow-visible">{opt.text}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedResponse === opt.key && (
                    <Badge variant="secondary">
                      {t("tasks.interface.yourAnswer")}
                    </Badge>
                  )}
                  {feedback.correctAnswer === opt.key && (
                    <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--primary-foreground))]">
                      {t("tasks.interface.correctAnswerBadge")}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-4 text-sm text-center text-muted-foreground">
            {t("tasks.interface.loadingNextTask")}
          </p>
        </div>
      ) : (
        <>
          {/* Response Options */}
          <div className="mb-6">
            <p className="text-sm text-muted-foreground mb-4">
              {t("tasks.interface.chooseBestResponse")}
            </p>

            <RadioGroup value={selectedResponse} onValueChange={onResponseChange}>
              <div className="space-y-4">
                {displayOrder.map((opt, idx) => (
                  <div
                    key={opt.key}
                    className="flex items-start space-x-3 p-4 rounded-lg border-2 hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <RadioGroupItem
                      value={opt.key}
                      id={`option-${opt.key}`}
                      className="mt-1 flex-shrink-0"
                    />
                    <Label
                      htmlFor={`option-${opt.key}`}
                      className="cursor-pointer flex-1 min-w-0"
                    >
                      <p className={`font-medium mb-2 ${idx === 0 ? "text-primary" : "text-green-600 dark:text-green-400"}`}>
                        {t(`tasks.interface.${OPTION_LABELS[idx]}`)}
                      </p>
                      <p className="text-sm leading-relaxed break-words whitespace-normal overflow-visible">{opt.text}</p>
                    </Label>
                  </div>
                ))}
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
              {t("tasks.interface.skipTask")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedResponse}
              className="flex-1 bg-gradient-to-r from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] text-white hover:opacity-90"
              size="lg"
            >
              {isSubmitting ? t("tasks.interface.submitting") : t("tasks.interface.submitAnswer")}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
};

export const TaskInterface = memo<TaskInterfaceProps>(TaskInterfaceComponent);
