import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useRealtimeTransactions } from "@/hooks/useRealtimeTransactions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageLoading } from "@/components/shared/PageLoading";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search,
  Filter,
  Calendar as CalendarIcon,
  X
} from "lucide-react";
import { RecentTransactionsCard } from "@/components/transactions/RecentTransactionsCard";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { format, subDays } from "date-fns";
import { useTranslation } from "react-i18next";

const Transactions = () => {
  const { t } = useTranslation();
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  
  // Advanced filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [showFilters, setShowFilters] = useState(false);

  // Enable real-time transaction updates
  useRealtimeTransactions(user?.id);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();
      
      if (profileError) throw profileError;
      
      if (profileData) {
        setProfile(profileData);
      }
    } catch (err) {
      console.error("Error loading profile:", err);
    }
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
    setSortBy("newest");
    setDateRange({ from: undefined, to: undefined });
  };

  const activeFiltersCount = 
    (searchQuery ? 1 : 0) +
    (typeFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (dateRange.from || dateRange.to ? 1 : 0) +
    (sortBy !== "newest" ? 1 : 0);

  // Early return ONLY for auth loading (before we have user)
  if (loading || !user) {
    return <PageLoading text={t("dashboard.authenticating")} />;
  }

  if (!profile) {
    return <PageLoading text={t("transactions.loadingTransactions")} />;
  }

  return (
    <div className="container max-w-6xl mx-auto p-4 lg:p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{t("transactions.title")}</h1>
          <p className="text-muted-foreground">
            {t("transactions.subtitle")}
          </p>
        </div>

        {/* Search and Filters */}
        <Card className="p-4 mb-6">
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("transactions.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Button
                variant={showFilters ? "default" : "outline"}
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                className="relative"
              >
                <Filter className="h-4 w-4" />
                {activeFiltersCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                  >
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
                {/* Transaction Type Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{t("transactions.transactionType")}</label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("transactions.allTypes")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("transactions.allTypes")}</SelectItem>
                      <SelectItem value="deposit">{t("transactions.deposit")}</SelectItem>
                      <SelectItem value="withdrawal">{t("transactions.withdrawal")}</SelectItem>
                      <SelectItem value="task_earning">{t("transactions.taskEarning")}</SelectItem>
                      <SelectItem value="referral_commission">{t("transactions.referralCommission")}</SelectItem>
                      <SelectItem value="plan_upgrade">{t("transactions.planUpgrade")}</SelectItem>
                      <SelectItem value="transfer">{t("transactions.transfer")}</SelectItem>
                      <SelectItem value="adjustment">{t("transactions.adjustment")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{t("transactions.status")}</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("transactions.allStatuses")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("transactions.allStatuses")}</SelectItem>
                      <SelectItem value="completed">{t("transactions.completed")}</SelectItem>
                      <SelectItem value="pending">{t("transactions.pending")}</SelectItem>
                      <SelectItem value="failed">{t("transactions.failed")}</SelectItem>
                      <SelectItem value="cancelled">{t("transactions.cancelled")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort By */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{t("transactions.sortBy")}</label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("transactions.sortBy")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">{t("transactions.newest")}</SelectItem>
                      <SelectItem value="oldest">{t("transactions.oldest")}</SelectItem>
                      <SelectItem value="amount-high">{t("transactions.amountHighToLow")}</SelectItem>
                      <SelectItem value="amount-low">{t("transactions.amountLowToHigh")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range Picker */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{t("transactions.dateRange")}</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateRange.from && !dateRange.to && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd, yyyy")}
                            </>
                          ) : (
                            format(dateRange.from, "MMM dd, yyyy")
                          )
                        ) : (
                          <span>{t("transactions.pickDateRange")}</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <div className="p-3 border-b space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}
                        >
                          {t("transactions.last7Days")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}
                        >
                          {t("transactions.last30Days")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => setDateRange({ from: subDays(new Date(), 90), to: new Date() })}
                        >
                          {t("transactions.last90Days")}
                        </Button>
                        {(dateRange.from || dateRange.to) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => setDateRange({ from: undefined, to: undefined })}
                          >
                            <X className="h-4 w-4 mr-2" />
                            {t("transactions.clearDates")}
                          </Button>
                        )}
                      </div>
                      <Calendar
                        mode="range"
                        selected={{ from: dateRange.from, to: dateRange.to }}
                        onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                        numberOfMonths={2}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Clear All Filters */}
                {activeFiltersCount > 0 && (
                  <div className="md:col-span-2 lg:col-span-4 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                      <X className="h-4 w-4 mr-2" />
                      {t("transactions.clearAllFilters", { count: activeFiltersCount })}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        <RecentTransactionsCard 
          userId={user.id}
          maxItems={50}
          showPagination={true}
          hideTitle={true}
          hideTabs={false}
          externalFilter={{
            searchQuery,
            typeFilter,
            statusFilter,
            dateRange,
            sortBy
          }}
        />
      </div>
  );
};

export default Transactions;
