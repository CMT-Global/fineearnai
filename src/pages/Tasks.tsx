import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useProfile } from "@/hooks/useProfile";
import { useRealtimeTransactions } from "@/hooks/useRealtimeTransactions";
import { useCurrencyConversion } from "@/hooks/useCurrencyConversion";
import { supabase } from "@/integrations/supabase/client";
import { TaskStats } from "@/components/tasks/TaskStats";
import { TaskInterface } from "@/components/tasks/TaskInterface";
import { TaskSkeleton } from "@/components/tasks/TaskSkeleton";
import { PageLoading } from "@/components/shared/PageLoading";
import { DailyLimitReached } from "@/components/tasks/DailyLimitReached";
import { NoTasksAvailable } from "@/components/tasks/NoTasksAvailable";
import { RecentTransactionsCard } from "@/components/transactions/RecentTransactionsCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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
  const { t } = useTranslation();
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { formatAmount } = useCurrencyConversion();

  // Use unified profile hook with earnerBadge computation
  const { data: profile, isLoading: isProfileLoading } = useProfile(user?.id);
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
          
          // Profile updates are handled by useProfile hook's real-time subscription
          
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
      toast.info(`${t("tasks.toasts.taskSkipped")} (${data.remainingSkips} ${t("tasks.stats.skipsRemaining")})`);
      setFeedback(null);
      setSelectedResponse("");
      refetchTask();
    },
    onError: (error: any) => {
      if (error.message?.includes('skip_limit_reached')) {
        toast.error(t("tasks.toasts.dailySkipLimitReached"));
      } else {
        toast.error(error.message || t("tasks.toasts.failedToLoadTask"));
      }
    },
  });

  const handleSkipTask = useCallback(async () => {
    if (!userStats || userStats.skipsToday >= userStats.skipLimit) {
      toast.error(t("tasks.toasts.dailySkipLimitReached"));
      return;
    }
    skipMutation.mutate();
  }, [userStats, skipMutation, t]);

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
        toast.success(t("tasks.interface.youEarned", { amount: formatAmount(data.earnedAmount) }));
      } else {
        toast.error(t("tasks.toasts.incorrectAnswer"));
      }

      // Check if daily limit reached after this task
      const tasksCompletedAfter = (userStats?.tasksCompletedToday || 0) + 1;
      const dailyLimit = userStats?.dailyLimit || 0;
      const remainingAfter = Math.max(0, dailyLimit - tasksCompletedAfter);
      
      if (remainingAfter === 0 || tasksCompletedAfter >= dailyLimit) {
        // Daily limit reached - show congratulatory message
        toast.success(t("tasks.toasts.allTasksCompleted"));
        
        // Set query data to show daily limit UI
        queryClient.setQueryData(['next-task', user?.id], {
          success: false,
          error: 'daily_limit_reached',
          message: t("tasks.toasts.allTasksCompleted"),
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
      toast.error(error.message || t("tasks.toasts.failedToLoadTask"));
      // Release submission lock on error
      setIsSubmitting(false);
    },
  });

  const handleSubmitAnswer = useCallback(async (response: string) => {
    if (!currentTask || isSubmitting) return; // Prevent submission if already submitting
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    submitMutation.mutate({ taskId: currentTask.id, response, timeTaken });
  }, [currentTask, startTime, submitMutation, isSubmitting]);

  // Early return ONLY for auth loading (before we have user)
  if (loading || !user) {
    return <PageLoading text={t("login.signingIn")} />;
  }

  if (isProfileLoading || !profile) {
    return <PageLoading text={t("tasks.loadingTasks")} />;
  }

  return (
    <>
      {/* Header */}
      <header className="bg-card border-b px-4 lg:px-8 py-6">
          <div>
            <h1 className="text-2xl font-bold">{t("tasks.title")}</h1>
            <p className="text-muted-foreground">
              {t("tasks.subtitle")}
            </p>
          </div>
        </header>

        {/* Main Content */}
        <div className="p-4 lg:p-8 max-w-5xl mx-auto">
          {/* AI Training Explanation Alert */}
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>{t("tasks.understandingAITraining")}</strong>{" "}
              {t("tasks.understandingAITrainingDescription")}
            </AlertDescription>
          </Alert>

          {/* Earner Status Banner - Unverified Users Only */}
          {profile?.earnerBadge && !profile.earnerBadge.isVerified && (
            <Alert className="mb-6 bg-orange-500/10 border-orange-500/20">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{profile.earnerBadge.icon}</span>
                <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-500" />
              </div>
              <AlertTitle className="text-orange-700 dark:text-orange-400">
                {profile.earnerBadge.badgeText} - {t("tasks.limitedTaskAccess")}
              </AlertTitle>
              <AlertDescription className="text-orange-800 dark:text-orange-300 space-y-3">
                <p>{profile.earnerBadge.upgradePrompt}</p>
                <Button 
                  onClick={() => navigate("/plans")}
                  className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white font-semibold"
                >
                  {t("tasks.upgradeNow")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </AlertDescription>
            </Alert>
          )}

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
              title={t("tasks.recentActivity")}
            />
          </div>
        </div>
    </>
  );
};

export default Tasks;
