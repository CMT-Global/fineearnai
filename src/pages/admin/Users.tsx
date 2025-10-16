import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { UserManagementStats } from "@/components/admin/UserManagementStats";
import { BulkActionsBar } from "@/components/admin/BulkActionsBar";
import { Search, Eye, Download, RefreshCw, ArrowUpDown } from "lucide-react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useUserManagement } from "@/hooks/useUserManagement";
import { useDebounce } from "@/hooks/useDebounce";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function Users() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showBulkPlanDialog, setShowBulkPlanDialog] = useState(false);
  const [bulkPlanName, setBulkPlanName] = useState("");
  const [showBulkSuspendDialog, setShowBulkSuspendDialog] = useState(false);
  const [bulkSuspendReason, setBulkSuspendReason] = useState("");
  
  const debouncedSearch = useDebounce(searchTerm, 500);
  
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
    sortBy,
    sortOrder,
  };

  const { data: usersData, isLoading } = useUserList(filters, currentPage, 20);
  const { data: stats, isLoading: statsLoading } = useUserStats();

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

  // Handle bulk plan update
  const handleBulkUpdatePlan = useCallback(async () => {
    if (!bulkPlanName || selectedUsers.size === 0) return;
    
    await bulkUpdatePlan.mutateAsync({
      userIds: Array.from(selectedUsers),
      planName: bulkPlanName,
    });
    
    setShowBulkPlanDialog(false);
    setSelectedUsers(new Set());
    setBulkPlanName("");
  }, [bulkPlanName, selectedUsers, bulkUpdatePlan]);

  // Handle bulk suspend
  const handleBulkSuspend = useCallback(async () => {
    if (selectedUsers.size === 0) return;
    
    await bulkSuspend.mutateAsync({
      userIds: Array.from(selectedUsers),
      suspendReason: bulkSuspendReason,
    });
    
    setShowBulkSuspendDialog(false);
    setSelectedUsers(new Set());
    setBulkSuspendReason("");
  }, [selectedUsers, bulkSuspendReason, bulkSuspend]);

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
    <div className="min-h-screen bg-[hsl(0,0%,98%)] p-6">
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
            {/* Filters */}
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by username, email, or name..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-10"
                  />
                </div>
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
                <Input
                  placeholder="Country..."
                  value={countryFilter}
                  onChange={(e) => {
                    setCountryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full md:w-[180px]"
                />
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
                          <TableCell className="font-medium">{user.username}</TableCell>
                          <TableCell>{user.email}</TableCell>
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
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
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

        {/* Bulk Update Plan Dialog */}
        <Dialog open={showBulkPlanDialog} onOpenChange={setShowBulkPlanDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bulk Update Plan</DialogTitle>
              <DialogDescription>
                Update {selectedUsers.size} user(s) to a new membership plan
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="bulk-plan">Select Plan</Label>
                <Select value={bulkPlanName} onValueChange={setBulkPlanName}>
                  <SelectTrigger id="bulk-plan">
                    <SelectValue placeholder="Choose a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkPlanDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleBulkUpdatePlan}
                disabled={!bulkPlanName || bulkUpdatePlan.isPending}
              >
                {bulkUpdatePlan.isPending ? "Updating..." : "Update Plan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Suspend Dialog */}
        <Dialog open={showBulkSuspendDialog} onOpenChange={setShowBulkSuspendDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bulk Suspend Users</DialogTitle>
              <DialogDescription>
                Suspend {selectedUsers.size} user(s). Provide a reason for suspension.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="suspend-reason">Reason (Optional)</Label>
                <Input
                  id="suspend-reason"
                  placeholder="e.g., Policy violation"
                  value={bulkSuspendReason}
                  onChange={(e) => setBulkSuspendReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkSuspendDialog(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleBulkSuspend}
                disabled={bulkSuspend.isPending}
              >
                {bulkSuspend.isPending ? "Suspending..." : "Suspend Users"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}