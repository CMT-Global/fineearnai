import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  LayoutDashboard,
  Users,
  Zap,
  DollarSign,
  Crown,
  Mail,
  ArrowLeft,
  LogOut,
  ChevronDown,
  Menu,
  Shield,
  Settings,
  TrendingUp,
  Sparkles,
  Activity,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAdminMode } from "@/contexts/AdminModeContext";
import { LogoutConfirmDialog } from "@/components/shared/LogoutConfirmDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AdminSidebarProps {
  profile: any;
  onSignOut: () => void;
}

interface NavCategory {
  label: string;
  icon: any;
  items: NavItem[];
  defaultOpen?: boolean;
}

interface NavItem {
  label: string;
  path: string;
  icon?: any;
}

export const AdminSidebar = ({ profile, onSignOut }: AdminSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { exitAdminMode } = useAdminMode();
  const [open, setOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(() => {
    const stored = localStorage.getItem("adminExpandedCategories");
    return stored ? JSON.parse(stored) : ["overview"];
  });

  // Fetch failed commission count for badge
  const { data: failedCommissionCount } = useQuery({
    queryKey: ['failed-commission-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('commission_audit_log')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed');
      
      if (error) {
        console.error('Error fetching failed commission count:', error);
        return 0;
      }
      return count || 0;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const navCategories: NavCategory[] = [
    {
      label: "Overview",
      icon: LayoutDashboard,
      items: [
        { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
        { label: "Platform Analytics", path: "/admin/analytics/dashboard", icon: TrendingUp },
      ],
      defaultOpen: true,
    },
    {
      label: "User Management",
      icon: Users,
      items: [
        { label: "All Users", path: "/admin/users" },
      ],
    },
    {
      label: "Task Management",
      icon: Zap,
      items: [
        { label: "Generate AI Tasks", path: "/admin/tasks/generate" },
        { label: "Manage AI Tasks", path: "/admin/tasks/manage" },
        { label: "Task Analytics", path: "/admin/analytics/tasks" },
      ],
    },
    {
      label: "Financial Management",
      icon: DollarSign,
      items: [
        { label: "All Transactions", path: "/admin/transactions" },
        { label: "Deposits", path: "/admin/deposits" },
        { label: "Withdrawals", path: "/admin/withdrawals" },
        { label: "Payment Settings", path: "/admin/settings/payments" },
        { label: "CPAY Checkouts", path: "/admin/settings/cpay-checkouts" },
        { label: "Fee Savings Banner", path: "/admin/settings/fee-savings-banner" },
      ],
    },
    {
      label: "Content Management",
      icon: Settings,
      items: [
        { label: "Dashboard Content", path: "/admin/content/dashboard" },
        { label: "How It Works Content", path: "/admin/content/how-it-works" },
      ],
    },
    {
      label: "Membership Management",
      icon: Crown,
      items: [
        { label: "Plans Configuration", path: "/admin/plans/manage" },
      ],
    },
    {
      label: "Referral Management",
      icon: TrendingUp,
      items: [
        { label: "Referral System", path: "/admin/referrals/manage" },
      ],
    },
      {
        label: "Partner Management",
        icon: Sparkles,
        items: [
          { label: "Partner Applications", path: "/admin/partners/applications" },
          { label: "All Partners", path: "/admin/partners" },
          { label: "Partner Analytics", path: "/admin/partner-analytics" },
          { label: "Partner Ranks", path: "/admin/partner-ranks" },
          { label: "Bonus Tiers", path: "/admin/partner-bonus-tiers" },
          { label: "Bonus Payouts", path: "/admin/partner-bonus-payouts" },
          { label: "Bonus Monitoring", path: "/admin/partner-bonus-monitoring" },
          { label: "Leaderboard", path: "/admin/partner-leaderboard-stats" },
          { label: "Leaderboard Settings", path: "/admin/partner-leaderboard" },
          { label: "Voucher Monitoring", path: "/admin/partners/vouchers" },
        ],
      },
    {
      label: "Communications",
      icon: Mail,
      items: [
        { label: "Email Settings", path: "/admin/communications/email-settings" },
        { label: "Login Message", path: "/admin/communications/login-message" },
        { label: "Bulk Email", path: "/admin/communications/email" },
        { label: "Influencer Invites", path: "/admin/communications/influencer-invites" },
        { label: "User Invites", path: "/admin/communications/user-invites" },
        { label: "Email Templates", path: "/admin/communications/templates" },
        { label: "Scheduled Emails", path: "/admin/communications/scheduled" },
      ],
    },
    {
      label: "Security",
      icon: Shield,
      items: [
        { label: "Security Settings", path: "/admin/security-settings" },
      ],
    },
    {
      label: "Monitoring",
      icon: Activity,
      items: [
        { label: "Daily Reset Logs", path: "/admin/monitoring/daily-reset-logs" },
        { label: "Commission Audit", path: "/admin/monitoring/commission-audit" },
      ],
    },
  ];

  // Save expanded categories to localStorage
  useEffect(() => {
    localStorage.setItem("adminExpandedCategories", JSON.stringify(expandedCategories));
  }, [expandedCategories]);

  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const isCategoryActive = (category: NavCategory) => {
    return category.items.some((item) => isActive(item.path));
  };

  const toggleCategory = (label: string) => {
    setExpandedCategories((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const handleExitAdminMode = () => {
    exitAdminMode();
    navigate("/dashboard");
    setOpen(false);
  };

  const handleLogoutClick = () => {
    setLogoutDialogOpen(true);
  };

  const handleLogoutConfirm = () => {
    setLogoutDialogOpen(false);
    setOpen(false);
    onSignOut();
  };

  const NavContent = () => (
    <>
      {/* Admin Header */}
      <div className="p-6 border-b border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-6 w-6 text-[hsl(var(--wallet-deposit))]" />
          <span className="text-xl font-bold">Admin Panel</span>
        </div>
        
        {/* Back to Main App Button */}
        <Button
          onClick={handleExitAdminMode}
          variant="outline"
          className="w-full border-[hsl(var(--wallet-deposit))] text-[hsl(var(--wallet-deposit))] hover:bg-[hsl(var(--wallet-deposit))]/10"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Main App
        </Button>
      </div>

      {/* Navigation Categories */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navCategories.map((category) => {
          const isExpanded = expandedCategories.includes(category.label);
          const categoryActive = isCategoryActive(category);

          return (
            <Collapsible
              key={category.label}
              open={isExpanded}
              onOpenChange={() => toggleCategory(category.label)}
            >
              <CollapsibleTrigger className="w-full">
                <div
                  className={`flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
                    categoryActive
                      ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-fg))]"
                      : "hover:bg-[hsl(var(--sidebar-accent))]/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <category.icon className={`h-5 w-5 ${categoryActive ? 'text-[hsl(var(--wallet-deposit))]' : ''}`} />
                    <span className="font-medium">{category.label}</span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-1 ml-4 space-y-1">
                {category.items.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => handleNavigation(item.path)}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200 w-full text-left text-sm ${
                      isActive(item.path)
                        ? "bg-[hsl(var(--wallet-deposit))]/20 text-[hsl(var(--wallet-deposit))] font-medium border-l-4 border-[hsl(var(--wallet-deposit))]"
                        : "hover:bg-[hsl(var(--sidebar-accent))]/30 text-[hsl(var(--sidebar-fg))]/80"
                    }`}
                  >
                    {item.icon && <item.icon className="h-4 w-4" />}
                    <span className="flex-1">{item.label}</span>
                    {/* Show failed commission badge on Commission Audit menu item */}
                    {item.path === "/admin/monitoring/commission-audit" && failedCommissionCount > 0 && (
                      <Badge variant="destructive" className="text-xs px-1.5 py-0 h-5 min-w-[20px]">
                        {failedCommissionCount}
                      </Badge>
                    )}
                  </button>
                ))}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </nav>

      {/* Admin Profile & Logout */}
      <div className="p-4 border-t border-[hsl(var(--sidebar-border))] space-y-3">
        <div className="flex items-center gap-3 px-4 py-3 bg-[hsl(var(--sidebar-accent))]/30 rounded-lg">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] flex items-center justify-center text-white font-bold flex-shrink-0">
            {profile?.username?.charAt(0).toUpperCase() || "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile?.username || "Admin"}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="default" className="text-xs px-2 py-0 bg-[hsl(var(--wallet-deposit))]">
                <Shield className="h-3 w-3 mr-1" />
                Admin
              </Badge>
            </div>
          </div>
        </div>

        {/* Logout Button - Highly Visible Red Style */}
        <Button
          onClick={handleLogoutClick}
          variant="destructive"
          size="lg"
          className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
        >
          <LogOut className="h-5 w-5 mr-2" />
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <>
      <LogoutConfirmDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        onConfirm={handleLogoutConfirm}
      />
      {/* Mobile Admin Sidebar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-[hsl(var(--wallet-deposit))]" />
          <span className="font-bold">Admin Panel</span>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <div className="flex flex-col h-full bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))]">
              <NavContent />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Admin Sidebar */}
      <aside className="hidden lg:flex w-80 bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))] flex-col">
        <NavContent />
      </aside>
    </>
  );
};
