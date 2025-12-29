import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useVouchers } from "@/hooks/usePartnerManagement";
import { Loader2, Ticket, Search, Info, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/wallet-utils";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const VoucherMonitoring = () => {
  const { t, i18n: i18nInstance } = useTranslation();
  const { userLanguage, isLoading: isLanguageLoading } = useLanguage();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { data: vouchers, isLoading } = useVouchers({ status: statusFilter });
  
  // Force re-render when language changes
  useEffect(() => {
    // Ensure i18n language is synced with userLanguage from context
    if (i18nInstance.language !== userLanguage && !isLanguageLoading) {
      i18nInstance.changeLanguage(userLanguage).catch((err) => {
        console.error('Error changing i18n language:', err);
      });
    }
  }, [userLanguage, isLanguageLoading, i18nInstance]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      active: { variant: "default", label: t("admin.voucherMonitoring.status.active") },
      redeemed: { variant: "secondary", label: t("admin.voucherMonitoring.status.redeemed") },
      expired: { variant: "destructive", label: t("admin.voucherMonitoring.status.expired") },
    };

    const config = variants[status] || variants.active;

    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredVouchers = vouchers?.filter((voucher: any) => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      voucher.voucher_code?.toLowerCase().includes(query) ||
      voucher.partner?.username?.toLowerCase().includes(query) ||
      voucher.redeemer?.username?.toLowerCase().includes(query)
    );
  });

  const stats = {
    total: vouchers?.length || 0,
    active: vouchers?.filter((v: any) => v.status === 'active').length || 0,
    redeemed: vouchers?.filter((v: any) => v.status === 'redeemed').length || 0,
    expired: vouchers?.filter((v: any) => v.status === 'expired').length || 0,
    totalValue: vouchers?.reduce((sum: number, v: any) => sum + parseFloat(String(v.voucher_amount)), 0) || 0,
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Ticket className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">{t("admin.voucherMonitoring.title")}</h1>
        </div>
        <p className="text-muted-foreground">
          {t("admin.voucherMonitoring.subtitle")}
        </p>
      </div>

      {/* Phase 2 Backward Compatibility Notice */}
      {stats.active > 0 ? (
        <Alert className="mb-6 border-blue-500 bg-blue-50 dark:bg-blue-950/20">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-900 dark:text-blue-100">
            System Transition: Auto-Redemption Active
          </AlertTitle>
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <p className="mb-2">
              <strong>New vouchers are now automatically redeemed.</strong> When a partner sends a voucher, 
              the recipient is instantly credited without needing to manually redeem a code.
            </p>
            <p className="mb-2">
              The <strong className="text-blue-900 dark:text-blue-100">{stats.active} active voucher(s)</strong> shown 
              below are legacy vouchers created before this update and still awaiting manual redemption.
            </p>
            <p className="text-sm">
              💡 <strong>Next Step:</strong> Once the active count reaches 0 (all legacy vouchers redeemed or expired), 
              the system can proceed to Phase 3 cleanup to remove legacy code.
            </p>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="mb-6 border-green-500 bg-green-50 dark:bg-green-950/20">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-blue-900 dark:text-blue-100">
            Ready for Phase 3 Cleanup
          </AlertTitle>
          <AlertDescription className="text-green-800 dark:text-green-200">
            <p className="mb-2">
              ✅ <strong>No active legacy vouchers remaining.</strong> All vouchers are now using the auto-redemption system.
            </p>
            <p className="text-sm">
              The system is ready for Phase 3 cleanup to remove legacy voucher redemption code and simplify the codebase.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("admin.voucherMonitoring.stats.totalVouchers")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("admin.voucherMonitoring.stats.active")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("admin.voucherMonitoring.stats.redeemed")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.redeemed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("admin.voucherMonitoring.stats.expired")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("admin.voucherMonitoring.stats.totalValue")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("admin.voucherMonitoring.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder={t("admin.voucherMonitoring.filterByStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.voucherMonitoring.allStatuses")}</SelectItem>
                <SelectItem value="active">{t("admin.voucherMonitoring.status.active")}</SelectItem>
                <SelectItem value="redeemed">{t("admin.voucherMonitoring.status.redeemed")}</SelectItem>
                <SelectItem value="expired">{t("admin.voucherMonitoring.status.expired")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Vouchers Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.voucherMonitoring.allVouchers")}</CardTitle>
          <CardDescription>{t("admin.voucherMonitoring.completeHistory")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredVouchers && filteredVouchers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.voucherMonitoring.table.voucherCode")}</TableHead>
                  <TableHead>{t("admin.voucherMonitoring.table.amount")}</TableHead>
                  <TableHead>{t("admin.voucherMonitoring.table.partner")}</TableHead>
                  <TableHead>{t("admin.voucherMonitoring.table.redeemedBy")}</TableHead>
                  <TableHead>{t("admin.voucherMonitoring.table.status")}</TableHead>
                  <TableHead>{t("admin.voucherMonitoring.table.created")}</TableHead>
                  <TableHead>{t("admin.voucherMonitoring.table.redeemed")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVouchers.map((voucher: any) => (
                  <TableRow key={voucher.id}>
                    <TableCell className="font-mono font-medium">
                      {voucher.voucher_code}
                    </TableCell>
                    <TableCell className="font-bold">
                      {formatCurrency(voucher.voucher_amount)}
                    </TableCell>
                    <TableCell>
                      {voucher.partner?.username || t("admin.voucherMonitoring.unknown")}
                    </TableCell>
                    <TableCell>
                      {voucher.status === 'redeemed' 
                        ? voucher.redeemer?.username || t("admin.voucherMonitoring.unknown")
                        : '—'
                      }
                    </TableCell>
                    <TableCell>{getStatusBadge(voucher.status)}</TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(voucher.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      {voucher.redeemed_at
                        ? formatDistanceToNow(new Date(voucher.redeemed_at), { addSuffix: true })
                        : '—'
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-12 text-center">
              <Ticket className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">{t("admin.voucherMonitoring.noVouchersFound")}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VoucherMonitoring;
