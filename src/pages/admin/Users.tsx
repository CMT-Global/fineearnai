import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { AdminErrorBoundary } from "@/components/admin/AdminErrorBoundary";
import { UserManagementStats } from "@/components/admin/UserManagementStats";
import { BulkActionsBar } from "@/components/admin/BulkActionsBar";
import { BulkUpdatePlanDialog } from "@/components/admin/dialogs/BulkUpdatePlanDialog";
import { BulkSuspendDialog } from "@/components/admin/dialogs/BulkSuspendDialog";
import { Search, Eye, Download, RefreshCw, ArrowUpDown, Crown, Shield, Mail, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useUserManagement } from "@/hooks/useUserManagement";
import { useDebounce } from "@/hooks/useDebounce";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { sanitizeSearchTerm } from "@/lib/admin-validation";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";

function UsersContent() {
  const { t } = useTranslation();
  // Use useLanguageSync hook to ensure proper language synchronization
  const { languageKey } = useLanguageSync();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [emailVerifiedFilter, setEmailVerifiedFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showBulkPlanDialog, setShowBulkPlanDialog] = useState(false);
  const [showBulkSuspendDialog, setShowBulkSuspendDialog] = useState(false);
  
  const debouncedSearch = useDebounce(sanitizeSearchTerm(searchTerm), 500);
  
  const {
    useUserList,
    useUserStats,
    bulkUpdatePlan,
    bulkSuspend,
    bulkExport,
  } = useUserManagement();

  const filters = {
    searchTerm: debouncedSearch,
    planFilter,
    statusFilter,
    countryFilter,
    roleFilter,
    emailVerifiedFilter,
    sortBy,
    sortOrder,
  };

  const { data: usersData, isLoading } = useUserList(filters, currentPage, 20);
  const { data: stats, isLoading: statsLoading } = useUserStats();

  // Fetch distinct countries for filter
  const { data: countries } = useQuery({
    queryKey: ["admin", "countries"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("registration_country, registration_country_name")
        .not("registration_country", "is", null)
        .not("registration_country_name", "is", null)
        .order("registration_country_name");
      
      // Deduplicate and filter out any remaining nulls
      const unique = Array.from(
        new Map(
          data
            ?.filter(item => item.registration_country && item.registration_country_name)
            ?.map(item => [item.registration_country, item])
        )
      ).map(([_, value]) => value);
      
      return unique;
    },
  });

  const users = usersData?.users || [];
  const totalPages = usersData?.totalPages || 1;

  // Select/Deselect all users on current page
  const toggleSelectAll = useCallback(() => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map((u: any) => u.id)));
    }
  }, [users, selectedUsers.size]);

  // Toggle individual user selection
  const toggleSelectUser = useCallback((userId: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  }, []);

  // Handle bulk export
  const handleBulkExport = useCallback(async () => {
    if (selectedUsers.size === 0) return;
    
    await bulkExport.mutateAsync({
      userIds: Array.from(selectedUsers),
      exportFormat: 'csv',
    });
  }, [selectedUsers, bulkExport]);

  // Handle sort column toggle
  const handleSort = useCallback((column: string) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(column);
      setSortOrder('DESC');
    }
  }, [sortBy]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <AdminBreadcrumb items={[{ label: t("admin.users.title") }]} />
        
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("admin.users.title")}</h1>
            <p className="text-muted-foreground mt-1">{t("admin.users.subtitle")}</p>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("admin.users.refresh")}
          </Button>
        </div>

        {/* Stats Cards */}
        <UserManagementStats key={languageKey} stats={stats} isLoading={statsLoading} />

        {/* Bulk Actions Bar */}
        <BulkActionsBar
          selectedCount={selectedUsers.size}
          onClearSelection={() => setSelectedUsers(new Set())}
          onBulkUpdatePlan={() => setShowBulkPlanDialog(true)}
          onBulkSuspend={() => setShowBulkSuspendDialog(true)}
          onBulkExport={handleBulkExport}
        />

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.users.allUsers")}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Search Input - Full Width */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder={t("admin.users.searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10 h-12 text-base"
                />
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <Select value={planFilter} onValueChange={(value) => {
                setPlanFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder={t("admin.users.filters.plan.label")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.users.filters.plan.all")}</SelectItem>
                  <SelectItem value="free">{t("admin.users.filters.plan.free")}</SelectItem>
                  <SelectItem value="basic">{t("admin.users.filters.plan.basic")}</SelectItem>
                  <SelectItem value="premium">{t("admin.users.filters.plan.premium")}</SelectItem>
                  <SelectItem value="vip">{t("admin.users.filters.plan.vip")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder={t("admin.users.filters.status.label")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.users.filters.status.all")}</SelectItem>
                  <SelectItem value="active">{t("admin.users.filters.status.active")}</SelectItem>
                  <SelectItem value="suspended">{t("admin.users.filters.status.suspended")}</SelectItem>
                  <SelectItem value="banned">{t("admin.users.filters.status.banned")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={countryFilter} onValueChange={(value) => {
                setCountryFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder={t("admin.users.filters.country.label")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.users.filters.country.all")}</SelectItem>
                  {countries
                    ?.filter(c => c.registration_country && c.registration_country_name)
                    ?.map((c) => (
                      <SelectItem key={c.registration_country} value={c.registration_country}>
                        {c.registration_country_name} ({c.registration_country})
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
              <Select value={roleFilter} onValueChange={(value) => {
                setRoleFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder={t("admin.users.filters.role.label")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.users.filters.role.all")}</SelectItem>
                  <SelectItem value="admin">{t("admin.users.filters.role.admin")}</SelectItem>
                  <SelectItem value="moderator">{t("admin.users.filters.role.moderator")}</SelectItem>
                  <SelectItem value="user">{t("admin.users.filters.role.user")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={emailVerifiedFilter} onValueChange={(value) => {
                setEmailVerifiedFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder={t("admin.users.filters.emailVerification.label")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.users.filters.emailVerification.all")}</SelectItem>
                  <SelectItem value="verified">{t("admin.users.filters.emailVerification.verified")}</SelectItem>
                  <SelectItem value="unverified">{t("admin.users.filters.emailVerification.unverified")}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkExport()}
                disabled={users.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                {t("admin.users.exportAll")}
              </Button>
            </div>

            {isLoading ? (
              <LoadingSpinner />
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedUsers.size === users.length && users.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleSort('username')}
                            className="h-8 px-2"
                          >
                            {t("admin.users.table.username")}
                            <ArrowUpDown className="ml-2 h-3 w-3" />
                          </Button>
                        </TableHead>
                        <TableHead>{t("admin.users.table.email")}</TableHead>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleSort('membership_plan')}
                            className="h-8 px-2"
                          >
                            {t("admin.users.table.plan")}
                            <ArrowUpDown className="ml-2 h-3 w-3" />
                          </Button>
                        </TableHead>
                        <TableHead>{t("admin.users.table.status")}</TableHead>
                        <TableHead>{t("admin.users.table.roles")}</TableHead>
                        <TableHead>{t("admin.users.table.country")}</TableHead>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleSort('total_earned')}
                            className="h-8 px-2"
                          >
                            {t("admin.users.table.earned")}
                            <ArrowUpDown className="ml-2 h-3 w-3" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleSort('created_at')}
                            className="h-8 px-2"
                          >
                            {t("admin.users.table.joined")}
                            <ArrowUpDown className="ml-2 h-3 w-3" />
                          </Button>
                        </TableHead>
                        <TableHead className="text-right">{t("admin.users.table.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user: any) => (
                        <TableRow key={user.id} className="hover:bg-muted/50">
                          <TableCell>
                            <Checkbox
                              checked={selectedUsers.has(user.id)}
                              onCheckedChange={() => toggleSelectUser(user.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="link"
                              className="h-auto p-0 font-medium text-base text-foreground hover:text-primary"
                              onClick={() => navigate(`/admin/users/${user.id}`)}
                            >
                              {user.username}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{user.email}</span>
                              {user.email_verified === true && (
                                <div title={t("admin.users.table.emailVerified")}>
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                </div>
                              )}
                              {user.email_verified === false && (
                                <div title={t("admin.users.table.emailNotVerified")}>
                                  <XCircle className="h-4 w-4 text-red-600" />
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{user.membership_plan}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                user.account_status === "active"
                                  ? "default"
                                  : user.account_status === "suspended"
                                  ? "secondary"
                                  : "destructive"
                              }
                            >
                              {user.account_status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {user.roles?.includes('admin') && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                  <Crown className="h-3 w-3" />
                                  {t("admin.users.filters.role.admin")}
                                </Badge>
                              )}
                              {user.roles?.includes('moderator') && (
                                <Badge variant="outline" className="flex items-center gap-1">
                                  <Shield className="h-3 w-3" />
                                  {t("admin.users.filters.role.moderator")}
                                </Badge>
                              )}
                              {(!user.roles || (user.roles.length === 1 && user.roles[0] === 'user')) && (
                                <Badge variant="outline">{t("admin.users.filters.role.user")}</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{user.country || "-"}</TableCell>
                          <TableCell>${(user.total_earned || 0).toFixed(2)}</TableCell>
                          <TableCell>
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/admin/users/${user.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {users.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                            {t("admin.users.table.noUsersFound")}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="mt-4">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const page = i + 1;
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
                        })}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Bulk Dialogs */}
        <BulkUpdatePlanDialog
          open={showBulkPlanDialog}
          onOpenChange={setShowBulkPlanDialog}
          selectedUserIds={Array.from(selectedUsers)}
          onComplete={() => setSelectedUsers(new Set())}
        />

        <BulkSuspendDialog
          open={showBulkSuspendDialog}
          onOpenChange={setShowBulkSuspendDialog}
          selectedUserIds={Array.from(selectedUsers)}
          onComplete={() => setSelectedUsers(new Set())}
        />
      </div>
    </div>
  );
}

export default function Users() {
  const { t } = useTranslation();
  return (
    <AdminErrorBoundary fallbackTitle={t("admin.users.errorTitle")}>
      <UsersContent />
    </AdminErrorBoundary>
  );
}