import { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarSkeleton } from "@/components/layout/SidebarSkeleton";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

interface PageLayoutProps {
  children: ReactNode;
  profile: any | null | undefined;
  isAdmin?: boolean;
  onSignOut: () => void;
  isLoading?: boolean;
  loadingText?: string;
}

/**
 * PageLayout - Consistent layout wrapper that keeps sidebar visible
 * 
 * Key benefit: Sidebar renders immediately, only content area shows loading
 * This prevents the jarring experience of the sidebar disappearing during page loads
 */
export const PageLayout = ({ 
  children, 
  profile, 
  isAdmin, 
  onSignOut,
  isLoading = false,
  loadingText = "Loading..."
}: PageLayoutProps) => {
  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Conditional Sidebar - Shows skeleton when profile is not loaded */}
      {profile ? (
        <Sidebar profile={profile} isAdmin={isAdmin} onSignOut={onSignOut} />
      ) : (
        <SidebarSkeleton />
      )}
      
      {/* Main Content - Shows loading state OR actual content */}
      <main className="flex-1 overflow-auto lg:mt-0 lg:ml-80 mt-16 pb-24 lg:pb-0">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <LoadingSpinner size="lg" text={loadingText} />
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
};
