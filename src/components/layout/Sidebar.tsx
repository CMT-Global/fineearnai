import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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
  Menu
} from "lucide-react";
import { useState } from "react";

interface SidebarProps {
  profile: any;
  isAdmin?: boolean;
  onSignOut: () => void;
}

export const Sidebar = ({ profile, isAdmin, onSignOut }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const navItems = [
    { icon: Home, label: "Dashboard", path: "/dashboard" },
    { icon: Zap, label: "Tasks", path: "/tasks" },
    { icon: Users, label: "Referrals", path: "/referrals" },
    { icon: Crown, label: "Membership", path: "/plans" },
    { icon: History, label: "Transactions", path: "/transactions" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];

  const isActive = (path: string) => location.pathname === path;
  const isAdminRoute = location.pathname.startsWith('/admin');

  const handleNavigation = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const NavContent = () => (
    <>
      <div className="p-6 border-b border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-[hsl(var(--wallet-deposit))]" />
          <span className="text-xl font-bold">FineEarn</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => handleNavigation(item.path)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 w-full text-left ${
              isActive(item.path)
                ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-fg))] border-l-4 border-[hsl(var(--wallet-deposit))]"
                : "hover:bg-[hsl(var(--sidebar-accent))]/50"
            }`}
          >
            <item.icon className={`h-5 w-5 ${isActive(item.path) ? 'text-[hsl(var(--wallet-deposit))]' : ''}`} />
            <span>{item.label}</span>
          </button>
        ))}
        
        {isAdmin && (
          <button
            onClick={() => handleNavigation("/admin")}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 w-full text-left ${
              isAdminRoute
                ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-fg))] border-l-4 border-[hsl(var(--wallet-deposit))]"
                : "hover:bg-[hsl(var(--sidebar-accent))]/50 bg-[hsl(var(--wallet-deposit))]/10"
            }`}
          >
            <Settings className="h-5 w-5 text-[hsl(var(--wallet-deposit))]" />
            <span className="text-[hsl(var(--wallet-deposit))]">Admin Panel</span>
          </button>
        )}
      </nav>

      <div className="p-4 border-t border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] flex items-center justify-center text-white text-sm font-bold">
            {profile?.username?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile?.username || "User"}</p>
            <p className="text-xs text-[hsl(var(--sidebar-fg))]/60 capitalize">
              {profile?.membership_plan || "free"} Plan
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-xs text-[hsl(var(--sidebar-fg))]/60 hover:text-[hsl(var(--sidebar-fg))]"
          onClick={() => {
            onSignOut();
            setOpen(false);
          }}
        >
          <LogOut className="h-3 w-3 mr-2" />
          Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Sidebar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[hsl(var(--wallet-deposit))]" />
          <span className="font-bold">FineEarn</span>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="flex flex-col h-full bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))]">
              <NavContent />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))] flex-col">
        <NavContent />
      </aside>
    </>
  );
};
