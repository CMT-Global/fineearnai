import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 1024;
const REAMAZE_SELECTORS = [
  "#reamaze-widget",
  "#reamaze-container",
  "#reamaze-widget-container",
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

function useReamazeChatOpen() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const checkOpen = (): boolean => {
      for (const sel of REAMAZE_SELECTORS) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const visible =
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          parseFloat(style.opacity) > 0 &&
          rect.width > 60 &&
          rect.height > 100;
        if (!visible) continue;
        const hasIframe = el.querySelector("iframe");
        if (hasIframe) return true;
        if (rect.height > 180) return true;
      }
      return false;
    };

    const update = () => setIsOpen(checkOpen());

    const interval = setInterval(update, 300);
    update();

    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });

    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  return isOpen;
}

function closeReamazeChat(): boolean {
  const w = window as Window & { _support?: { close?: () => void } };
  if (typeof w._support?.close === "function") {
    w._support.close();
    return true;
  }

  for (const sel of REAMAZE_SELECTORS) {
    const container = document.querySelector(sel);
    if (!container) continue;
    const closeBtn =
      container.querySelector<HTMLElement>(
        '[aria-label*="close" i], [aria-label*="dismiss" i], [class*="close" i], button[class*="close" i]'
      ) ||
      container.querySelector<HTMLElement>('button[type="button"]');
    if (closeBtn) {
      closeBtn.click();
      return true;
    }
  }

  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

  const widget = document.querySelector("#reamaze-widget") as HTMLElement | null;
  const container = document.querySelector("#reamaze-container") as HTMLElement | null;
  if (widget || container) {
    [widget, container].forEach((el) => {
      if (el) {
        el.style.setProperty("display", "none", "important");
        setTimeout(() => el.style.removeProperty("display"), 800);
      }
    });
    return true;
  }
  return false;
}

export function ReamazeMobileCloseButton() {
  const isMobile = useIsMobile();
  const chatOpen = useReamazeChatOpen();
  const [visible, setVisible] = useState(false);

  const { data: config } = useQuery({
    queryKey: ["reamaze-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_config")
        .select("value")
        .eq("key", "reamaze_config")
        .maybeSingle();
      return data?.value as { isEnabled: boolean } | null;
    },
  });

  const handleClose = useCallback(() => {
    closeReamazeChat();
    setVisible(false);
  }, []);

  useEffect(() => {
    setVisible(isMobile && !!config?.isEnabled && chatOpen);
  }, [isMobile, config?.isEnabled, chatOpen]);

  if (!visible) return null;

  return (
    <div
      role="banner"
      className={cn(
        "fixed left-0 right-0 top-0 z-[100000]",
        "flex items-center justify-between gap-3",
        "pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] pb-3",
        "bg-primary text-primary-foreground shadow-lg",
        "animate-in fade-in slide-in-from-top-2 duration-200"
      )}
    >
      <span className="text-sm font-medium pl-1">Contact chat</span>
      <button
        type="button"
        onClick={handleClose}
        aria-label="Close chat"
        className={cn(
          "flex items-center justify-center gap-2",
          "h-12 min-w-[48px] px-4 rounded-lg shrink-0",
          "bg-primary-foreground/20 text-primary-foreground",
          "hover:bg-primary-foreground/30 active:scale-95",
          "touch-manipulation"
        )}
      >
        <X className="h-5 w-5 shrink-0" />
        <span className="text-sm font-medium">Close</span>
      </button>
    </div>
  );
}
