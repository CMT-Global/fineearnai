import { useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const VoucherMonitoring = () => {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { data: vouchers, isLoading } = useVouchers({ status: statusFilter });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      active: { variant: "default", label: "Active" },
      redeemed: { variant: "secondary", label: "Redeemed" },
      expired: { variant: "destructive", label: "Expired" },
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
    <AdminLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Ticket className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Voucher Monitoring</h1>
          </div>
          <p className="text-muted-foreground">
            Track all voucher purchases and redemptions
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
            <AlertTitle className="text-green-900 dark:text-green-100">
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
                Total Vouchers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Redeemed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.redeemed}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Expired
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Value
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
                    placeholder="Search by voucher code, partner, or redeemer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="redeemed">Redeemed</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Vouchers Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Vouchers</CardTitle>
            <CardDescription>Complete voucher transaction history</CardDescription>
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
                    <TableHead>Voucher Code</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead>Redeemed By</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Redeemed</TableHead>
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
                        {voucher.partner?.username || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        {voucher.status === 'redeemed' 
                          ? voucher.redeemer?.username || 'Unknown'
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
                <p className="text-muted-foreground">No vouchers found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default VoucherMonitoring;
