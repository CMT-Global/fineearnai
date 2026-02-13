import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  Zap,
  Wallet,
  Users,
  Crown,
  Settings,
  Sparkles,
  LogOut,
  History,
  Menu,
  Shield,
  ArrowRight,
  HelpCircle
} from "lucide-react";
import { useState, useMemo, memo, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminMode } from "@/contexts/AdminModeContext";
import { LogoutConfirmDialog } from "@/components/shared/LogoutConfirmDialog";
import { supabase, supabaseService } from "@/integrations/supabase";
import { useIsPartner } from "@/hooks/usePartner";
import { useBranding } from "@/contexts/BrandingContext";
import { CurrencySelector } from "@/components/layout/CurrencySelector";
import { MobileCurrencyBadge } from "@/components/layout/MobileCurrencyBadge";
import { UserHeaderCard } from "@/components/layout/UserHeaderCard";
import { MobileUserBadge } from "@/components/layout/MobileUserBadge";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Persists across Sidebar remounts when navigating between pages (Dashboard → Settings etc.) */
const SIDEBAR_SCROLL_KEY = "sidebar-nav-scroll-top";
let persistedSidebarScroll = 0;

interface SidebarProps {
  profile: any;
  isAdmin?: boolean;
  onSignOut: () => void;
}

export const Sidebar = memo(({ profile, isAdmin, onSignOut }: SidebarProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { enterAdminMode } = useAdminMode();
  const [open, setOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const { data: isPartner } = useIsPartner();
  const { platformName, platformLogoUrl } = useBranding();

  // Load feature-flag style platform config for sidebar-controlled sections
  const { data: sidebarConfig } = useQuery({
    queryKey: ["sidebar-platform-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("key, value")
        .in("key", ["how_it_works_content", "partner_program_config"]);

      if (error) throw error;

      const map = new Map<string, any>();
      data?.forEach((row: any) => {
        map.set(row.key, row.value);
      });

      return {
        howItWorks: map.get("how_it_works_content") || {},
        partnerProgram: map.get("partner_program_config") || {},
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const isHowItWorksVisible = sidebarConfig?.howItWorks?.isVisible ?? true;
  const isPartnerProgramEnabled = sidebarConfig?.partnerProgram?.isEnabled ?? true;

  // Primary navigation items (shown in bottom nav on mobile + sidebar) - memoized
  const basePrimaryNavItems = useMemo(() => [
    { icon: Home, label: t("navigation.dashboard"), path: "/dashboard" },
    { icon: Zap, label: t("navigation.tasks"), path: "/tasks" },
    { icon: Wallet, label: t("navigation.wallet"), path: "/wallet" },
    { icon: Users, label: t("navigation.referrals"), path: "/referrals", tooltip: t("navigation.myTeamTooltip") },
  ], [t]);

  // Partner navigation - changes based on partner status and global partner program toggle - memoized
  const partnerNavItem = useMemo(() => isPartner
    ? { icon: Sparkles, label: t("components.sidebar.partnerHub"), path: "/partner/dashboard", isPartner: true }
    : { icon: Sparkles, label: t("components.sidebar.becomePartner"), path: "/become-partner", isPartner: false },
  [isPartner, t]);

  const primaryNavItems = useMemo(() => [
    ...basePrimaryNavItems,
    ...(isPartnerProgramEnabled ? [partnerNavItem] : []),
    { icon: Crown, label: t("navigation.plans"), path: "/plans" },
  ], [basePrimaryNavItems, isPartnerProgramEnabled, partnerNavItem, t]);

  // Secondary navigation items (shown only in hamburger menu on mobile + sidebar) - memoized
  const secondaryNavItems = useMemo(() => [
    isHowItWorksVisible
      ? { icon: HelpCircle, label: t("components.sidebar.howItWorks"), path: "/how-it-works", highlight: true }
      : null,
    { icon: History, label: t("navigation.transactions"), path: "/transactions" },
    { icon: Settings, label: t("navigation.settings"), path: "/settings" },
  ].filter(Boolean) as { icon: any; label: string; path: string; highlight?: boolean }[], [isHowItWorksVisible, t]);

  // Combined nav items for desktop sidebar - memoized to prevent recreation on every render
  const navItems: any[] = useMemo(() => [...primaryNavItems, ...secondaryNavItems], [primaryNavItems, secondaryNavItems]);

  // Memoize active path check to prevent unnecessary re-renders
  const currentPath = location.pathname;
  const isActive = useMemo(() => {
    return (path: string) => currentPath === path;
  }, [currentPath]);
  
  const isAdminRoute = useMemo(() => currentPath.startsWith('/admin'), [currentPath]);

  const navScrollRef = useRef<HTMLElement | null>(null);
  const scrollCapturedRef = useRef(0);

  const captureScroll = useCallback(() => {
    if (navScrollRef.current) {
      const top = navScrollRef.current.scrollTop;
      scrollCapturedRef.current = top;
      persistedSidebarScroll = top;
    }
  }, []);

  const handleNavigation = useCallback((path: string) => {
    const toSave = scrollCapturedRef.current || navScrollRef.current?.scrollTop || 0;
    persistedSidebarScroll = toSave;
    try {
      sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(toSave));
    } catch (_) {}
    navigate(path);
    setOpen(false);
  }, [navigate]);

  const setNavRef = useCallback((el: HTMLElement | null) => {
    navScrollRef.current = el;
    if (!el) return;
    const fromStorage = sessionStorage.getItem(SIDEBAR_SCROLL_KEY);
    const scroll = fromStorage !== null ? Number(fromStorage) : persistedSidebarScroll;
    if (scroll <= 0) return;
    const apply = () => {
      el.scrollTop = scroll;
    };
    apply();
    requestAnimationFrame(apply);
    setTimeout(apply, 0);
    setTimeout(apply, 50);
    setTimeout(apply, 150);
    setTimeout(apply, 300);
    setTimeout(apply, 500);
    // Do NOT clear here: Settings (and others) show SidebarSkeleton until profile
    // loads, so the real Sidebar mounts late. We only overwrite on next navigation.
  }, []);

  const handleSwitchToAdmin = useCallback(() => {
    enterAdminMode();
    navigate("/admin");
    setOpen(false);
  }, [enterAdminMode, navigate]);

  const handleLogoutClick = useCallback(() => {
    setLogoutDialogOpen(true);
  }, []);

  const handleLogoutConfirm = useCallback(() => {
    setLogoutDialogOpen(false);
    setOpen(false);
    onSignOut();
  }, [onSignOut]);

  // ✅ Phase 4: Prefetch data on hover for instant page loads
  const handlePrefetch = (path: string) => {
    const userId = profile?.id;
    if (!userId) return;

    console.log('🚀 Prefetching data for:', path);

    switch (path) {
      case '/dashboard':
        // Prefetch dashboard data (profile + referral stats + membership plan)
        queryClient.prefetchQuery({
          queryKey: ['dashboard-data-v2', userId],
          queryFn: async () => {
            const [profile, stats] = await Promise.all([
              supabaseService.profiles.get(userId),
              supabaseService.rpc.getReferralStats(userId)
            ]);
            
            const plan = profile.membership_plan
              ? await supabaseService.membershipPlans.getByName(profile.membership_plan)
              : null;
            
            // Add earner badge status
            const accountType = plan?.account_type;
            const { getEarnerBadgeStatus } = await import('@/lib/earner-badge-utils');
            const earnerBadge = getEarnerBadgeStatus(accountType);
            
            return {
              profile: { ...profile, earnerBadge },
              referralStats: stats,
              membershipPlan: plan
            };
          },
          staleTime: 30000,
        });
        break;

      case '/referrals':
        // Prefetch referral data (stats + upline + earnings + referrals list)
        queryClient.prefetchQuery({
          queryKey: ['referral-complete-data-v2', userId],
          queryFn: async () => {
            const { supabaseService } = await import('@/integrations/supabase');
            
            const [profile, stats, earnings, referrals] = await Promise.all([
              supabaseService.profiles.get(userId),
              supabaseService.rpc.getReferralStats(userId),
              supabaseService.referralEarnings.getByReferrer(userId, 20),
              supabaseService.referrals.getByReferrer(userId)
            ]);
            
            return { 
              profile,
              stats,
              earnings,
              referrals: referrals.slice(0, 20) // Limit to 20 for prefetch
            };
          },
          staleTime: 30000,
        });
        break;

      case '/wallet':
      case '/transactions':
        // Prefetch transactions (first page)
        queryClient.prefetchQuery({
          queryKey: ['transactions', userId, 1],
          queryFn: async () => {
            const PAGE_SIZE = 50;
            const { data, error, count } = await supabase
              .from('transactions')
              .select('*', { count: 'exact' })
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .range(0, PAGE_SIZE - 1);
            
            if (error) throw error;
            
            return {
              transactions: data,
              totalCount: count || 0,
              hasMore: (count || 0) > PAGE_SIZE
            };
          },
          staleTime: 10000,
        });
        break;

      case '/plans':
        // Prefetch membership plans
        queryClient.prefetchQuery({
          queryKey: ['membership-plans'],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('membership_plans')
              .select('*')
              .order('price', { ascending: true });
            
            if (error) throw error;
            return data;
          },
          staleTime: 300000, // 5 minutes (plans don't change often)
        });
        break;
    }
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-[hsl(var(--sidebar-border))] flex-shrink-0">
        <div className="flex items-center gap-2">
          <img src={platformLogoUrl} alt={`${platformName} Logo`} className="h-14 w-14 object-contain" />
          <span className="text-xl font-bold">{platformName}</span>
        </div>
      </div>

      {/* User Header Card - Top Position */}
      <UserHeaderCard profile={profile} />

      {/* Currency Selector - Top Position */}
      <CurrencySelector />

      <nav
        ref={setNavRef}
        className="flex-1 p-4 space-y-1 overflow-y-auto min-h-0"
        onPointerDownCapture={captureScroll}
        onMouseDownCapture={captureScroll}
      >
        {navItems.map((item: any) => {
          const navButton = (
            <button
              onClick={() => handleNavigation(item.path)}
              onMouseEnter={() => handlePrefetch(item.path)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 w-full text-left ${
                isActive(item.path)
                  ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-fg))] border-l-4 border-[hsl(var(--wallet-deposit))]"
                  : item.highlight
                  ? "bg-green-500/10 hover:bg-green-500/20"
                  : "hover:bg-[hsl(var(--sidebar-accent))]/50"
              } ${item.isPartner ? 'bg-gradient-to-r from-[hsl(var(--wallet-deposit))]/10 to-transparent border border-[hsl(var(--wallet-deposit))]/20' : ''}`}
            >
              <item.icon className={`h-5 w-5 ${isActive(item.path) || item.isPartner ? 'text-[hsl(var(--wallet-deposit))]' : item.highlight ? 'text-green-600' : ''}`} />
              <span className={`${item.isPartner ? 'font-semibold' : ''} ${item.highlight ? 'text-green-600 font-semibold' : ''}`}>{item.label}</span>
              {item.isPartner && (
                <Badge className="ml-auto bg-[hsl(var(--wallet-deposit))] text-white">Pro</Badge>
              )}
            </button>
          );
          return item.tooltip ? (
            <Tooltip key={item.path}>
              <TooltipTrigger asChild>{navButton}</TooltipTrigger>
              <TooltipContent side="right" className="max-w-[200px]">
                {item.tooltip}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span key={item.path}>{navButton}</span>
          );
        })}
      </nav>

      {/* Switch to Admin Button - Highly Visible */}
      {isAdmin && (
        <div className="px-4 pb-4">
          <Button
            onClick={handleSwitchToAdmin}
            className="w-full bg-gradient-to-r from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] text-white hover:opacity-90 transition-opacity font-bold py-6"
          >
            <Shield className="h-5 w-5 mr-2" />
            Switch to Admin Panel
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      )}

      {/* Logout Section - Bottom */}
      <div className="p-4 border-t border-[hsl(var(--sidebar-border))] space-y-3 flex-shrink-0">
        <Button
          onClick={handleLogoutClick}
          variant="destructive"
          size="lg"
          className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
        >
          <LogOut className="h-5 w-5 mr-2" />
          {t("navigation.logout")}
        </Button>
      </div>
    </div>
  );

  // Mobile hamburger menu content - only secondary items
  const MobileMenuContent = () => (
    <>
      <div className="p-6 border-b border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-[hsl(var(--wallet-deposit))]" />
          <span className="text-xl font-bold">ProfitChips</span>
        </div>
      </div>

      {/* User Header Card */}
      <UserHeaderCard profile={profile} />

      {/* Currency Selector */}
      <CurrencySelector />

      {/* Only secondary navigation items + Partner navigation (always visible) in mobile menu */}
      <nav className="flex-1 p-4 space-y-1">
        {/* Partner Navigation - Respects global enable/disable toggle */}
        {isPartnerProgramEnabled && (
          isPartner ? (
            <button
              onClick={() => handleNavigation("/partner/dashboard")}
              onMouseEnter={() => handlePrefetch("/partner/dashboard")}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 w-full text-left bg-gradient-to-r from-[hsl(var(--wallet-deposit))]/10 to-transparent border border-[hsl(var(--wallet-deposit))]/20 ${
                isActive("/partner/dashboard")
                  ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-fg))] border-l-4 border-[hsl(var(--wallet-deposit))]"
                  : "hover:bg-[hsl(var(--sidebar-accent))]/50"
              }`}
            >
              <Sparkles className={`h-5 w-5 text-[hsl(var(--wallet-deposit))]`} />
              <span className="font-semibold">{t("components.sidebar.partnerHub")}</span>
              <Badge className="ml-auto bg-[hsl(var(--wallet-deposit))] text-white">Pro</Badge>
            </button>
          ) : (
            <button
              onClick={() => handleNavigation("/become-partner")}
              onMouseEnter={() => handlePrefetch("/become-partner")}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 w-full text-left ${
                isActive("/become-partner")
                  ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-fg))] border-l-4 border-[hsl(var(--wallet-deposit))]"
                  : "hover:bg-[hsl(var(--sidebar-accent))]/50"
              }`}
            >
              <Sparkles className={`h-5 w-5 ${isActive("/become-partner") ? 'text-[hsl(var(--wallet-deposit))]' : ''}`} />
              <span>{t("components.sidebar.becomePartner")}</span>
            </button>
          )
        )}
        {secondaryNavItems.map((item) => (
          <button
            key={item.path}
            onClick={() => handleNavigation(item.path)}
            onMouseEnter={() => handlePrefetch(item.path)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 w-full text-left ${
              isActive(item.path)
                ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-fg))] border-l-4 border-[hsl(var(--wallet-deposit))]"
                : item.highlight
                ? "bg-green-500/10 hover:bg-green-500/20"
                : "hover:bg-[hsl(var(--sidebar-accent))]/50"
            }`}
          >
            <item.icon className={`h-5 w-5 ${isActive(item.path) ? 'text-[hsl(var(--wallet-deposit))]' : item.highlight ? 'text-green-600' : ''}`} />
            <span className={item.highlight ? 'text-green-600 font-semibold' : ''}>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Switch to Admin Button - Highly Visible */}
      {isAdmin && (
        <div className="px-4 pb-4">
          <Button
            onClick={handleSwitchToAdmin}
            className="w-full bg-gradient-to-r from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] text-white hover:opacity-90 transition-opacity font-bold py-6"
          >
            <Shield className="h-5 w-5 mr-2" />
            Switch to Admin Panel
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      )}

      {/* Logout Section - Bottom */}
      <div className="p-4 border-t border-[hsl(var(--sidebar-border))]">
        <Button
          onClick={handleLogoutClick}
          variant="destructive"
          size="lg"
          className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
        >
          <LogOut className="h-5 w-5 mr-2" />
          {t("navigation.logout")}
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
      {/* Mobile Sidebar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={platformLogoUrl} alt={`${platformName} Logo`} className="h-12 w-12 object-contain" />
          <span className="font-bold">{platformName}</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Mobile User Badge */}
          <MobileUserBadge profile={profile} />
          
          {/* Mobile Currency Badge */}
          <MobileCurrencyBadge />
          
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0">
              <div className="flex flex-col h-full bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))]">
                <MobileMenuContent />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-80 bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))] flex-col z-40">
        <NavContent />
      </aside>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav profile={profile} />
    </>
  );
});

Sidebar.displayName = "Sidebar";
