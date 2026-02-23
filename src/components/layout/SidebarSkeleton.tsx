/**
 * SidebarSkeleton - Enhanced loading skeleton with shimmer effect
 * Now a rare fallback thanks to localStorage caching
 */
export const SidebarSkeleton = () => {
  return (
    <>
      {/* Desktop Sidebar Skeleton */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-80 bg-[hsl(var(--sidebar-bg))] flex-col z-40">
        {/* Logo skeleton */}
        <div className="p-6 border-b border-[hsl(var(--sidebar-border))]">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-gradient-to-r from-muted via-muted/50 to-muted animate-shimmer rounded" 
                 style={{ backgroundSize: '200% 100%' }} />
            <div className="h-6 w-24 bg-gradient-to-r from-muted via-muted/50 to-muted animate-shimmer rounded" 
                 style={{ backgroundSize: '200% 100%' }} />
          </div>
        </div>
        
        {/* User card skeleton */}
        <div className="p-4 border-b border-[hsl(var(--sidebar-border))]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-muted via-muted/50 to-muted animate-shimmer" 
                 style={{ backgroundSize: '200% 100%' }} />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-20 bg-gradient-to-r from-muted via-muted/50 to-muted animate-shimmer rounded" 
                   style={{ backgroundSize: '200% 100%' }} />
              <div className="h-3 w-16 bg-gradient-to-r from-muted via-muted/50 to-muted animate-shimmer rounded" 
                   style={{ backgroundSize: '200% 100%' }} />
            </div>
          </div>
        </div>
        
        {/* Currency selector skeleton */}
        <div className="p-4 border-b border-[hsl(var(--sidebar-border))]">
          <div className="h-9 bg-gradient-to-r from-muted via-muted/50 to-muted animate-shimmer rounded" 
               style={{ backgroundSize: '200% 100%' }} />
        </div>
        
        {/* Navigation items skeleton */}
        <div className="flex-1 p-4 space-y-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} 
                 className="h-10 bg-gradient-to-r from-muted/50 via-muted/30 to-muted/50 animate-shimmer rounded-lg" 
                 style={{ 
                   backgroundSize: '200% 100%',
                   animationDelay: `${i * 0.1}s` 
                 }} />
          ))}
        </div>
        
        {/* Logout button skeleton */}
        <div className="p-4 border-t border-[hsl(var(--sidebar-border))]">
          <div className="h-10 bg-gradient-to-r from-muted via-muted/50 to-muted animate-shimmer rounded-lg" 
               style={{ backgroundSize: '200% 100%' }} />
        </div>
      </aside>

      {/* Mobile Header Skeleton */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-gradient-to-r from-muted via-muted/50 to-muted animate-shimmer rounded" 
               style={{ backgroundSize: '200% 100%' }} />
          <div className="h-5 w-32 bg-gradient-to-r from-muted via-muted/50 to-muted animate-shimmer rounded" 
               style={{ backgroundSize: '200% 100%' }} />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-16 bg-gradient-to-r from-muted via-muted/50 to-muted animate-shimmer rounded" 
               style={{ backgroundSize: '200% 100%' }} />
          <div className="h-8 w-8 bg-gradient-to-r from-muted via-muted/50 to-muted animate-shimmer rounded-full" 
               style={{ backgroundSize: '200% 100%' }} />
        </div>
      </div>
    </>
  );
};
