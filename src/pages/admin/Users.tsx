import { useState, useCallback } from "react";
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

function UsersContent() {
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
        <AdminBreadcrumb items={[{ label: "User Management" }]} />
        
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground mt-1">Manage and monitor all platform users</p>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <UserManagementStats stats={stats} isLoading={statsLoading} />

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
            <CardTitle>All Users</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Search Input - Full Width */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search by username, email, or name..."
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
                  <SelectValue placeholder="Filter by plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="banned">Banned</SelectItem>
                </SelectContent>
              </Select>
              <Select value={countryFilter} onValueChange={(value) => {
                setCountryFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Filter by country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
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
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="user">User Only</SelectItem>
                </SelectContent>
              </Select>
              <Select value={emailVerifiedFilter} onValueChange={(value) => {
                setEmailVerifiedFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Email Verification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="verified">Verified Only</SelectItem>
                  <SelectItem value="unverified">Unverified Only</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkExport()}
                disabled={users.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export All
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
                            Username
                            <ArrowUpDown className="ml-2 h-3 w-3" />
                          </Button>
                        </TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleSort('membership_plan')}
                            className="h-8 px-2"
                          >
                            Plan
                            <ArrowUpDown className="ml-2 h-3 w-3" />
                          </Button>
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleSort('total_earned')}
                            className="h-8 px-2"
                          >
                            Earned
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
                            Joined
                            <ArrowUpDown className="ml-2 h-3 w-3" />
                          </Button>
                        </TableHead>
                        <TableHead className="text-right">Actions</TableHead>
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
                                <div title="Email Verified">
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                </div>
                              )}
                              {user.email_verified === false && (
                                <div title="Email Not Verified">
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
                                  Admin
                                </Badge>
                              )}
                              {user.roles?.includes('moderator') && (
                                <Badge variant="outline" className="flex items-center gap-1">
                                  <Shield className="h-3 w-3" />
                                  Mod
                                </Badge>
                              )}
                              {(!user.roles || (user.roles.length === 1 && user.roles[0] === 'user')) && (
                                <Badge variant="outline">User</Badge>
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
                            No users found
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
  return (
    <AdminErrorBoundary fallbackTitle="User Management Error">
      <UsersContent />
    </AdminErrorBoundary>
  );
}