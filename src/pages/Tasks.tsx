import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useRealtimeTransactions } from "@/hooks/useRealtimeTransactions";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/layout/Sidebar";
import { TaskStats } from "@/components/tasks/TaskStats";
import { TaskInterface } from "@/components/tasks/TaskInterface";
import { TaskSkeleton } from "@/components/tasks/TaskSkeleton";
import { DailyLimitReached } from "@/components/tasks/DailyLimitReached";
import { NoTasksAvailable } from "@/components/tasks/NoTasksAvailable";
import { RecentTransactionsCard } from "@/components/transactions/RecentTransactionsCard";
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
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Enable real-time transaction updates
  useRealtimeTransactions(user?.id);

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

  // ✅ Phase 2: React Query handles ALL server data (user stats from get-next-task)
  // Database is the single source of truth for task resets
  // ✅ Phase 2.3: Add retry logic for transient auth errors
  const { data: taskData, isLoading: isLoadingTask, refetch: refetchTask } = useQuery({
    queryKey: ['next-task', user?.id],
    queryFn: async () => {
      let lastError = null;
      
      // Retry up to 2 times with short delay for auth timing issues
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const { data, error } = await supabase.functions.invoke("get-next-task");

          // Handle HTTP errors from edge function
          if (error) {
            // Check if it's a transient auth error worth retrying
            if (error.message?.includes('AuthSessionMissingError') && attempt === 0) {
              console.warn(`⚠️ AuthSessionMissingError on attempt ${attempt + 1}, retrying...`);
              lastError = error;
              await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
              continue;
            }
            
            console.error('❌ Error from get-next-task:', error);
            throw error;
          }

          // Success - return data
          return data;
        } catch (err) {
          lastError = err;
          if (attempt < 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
      
      // All retries failed
      throw lastError;
    },
    enabled: !!user,
    staleTime: 10000,    // Cache for 10 seconds
    gcTime: 60000,       // Keep in cache for 1 minute
    retry: false,        // Disable automatic retry since we handle it manually
  });

  // ✅ Phase 2: Real-time subscription to profile updates (React Query invalidation only)
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
  // ✅ Phase 2: All user stats from React Query (taskData)
  // Database is single source of truth - API tells us if limit is reached
  const userStats = taskData?.userStats || null;
  const isDailyLimitReached = taskData?.error === 'daily_limit_reached';

  // Skip mutation - Phase 1.3: Server-side skip enforcement
  const skipMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      // Call server-side skip function with limit enforcement
      const { data, error } = await supabase.functions.invoke('skip-task', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.message || 'Failed to skip task');
      
      return data;
    },
    onSuccess: (data) => {
      toast.info(`Task skipped (${data.remainingSkips} skips remaining)`);
      setFeedback(null);
      setSelectedResponse("");
      refetchTask();
    },
    onError: (error: any) => {
      if (error.message?.includes('skip_limit_reached')) {
        toast.error("Daily skip limit reached!");
      } else {
        toast.error(error.message || "Failed to skip task");
      }
    },
  });

  const handleSkipTask = useCallback(async () => {
    if (!userStats || userStats.skipsToday >= userStats.skipLimit) {
      toast.error("Daily skip limit reached!");
      return;
    }
    skipMutation.mutate();
  }, [userStats, skipMutation]);

  // Submit mutation - Phase 1: No optimistic updates, server response is single source of truth
  const submitMutation = useMutation({
    mutationFn: async ({ taskId, response, timeTaken }: { taskId: string; response: string; timeTaken: number }) => {
      // Set submitting state to prevent double-clicks
      setIsSubmitting(true);
      
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
    onSuccess: (data) => {
      setFeedback(data);

      if (data.isCorrect) {
        toast.success(`Correct! You earned $${data.earnedAmount.toFixed(2)}`);
      } else {
        toast.error("Incorrect answer");
      }

      // Check if daily limit reached after this task
      const tasksCompletedAfter = (userStats?.tasksCompletedToday || 0) + 1;
      const dailyLimit = userStats?.dailyLimit || 0;
      const remainingAfter = Math.max(0, dailyLimit - tasksCompletedAfter);
      
      if (remainingAfter === 0 || tasksCompletedAfter >= dailyLimit) {
        // Daily limit reached - show congratulatory message
        toast.success("Congratulations! You've completed all your tasks for today!");
        
        // Set query data to show daily limit UI
        queryClient.setQueryData(['next-task', user?.id], {
          success: false,
          error: 'daily_limit_reached',
          message: 'You have completed all your tasks for today!',
          task: null,
          userStats: {
            ...userStats,
            tasksCompletedToday: tasksCompletedAfter,
            remainingTasks: 0,
            earningsBalance: data.newBalance,
          }
        });
        
        // Clear feedback after showing it briefly
        setTimeout(() => {
          setFeedback(null);
          setSelectedResponse("");
          // Release submission lock after 1-second cooldown
          setIsSubmitting(false);
        }, 2000);
      } else {
        // More tasks available - invalidate and refetch
        queryClient.invalidateQueries({ queryKey: ['next-task', user?.id] });
        
        setTimeout(() => {
          setFeedback(null);
          setSelectedResponse("");
          refetchTask();
          // Release submission lock after 1-second cooldown
          setIsSubmitting(false);
        }, 2000);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to submit answer");
      // Release submission lock on error
      setIsSubmitting(false);
    },
  });

  const handleSubmitAnswer = useCallback(async (response: string) => {
    if (!currentTask || isSubmitting) return; // Prevent submission if already submitting
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    submitMutation.mutate({ taskId: currentTask.id, response, timeTaken });
  }, [currentTask, startTime, submitMutation, isSubmitting]);

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

      <main className="flex-1 overflow-auto lg:mt-0 mt-16 pb-24 lg:pb-0">
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

          {/* Stats Cards - Always Visible */}
          <TaskStats
            tasksCompletedToday={userStats?.tasksCompletedToday || 0}
            dailyLimit={userStats?.dailyLimit || 0}
            remainingTasks={userStats?.remainingTasks || 0}
            earningsBalance={userStats?.earningsBalance || 0}
            isLoading={isLoadingTask && !userStats}
            isSyncing={isSyncing || submitMutation.isPending}
          />

          {/* Task Interface or Loading Skeleton */}
          {isLoadingTask ? (
            <TaskSkeleton />
          ) : isDailyLimitReached ? (
            <DailyLimitReached
              tasksCompleted={userStats?.tasksCompletedToday || 0}
              dailyLimit={userStats?.dailyLimit || 0}
              membershipPlan={userStats?.membershipPlan || 'free'}
              onUpgrade={() => navigate('/plans')}
            />
          ) : currentTask ? (
            <TaskInterface
              task={currentTask}
              onSubmit={handleSubmitAnswer}
              onSkip={handleSkipTask}
              isSubmitting={isSubmitting || submitMutation.isPending}
              feedback={feedback}
              selectedResponse={selectedResponse}
              onResponseChange={setSelectedResponse}
            />
          ) : (
            <NoTasksAvailable onRefresh={refetchTask} />
          )}

          {/* Recent Activity */}
          <div className="mt-8">
            <RecentTransactionsCard 
              userId={user?.id || ''} 
              maxItems={5} 
              showPagination={false} 
              title="Recent Activity"
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Tasks;
