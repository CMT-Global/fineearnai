import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles } from "lucide-react";

interface LoginMessageConfig {
  enabled: boolean;
  title: string;
  body: string;
  show_once_per_session: boolean;
  dismissible: boolean;
  priority: "low" | "medium" | "high";
}

interface LoginMessageDialogProps {
  userId: string;
  onOpenChange?: (open: boolean) => void;
  trigger?: boolean;
}

export const LoginMessageDialog = ({ 
  userId, 
  onOpenChange,
  trigger = false 
}: LoginMessageDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);
  const [lastTriggerValue, setLastTriggerValue] = useState(trigger);

  // Fetch login message config from platform_config
  const { data: config, isLoading } = useQuery({
    queryKey: ["login-message-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("value")
        .eq("key", "login_message")
        .maybeSingle();

      if (error) throw error;
      return data?.value as unknown as LoginMessageConfig | null;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Get storage key for this user
  const getSessionStorageKey = () => `loginMessageShown_session_${userId}`;

  // Check if message has been shown this session
  const hasShownThisSession = () => {
    // If show_once_per_session is false, ALWAYS allow showing (never block)
    if (!config?.show_once_per_session) {
      return false;
    }
    
    // If show_once_per_session is true, check sessionStorage
    const storageKey = getSessionStorageKey();
    const shownInSession = sessionStorage.getItem(storageKey);
    
    // Return true if already shown in this browser session
    return shownInSession === 'true';
  };

  // Mark message as shown in sessionStorage (only if show_once_per_session is enabled)
  const markAsShown = () => {
    if (config?.show_once_per_session) {
      const storageKey = getSessionStorageKey();
      sessionStorage.setItem(storageKey, 'true');
    }
  };

  // Clear the shown flag (for when show_once_per_session is false or dialog dismissed)
  const clearShownFlag = () => {
    const storageKey = getSessionStorageKey();
    sessionStorage.removeItem(storageKey);
  };

  // Reset hasCheckedStorage when trigger changes from false to true (new login)
  useEffect(() => {
    if (trigger !== lastTriggerValue) {
      setLastTriggerValue(trigger);
      
      // If trigger changed from false to true, reset the check flag
      if (trigger && !lastTriggerValue) {
        setHasCheckedStorage(false);
      }
    }
  }, [trigger, lastTriggerValue]);

  // Handle dialog open state
  useEffect(() => {
    if (isLoading || !config || !userId) return;
    
    // Only check once per trigger cycle
    if (hasCheckedStorage) return;

    // Check all conditions to show dialog
    const shouldShow = 
      config.enabled && 
      !hasShownThisSession() &&
      trigger;

    if (shouldShow) {
      // Small delay for smooth transition after auth
      setTimeout(() => {
        setIsOpen(true);
        // Only mark as shown if show_once_per_session is enabled
        if (config.show_once_per_session) {
          markAsShown();
        }
      }, 500);
    }

    setHasCheckedStorage(true);
  }, [config, isLoading, userId, trigger, hasCheckedStorage]);

  // Handle dialog close
  const handleOpenChange = (open: boolean) => {
    // Only allow closing if dismissible
    if (!open && !config?.dismissible) {
      return;
    }
    
    // If closing and show_once_per_session is false, clear the flag so it can show again
    if (!open && !config?.show_once_per_session) {
      clearShownFlag();
    }
    
    setIsOpen(open);
    onOpenChange?.(open);
  };

  // Don't render if loading or config not available
  if (isLoading || !config || !config.enabled) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="
          w-[95vw] max-w-[420px] 
          sm:w-[85vw] sm:max-w-[500px] 
          md:w-[600px]
          p-0
          gap-0
          overflow-hidden
        "
        aria-describedby="login-message-description"
      >
        {/* Header with gradient background */}
        <div className="
          bg-gradient-to-r from-primary/10 via-primary/5 to-background
          border-b border-border/50
          p-4 sm:p-6
        ">
          <DialogHeader>
            <DialogTitle className="
              flex items-center gap-2 
              text-xl sm:text-2xl 
              font-bold
              text-foreground
              pr-8
            ">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-primary animate-pulse flex-shrink-0" />
              <span className="truncate">{config.title}</span>
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Scrollable body content */}
        <ScrollArea className="max-h-[60vh] sm:max-h-[70vh]">
          <DialogDescription 
            id="login-message-description"
            className="p-4 sm:p-6"
          >
            <div 
              className="
                prose prose-sm sm:prose-base
                dark:prose-invert
                max-w-none
                text-foreground
                [&>p]:text-foreground
                [&>p]:leading-relaxed
                [&>h1]:text-foreground
                [&>h2]:text-foreground
                [&>h3]:text-foreground
                [&>strong]:text-foreground
                [&>em]:text-muted-foreground
                [&>ul]:text-foreground
                [&>ol]:text-foreground
                [&>a]:text-primary [&>a]:underline
                [&>a:hover]:text-primary/80
                touch-manipulation
              "
              dangerouslySetInnerHTML={{ __html: config.body }}
            />
          </DialogDescription>
        </ScrollArea>

        {/* Footer with action button */}
        {config.dismissible && (
          <div className="
            border-t border-border/50
            p-4 sm:p-6
            bg-muted/30
          ">
            <Button 
              onClick={() => handleOpenChange(false)}
              className="w-full h-12 sm:h-11 text-base touch-manipulation"
              size="lg"
            >
              Got it, thanks! 🎉
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
