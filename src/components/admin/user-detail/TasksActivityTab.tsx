import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Target, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface TasksActivityTabProps {
  userId: string;
  userData: any;
}

export const TasksActivityTab = ({ userId, userData }: TasksActivityTabProps) => {
  const [page, setPage] = useState(1);
  const limit = 20;

  // Fetch recent task completions
  const { data: taskCompletions, isLoading } = useQuery({
    queryKey: ['admin-user-tasks', userId, page],
    queryFn: async () => {
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      const { data, error, count } = await supabase
        .from('task_completions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        completions: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      };
    },
    enabled: !!userId,
  });

  if (!userData) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = userData.stats;
  const profile = userData.profile;
  const planInfo = userData.plan_info;

  return (
    <div className="space-y-6">
      {/* Task Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_tasks || 0}</div>
            <p className="text-xs text-muted-foreground">
              Completed all-time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Correct Tasks</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.correct_tasks || 0}</div>
            <p className="text-xs text-muted-foreground">
              Accuracy: {stats.accuracy || 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wrong Tasks</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.wrong_tasks || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total_tasks > 0 
                ? `${((stats.wrong_tasks / stats.total_tasks) * 100).toFixed(1)}% error rate`
                : 'No data'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Task Earnings</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(stats.total_earned || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              From task completions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Tasks Completed</p>
                <p className="text-sm text-muted-foreground">
                  {profile.tasks_completed_today || 0} / {planInfo?.daily_task_limit || 0}
                </p>
              </div>
              <Progress 
                value={((profile.tasks_completed_today || 0) / (planInfo?.daily_task_limit || 1)) * 100} 
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Skips Used</p>
                <p className="text-sm text-muted-foreground">
                  {profile.skips_today || 0} / {planInfo?.task_skip_limit_per_day || 0}
                </p>
              </div>
              <Progress 
                value={((profile.skips_today || 0) / (planInfo?.task_skip_limit_per_day || 1)) * 100} 
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">Last Task Date</p>
              <p className="font-medium">
                {profile.last_task_date 
                  ? format(new Date(profile.last_task_date), "PPP")
                  : "Never"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Task Completions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Task Completions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : taskCompletions?.completions && taskCompletions.completions.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task ID</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Earnings</TableHead>
                    <TableHead>Time Taken</TableHead>
                    <TableHead>Completed At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taskCompletions.completions.map((task: any) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-mono text-xs">
                        {task.task_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <Badge variant={task.is_correct ? "default" : "destructive"}>
                          {task.is_correct ? "Correct" : "Wrong"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        ${(task.earnings_amount || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>{task.time_taken_seconds || 0}s</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(task.completed_at), "PPp")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No task completions yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};