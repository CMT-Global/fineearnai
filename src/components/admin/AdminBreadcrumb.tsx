import { ChevronRight, LayoutDashboard } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const location = useLocation();

  // Always include Admin as the root
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: t("admin.sidebar.admin"), path: "/admin" },
    ...items,
  ];

  return (
    <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground mb-4 min-w-0 overflow-hidden">
      {breadcrumbItems.map((item, index) => {
        const isLast = index === breadcrumbItems.length - 1;
        const isCurrent = item.path === location.pathname;

        return (
          <div key={index} className="flex items-center gap-2 min-w-0 flex-shrink-0">
            {index > 0 && <ChevronRight className="h-4 w-4 flex-shrink-0" />}
            
            {index === 0 && <LayoutDashboard className="h-4 w-4 flex-shrink-0" />}
            
            {isLast || isCurrent || !item.path ? (
              <span className="font-medium text-foreground break-words min-w-0">{item.label}</span>
            ) : (
              <Link
                to={item.path}
                className="hover:text-foreground transition-colors break-words min-w-0"
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
