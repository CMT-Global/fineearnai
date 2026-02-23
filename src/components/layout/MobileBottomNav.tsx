import { useNavigate, useLocation } from "react-router-dom";
import { Home, Zap, Crown, Wallet, Users } from "lucide-react";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";

interface MobileBottomNavProps {
  profile: any;
}

/**
 * MobileBottomNav - Fixed bottom navigation for mobile devices (Phase 3: Polished)
 *
 * Provides quick access to 5 primary actions:
 * 1. Home (Dashboard)
 * 2. Tasks
 * 3. Upgrade (Membership Plans) - Elevated Center FAB
 * 4. Wallet
 * 5. My Team (Referrals)
 *
 * Features:
 * - Fixed bottom positioning with iOS safe area support
 * - Active state highlighting with gradient indicators
 * - Smooth animations & micro-interactions
 * - Elevated shadow for depth
 * - Tap feedback animations
 * - Hidden on desktop (lg:hidden)
 */
export const MobileBottomNav = memo(({ profile }: MobileBottomNavProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [pressedButton, setPressedButton] = useState<string | null>(null);

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
      label: t("navigation.referrals"), 
      path: "/referrals",
      ariaLabel: t("navigation.myTeamTooltip")
    },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleNavigation = (path: string) => {
    // Haptic-like feedback with visual animation
    setPressedButton(path);
    setTimeout(() => setPressedButton(null), 150);
    navigate(path);
  };

  return (
    <nav 
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-lg border-t border-border shadow-[0_-4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.3)]"
      style={{ 
        paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)'
      }}
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around min-w-0 h-16 px-1 sm:px-2 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const isPressed = pressedButton === item.path;
          const Icon = item.icon;
          
          // Center button (Upgrade) gets special elevated FAB styling
          if (item.highlighted) {
            return (
              <button
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                onTouchStart={() => setPressedButton(item.path)}
                onTouchEnd={() => setTimeout(() => setPressedButton(null), 150)}
                className="flex flex-col items-center justify-center flex-1 min-w-[52px] sm:min-w-0 h-full relative group touch-manipulation flex-shrink-0"
                aria-label={item.ariaLabel}
                aria-current={active ? "page" : undefined}
              >
                {/* Glow effect behind FAB when active */}
                {active && (
                  <div 
                    className="absolute -top-2 w-16 h-16 rounded-full bg-gradient-to-r from-[hsl(var(--wallet-deposit))]/20 to-[hsl(var(--wallet-tasks))]/20 blur-xl animate-pulse"
                    aria-hidden="true"
                  />
                )}
                
                {/* FAB Circle with enhanced gradient & shadow */}
                <div className={`
                  relative w-14 h-14 rounded-full flex items-center justify-center
                  bg-gradient-to-br from-[hsl(var(--wallet-deposit))] via-[hsl(var(--wallet-tasks))] to-[hsl(var(--wallet-deposit))]
                  shadow-[0_8px_16px_rgba(138,43,226,0.3),0_4px_8px_rgba(138,43,226,0.2)]
                  transform transition-all duration-200 ease-out
                  ${active ? 'scale-110 shadow-[0_12px_24px_rgba(138,43,226,0.4)]' : ''}
                  ${isPressed ? 'scale-95' : 'group-active:scale-95'}
                  before:absolute before:inset-0 before:rounded-full before:bg-white/20 before:opacity-0 before:transition-opacity hover:before:opacity-100
                `}>
                  {/* Icon with subtle animation */}
                  <Icon className={`
                    h-6 w-6 text-white relative z-10
                    transition-transform duration-200
                    ${active ? 'animate-pulse' : ''}
                  `} />
                  
                  {/* Shine effect */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/30 to-transparent opacity-50" aria-hidden="true" />
                </div>
                
                {/* Label with gradient text when active */}
                <span className={`
                  text-[10px] mt-1 font-medium transition-all duration-200
                  ${active 
                    ? 'font-semibold bg-gradient-to-r from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] bg-clip-text text-transparent' 
                    : 'text-muted-foreground'
                  }
                `}>
                  {item.label}
                </span>
              </button>
            );
          }

          // Regular navigation buttons with enhanced animations
          return (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path)}
              onTouchStart={() => setPressedButton(item.path)}
              onTouchEnd={() => setTimeout(() => setPressedButton(null), 150)}
              className="flex flex-col items-center justify-center flex-1 min-w-[52px] sm:min-w-0 h-full relative group touch-manipulation flex-shrink-0"
              aria-label={item.ariaLabel}
              aria-current={active ? "page" : undefined}
            >
              {/* Active indicator - enhanced gradient top border with glow */}
              {active && (
                <>
                  <div 
                    className="absolute top-0 left-1/2 transform -translate-x-1/2 w-12 h-1 rounded-full bg-gradient-to-r from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] animate-fade-in"
                    aria-hidden="true"
                  />
                  {/* Glow effect */}
                  <div 
                    className="absolute top-0 left-1/2 transform -translate-x-1/2 w-16 h-2 rounded-full bg-gradient-to-r from-[hsl(var(--wallet-deposit))]/30 to-[hsl(var(--wallet-tasks))]/30 blur-sm"
                    aria-hidden="true"
                  />
                </>
              )}
              
              {/* Icon container with tap feedback */}
              <div className={`
                transform transition-all duration-200 ease-out
                ${active ? 'scale-110 -translate-y-0.5' : ''}
                ${isPressed ? 'scale-90' : 'group-active:scale-90'}
              `}>
                {/* Background circle on active */}
                {active && (
                  <div 
                    className="absolute inset-0 -m-2 w-10 h-10 rounded-full bg-[hsl(var(--wallet-deposit))]/10 animate-pulse"
                    aria-hidden="true"
                  />
                )}
                
                <Icon 
                  className={`
                    h-6 w-6 transition-all duration-200 relative z-10
                    ${active 
                      ? 'text-[hsl(var(--wallet-deposit))] drop-shadow-[0_2px_4px_rgba(138,43,226,0.3)]' 
                      : 'text-muted-foreground group-hover:text-foreground'
                    }
                  `} 
                />
              </div>
              
              {/* Label with smooth transitions */}
              <span className={`
                text-[10px] mt-1 transition-all duration-200
                ${active 
                  ? 'text-[hsl(var(--wallet-deposit))] font-semibold tracking-wide' 
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
