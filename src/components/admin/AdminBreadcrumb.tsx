import { ChevronRight, LayoutDashboard } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface AdminBreadcrumbProps {
  items?: BreadcrumbItem[];
}

/**
 * AdminBreadcrumb - Navigation breadcrumb for admin pages
 * 
 * Shows the navigation path within the admin area.
 * Automatically adds "Admin" as the first item and links to /admin
 */
export const AdminBreadcrumb = ({ items = [] }: AdminBreadcrumbProps) => {
  const location = useLocation();

  // Always include Admin as the root
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Admin", path: "/admin" },
    ...items,
  ];

  return (
    <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
      {breadcrumbItems.map((item, index) => {
        const isLast = index === breadcrumbItems.length - 1;
        const isCurrent = item.path === location.pathname;

        return (
          <div key={index} className="flex items-center gap-2">
            {index > 0 && <ChevronRight className="h-4 w-4" />}
            
            {index === 0 && <LayoutDashboard className="h-4 w-4" />}
            
            {isLast || isCurrent || !item.path ? (
              <span className="font-medium text-foreground">{item.label}</span>
            ) : (
              <Link
                to={item.path}
                className="hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
};
