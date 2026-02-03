import { useEffect } from "react";
import { X, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import telegramIcon from "@/assets/telegram-icon.png";

interface FloatingTelegramPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TelegramCommunity {
  name: string;
  url: string;
  flag: string;
  gradient: string;
}

const activeCommunities: TelegramCommunity[] = [
  {
    name: "Asia Community",
    url: "https://t.me/ProfitChipsOfficial",
    flag: "🇵🇭",
    gradient: "from-blue-500 to-red-500"
  },
  {
    name: "European Community",
    url: "https://t.me/ProfitChipsGROUP",
    flag: "🇪🇺",
    gradient: "from-blue-600 to-yellow-400"
  },
  {
    name: "Georgia Community",
    url: "https://t.me/finearngeorgia",
    flag: "🇬🇪",
    gradient: "from-red-600 to-red-900"
  },
  {
    name: "Marketing Material (Global)",
    url: "https://t.me/ProfitChips",
    flag: "📢",
    gradient: "from-purple-500 to-pink-500"
  }
];

export const FloatingTelegramPanel = ({ isOpen, onClose }: FloatingTelegramPanelProps) => {
  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const panel = document.getElementById('telegram-panel');
      const button = document.getElementById('telegram-button');
      
      if (
        panel && 
        button && 
        !panel.contains(e.target as Node) && 
        !button.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    // Small delay to prevent immediate close on open click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // ESC key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Track panel open
  useEffect(() => {
    if (isOpen) {
      console.log('Telegram panel opened:', {
        timestamp: new Date().toISOString(),
        communities_shown: activeCommunities.length
      });
    }
  }, [isOpen]);

  const handleCommunityClick = (community: TelegramCommunity) => {
    console.log('Telegram community clicked:', {
      community: community.name,
      url: community.url,
      source: 'floating_panel',
      timestamp: new Date().toISOString()
    });
    
    window.open(community.url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop for mobile */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 lg:hidden animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        id="telegram-panel"
        role="dialog"
        aria-label="Telegram Communities"
        aria-modal="true"
        className={cn(
          "fixed z-50 animate-in slide-in-from-right-4 fade-in duration-300",
          // Desktop: positioned next to button
          "lg:right-24 lg:top-1/2 lg:-translate-y-1/2",
          // Mobile: from top with max-height so header/close stay visible; safe area for notch
          "max-lg:left-4 max-lg:right-4 max-lg:top-[max(1rem,env(safe-area-inset-top))] max-lg:bottom-[max(1rem,env(safe-area-inset-bottom))] max-lg:mx-auto max-lg:max-w-sm max-lg:flex max-lg:flex-col"
        )}
      >
        <Card className="border-2 border-border shadow-2xl overflow-hidden bg-background flex flex-col max-lg:min-h-0 max-lg:flex-1">
          {/* Header - always visible on mobile (sticky) */}
          <div className="flex items-center justify-between gap-3 p-4 border-b border-border bg-gradient-to-r from-[#0088cc]/10 to-[#0066aa]/10 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <img 
                src={telegramIcon} 
                alt="" 
                className="w-6 h-6 object-contain flex-shrink-0"
              />
              <h3 className="font-bold text-base text-foreground truncate">
                Join Our Communities
              </h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-10 w-10 min-w-10 min-h-10 flex-shrink-0 touch-manipulation hover:bg-accent"
              aria-label="Close communities panel"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Communities List - scrollable on mobile */}
          <CardContent className="p-0 flex-1 min-h-0 overflow-y-auto max-lg:overflow-y-auto">
            {activeCommunities.map((community, index) => (
              <button
                key={community.name}
                onClick={() => handleCommunityClick(community)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 p-4",
                  "transition-all duration-200 hover:bg-accent",
                  "group text-left",
                  index < activeCommunities.length - 1 && "border-b border-border"
                )}
                aria-label={`Join ${community.name} on Telegram`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Flag with gradient glow on hover */}
                  <span 
                    className="text-3xl flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                    role="img"
                    aria-label={`${community.name} flag`}
                  >
                    {community.flag}
                  </span>
                  
                  {/* Community name */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate">
                      {community.name}
                    </p>
                    {/* Gradient underline on hover */}
                    <div className={cn(
                      "h-0.5 w-0 bg-gradient-to-r transition-all duration-300 group-hover:w-full mt-1",
                      community.gradient
                    )} />
                  </div>
                </div>

                {/* External link icon */}
                <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
              </button>
            ))}
          </CardContent>

          {/* Footer */}
          <div className="px-4 py-3 bg-muted/50 border-t border-border flex-shrink-0">
            <p className="text-xs text-muted-foreground text-center">
              💡 More regions coming soon
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};
