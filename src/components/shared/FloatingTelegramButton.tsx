import { useState } from "react";
import telegramIcon from "@/assets/telegram-icon.png";

export const FloatingTelegramButton = () => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <a
      href="https://t.me/fineearn"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 lg:bottom-8 lg:right-8 z-50 
                 w-14 h-14 lg:w-16 lg:h-16
                 bg-[#0088cc] hover:bg-[#0077b5]
                 rounded-full shadow-lg hover:shadow-2xl
                 flex items-center justify-center
                 transition-all duration-300
                 hover:scale-110 active:scale-95
                 animate-fade-in
                 mb-16 lg:mb-0"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label="Join FineEarn Telegram Group"
      title="Join our Telegram community"
    >
      <img 
        src={telegramIcon} 
        alt="Telegram" 
        className="w-8 h-8 lg:w-10 lg:h-10 object-contain"
      />
      
      {isHovered && (
        <div className="absolute right-full mr-3 px-3 py-2 
                        bg-gray-900 text-white text-sm rounded-lg 
                        whitespace-nowrap animate-fade-in">
          Join our Telegram group
          <div className="absolute top-1/2 -right-1 transform -translate-y-1/2 
                          w-2 h-2 bg-gray-900 rotate-45" />
        </div>
      )}
    </a>
  );
};
