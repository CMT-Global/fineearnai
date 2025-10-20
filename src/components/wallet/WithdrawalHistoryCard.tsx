import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { format } from "date-fns";
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Ban,
  ArrowUpRight 
} from "lucide-react";

interface WithdrawalRequest {
  id: string;
  amount: number;
  fee: number;
  net_amount: number;
  payment_method: string;
  payout_address: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  processed_at: string | null;
}

interface WithdrawalHistoryCardProps {
  withdrawal: WithdrawalRequest;
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'completed':
      return {
        icon: CheckCircle2,
        color: 'text-green-600',
        bgColor: 'bg-green-600/10',
        badgeVariant: 'default' as const,
        label: 'Completed'
      };
    case 'pending':
      return {
        icon: Clock,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-600/10',
        badgeVariant: 'secondary' as const,
        label: 'Pending'
      };
    case 'rejected':
      return {
        icon: XCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-600/10',
        badgeVariant: 'destructive' as const,
        label: 'Rejected'
      };
    case 'cancelled':
      return {
        icon: Ban,
        color: 'text-gray-600',
        bgColor: 'bg-gray-600/10',
        badgeVariant: 'outline' as const,
        label: 'Cancelled'
      };
    default:
      return {
        icon: Clock,
        color: 'text-muted-foreground',
        bgColor: 'bg-muted',
        badgeVariant: 'outline' as const,
        label: status
      };
  }
};

export const WithdrawalHistoryCard = ({ withdrawal }: WithdrawalHistoryCardProps) => {
  const statusConfig = getStatusConfig(withdrawal.status);
  const StatusIcon = statusConfig.icon;

  return (
    <Card className="p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${statusConfig.bgColor}`}>
            <ArrowUpRight className={`h-5 w-5 ${statusConfig.color}`} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold">Withdrawal Request</p>
              <Badge variant={statusConfig.badgeVariant} className="flex items-center gap-1">
                <StatusIcon className="h-3 w-3" />
                {statusConfig.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {format(new Date(withdrawal.created_at), "MMM dd, yyyy 'at' hh:mm a")}
            </p>
            <p className="text-xs text-muted-foreground">
              Method: {withdrawal.payment_method}
            </p>
            {withdrawal.rejection_reason && (
              <p className="text-xs text-red-600 mt-1">
                Reason: {withdrawal.rejection_reason}
              </p>
            )}
          </div>
        </div>
        <div className="text-right space-y-1">
          <p className="text-lg font-bold text-destructive">
            -<CurrencyDisplay amountUSD={withdrawal.amount} />
          </p>
          <p className="text-xs text-muted-foreground">
            Fee: <CurrencyDisplay amountUSD={withdrawal.fee} />
          </p>
          <p className="text-sm text-green-600 font-semibold">
            Net: <CurrencyDisplay amountUSD={withdrawal.net_amount} />
          </p>
          {withdrawal.processed_at && (
            <p className="text-xs text-muted-foreground">
              Processed: {format(new Date(withdrawal.processed_at), "MMM dd, yyyy")}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};
