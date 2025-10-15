import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/layout/Sidebar";
import { TaskStats } from "@/components/tasks/TaskStats";
import { TaskInterface } from "@/components/tasks/TaskInterface";
import { TaskSkeleton } from "@/components/tasks/TaskSkeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AITask {
  id: string;
  prompt: string;
  response_a: string;
  response_b: string;
  category: string;
  difficulty: string;
  reward: number;
}

interface UserStats {
  username: string;
  tasksCompletedToday: number;
  dailyLimit: number;
  remainingTasks: number;
  earningsBalance: number;
  depositBalance: number;
  totalEarned: number;
  skipsToday: number;
  skipLimit: number;
  remainingSkips: number;
  membershipPlan: string;
  planExpiresAt: string | null;
}

interface Feedback {
  isCorrect: boolean;
  correctAnswer: string;
  earnedAmount: number;
  newBalance: number;
}

const Tasks = () => {
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [profile, setProfile] = useState<any>(null);
  const [selectedResponse, setSelectedResponse] = useState<string>("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [startTime] = useState<number>(Date.now());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  // Load profile
  useEffect(() => {
    if (user) {
      supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()
        .then(({ data }) => data && setProfile(data));
    }
  }, [user]);

  // Fetch next task with TanStack Query
  const { data: taskData, isLoading: isLoadingTask, refetch: refetchTask } = useQuery({
    queryKey: ['next-task', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-next-task");

      // Handle HTTP errors from edge function
      if (error) {
        console.error('❌ Error from get-next-task:', error);
        
        // Parse error details if available
        const errorMessage = error.message || 'Failed to fetch task';
        
        // Check for specific error types
        if (errorMessage.includes('Daily task limit reached') || errorMessage.includes('429')) {
          // Daily limit reached - return structured error instead of throwing
          return {
            success: false,
            error: 'daily_limit_reached',
            message: 'You have completed all your tasks for today!',
            task: null,
            userStats: data?.userStats || {
              tasksCompletedToday: data?.tasksCompletedToday || 0,
              dailyLimit: data?.dailyLimit || 0,
              remainingTasks: 0,
              earningsBalance: 0,
              depositBalance: 0,
              totalEarned: 0,
              skipsToday: 0,
              skipLimit: 0,
              remainingSkips: 0,
              membershipPlan: 'free',
              planExpiresAt: null,
            }
          };
        }
        
        // Handle other error types
        if (errorMessage.includes('expired') || errorMessage.includes('403')) {
          return {
            success: false,
            error: 'plan_expired',
            message: 'Your membership plan has expired. Please upgrade to continue.',
            task: null,
            userStats: null
          };
        }
        
        if (errorMessage.includes('not found') || errorMessage.includes('404')) {
          return {
            success: false,
            error: 'no_tasks',
            message: 'No tasks available at the moment.',
            task: null,
            userStats: null
          };
        }
        
        // Generic error - throw to trigger error UI
        throw error;
      }

      // Handle successful response with no task
      if (!data.success || !data.task) {
        // Check if it's because of daily limit
        if (data?.userStats?.remainingTasks === 0 || 
            data?.userStats?.tasksCompletedToday >= data?.userStats?.dailyLimit) {
          return {
            success: false,
            error: 'daily_limit_reached',
            message: 'You have completed all your tasks for today!',
            task: null,
            userStats: data.userStats
          };
        }
        
        return {
          success: false,
          error: 'no_tasks',
          message: 'No tasks available at the moment.',
          task: null,
          userStats: data?.userStats || null
        };
      }

      return data;
    },
    enabled: !!user,
    staleTime: 0,
    gcTime: 0,
  });

  // Phase 3: Real-time subscription to profile updates
  useEffect(() => {
    if (!user) return;

    console.log('📡 Setting up realtime subscription for user profile:', user.id);

    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🔄 Profile update received via realtime:', payload.new);
          
          // Show syncing indicator
          setIsSyncing(true);
          
          // Invalidate the next-task query to trigger a refetch with fresh data
          queryClient.invalidateQueries({ queryKey: ['next-task', user?.id] });
          
          // Also update the profile state
          setProfile(payload.new);
          
          // Hide syncing indicator after a short delay
          setTimeout(() => setIsSyncing(false), 1000);
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });

    return () => {
      console.log('🔌 Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const currentTask = taskData?.task || null;
  const userStats = taskData?.userStats || null;

  // Skip mutation
  const skipMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({ skips_today: (userStats?.skipsToday || 0) + 1 })
        .eq("id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.info("Task skipped");
      setFeedback(null);
      setSelectedResponse("");
      refetchTask();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to skip task");
    },
  });

  const handleSkipTask = useCallback(async () => {
    if (!userStats || userStats.skipsToday >= userStats.skipLimit) {
      toast.error("Daily skip limit reached!");
      return;
    }
    skipMutation.mutate();
  }, [userStats, skipMutation]);

  // Submit mutation with optimistic updates
  const submitMutation = useMutation({
    mutationFn: async ({ taskId, response, timeTaken }: { taskId: string; response: string; timeTaken: number }) => {
      const { data, error } = await supabase.functions.invoke("complete-ai-task", {
        body: {
          taskId,
          selectedResponse: response,
          timeTakenSeconds: timeTaken,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onMutate: async (variables) => {
      // Optimistic update: immediately update UI before server response
      const previousTaskData = queryClient.getQueryData(['next-task', user?.id]);
      
      if (previousTaskData && userStats) {
        // Optimistically update the task stats
        queryClient.setQueryData(['next-task', user?.id], (old: any) => {
          if (!old) return old;
          
          return {
            ...old,
            userStats: {
              ...old.userStats,
              tasksCompletedToday: old.userStats.tasksCompletedToday + 1,
              remainingTasks: Math.max(0, old.userStats.remainingTasks - 1),
            }
          };
        });
      }
      
      return { previousTaskData };
    },
    onSuccess: (data) => {
      setFeedback(data);

      if (data.isCorrect) {
        toast.success(`Correct! You earned $${data.earnedAmount.toFixed(2)}`);
      } else {
        toast.error("Incorrect answer");
      }

      // Invalidate and refetch the task query to get fresh data
      queryClient.invalidateQueries({ queryKey: ['next-task', user?.id] });

      setTimeout(() => {
        setFeedback(null);
        setSelectedResponse("");
        refetchTask();
      }, 3000);
    },
    onError: (error: any, variables, context) => {
      toast.error(error.message || "Failed to submit answer");
      
      // Rollback optimistic update on error
      if (context?.previousTaskData) {
        queryClient.setQueryData(['next-task', user?.id], context.previousTaskData);
      }
    },
  });

  const handleSubmitAnswer = useCallback(async (response: string) => {
    if (!currentTask) return;
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    submitMutation.mutate({ taskId: currentTask.id, response, timeTaken });
  }, [currentTask, startTime, submitMutation]);

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      <Sidebar profile={profile} isAdmin={isAdmin} onSignOut={signOut} />

      <main className="flex-1 overflow-auto lg:mt-0 mt-16">
        {/* Header */}
        <header className="bg-card border-b px-4 lg:px-8 py-6">
          <div>
            <h1 className="text-2xl font-bold">AI Training Tasks</h1>
            <p className="text-muted-foreground">
              Complete tasks to earn money and help train AI
            </p>
          </div>
        </header>

        {/* Main Content */}
        <div className="p-4 lg:p-8 max-w-5xl mx-auto">
          {/* AI Training Explanation Alert */}
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Understanding AI Training:</strong> The 'correct' response for these
              tasks is determined by the collective analysis and consensus of many human
              evaluators, not by pre-existing AI knowledge. Your contributions are vital for
              refining and advancing AI models.
            </AlertDescription>
          </Alert>

          {/* Stats Cards */}
          {userStats && (
            <TaskStats
              tasksCompletedToday={userStats.tasksCompletedToday}
              dailyLimit={userStats.dailyLimit}
              remainingTasks={userStats.remainingTasks}
              earningsBalance={userStats.earningsBalance}
              isLoading={isLoadingTask && !userStats}
              isSyncing={isSyncing || submitMutation.isPending}
            />
          )}

          {/* Task Interface or Loading Skeleton */}
          {isLoadingTask ? (
            <TaskSkeleton />
          ) : currentTask ? (
            <TaskInterface
              task={currentTask}
              onSubmit={handleSubmitAnswer}
              onSkip={handleSkipTask}
              isSubmitting={submitMutation.isPending}
              feedback={feedback}
              selectedResponse={selectedResponse}
              onResponseChange={setSelectedResponse}
            />
          ) : (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground mb-4">
                No tasks available at the moment
              </p>
              <p className="text-sm text-muted-foreground">
                Please check back later or upgrade your plan for more tasks
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Tasks;
