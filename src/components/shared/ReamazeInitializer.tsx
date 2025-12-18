import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";

export const ReamazeInitializer = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  const { data: config } = useQuery({
    queryKey: ["reamaze-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("value")
        .eq("key", "reamaze_config")
        .maybeSingle();

      if (error) {
        console.error("Error fetching Reamaze config:", error);
        return null;
      }
      return data?.value as { isEnabled: boolean; embedCode: string } | null;
    },
  });

  useEffect(() => {
    // Set admin mode attribute for CSS targeting
    document.body.setAttribute("data-admin-mode", isAdminRoute.toString());
  }, [isAdminRoute]);

  useEffect(() => {
    const cleanup = () => {
      // Remove scripts we injected
      document.querySelectorAll('script[data-reamaze]').forEach(s => s.remove());
      
      // Remove loader if it exists (legacy or direct match)
      const loader = document.querySelector('script[src*="reamaze-loader.js"]');
      if (loader) loader.remove();
      
      // Reamaze creates various elements, we can try to find them by ID or class
      const widget = document.getElementById("reamaze-widget");
      if (widget) widget.remove();
      
      const frames = document.querySelectorAll(".reamaze-frame");
      frames.forEach(f => f.remove());

      // Safely reset the global _support object if it exists
      // Using assignment instead of delete to avoid "Cannot delete property of #<Window>" error
      // @ts-ignore
      if (typeof window !== 'undefined' && window._support) {
        // @ts-ignore
        window._support = undefined;
      }
    };

    if (!config?.isEnabled || !config?.embedCode) {
      cleanup();
      return;
    }

    // Function to extract script content and execute it
    const injectReamaze = () => {
      // First, clean up any existing reamaze scripts/elements
      cleanup();

      const parser = new DOMParser();
      const doc = parser.parseFromString(config.embedCode, "text/html");
      const scripts = doc.querySelectorAll("script");

      scripts.forEach((script) => {
        const newScript = document.createElement("script");
        newScript.setAttribute('data-reamaze', 'true');
        
        // Copy attributes
        Array.from(script.attributes).forEach(attr => {
          newScript.setAttribute(attr.name, attr.value);
        });

        if (script.src) {
          // It's an external script (like the loader)
          document.body.appendChild(newScript);
        } else {
          // It's inline script
          newScript.textContent = script.textContent;
          document.body.appendChild(newScript);
        }
      });
    };

    injectReamaze();

    return cleanup;
  }, [config]);

  return null;
};
