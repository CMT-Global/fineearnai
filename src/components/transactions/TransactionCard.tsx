import { useState } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ArrowUpRight, 
  ArrowDownRight,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Wallet,
  CreditCard
} from "lucide-react";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { getTransactionTypeLabel, getTransactionStatusColor, getTransactionTypeColor } from "@/lib/wallet-utils";
import { getDisplayNameForUser, maskTransactionDescription } from "@/lib/payment-processor-utils";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface TransactionCardProps {
  transaction: {
    id: string;
    type: string;
    amount: number;
    wallet_type: string;
    status: string;
    payment_gateway: string | null;
    gateway_transaction_id: string | null;
    new_balance: number;
    description: string | null;
    metadata: any;
    created_at: string;
  };
}

export const TransactionCard = ({ transaction: tx }: TransactionCardProps) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const { isAdmin } = useAdmin();

  const isCredit = ['deposit', 'task_earning', 'referral_commission', 'adjustment'].includes(tx.type);

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      toast({
        title: "Copied!",
        description: `${fieldName} copied to clipboard`,
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const hasMetadata = tx.metadata && Object.keys(tx.metadata).length > 0;

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="space-y-3">
        {/* Main Transaction Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div 
              className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center",
                isCredit ? "bg-green-100 dark:bg-green-900/20" : "bg-red-100 dark:bg-red-900/20"
              )}
            >
              {isCredit ? (
                <ArrowDownRight className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <ArrowUpRight className="h-5 w-5 text-red-600 dark:text-red-400" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold">{getTransactionTypeLabel(tx.type)}</p>
                
                {/* Wallet Type Badge */}
                <Badge variant="outline" className="text-xs">
                  {tx.wallet_type === 'earnings' ? (
                    <>
                      <Wallet className="h-3 w-3 mr-1" />
                      Earnings Wallet
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-3 w-3 mr-1" />
                      Deposit Wallet
                    </>
                  )}
                </Badge>

                {/* Payment Gateway Badge */}
                {tx.payment_gateway && (
                  <Badge variant="secondary" className="text-xs uppercase">
                    {getDisplayNameForUser(tx.payment_gateway, false)}
                  </Badge>
                )}

                {/* Status Badge */}
                <Badge 
                  variant={tx.status === 'completed' ? 'default' : tx.status === 'pending' ? 'secondary' : 'destructive'}
                  className="text-xs capitalize"
                >
                  {tx.status}
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground mt-1">
                {format(new Date(tx.created_at), "MMM dd, yyyy 'at' hh:mm a")}
              </p>

              {tx.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {maskTransactionDescription(tx.description, false)}
                </p>
              )}
            </div>
          </div>

          <div className="text-right">
            <p className={cn("text-lg font-bold", getTransactionTypeColor(tx.type))}>
              {isCredit ? '+' : '-'}<CurrencyDisplay amountUSD={Math.abs(tx.amount)} />
            </p>
            <p className="text-sm text-muted-foreground">
              Balance: <CurrencyDisplay amountUSD={tx.new_balance} />
            </p>
          </div>
        </div>

        {/* Transaction Details - Expandable Section */}
        {(tx.gateway_transaction_id || hasMetadata) && (
          <div className="border-t pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full justify-between text-xs"
            >
              <span className="text-muted-foreground">
                {isExpanded ? 'Hide' : 'Show'} transaction details
              </span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>

            {isExpanded && (
              <div className="mt-3 space-y-2 text-xs">
                {/* Transaction ID */}
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span className="text-muted-foreground">Transaction ID:</span>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono">{tx.id.slice(0, 8)}...{tx.id.slice(-8)}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(tx.id, 'Transaction ID')}
                      className="h-6 w-6 p-0"
                    >
                      {copiedField === 'Transaction ID' ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Gateway Transaction ID */}
                {tx.gateway_transaction_id && (
                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <span className="text-muted-foreground">Gateway TX ID:</span>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono">{tx.gateway_transaction_id}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(tx.gateway_transaction_id!, 'Gateway Transaction ID')}
                        className="h-6 w-6 p-0"
                      >
                        {copiedField === 'Gateway Transaction ID' ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Metadata */}
                {hasMetadata && (
                  <div className="p-2 bg-muted/50 rounded">
                    <p className="text-muted-foreground mb-2">Additional Information:</p>
                    <div className="space-y-1 pl-2">
                      {Object.entries(tx.metadata).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-muted-foreground capitalize">
                            {key.replace(/_/g, ' ')}:
                          </span>
                          <span className="font-mono">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
