import { useState } from "react";
import telegramIcon from "@/assets/telegram-icon.png";
import { FloatingTelegramPanel } from "./FloatingTelegramPanel";
import { cn } from "@/lib/utils";

export const FloatingTelegramButton = () => {
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const togglePanel = () => {
    setIsPanelOpen(!isPanelOpen);
    console.log('Telegram button clicked:', {
      action: !isPanelOpen ? 'open' : 'close',
      timestamp: new Date().toISOString()
    });
  };

  const closePanel = () => {
    setIsPanelOpen(false);
  };
  
  return (
    <>
      <button
        id="telegram-button"
        onClick={togglePanel}
        className={cn(
          "fixed bottom-36 lg:bottom-20 -translate-y-1/2 right-4 lg:right-5 z-50",
          "w-8 h-8 lg:w-14 lg:h-14",
          "bg-gradient-to-br from-[#0088cc] to-[#0066aa]",
          "hover:from-[#0099dd] hover:to-[#0077bb]",
          "rounded-full",
          "shadow-[0_8px_30px_rgba(0,136,204,0.4)]",
          "hover:shadow-[0_12px_40px_rgba(0,136,204,0.6)]",
          "flex items-center justify-center",
          "transition-all duration-300",
          "hover:scale-110 active:scale-95",
          "animate-fade-in",
          "border-2 border-white/20",
          "group",
          isPanelOpen && "scale-105 shadow-[0_12px_40px_rgba(0,136,204,0.7)]"
        )}
        aria-label="Open Telegram Communities"
        aria-expanded={isPanelOpen}
        aria-controls="telegram-panel"
        title="Join our Telegram communities"
      >
        {/* Pulse ring effect */}
        <div className="absolute inset-0 rounded-full bg-[#0088cc] animate-ping opacity-20" />
        
        {/* Icon */}
        <img 
          src={telegramIcon} 
          alt="Telegram" 
          className={cn(
            "relative z-10 w-6 h-6 lg:w-8 lg:h-8 object-contain",
            "drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]",
            "transition-transform duration-300 group-hover:rotate-12",
            isPanelOpen && "rotate-12"
          )}
        />
      </button>

      {/* Floating Panel */}
      <FloatingTelegramPanel isOpen={isPanelOpen} onClose={closePanel} />
    </>
  );
};
