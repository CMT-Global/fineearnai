/**
 * SidebarSkeleton - Loading skeleton for the sidebar
 * Displays during initial profile data load to maintain layout consistency
 */
export const SidebarSkeleton = () => {
  return (
    <>
      {/* Desktop Sidebar Skeleton */}
      <aside className="hidden lg:flex w-64 bg-[hsl(var(--sidebar-bg))] flex-col border-r border-[hsl(var(--sidebar-border))]">
        {/* Logo skeleton */}
        <div className="p-6 border-b border-[hsl(var(--sidebar-border))]">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-muted animate-pulse rounded" />
            <div className="h-6 w-24 bg-muted animate-pulse rounded" />
          </div>
        </div>
        
        {/* User card skeleton */}
        <div className="p-4 border-b border-[hsl(var(--sidebar-border))]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
              <div className="h-3 w-16 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </div>
        
        {/* Currency selector skeleton */}
        <div className="p-4 border-b border-[hsl(var(--sidebar-border))]">
          <div className="h-9 bg-muted animate-pulse rounded" />
        </div>
        
        {/* Navigation items skeleton */}
        <div className="flex-1 p-4 space-y-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-10 bg-muted/50 animate-pulse rounded-lg" />
          ))}
        </div>
        
        {/* Logout button skeleton */}
        <div className="p-4 border-t border-[hsl(var(--sidebar-border))]">
          <div className="h-10 bg-muted animate-pulse rounded-lg" />
        </div>
      </aside>

      {/* Mobile Header Skeleton */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-muted animate-pulse rounded" />
          <div className="h-5 w-32 bg-muted animate-pulse rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-16 bg-muted animate-pulse rounded" />
          <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
        </div>
      </div>
    </>
  );
};
