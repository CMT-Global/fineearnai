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
  Globe,
} from "lucide-react";
import { useState, useEffect, useMemo, memo, useCallback, useRef } from "react";
import { useAdminMode } from "@/contexts/AdminModeContext";
import { LogoutConfirmDialog } from "@/components/shared/LogoutConfirmDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "@/contexts/BrandingContext";
import { useTranslation } from "react-i18next";
import { useAdmin } from "@/hooks/useAdmin";

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
  exact?: boolean;
}

/** Persists admin sidebar nav scroll across navigations (e.g. Overview → Withdrawals). */
const ADMIN_SIDEBAR_SCROLL_KEY = "admin-sidebar-nav-scroll-top";
let persistedAdminSidebarScroll = 0;

export const AdminSidebar = memo(({ profile, onSignOut }: AdminSidebarProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { platformName, platformLogoUrl } = useBranding();
  const { exitAdminMode } = useAdminMode();
  const [open, setOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(() => {
    const stored = localStorage.getItem("adminExpandedSection");
    if (stored) return stored;
    return "overview";
  });
  const scrollPositionsRef = useRef<Map<string, number>>(new Map());
  const navScrollRef = useRef<HTMLElement | null>(null);
  const scrollCapturedRef = useRef(0);
  /** Captured on mousedown so we save scroll before click/focus can change it. */
  const scrollAtMouseDownRef = useRef(0);
  /** Scroll to restore after next pathname change (from the click that triggered it). */
  const pendingScrollRestoreRef = useRef<number | null>(null);
  /** After toggle/expand, guard scroll at this position so browser can't jump to active link. */
  const scrollGuardRef = useRef<number | null>(null);
  const scrollGuardUntilRef = useRef<number>(0);
  /** Scroll to restore after expandedSection state has committed (for below-the-fold clicks). */
  const scrollToRestoreAfterExpandRef = useRef<number | null>(null);

  const { isAdmin } = useAdmin();

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
      label: t("admin.sidebar.categories.overview"),
      icon: LayoutDashboard,
      items: [
        { label: t("admin.sidebar.items.dashboard"), path: "/admin", icon: LayoutDashboard },
        { label: t("admin.sidebar.items.platformAnalytics"), path: "/admin/analytics/dashboard", icon: TrendingUp },
      ],
      defaultOpen: true,
    },
    {
      label: t("admin.sidebar.categories.userManagement"),
      icon: Users,
      items: [
        { label: t("admin.sidebar.items.allUsers"), path: "/admin/users", exact: true },
        { label: t("admin.sidebar.items.inviteRequests"), path: "/admin/users/invite-requests" },
      ],
    },
    {
      label: t("admin.sidebar.categories.taskManagement"),
      icon: Zap,
      items: [
        { label: t("admin.sidebar.items.generateAITasks"), path: "/admin/tasks/generate" },
        { label: t("admin.sidebar.items.manageAITasks"), path: "/admin/tasks/manage" },
        { label: t("admin.sidebar.items.taskAnalytics"), path: "/admin/analytics/tasks" },
        ...(isAdmin ? [{ label: "4-Option Access Control", path: "/admin/tasks/access-4opt" }] : []),
      ],
    },
    {
      label: t("admin.sidebar.categories.financialManagement"),
      icon: DollarSign,
      items: [
        { label: t("admin.sidebar.items.allTransactions"), path: "/admin/transactions" },
        { label: t("admin.sidebar.items.deposits"), path: "/admin/deposits" },
        { label: t("admin.sidebar.items.withdrawals"), path: "/admin/withdrawals" },
        { label: t("admin.sidebar.items.paymentSettings"), path: "/admin/settings/payments" },
        { label: t("admin.sidebar.items.cpayCheckouts"), path: "/admin/settings/cpay-checkouts" },
        { label: t("admin.sidebar.items.feeSavingsBanner"), path: "/admin/settings/fee-savings-banner" },
      ],
    },
    {
      label: t("admin.sidebar.categories.contentManagement"),
      icon: Settings,
      items: [
        { label: t("admin.sidebar.items.dashboardContent"), path: "/admin/content/dashboard" },
        { label: t("admin.sidebar.items.howItWorksContent"), path: "/admin/content/how-it-works" },
        { label: t("admin.sidebar.items.partnerProgramContent"), path: "/admin/content/partner-program" },
        { label: t("admin.sidebar.items.globalEmailTemplate"), path: "/admin/content/email-template" },
        { label: t("admin.sidebar.items.seoSocialSettings"), path: "/admin/settings/seo", icon: Globe },
      ],
    },
    {
      label: t("admin.sidebar.categories.membershipManagement"),
      icon: Crown,
      items: [
        { label: t("admin.sidebar.items.plansConfiguration"), path: "/admin/plans/manage" },
      ],
    },
    {
      label: t("admin.sidebar.categories.referralManagement"),
      icon: TrendingUp,
      items: [
        { label: t("admin.sidebar.items.referralSystem"), path: "/admin/referrals/manage" },
      ],
    },
      {
        label: t("admin.sidebar.categories.partnerManagement"),
        icon: Sparkles,
        items: [
          { label: t("admin.sidebar.items.partnerApplications"), path: "/admin/partners/applications" },
          { label: t("admin.sidebar.items.allPartners"), path: "/admin/partners", exact: true },
          { label: t("admin.sidebar.items.partnerAnalytics"), path: "/admin/partner-analytics" },
          { label: t("admin.sidebar.items.partnerRanks"), path: "/admin/partner-ranks" },
          { label: t("admin.sidebar.items.bonusTiers"), path: "/admin/partner-bonus-tiers" },
          { label: t("admin.sidebar.items.bonusPayouts"), path: "/admin/partner-bonus-payouts" },
          { label: t("admin.sidebar.items.bonusMonitoring"), path: "/admin/partner-bonus-monitoring" },
          { label: t("admin.sidebar.items.leaderboard"), path: "/admin/partner-leaderboard-stats" },
          { label: t("admin.sidebar.items.leaderboardSettings"), path: "/admin/partner-leaderboard" },
          { label: t("admin.sidebar.items.voucherMonitoring"), path: "/admin/partners/vouchers" },
        ],
      },
    {
      label: t("admin.sidebar.categories.communications"),
      icon: Mail,
      items: [
        { label: t("admin.sidebar.items.emailSettings"), path: "/admin/communications/email-settings" },
        { label: t("admin.sidebar.items.liveChatSettings"), path: "/admin/communications/reamaze-settings" },
        { label: t("admin.sidebar.items.loginMessage"), path: "/admin/communications/login-message" },
        { label: t("admin.sidebar.items.bulkEmail"), path: "/admin/communications/email" },
        { label: t("admin.sidebar.items.influencerInvites"), path: "/admin/communications/influencer-invites" },
        { label: t("admin.sidebar.items.userInvites"), path: "/admin/communications/user-invites" },
        { label: t("admin.sidebar.items.emailTemplates"), path: "/admin/communications/templates" },
        { label: t("admin.sidebar.items.scheduledEmails"), path: "/admin/communications/scheduled" },
        { label: t("admin.sidebar.items.dailyTasksReminder"), path: "/admin/communications/daily-tasks-reminder" },
        { label: t("admin.sidebar.items.trialReactivation"), path: "/admin/communications/trial-reactivation" },
        { label: t("admin.sidebar.items.payoutReminder"), path: "/admin/communications/payout-reminder" },
      ],
    },
    {
      label: t("admin.sidebar.categories.security"),
      icon: Shield,
      items: [
        { label: t("admin.sidebar.items.securitySettings"), path: "/admin/security-settings" },
        { label: t("admin.sidebar.items.systemSecrets"), path: "/admin/security/secrets" },
        { label: t("admin.sidebar.items.registrationControls"), path: "/admin/settings/registration-controls" },
        { label: t("admin.sidebar.items.ipstackConfiguration"), path: "/admin/settings/ipstack" },
      ],
    },
    {
      label: t("admin.sidebar.categories.monitoring"),
      icon: Activity,
      items: [
        { label: t("admin.sidebar.items.dailyResetLogs"), path: "/admin/monitoring/daily-reset-logs" },
        { label: t("admin.sidebar.items.commissionAudit"), path: "/admin/monitoring/commission-audit" },
      ],
    },
  ];

  // Persist the single expanded section (accordion) to localStorage
  useEffect(() => {
    if (expandedSection) {
      localStorage.setItem("adminExpandedSection", expandedSection);
    } else {
      localStorage.removeItem("adminExpandedSection");
    }
  }, [expandedSection]);

  // On mount: expand the section that contains the current route so the active link is visible (e.g. direct link / refresh)
  const didInitialExpandRef = useRef(false);
  useEffect(() => {
    if (didInitialExpandRef.current) return;
    didInitialExpandRef.current = true;
    const pathname = location.pathname;
    const categoryForRoute = navCategories.find((cat) =>
      cat.items.some((item) => {
        if (item.path === "/admin") return pathname === "/admin";
        if (item.exact) return pathname === item.path;
        return pathname === item.path || pathname.startsWith(item.path + "/");
      })
    );
    if (categoryForRoute) {
      setExpandedSection(categoryForRoute.label);
    }
  }, [location.pathname]);

  // Save scroll position periodically (AdminLayout handles restoration)
  useEffect(() => {
    const saveScroll = () => {
      const currentScroll = window.scrollY;
      if (currentScroll > 0) {
        scrollPositionsRef.current.set(location.pathname, currentScroll);
      }
    };
    
    // Save on scroll
    window.addEventListener('scroll', saveScroll, { passive: true });
    
    // Save on mount
    saveScroll();
    
    return () => {
      window.removeEventListener('scroll', saveScroll);
    };
  }, [location.pathname]);

  // Memoize current path to prevent unnecessary re-renders
  const currentPath = location.pathname;
  
  const isActive = useMemo(() => {
    return (path: string, exact?: boolean) => {
      if (path === "/admin") {
        return currentPath === path;
      }
      
      // If exact is true, only match the exact path
      if (exact) {
        return currentPath === path;
      }

      // Use exact match or ensure the path is followed by a slash (for nested routes)
      // This prevents "/admin/communications/email" from matching "/admin/communications/email-settings"
      const exactMatch = currentPath === path;
      // Only match if pathname starts with path + "/" (not just any character after)
      const pathWithSlash = currentPath.startsWith(path + "/");
      return exactMatch || pathWithSlash;
    };
  }, [currentPath]);

  const isCategoryActive = (category: NavCategory) => {
    return category.items.some((item) => isActive(item.path, item.exact));
  };

  const restoreSidebarScroll = useCallback((scrollTop: number, options?: { longGuard?: boolean }) => {
    const nav = navScrollRef.current;
    if (!nav || scrollTop < 0) return;
    const target = scrollTop;
    const useGuardCheck = options?.longGuard ?? false;

    const apply = (el?: HTMLElement) => {
      if (useGuardCheck && (scrollGuardRef.current === null || Date.now() >= scrollGuardUntilRef.current)) return;
      const n = el ?? navScrollRef.current;
      if (!n) return;
      const maxScroll = n.scrollHeight - n.clientHeight;
      if (maxScroll <= 0) return;
      const clampedTarget = Math.min(target, maxScroll);
      if (n.scrollTop !== clampedTarget) {
        n.scrollTop = clampedTarget;
      }
    };

    if (options?.longGuard) {
      scrollGuardRef.current = target;
      scrollGuardUntilRef.current = Date.now() + 2500;
    }

    apply(nav);
    requestAnimationFrame(() => apply());
    requestAnimationFrame(() => requestAnimationFrame(() => apply()));

    const delays = options?.longGuard
      ? [0, 10, 20, 30, 50, 80, 100, 150, 200, 300, 400, 500, 700, 900, 1200, 1500, 2000, 2500]
      : [0, 10, 20, 50, 100, 200, 400];
    delays.forEach((ms) => setTimeout(() => apply(), ms));

    if (options?.longGuard) {
      const tick = () => {
        if (Date.now() >= scrollGuardUntilRef.current || scrollGuardRef.current === null) return;
        apply();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }, []);

  const toggleCategory = (label: string) => {
    const scrollAtClick = scrollAtMouseDownRef.current;
    scrollToRestoreAfterExpandRef.current = scrollAtClick;
    const nav = navScrollRef.current;
    if (nav && scrollAtClick >= 0) {
      const maxScroll = nav.scrollHeight - nav.clientHeight;
      if (maxScroll > 0) {
        nav.scrollTop = Math.min(scrollAtClick, maxScroll);
        scrollGuardRef.current = scrollAtClick;
        scrollGuardUntilRef.current = Date.now() + 2500;
      }
    }
    setExpandedSection((prev) => (prev === label ? null : label));
  };

  const captureScroll = useCallback(() => {
    if (navScrollRef.current) {
      const top = navScrollRef.current.scrollTop;
      scrollCapturedRef.current = top;
      persistedAdminSidebarScroll = top;
    }
  }, []);

  const handleNavScroll = useCallback(() => {
    captureScroll();
    const nav = navScrollRef.current;
    if (!nav) return;
    if (scrollGuardUntilRef.current > Date.now() && scrollGuardRef.current !== null) {
      const maxScroll = nav.scrollHeight - nav.clientHeight;
      if (maxScroll <= 0) return;
      const guard = Math.min(scrollGuardRef.current, maxScroll);
      if (Math.abs(nav.scrollTop - guard) > 5) {
        nav.scrollTop = guard;
      }
    }
  }, [captureScroll]);

  const captureScrollOnMouseDown = useCallback(() => {
    scrollGuardRef.current = null;
    scrollGuardUntilRef.current = 0;
    const top = navScrollRef.current?.scrollTop ?? 0;
    scrollAtMouseDownRef.current = top;
    scrollCapturedRef.current = top;
    persistedAdminSidebarScroll = top;
  }, []);

  const clearScrollGuard = useCallback(() => {
    scrollGuardRef.current = null;
    scrollGuardUntilRef.current = 0;
  }, []);

  const handleNavigation = useCallback((path: string) => {
    const toSave = scrollAtMouseDownRef.current ?? scrollCapturedRef.current ?? navScrollRef.current?.scrollTop ?? 0;
    pendingScrollRestoreRef.current = toSave;
    persistedAdminSidebarScroll = toSave;
    try {
      sessionStorage.setItem(ADMIN_SIDEBAR_SCROLL_KEY, String(toSave));
    } catch (_) {}
    const nav = navScrollRef.current;
    if (nav && toSave >= 0) {
      const maxScroll = nav.scrollHeight - nav.clientHeight;
      if (maxScroll > 0) {
        nav.scrollTop = Math.min(toSave, maxScroll);
        scrollGuardRef.current = toSave;
        scrollGuardUntilRef.current = Date.now() + 2500;
      }
    }
    const currentScroll = window.scrollY;
    if (currentScroll > 0) {
      scrollPositionsRef.current.set(location.pathname, currentScroll);
    }
    navigate(path, { preventScrollReset: true });
    setOpen(false);
  }, [navigate, location.pathname]);

  const setNavRef = useCallback((el: HTMLElement | null) => {
    navScrollRef.current = el;
  }, []);

  // After accordion expand/collapse: restore scroll (below-the-fold clicks cause re-render; restore after DOM update)
  useEffect(() => {
    const toRestore = scrollToRestoreAfterExpandRef.current;
    if (toRestore === null) return;
    scrollToRestoreAfterExpandRef.current = null;
    const nav = navScrollRef.current;
    if (!nav) return;
    restoreSidebarScroll(toRestore, { longGuard: true });
  }, [expandedSection, restoreSidebarScroll]);

  // After pathname change (subsection click), restore sidebar scroll and guard against browser scroll
  useEffect(() => {
    const scrollToRestore = pendingScrollRestoreRef.current;
    if (scrollToRestore === null) return;
    pendingScrollRestoreRef.current = null;
    restoreSidebarScroll(scrollToRestore, { longGuard: true });
  }, [location.pathname, restoreSidebarScroll]);

  const handleExitAdminMode = useCallback(() => {
    exitAdminMode();
    navigate("/dashboard");
    setOpen(false);
  }, [exitAdminMode, navigate]);

  const handleLogoutClick = useCallback(() => {
    setLogoutDialogOpen(true);
  }, []);

  const handleLogoutConfirm = useCallback(() => {
    setLogoutDialogOpen(false);
    setOpen(false);
    onSignOut();
  }, [onSignOut]);

  const NavContent = ({ navRef, onScrollCapture, onNavMouseDown, onClearScrollGuard }: { navRef: (el: HTMLElement | null) => void; onScrollCapture: () => void; onNavMouseDown: () => void; onClearScrollGuard: () => void }) => (
    <div className="flex flex-col h-full">
      {/* Admin Header */}
      <div className="p-6 border-b border-[hsl(var(--sidebar-border))] flex-shrink-0">
        <div className="flex items-center gap-2 mb-4">
          <img src={platformLogoUrl} alt={`${platformName} Logo`} className="h-14 w-14 object-contain" />
          <span className="text-xl font-bold">{t("admin.sidebar.adminPanel")}</span>
        </div>
        
        {/* Back to Main App Button */}
        <Button
          onClick={handleExitAdminMode}
          variant="outline"
          className="w-full border-[hsl(var(--wallet-deposit))] text-[hsl(var(--wallet-deposit))] hover:bg-[hsl(var(--wallet-deposit))]/10 hover:text-[hsl(var(--wallet-deposit))]"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("admin.sidebar.backToMainApp")}
        </Button>
      </div>

      {/* Navigation Categories */}
      <nav 
        ref={navRef} 
        onScroll={onScrollCapture} 
        onMouseDown={onNavMouseDown}
        onWheel={onClearScrollGuard}
        onTouchStart={onClearScrollGuard}
        className="flex-1 p-4 space-y-1 overflow-y-auto min-h-0 scrollbar-hide"
        style={{ scrollBehavior: 'auto', overflowAnchor: 'none' }}
      >
        {navCategories.map((category) => {
          const isExpanded = expandedSection === category.label;
          const categoryActive = isCategoryActive(category);

          return (
            <Collapsible
              key={category.label}
              open={isExpanded}
            >
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  tabIndex={-1}
                  className="w-full"
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    toggleCategory(category.label);
                  }}
                >
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
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-1 ml-4 space-y-1">
                {category.items.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => handleNavigation(item.path)}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200 w-full text-left text-sm ${
                      isActive(item.path, item.exact)
                        ? "bg-primary/20 text-primary font-medium border-l-4 border-primary"
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
      <div className="p-4 border-t border-[hsl(var(--sidebar-border))] space-y-3 flex-shrink-0">
        <div className="flex items-center gap-3 px-4 py-3 bg-[hsl(var(--sidebar-accent))]/30 rounded-lg">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] flex items-center justify-center text-white font-bold flex-shrink-0">
            {profile?.username?.charAt(0).toUpperCase() || "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile?.username || "Admin"}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="default" className="text-xs px-2 py-0 bg-[hsl(var(--wallet-deposit))]">
                <Shield className="h-3 w-3 mr-1" />
                {t("admin.sidebar.admin")}
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
          {t("admin.sidebar.logout")}
        </Button>
      </div>
    </div>
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
          <img src={platformLogoUrl} alt={`${platformName} Logo`} className="h-12 w-12 object-contain" />
          <span className="font-bold">{t("admin.sidebar.adminPanel")}</span>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <div className="flex flex-col h-full bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))]">
              <NavContent navRef={setNavRef} onScrollCapture={handleNavScroll} onNavMouseDown={captureScrollOnMouseDown} onClearScrollGuard={clearScrollGuard} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Admin Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-80 bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))] flex-col z-40">
        <NavContent navRef={setNavRef} onScrollCapture={handleNavScroll} onNavMouseDown={captureScrollOnMouseDown} onClearScrollGuard={clearScrollGuard} />
      </aside>
    </>
  );
});

AdminSidebar.displayName = "AdminSidebar";
