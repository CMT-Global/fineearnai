import { useState } from "react";
import telegramIcon from "@/assets/telegram-icon.png";

export const FloatingTelegramButton = () => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <a
      href="https://t.me/fineearn"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed top-1/2 -translate-y-1/2 right-6 lg:right-8 z-50 
                 w-16 h-16 lg:w-20 lg:h-20
                 bg-gradient-to-br from-[#0088cc] to-[#0066aa]
                 hover:from-[#0099dd] hover:to-[#0077bb]
                 rounded-full 
                 shadow-[0_8px_30px_rgba(0,136,204,0.4)] 
                 hover:shadow-[0_12px_40px_rgba(0,136,204,0.6)]
                 flex items-center justify-center
                 transition-all duration-300
                 hover:scale-110 active:scale-95
                 animate-fade-in
                 border-2 border-white/20
                 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label="Join FineEarn Telegram Group"
      title="Join our Telegram community"
    >
      {/* Pulse ring effect */}
      <div className="absolute inset-0 rounded-full bg-[#0088cc] animate-ping opacity-20" />
      
      {/* Icon */}
      <img 
        src={telegramIcon} 
        alt="Telegram" 
        className="relative z-10 w-9 h-9 lg:w-12 lg:h-12 object-contain 
                   drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]
                   transition-transform duration-300 group-hover:rotate-12"
      />
      
      {/* Tooltip */}
      {isHovered && (
        <div className="absolute right-full mr-4 px-4 py-2 
                        bg-gray-900 text-white text-sm font-medium rounded-lg 
                        whitespace-nowrap animate-fade-in
                        shadow-xl">
          Join our Telegram group
          <div className="absolute top-1/2 -right-1.5 transform -translate-y-1/2 
                          w-3 h-3 bg-gray-900 rotate-45" />
        </div>
      )}
    </a>
  );
};
