import { format } from "date-fns";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import {
  getTransactionTypeLabel,
  getTransactionStatusColor,
  getTransactionTypeColor,
} from "@/lib/wallet-utils";

interface TransactionListItemProps {
  transaction: {
    id: string;
    type: string;
    amount: number;
    wallet_type: string;
    status: string;
    payment_gateway: string | null;
    new_balance: number;
    description: string | null;
    created_at: string;
    gateway_transaction_id?: string | null;
  };
}

export function TransactionListItem({ transaction }: TransactionListItemProps) {
  const isCredit = ["deposit", "task_earning", "referral_commission", "adjustment"].includes(
    transaction.type
  );

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`flex-shrink-0 mt-0.5 ${isCredit ? "text-green-600" : "text-red-600"}`}>
            {isCredit ? (
              <ArrowDownCircle className="w-8 h-8" />
            ) : (
              <ArrowUpCircle className="w-8 h-8" />
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Type and Date */}
            <div>
              <p className="font-medium text-foreground">
                {getTransactionTypeLabel(transaction.type)}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(transaction.created_at), "MMM dd, yyyy 'at' h:mm a")}
              </p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5">
              {/* Status Badge */}
              <Badge
                variant="outline"
                className={`text-xs ${getTransactionStatusColor(transaction.status)}`}
              >
                {transaction.status}
              </Badge>

              {/* Wallet Type Badge */}
              <Badge variant="secondary" className="text-xs">
                {transaction.wallet_type === "deposit_wallet" ? "Deposit" : "Earnings"}
              </Badge>

              {/* Payment Gateway Badge */}
              {transaction.payment_gateway && (
                <Badge variant="outline" className="text-xs">
                  {transaction.payment_gateway}
                </Badge>
              )}
            </div>

            {/* Description (if available and not masked) */}
            {transaction.description && !transaction.description.includes("***") && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {transaction.description}
              </p>
            )}
          </div>

          {/* Amount and Balance - Right Side */}
          <div className="flex-shrink-0 text-right space-y-1">
            <p
              className={`font-semibold text-base ${getTransactionTypeColor(transaction.type)}`}
            >
              {isCredit ? "+" : "-"}
              <CurrencyDisplay amountUSD={Math.abs(transaction.amount)} />
            </p>
            <div className="text-xs text-muted-foreground">
              <p className="whitespace-nowrap">Balance:</p>
              <p className="font-medium">
                <CurrencyDisplay amountUSD={transaction.new_balance} />
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
