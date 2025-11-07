import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VoucherDetailsDialog } from "./VoucherDetailsDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Loader2, Ticket, Search, Download, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/wallet-utils";
import { Skeleton } from "@/components/ui/skeleton";

const ITEMS_PER_PAGE = 10;

type VoucherType = 'all' | 'sent' | 'received';
type VoucherStatus = 'all' | 'active' | 'redeemed' | 'expired';

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

export function VoucherHistoryTable() {
  const { user } = useAuth();
  const [voucherType, setVoucherType] = useState<VoucherType>('all');
  const [statusFilter, setStatusFilter] = useState<VoucherStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Fetch sent vouchers (where user is partner)
  const { data: sentVouchers = [], isLoading: loadingSent } = useQuery({
    queryKey: ['sent-vouchers', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('vouchers')
        .select('*')
        .eq('partner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user && (voucherType === 'all' || voucherType === 'sent'),
  });

  // Fetch received vouchers (where user redeemed them)
  const { data: receivedVouchers = [], isLoading: loadingReceived } = useQuery({
    queryKey: ['received-vouchers', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('vouchers')
        .select('*')
        .eq('redeemed_by_user_id', user.id)
        .order('redeemed_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user && (voucherType === 'all' || voucherType === 'received'),
  });

  const isLoading = loadingSent || loadingReceived;

  // Fetch user profiles for all unique user IDs
  useEffect(() => {
    const fetchUserProfiles = async () => {
      const allVouchers = [...sentVouchers, ...receivedVouchers];
      const userIds = new Set<string>();

      allVouchers.forEach((voucher) => {
        if (voucher.partner_id) userIds.add(voucher.partner_id);
        if (voucher.redeemed_by_user_id) userIds.add(voucher.redeemed_by_user_id);
      });

      if (userIds.size === 0) return;

      try {
        const { data, error } = await supabase.functions.invoke('get-voucher-user-profiles', {
          body: { userIds: Array.from(userIds) }
        });

        if (error) throw error;
        if (data?.profiles) {
          setUserProfiles(data.profiles);
        }
      } catch (error) {
        console.error('Failed to fetch user profiles:', error);
      }
    };

    if ((sentVouchers.length > 0 || receivedVouchers.length > 0) && !isLoading) {
      fetchUserProfiles();
    }
  }, [sentVouchers, receivedVouchers, isLoading]);

  // Combine and filter vouchers
  const allVouchers: Voucher[] = [
    ...sentVouchers.map((v) => ({ ...v, type: 'sent' as const })),
    ...receivedVouchers.map((v) => ({ ...v, type: 'received' as const })),
  ];

  const filteredVouchers = allVouchers.filter((voucher) => {
    // Type filter
    if (voucherType !== 'all' && voucher.type !== voucherType) return false;

    // Status filter
    if (statusFilter !== 'all' && voucher.status !== statusFilter) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        voucher.voucher_code.toLowerCase().includes(query) ||
        voucher.partner_id.toLowerCase().includes(query) ||
        (voucher.redeemed_by_user_id && voucher.redeemed_by_user_id.toLowerCase().includes(query))
      );
    }

    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredVouchers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedVouchers = filteredVouchers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Stats
  const stats = {
    total: filteredVouchers.length,
    sent: allVouchers.filter(v => v.type === 'sent').length,
    received: allVouchers.filter(v => v.type === 'received').length,
    active: filteredVouchers.filter(v => v.status === 'active').length,
    redeemed: filteredVouchers.filter(v => v.status === 'redeemed').length,
    totalValue: filteredVouchers.reduce((sum, v) => sum + Number(v.voucher_amount), 0),
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">Active</Badge>;
      case 'redeemed':
        return <Badge variant="secondary">Redeemed</Badge>;
      case 'expired':
        return <Badge variant="destructive">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: 'sent' | 'received') => {
    return type === 'sent' ? (
      <Badge variant="outline" className="gap-1">
        <ArrowUpCircle className="h-3 w-3" />
        Sent
      </Badge>
    ) : (
      <Badge variant="outline" className="gap-1">
        <ArrowDownCircle className="h-3 w-3" />
        Received
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voucher History</CardTitle>
        <CardDescription>
          Track all vouchers you've sent and received
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-blue-500/10 rounded-lg p-3">
            <p className="text-xs text-blue-700 dark:text-blue-300">Sent</p>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{stats.sent}</p>
          </div>
          <div className="bg-green-500/10 rounded-lg p-3">
            <p className="text-xs text-green-700 dark:text-green-300">Received</p>
            <p className="text-xl font-bold text-green-700 dark:text-green-300">{stats.received}</p>
          </div>
          <div className="bg-amber-500/10 rounded-lg p-3">
            <p className="text-xs text-amber-700 dark:text-amber-300">Active</p>
            <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{stats.active}</p>
          </div>
          <div className="bg-purple-500/10 rounded-lg p-3">
            <p className="text-xs text-purple-700 dark:text-purple-300">Redeemed</p>
            <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{stats.redeemed}</p>
          </div>
          <div className="bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg p-3">
            <p className="text-xs text-primary">Total Value</p>
            <p className="text-xl font-bold text-primary">{formatCurrency(stats.totalValue)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>Type</Label>
            <Select value={voucherType} onValueChange={(value: VoucherType) => {
              setVoucherType(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vouchers</SelectItem>
                <SelectItem value="sent">Sent Only</SelectItem>
                <SelectItem value="received">Received Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={(value: VoucherStatus) => {
              setStatusFilter(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="redeemed">Redeemed</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by voucher code or ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filteredVouchers.length === 0 ? (
          <div className="text-center py-12">
            <Ticket className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">No vouchers found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery
                ? 'Try adjusting your filters or search query'
                : 'Vouchers will appear here once you send or receive them'}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Partner/User ID</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Redeemed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedVouchers.map((voucher) => (
                    <TableRow 
                      key={voucher.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedVoucher(voucher);
                        setDetailsDialogOpen(true);
                      }}
                    >
                      <TableCell>{getTypeBadge(voucher.type)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {voucher.voucher_code}
                      </TableCell>
                      <TableCell className="font-bold">
                        {formatCurrency(voucher.voucher_amount)}
                        {voucher.type === 'sent' && (
                          <span className="block text-xs text-green-600 dark:text-green-400">
                            +{formatCurrency(voucher.commission_amount)} profit
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(voucher.status)}</TableCell>
                      <TableCell>
                        {voucher.type === 'sent' 
                          ? (voucher.redeemed_by_user_id 
                              ? userProfiles[voucher.redeemed_by_user_id]?.username || `User ${voucher.redeemed_by_user_id.slice(0, 8)}...`
                              : '—')
                          : userProfiles[voucher.partner_id]?.username || `Partner ${voucher.partner_id.slice(0, 8)}...`
                        }
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {format(new Date(voucher.created_at), 'MMM dd, yyyy')}
                        </span>
                      </TableCell>
                      <TableCell>
                        {voucher.redeemed_at ? (
                          <span className="text-sm">
                            {format(new Date(voucher.redeemed_at), 'MMM dd, yyyy')}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {[...Array(totalPages)].map((_, i) => {
                    const page = i + 1;
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return (
                        <PaginationItem key={page}>
                          <span className="px-4">...</span>
                        </PaginationItem>
                      );
                    }
                    return null;
                  })}
                  
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}

            {/* Results info */}
            <p className="text-sm text-muted-foreground text-center">
              Showing {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredVouchers.length)} of {filteredVouchers.length} vouchers
            </p>
          </>
        )}
      </CardContent>

      <VoucherDetailsDialog
        voucher={selectedVoucher}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        userProfiles={userProfiles}
      />
    </Card>
  );
}
