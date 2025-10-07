import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, Clock, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/wallet-utils";

const TaskDetail = () => {
  const { userTaskId } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [userTask, setUserTask] = useState<any>(null);
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user && userTaskId) {
      loadUserTask();
    }
  }, [user, userTaskId]);

  const loadUserTask = async () => {
    try {
      const { data, error } = await supabase
        .from("user_tasks")
        .select(`
          *,
          task:tasks(*)
        `)
        .eq("id", userTaskId)
        .eq("user_id", user?.id)
        .single();

      if (error) throw error;
      setUserTask(data);
    } catch (error) {
      console.error("Error loading task:", error);
      toast.error("Failed to load task");
      navigate("/tasks");
    }
  };

  const handleCompleteTask = async () => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("complete-task", {
        body: {
          userTaskId: userTaskId,
          submissionData: {
            notes: submissionNotes,
            completedAt: new Date().toISOString(),
          },
        },
      });

      if (error) throw error;

      toast.success("Task completed!", {
        description: `You earned ${formatCurrency(data.earnedAmount)}`,
      });

      navigate("/tasks");
    } catch (error: any) {
      console.error("Error completing task:", error);
      toast.error(error.message || "Failed to complete task");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !userTask) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  const task = userTask.task;
  const instructions = task.instructions || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b px-8 py-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/tasks")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{task.title}</h1>
            <p className="text-muted-foreground">{task.description}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Reward</p>
              <p className="text-xl font-bold text-[hsl(var(--wallet-earnings))]">
                {formatCurrency(task.base_reward)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Est. Time</p>
              <p className="text-xl font-bold">{task.time_estimate_minutes}m</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-8 max-w-4xl mx-auto">
        {/* Instructions */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Instructions</h2>
          <ol className="space-y-3">
            {instructions.map((instruction: any, index: number) => (
              <li key={index} className="flex gap-3">
                <div className="flex-shrink-0 h-6 w-6 rounded-full bg-[hsl(var(--wallet-tasks))]/10 flex items-center justify-center text-[hsl(var(--wallet-tasks))] text-sm font-semibold">
                  {instruction.step}
                </div>
                <p className="text-sm pt-0.5">{instruction.text}</p>
              </li>
            ))}
          </ol>
        </Card>

        {/* Task Workspace */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Task Workspace</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Complete the task following the instructions above. This is a demo task - in production, 
            this would contain the actual task interface (image classification, text analysis, etc.).
          </p>
          
          <div className="bg-muted/50 rounded-lg p-8 mb-4 text-center">
            <p className="text-muted-foreground">Task Interface Placeholder</p>
            <p className="text-sm text-muted-foreground mt-2">
              This would be replaced with actual task content
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Submission Notes (Optional)</label>
            <Textarea
              placeholder="Add any notes about your work..."
              value={submissionNotes}
              onChange={(e) => setSubmissionNotes(e.target.value)}
              rows={4}
            />
          </div>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => navigate("/tasks")}
            className="flex-1"
          >
            Save & Exit
          </Button>
          <Button
            onClick={handleCompleteTask}
            disabled={isSubmitting}
            className="flex-1 bg-gradient-to-r from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] text-white hover:opacity-90"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {isSubmitting ? "Submitting..." : "Complete Task"}
          </Button>
        </div>

        {/* Info */}
        <Card className="mt-6 p-4 bg-[hsl(var(--wallet-earnings))]/5 border-[hsl(var(--wallet-earnings))]/20">
          <div className="flex gap-2">
            <Clock className="h-5 w-5 text-[hsl(var(--wallet-earnings))] flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-[hsl(var(--wallet-earnings))]">Task Timer</p>
              <p className="text-muted-foreground">
                Started {new Date(userTask.started_at || userTask.assigned_at).toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default TaskDetail;
