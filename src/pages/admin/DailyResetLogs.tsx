import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguageSync } from '@/hooks/useLanguageSync';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDailyResetLogs, useDailyResetStats } from '@/hooks/useDailyResetLogs';
import { Clock, Users, Zap, Calendar, Filter, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

const DailyResetLogs = () => {
  const { t, ready } = useTranslation();
  useLanguageSync(); // Sync language and force re-render when language changes
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [triggeredBy, setTriggeredBy] = useState<string>('');

  const filters = {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    triggeredBy: triggeredBy || undefined,
  };

  const { data: logs, isLoading, error, refetch } = useDailyResetLogs(filters);
  const { data: stats, isLoading: statsLoading } = useDailyResetStats();

  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setTriggeredBy('');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator {
          filter: brightness(0) invert(1);
          cursor: pointer;
          opacity: 1;
        }
        input[type="date"]::-moz-calendar-picker-indicator {
          filter: brightness(0) invert(1);
          cursor: pointer;
          opacity: 1;
        }
      `}</style>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("admin.dailyResetLogs.title")}</h1>
            <p className="text-muted-foreground mt-1">
              {t("admin.dailyResetLogs.subtitle")}
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("common.refresh")}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("admin.dailyResetLogs.stats.avgUsersReset")}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats?.avgUsersReset.toLocaleString()}</div>
              )}
              <p className="text-xs text-muted-foreground">{t("admin.dailyResetLogs.stats.last30Resets")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("admin.dailyResetLogs.stats.avgExecution")}</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats?.avgExecutionTime}ms</div>
              )}
              <p className="text-xs text-muted-foreground">{t("admin.dailyResetLogs.stats.averageTime")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("admin.dailyResetLogs.stats.maxExecution")}</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats?.maxExecutionTime}ms</div>
              )}
              <p className="text-xs text-muted-foreground">{t("admin.dailyResetLogs.stats.peakTime")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("admin.dailyResetLogs.stats.minExecution")}</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats?.minExecutionTime}ms</div>
              )}
              <p className="text-xs text-muted-foreground">{t("admin.dailyResetLogs.stats.bestTime")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("admin.dailyResetLogs.stats.totalResets")}</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats?.totalResets}</div>
              )}
              <p className="text-xs text-muted-foreground">{t("admin.dailyResetLogs.stats.last30Days")}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              {t("admin.dailyResetLogs.filters.title")}
            </CardTitle>
            <CardDescription>{t("admin.dailyResetLogs.filters.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("admin.dailyResetLogs.filters.dateFrom")}</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("admin.dailyResetLogs.filters.dateTo")}</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("admin.dailyResetLogs.filters.triggeredBy")}</label>
                <Select value={triggeredBy} onValueChange={setTriggeredBy}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("admin.dailyResetLogs.filters.allTriggers")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.dailyResetLogs.filters.allTriggers")}</SelectItem>
                    <SelectItem value="cron">{t("admin.dailyResetLogs.filters.cronJob")}</SelectItem>
                    <SelectItem value="manual">{t("admin.dailyResetLogs.filters.manual")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleClearFilters} variant="outline" className="w-full">
                  {t("admin.dailyResetLogs.filters.clearFilters")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.dailyResetLogs.logs.title")}</CardTitle>
            <CardDescription>
              {t("admin.dailyResetLogs.logs.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>
                  {t("admin.dailyResetLogs.logs.errorLoading", { error: error.message })}
                </AlertDescription>
              </Alert>
            )}

            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : logs && logs.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.dailyResetLogs.logs.resetDate")}</TableHead>
                      <TableHead>{t("admin.dailyResetLogs.logs.usersReset")}</TableHead>
                      <TableHead>{t("admin.dailyResetLogs.logs.executionTime")}</TableHead>
                      <TableHead>{t("admin.dailyResetLogs.logs.triggeredBy")}</TableHead>
                      <TableHead>{t("admin.dailyResetLogs.logs.utcTime")}</TableHead>
                      <TableHead>{t("admin.dailyResetLogs.logs.eatTime")}</TableHead>
                      <TableHead>{t("admin.dailyResetLogs.logs.requestId")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          {format(new Date(log.reset_date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {log.users_reset.toLocaleString()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={log.execution_time_ms > 5000 ? 'destructive' : 'default'}
                          >
                            {log.execution_time_ms}ms
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.triggered_by}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.details?.utc_time ? 
                            format(new Date(log.details.utc_time), 'HH:mm:ss') : 
                            '-'
                          }
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.details?.eat_time ? 
                            format(new Date(log.details.eat_time), 'HH:mm:ss') : 
                            '-'
                          }
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {log.details?.request_id?.slice(0, 8)}...
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t("admin.dailyResetLogs.logs.noLogsFound")}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("admin.dailyResetLogs.logs.noLogsDescription")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DailyResetLogs;
