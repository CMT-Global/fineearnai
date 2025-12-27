import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/wallet-utils";
import { ArrowUpCircle, ArrowDownCircle, Calendar, User, FileText, DollarSign, Hash } from "lucide-react";
import { useTranslation } from "react-i18next";

interface UserProfile {
  id: string;
  username: string;
  email: string;
}

interface VoucherData {
  id: string;
  voucher_code: string;
  voucher_amount: number;
  partner_paid_amount: number;
  commission_amount: number;
  commission_rate: number;
  status: string;
  created_at: string;
  redeemed_at: string | null;
  expires_at: string;
  partner_id: string;
  redeemed_by_user_id: string | null;
  purchase_transaction_id: string | null;
  redemption_transaction_id: string | null;
  notes: string | null;
}

interface Voucher extends VoucherData {
  type: 'sent' | 'received';
}

interface VoucherDetailsDialogProps {
  voucher: Voucher | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userProfiles: Record<string, UserProfile>;
}

export function VoucherDetailsDialog({
  voucher,
  open,
  onOpenChange,
  userProfiles,
}: VoucherDetailsDialogProps) {
  const { t } = useTranslation();
  if (!voucher) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">{t("partner.voucherDetails.status.active")}</Badge>;
      case 'redeemed':
        return <Badge variant="secondary">{t("partner.voucherDetails.status.redeemed")}</Badge>;
      case 'expired':
        return <Badge variant="destructive">{t("partner.voucherDetails.status.expired")}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: 'sent' | 'received') => {
    return type === 'sent' ? (
      <Badge variant="outline" className="gap-1">
        <ArrowUpCircle className="h-3 w-3" />
        {t("partner.voucherDetails.type.sent")}
      </Badge>
    ) : (
      <Badge variant="outline" className="gap-1">
        <ArrowDownCircle className="h-3 w-3" />
        {t("partner.voucherDetails.type.received")}
      </Badge>
    );
  };

  const partnerProfile = userProfiles[voucher.partner_id];
  const redeemerProfile = voucher.redeemed_by_user_id 
    ? userProfiles[voucher.redeemed_by_user_id]
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t("partner.voucherDetails.title")}
            {getTypeBadge(voucher.type)}
            {getStatusBadge(voucher.status)}
          </DialogTitle>
          <DialogDescription>
            {t("partner.voucherDetails.completeInformation", { code: voucher.voucher_code })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Voucher Code */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t("partner.voucherDetails.voucherCode")}</span>
            </div>
            <p className="font-mono text-xl font-bold">{voucher.voucher_code}</p>
          </div>

          {/* Financial Breakdown */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">{t("partner.voucherDetails.financialBreakdown")}</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                <span className="text-sm text-muted-foreground">{t("partner.voucherDetails.voucherAmount")}</span>
                <span className="font-bold text-lg">{formatCurrency(voucher.voucher_amount)}</span>
              </div>
              
              {voucher.type === 'sent' && (
                <>
                  <div className="flex justify-between items-center p-3 bg-red-500/10 rounded-lg">
                    <span className="text-sm text-muted-foreground">{t("partner.voucherDetails.partnerPaid")}</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      -{formatCurrency(voucher.partner_paid_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-500/10 rounded-lg">
                    <span className="text-sm text-muted-foreground">{t("partner.voucherDetails.commissionEarned")}</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      +{formatCurrency(voucher.commission_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-500/10 rounded-lg">
                    <span className="text-sm text-muted-foreground">{t("partner.voucherDetails.commissionRate")}</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {(voucher.commission_rate * 100).toFixed(1)}%
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <Separator />

          {/* User Information */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">{t("partner.voucherDetails.userInformation")}</h3>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">
                  {voucher.type === 'sent' ? t("partner.voucherDetails.createdBy") : t("partner.voucherDetails.partner")}
                </p>
                <p className="font-medium">
                  {partnerProfile?.username || `User ${voucher.partner_id.slice(0, 8)}...`}
                </p>
                {partnerProfile?.email && (
                  <p className="text-sm text-muted-foreground">{partnerProfile.email}</p>
                )}
              </div>

              {voucher.redeemed_by_user_id && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">{t("partner.voucherDetails.redeemedBy")}</p>
                  <p className="font-medium">
                    {redeemerProfile?.username || `User ${voucher.redeemed_by_user_id.slice(0, 8)}...`}
                  </p>
                  {redeemerProfile?.email && (
                    <p className="text-sm text-muted-foreground">{redeemerProfile.email}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">{t("partner.voucherDetails.timeline")}</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t("partner.voucherDetails.created")}</span>
                <span className="text-sm font-medium">
                  {format(new Date(voucher.created_at), 'PPpp')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t("partner.voucherDetails.expires")}</span>
                <span className="text-sm font-medium">
                  {format(new Date(voucher.expires_at), 'PPpp')}
                </span>
              </div>
              {voucher.redeemed_at && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t("partner.voucherDetails.redeemed")}</span>
                  <span className="text-sm font-medium">
                    {format(new Date(voucher.redeemed_at), 'PPpp')}
                  </span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Transaction IDs */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">{t("partner.voucherDetails.transactionReferences")}</h3>
            </div>
            <div className="space-y-2">
              {voucher.purchase_transaction_id && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">{t("partner.voucherDetails.purchaseTransactionId")}</p>
                  <p className="font-mono text-sm break-all">{voucher.purchase_transaction_id}</p>
                </div>
              )}
              {voucher.redemption_transaction_id && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">{t("partner.voucherDetails.redemptionTransactionId")}</p>
                  <p className="font-mono text-sm break-all">{voucher.redemption_transaction_id}</p>
                </div>
              )}
              {!voucher.purchase_transaction_id && !voucher.redemption_transaction_id && (
                <p className="text-sm text-muted-foreground italic">{t("partner.voucherDetails.noTransactionIds")}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          {voucher.notes && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">{t("partner.voucherDetails.notes")}</h3>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{voucher.notes}</p>
                </div>
              </div>
            </>
          )}

          {/* Voucher ID */}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              {t("partner.voucherDetails.voucherId")}: <span className="font-mono">{voucher.id}</span>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
