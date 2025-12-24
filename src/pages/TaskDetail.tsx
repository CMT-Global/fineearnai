import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCurrencyConversion } from "@/hooks/useCurrencyConversion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, XCircle, Info } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/wallet-utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

const TaskDetail = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { formatAmount } = useCurrencyConversion();
  const [task, setTask] = useState<any>(null);
  const [selectedResponse, setSelectedResponse] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime] = useState<number>(Date.now());
  const [feedback, setFeedback] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      loadNextTask();
    }
  }, [user]);

  const loadNextTask = async () => {
    try {
      // Get user profile to check daily limit
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("tasks_completed_today, membership_plan")
        .eq("id", user?.id)
        .single();

      const { data: plan } = await supabase
        .from("membership_plans")
        .select("daily_task_limit, earning_per_task")
        .eq("name", profile?.membership_plan)
        .single();

      if (profileError) throw profileError;

      // Check if user has reached daily limit
      if (profile.tasks_completed_today >= (plan?.daily_task_limit || 0)) {
        toast.error("Daily task limit reached!");
        navigate("/tasks");
        return;
      }

      // Get completed task IDs for this user
      const { data: completions } = await supabase
        .from("task_completions")
        .select("task_id")
        .eq("user_id", user?.id);

      const completedTaskIds = completions?.map(c => c.task_id) || [];

      // Get next available task
      let query = supabase
        .from("ai_tasks")
        .select("*")
        .eq("is_active", true);

      if (completedTaskIds.length > 0) {
        query = query.not("id", "in", `(${completedTaskIds.join(",")})`);
      }

      const { data: nextTask, error: taskError } = await query
        .limit(1)
        .single();

      if (taskError || !nextTask) {
        toast.info("No more tasks available at the moment");
        navigate("/tasks");
        return;
      }

      setTask(nextTask);
    } catch (error) {
      console.error("Error loading task:", error);
      toast.error("Failed to load task");
      navigate("/tasks");
    }
  };

  const handleSkipTask = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("skips_today, membership_plan")
        .eq("id", user?.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { data: plan } = await supabase
        .from("membership_plans")
        .select("task_skip_limit_per_day")
        .eq("name", profile.membership_plan)
        .single();

      if (profile.skips_today >= (plan?.task_skip_limit_per_day || 0)) {
        toast.error("Daily skip limit reached!");
        return;
      }

      // Update skip count
      await supabase
        .from("profiles")
        .update({ skips_today: profile.skips_today + 1 })
        .eq("id", user?.id);

      toast.info("Task skipped");
      loadNextTask();
    } catch (error: any) {
      console.error("Error skipping task:", error);
      toast.error(error.message || "Failed to skip task");
    }
  };

  const handleSubmitAnswer = async () => {
    if (!selectedResponse) {
      toast.error("Please select an answer");
      return;
    }

    setIsSubmitting(true);
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);

    try {
      const { data, error } = await supabase.functions.invoke("complete-ai-task", {
        body: {
          taskId: task.id,
          selectedResponse,
          timeTakenSeconds: timeTaken,
        },
      });

      if (error) throw error;

      setFeedback(data);

      if (data.isCorrect) {
        toast.success(`Correct! You earned ${formatAmount(data.earnedAmount)}`);
      } else {
        toast.error("Incorrect answer");
      }

      // Wait 3 seconds to show feedback, then load next task
      setTimeout(() => {
        setFeedback(null);
        setSelectedResponse("");
        loadNextTask();
      }, 3000);

    } catch (error: any) {
      console.error("Error submitting answer:", error);
      toast.error(error.message || "Failed to submit answer");
      setIsSubmitting(false);
    }
  };

  if (loading || !task) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading task...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b px-8 py-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/tasks")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">AI Training Tasks</h1>
            <p className="text-muted-foreground">
              Complete tasks to earn rewards and help train AI systems
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-8 max-w-4xl mx-auto">
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Understanding AI Training:</strong> The 'correct' response for these tasks is
            determined by the collective analysis and consensus of many human evaluators, not by
            pre-existing AI knowledge. Your contributions are vital for refining and advancing our AI
            models.
          </AlertDescription>
        </Alert>

        {/* Task Card */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{task.category}</Badge>
              <Badge variant="outline" className="capitalize">{task.difficulty}</Badge>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Reward</p>
              <p className="text-lg font-bold text-[hsl(var(--wallet-earnings))]">
                {formatCurrency(0.60)}
              </p>
            </div>
          </div>

          <h2 className="text-xl font-semibold mb-6">{task.prompt}</h2>

          {feedback ? (
            <div className={`p-6 rounded-lg ${feedback.isCorrect ? 'bg-[hsl(var(--success))]/10 border-2 border-[hsl(var(--success))]/20' : 'bg-[hsl(var(--destructive))]/10 border-2 border-[hsl(var(--destructive))]/20'}`}>
              <div className="flex items-center gap-3 mb-4">
                {feedback.isCorrect ? (
                  <>
                    <CheckCircle2 className="h-6 w-6 text-[hsl(var(--success))]" />
                    <div>
                      <p className="font-semibold text-[hsl(var(--success))]">Correct!</p>
                      <p className="text-sm text-[hsl(var(--success))]/80">
                        You earned {formatCurrency(feedback.earnedAmount)}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-6 w-6 text-[hsl(var(--destructive))]" />
                    <div>
                      <p className="font-semibold text-[hsl(var(--destructive))]">Incorrect</p>
                      <p className="text-sm text-[hsl(var(--destructive))]/80">
                        No earnings for this task
                      </p>
                    </div>
                  </>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className={`p-3 rounded border-2 ${selectedResponse === 'a' ? (feedback.correctAnswer === 'a' ? 'border-[hsl(var(--success))] bg-[hsl(var(--success))]/10' : 'border-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10') : 'border-transparent bg-muted/30'}`}>
                  <p className="font-medium text-sm mb-1">Option A:</p>
                  <p className="text-sm">{task.response_a}</p>
                  {selectedResponse === 'a' && <Badge className="mt-2">Your Answer</Badge>}
                </div>
                <div className={`p-3 rounded border-2 ${selectedResponse === 'b' ? (feedback.correctAnswer === 'b' ? 'border-[hsl(var(--success))] bg-[hsl(var(--success))]/10' : 'border-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10') : 'border-transparent bg-muted/30'}`}>
                  <p className="font-medium text-sm mb-1">Option B:</p>
                  <p className="text-sm">{task.response_b}</p>
                  {selectedResponse === 'b' && <Badge className="mt-2">Your Answer</Badge>}
                </div>
              </div>
              {!feedback.isCorrect && (
                <p className="mt-4 text-sm">
                  <strong>Correct Answer:</strong> Option {feedback.correctAnswer.toUpperCase()}
                </p>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                Choose the best response from the options below:
              </p>

              <RadioGroup value={selectedResponse} onValueChange={setSelectedResponse}>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="a" id="option-a" />
                    <Label htmlFor="option-a" className="cursor-pointer flex-1">
                      <p className="font-medium text-primary mb-1">Option A</p>
                      <p className="text-sm">{task.response_a}</p>
                    </Label>
                  </div>

                  <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="b" id="option-b" />
                    <Label htmlFor="option-b" className="cursor-pointer flex-1">
                      <p className="font-medium text-green-600 dark:text-green-400 mb-1">Option B</p>
                      <p className="text-sm">{task.response_b}</p>
                    </Label>
                  </div>
                </div>
              </RadioGroup>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={handleSkipTask}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Skip Task
                </Button>
                <Button
                  onClick={handleSubmitAnswer}
                  disabled={isSubmitting || !selectedResponse}
                  className="flex-1"
                >
                  {isSubmitting ? "Submitting..." : "Submit Answer"}
                </Button>
              </div>
            </>
          )}
        </Card>
      </main>
    </div>
  );
};

export default TaskDetail;
