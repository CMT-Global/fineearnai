import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
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
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Daily Reset Logs</h1>
            <p className="text-muted-foreground mt-1">
              Monitor daily counter reset operations and performance
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Users Reset</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats?.avgUsersReset.toLocaleString()}</div>
              )}
              <p className="text-xs text-muted-foreground">Last 30 resets</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Execution</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats?.avgExecutionTime}ms</div>
              )}
              <p className="text-xs text-muted-foreground">Average time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Max Execution</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats?.maxExecutionTime}ms</div>
              )}
              <p className="text-xs text-muted-foreground">Peak time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Min Execution</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats?.minExecutionTime}ms</div>
              )}
              <p className="text-xs text-muted-foreground">Best time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Resets</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats?.totalResets}</div>
              )}
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
            <CardDescription>Filter reset logs by date range and trigger type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Date From</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date To</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Triggered By</label>
                <Select value={triggeredBy} onValueChange={setTriggeredBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="All triggers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All triggers</SelectItem>
                    <SelectItem value="cron">CRON Job</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleClearFilters} variant="outline" className="w-full">
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Reset Operations Log</CardTitle>
            <CardDescription>
              Detailed execution history of daily counter resets
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>
                  Error loading logs: {error.message}
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
                      <TableHead>Reset Date</TableHead>
                      <TableHead>Users Reset</TableHead>
                      <TableHead>Execution Time</TableHead>
                      <TableHead>Triggered By</TableHead>
                      <TableHead>UTC Time</TableHead>
                      <TableHead>EAT Time</TableHead>
                      <TableHead>Request ID</TableHead>
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
                <p className="text-muted-foreground">No reset logs found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Logs will appear here after daily reset operations run
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default DailyResetLogs;
