import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useLast7DaysActivity } from '@/hooks/useLast7DaysActivity';
import { formatCurrency } from '@/lib/wallet-utils';

export const Last7DaysActivityTable = () => {
  const { data: activityData, isLoading, error } = useLast7DaysActivity();

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load activity data. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return <TableSkeleton />;
  }

  if (!activityData || activityData.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No activity data available for the last 7 days.
        </AlertDescription>
      </Alert>
    );
  }

  // Calculate totals
  const totals = activityData.reduce(
    (acc, day) => ({
      new_registrations: acc.new_registrations + day.new_registrations,
      referred_users: acc.referred_users + day.referred_users,
      deposits_count: acc.deposits_count + day.deposits_count,
      deposits_volume: acc.deposits_volume + day.deposits_volume,
      withdrawals_count: acc.withdrawals_count + day.withdrawals_count,
      withdrawals_volume: acc.withdrawals_volume + day.withdrawals_volume,
      plan_upgrades_count: acc.plan_upgrades_count + day.plan_upgrades_count,
      margin: acc.margin + day.margin,
    }),
    {
      new_registrations: 0,
      referred_users: 0,
      deposits_count: 0,
      deposits_volume: 0,
      withdrawals_count: 0,
      withdrawals_volume: 0,
      plan_upgrades_count: 0,
      margin: 0,
    }
  );

  // Calculate trend (compare first 3 days vs last 3 days)
  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp className="h-3 w-3 text-green-600" />;
    if (current < previous) return <TrendingDown className="h-3 w-3 text-red-600" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'EEE, MMM d');
    } catch {
      return dateStr;
    }
  };

  const calculatePercentage = (part: number, total: number): string => {
    if (total === 0) return '0.0%';
    const percentage = (part / total) * 100;
    return `${percentage.toFixed(1)}%`;
  };

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold whitespace-nowrap">Date</TableHead>
            <TableHead className="text-right font-semibold whitespace-nowrap">New Users</TableHead>
            <TableHead className="text-right font-semibold whitespace-nowrap">Referred</TableHead>
            <TableHead className="text-right font-semibold whitespace-nowrap">Deposits</TableHead>
            <TableHead className="text-right font-semibold whitespace-nowrap">Deposit Vol.</TableHead>
            <TableHead className="text-right font-semibold whitespace-nowrap">Withdrawals</TableHead>
            <TableHead className="text-right font-semibold whitespace-nowrap">Withdrawal Vol.</TableHead>
            <TableHead className="text-right font-semibold whitespace-nowrap">Upgrades</TableHead>
            <TableHead className="text-right font-semibold whitespace-nowrap">Margin</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activityData.map((day, index) => (
            <TableRow key={day.activity_date} className="hover:bg-muted/30">
              <TableCell className="font-medium whitespace-nowrap">
                {formatDate(day.activity_date)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(day.new_registrations)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-col items-end">
                  <span className="font-medium tabular-nums">{formatNumber(day.referred_users)}</span>
                  <span className="text-xs text-muted-foreground">
                    ({calculatePercentage(day.referred_users, day.new_registrations)})
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(day.deposits_count)}
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium text-green-600">
                {formatCurrency(day.deposits_volume)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(day.withdrawals_count)}
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium text-red-600">
                {formatCurrency(day.withdrawals_volume)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(day.plan_upgrades_count)}
              </TableCell>
              <TableCell 
                className="text-right tabular-nums font-bold"
                style={{ color: day.margin >= 0 ? 'rgb(22, 163, 74)' : 'rgb(220, 38, 38)' }}
              >
                {formatCurrency(day.margin)}
              </TableCell>
            </TableRow>
          ))}
          {/* Totals Row */}
          <TableRow className="bg-muted/50 font-semibold border-t-2">
            <TableCell className="font-bold">TOTAL</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNumber(totals.new_registrations)}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex flex-col items-end">
                <span className="font-bold tabular-nums">{formatNumber(totals.referred_users)}</span>
                <span className="text-xs font-semibold text-muted-foreground">
                  ({calculatePercentage(totals.referred_users, totals.new_registrations)})
                </span>
              </div>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNumber(totals.deposits_count)}
            </TableCell>
            <TableCell className="text-right tabular-nums font-bold text-green-600">
              {formatCurrency(totals.deposits_volume)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNumber(totals.withdrawals_count)}
            </TableCell>
            <TableCell className="text-right tabular-nums font-bold text-red-600">
              {formatCurrency(totals.withdrawals_volume)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNumber(totals.plan_upgrades_count)}
            </TableCell>
            <TableCell 
              className="text-right tabular-nums font-bold"
              style={{ color: totals.margin >= 0 ? 'rgb(22, 163, 74)' : 'rgb(220, 38, 38)' }}
            >
              {formatCurrency(totals.margin)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

const TableSkeleton = () => {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Date</TableHead>
            <TableHead className="text-right">New Users</TableHead>
            <TableHead className="text-right">Referred</TableHead>
            <TableHead className="text-right">Deposits</TableHead>
            <TableHead className="text-right">Deposit Vol.</TableHead>
            <TableHead className="text-right">Withdrawals</TableHead>
            <TableHead className="text-right">Withdrawal Vol.</TableHead>
            <TableHead className="text-right">Upgrades</TableHead>
            <TableHead className="text-right">Margin</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 7 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
              <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
              <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
              <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
              <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
