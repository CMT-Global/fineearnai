import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Users, UserX, FileDown } from "lucide-react";

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkUpdatePlan: () => void;
  onBulkSuspend: () => void;
  onBulkExport: () => void;
}

export const BulkActionsBar = ({
  selectedCount,
  onClearSelection,
  onBulkUpdatePlan,
  onBulkSuspend,
  onBulkExport,
}: BulkActionsBarProps) => {
  if (selectedCount === 0) return null;

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center gap-3">
        <Badge variant="default" className="text-sm">
          {selectedCount} selected
        </Badge>
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          Clear
        </Button>
      </div>
      
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Users className="h-4 w-4 mr-2" />
              Bulk Actions
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onBulkUpdatePlan}>
              <Users className="h-4 w-4 mr-2" />
              Update Plan
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onBulkSuspend}>
              <UserX className="h-4 w-4 mr-2" />
              Suspend Users
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onBulkExport}>
              <FileDown className="h-4 w-4 mr-2" />
              Export Data
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};