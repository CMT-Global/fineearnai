import { useNavigate, useLocation } from "react-router-dom";
import { Home, Zap, Crown, Wallet, Users } from "lucide-react";
import { memo } from "react";

interface MobileBottomNavProps {
  profile: any;
}

/**
 * MobileBottomNav - Fixed bottom navigation for mobile devices
 * 
 * Provides quick access to 5 primary actions:
 * 1. Home (Dashboard)
 * 2. Tasks
 * 3. Upgrade (Membership Plans) - Center FAB
 * 4. Wallet
 * 5. Invite (Referrals)
 * 
 * Features:
 * - Fixed bottom positioning with safe area padding
 * - Active state highlighting
 * - Smooth animations
 * - Hidden on desktop (lg:hidden)
 */
export const MobileBottomNav = memo(({ profile }: MobileBottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { 
      icon: Home, 
      label: "Home", 
      path: "/dashboard",
      ariaLabel: "Go to Dashboard"
    },
    { 
      icon: Zap, 
      label: "Tasks", 
      path: "/tasks",
      ariaLabel: "View AI Tasks"
    },
    { 
      icon: Crown, 
      label: "Upgrade", 
      path: "/plans",
      highlighted: true,
      ariaLabel: "Upgrade Membership Plan"
    },
    { 
      icon: Wallet, 
      label: "Wallet", 
      path: "/wallet",
      ariaLabel: "Manage Wallet"
    },
    { 
      icon: Users, 
      label: "Invite", 
      path: "/referrals",
      ariaLabel: "Invite Friends"
    },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <nav 
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-lg border-t border-border pb-safe"
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          
          // Center button (Upgrade) gets special styling
          if (item.highlighted) {
            return (
              <button
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                className="flex flex-col items-center justify-center flex-1 h-full relative group"
                aria-label={item.ariaLabel}
                aria-current={active ? "page" : undefined}
              >
                {/* FAB Circle */}
                <div className={`
                  w-14 h-14 rounded-full flex items-center justify-center
                  bg-gradient-to-r from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))]
                  shadow-elevated
                  transform transition-all duration-200
                  ${active ? 'scale-110' : 'group-active:scale-95'}
                `}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                
                {/* Label */}
                <span className={`
                  text-[10px] mt-1 font-medium
                  ${active ? 'text-[hsl(var(--wallet-deposit))]' : 'text-muted-foreground'}
                `}>
                  {item.label}
                </span>
              </button>
            );
          }

          // Regular navigation buttons
          return (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path)}
              className="flex flex-col items-center justify-center flex-1 h-full relative group"
              aria-label={item.ariaLabel}
              aria-current={active ? "page" : undefined}
            >
              {/* Active indicator - gradient top border */}
              {active && (
                <div 
                  className="absolute top-0 left-1/2 transform -translate-x-1/2 w-12 h-1 rounded-full bg-gradient-to-r from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))]"
                  aria-hidden="true"
                />
              )}
              
              {/* Icon container */}
              <div className={`
                transform transition-all duration-200
                ${active ? 'scale-110' : 'group-active:scale-95'}
              `}>
                <Icon 
                  className={`
                    h-6 w-6 transition-colors duration-200
                    ${active 
                      ? 'text-[hsl(var(--wallet-deposit))]' 
                      : 'text-muted-foreground group-hover:text-foreground'
                    }
                  `} 
                />
              </div>
              
              {/* Label */}
              <span className={`
                text-[10px] mt-1 transition-all duration-200
                ${active 
                  ? 'text-[hsl(var(--wallet-deposit))] font-semibold' 
                  : 'text-muted-foreground font-medium'
                }
              `}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
});

MobileBottomNav.displayName = "MobileBottomNav";
