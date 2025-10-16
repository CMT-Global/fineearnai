import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";

interface FinancialTabProps {
  userData: any;
  onAdjustWallet: (walletType: 'deposit' | 'earnings') => void;
}

export const FinancialTab = ({ userData, onAdjustWallet }: FinancialTabProps) => {
  if (!userData) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
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

  const financial = userData.financial;
  const profile = userData.profile;

  return (
    <div className="space-y-6">
      {/* Wallet Balances */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Deposit Wallet</CardTitle>
              <Button variant="outline" size="sm" onClick={() => onAdjustWallet('deposit')}>
                Adjust
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(financial.deposit_wallet_balance || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Used for plan upgrades
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Earnings Wallet</CardTitle>
              <Button variant="outline" size="sm" onClick={() => onAdjustWallet('earnings')}>
                Adjust
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(financial.earnings_wallet_balance || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Available for withdrawal
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(financial.total_balance || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Combined balance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deposits</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(financial.total_deposits || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              All-time deposits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Withdrawals</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(financial.total_withdrawals || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Completed payouts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(financial.lifetime_net_earnings || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Deposits + Earnings - Withdrawals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {financial.total_transactions || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              All financial transactions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Withdrawal Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Withdrawal Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Pending Withdrawals</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-2xl font-bold">{financial.pending_withdrawals || 0}</p>
                {financial.pending_withdrawals > 0 && (
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Amount: ${(financial.pending_withdrawal_amount || 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold">{financial.completed_withdrawals || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rejected</p>
              <p className="text-2xl font-bold">{financial.rejected_withdrawals || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Transaction Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Last Transaction</CardTitle>
        </CardHeader>
        <CardContent>
          {userData.recent_activity?.last_transaction ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {userData.recent_activity.last_transaction.description || 
                     userData.recent_activity.last_transaction.type}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(userData.recent_activity.last_transaction.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">
                    ${(userData.recent_activity.last_transaction.amount || 0).toFixed(2)}
                  </p>
                  <Badge variant={
                    userData.recent_activity.last_transaction.status === 'completed' 
                      ? 'default' 
                      : 'secondary'
                  }>
                    {userData.recent_activity.last_transaction.status}
                  </Badge>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No transactions yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};