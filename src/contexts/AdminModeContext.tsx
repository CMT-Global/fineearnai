import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AdminModeContextType {
  isAdminMode: boolean;
  isTransitioning: boolean;
  enterAdminMode: () => void;
  exitAdminMode: () => void;
}

const AdminModeContext = createContext<AdminModeContextType | undefined>(undefined);

export const AdminModeProvider = ({ children }: { children: ReactNode }) => {
  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => {
    // Restore admin mode preference from localStorage
    const stored = localStorage.getItem("adminMode");
    return stored === "true";
  });
  
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Persist admin mode state to localStorage
  useEffect(() => {
    localStorage.setItem("adminMode", String(isAdminMode));
  }, [isAdminMode]);

  const enterAdminMode = () => {
    // Enter immediately - no blocking transition. Avoids extra loading screen
    // when navigating user→admin (AdminRoute already handles its own loading).
    setIsAdminMode(true);
    setIsTransitioning(false);
  };

  const exitAdminMode = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setIsAdminMode(false);
      setTimeout(() => setIsTransitioning(false), 300);
    }, 150);
  };

  return (
    <AdminModeContext.Provider value={{ isAdminMode, isTransitioning, enterAdminMode, exitAdminMode }}>
      {children}
    </AdminModeContext.Provider>
  );
};

export const useAdminMode = () => {
  const context = useContext(AdminModeContext);
  if (context === undefined) {
    throw new Error("useAdminMode must be used within AdminModeProvider");
  }
  return context;
};
