import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AdminModeContextType {
  isAdminMode: boolean;
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

  // Persist admin mode state to localStorage
  useEffect(() => {
    localStorage.setItem("adminMode", String(isAdminMode));
  }, [isAdminMode]);

  const enterAdminMode = () => {
    setIsAdminMode(true);
  };

  const exitAdminMode = () => {
    setIsAdminMode(false);
  };

  return (
    <AdminModeContext.Provider value={{ isAdminMode, enterAdminMode, exitAdminMode }}>
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
