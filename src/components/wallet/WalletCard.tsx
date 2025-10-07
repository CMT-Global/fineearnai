import { Card } from "@/components/ui/card";
import { Wallet, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/wallet-utils";

interface WalletCardProps {
  type: "deposit" | "earnings";
  balance: number;
  subtitle: string;
}

export const WalletCard = ({ type, balance, subtitle }: WalletCardProps) => {
  const isDeposit = type === "deposit";
  const colorVar = isDeposit ? "--wallet-deposit" : "--wallet-earnings";
  const Icon = isDeposit ? Wallet : DollarSign;
  const title = isDeposit ? "Deposit Wallet" : "Earnings Wallet";

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl font-bold">{formatCurrency(balance)}</p>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <div 
          className="h-12 w-12 rounded-xl flex items-center justify-center"
          style={{ 
            backgroundColor: `hsl(var(${colorVar}) / 0.1)`,
            color: `hsl(var(${colorVar}))`
          }}
        >
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </Card>
  );
};
