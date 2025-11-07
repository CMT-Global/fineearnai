import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";

export interface ComparisonPreset {
  label: string;
  startDate: string;
  endDate: string;
}

interface ComparisonPresetSelectorProps {
  onPresetSelect: (preset: ComparisonPreset) => void;
  selectedPreset?: string;
}

export const ComparisonPresetSelector = ({
  onPresetSelect,
  selectedPreset,
}: ComparisonPresetSelectorProps) => {
  const today = new Date();
  
  const presets: ComparisonPreset[] = [
    {
      label: "Yesterday vs Day Before",
      startDate: format(subDays(today, 1), "yyyy-MM-dd"),
      endDate: format(subDays(today, 1), "yyyy-MM-dd"),
    },
    {
      label: "Last 7 Days vs Previous 7",
      startDate: format(subDays(today, 7), "yyyy-MM-dd"),
      endDate: format(subDays(today, 1), "yyyy-MM-dd"),
    },
    {
      label: "Last 30 Days vs Previous 30",
      startDate: format(subDays(today, 30), "yyyy-MM-dd"),
      endDate: format(subDays(today, 1), "yyyy-MM-dd"),
    },
    {
      label: "This Month vs Last Month",
      startDate: format(startOfMonth(today), "yyyy-MM-dd"),
      endDate: format(today, "yyyy-MM-dd"),
    },
    {
      label: "Last Month vs Month Before",
      startDate: format(startOfMonth(subMonths(today, 1)), "yyyy-MM-dd"),
      endDate: format(endOfMonth(subMonths(today, 1)), "yyyy-MM-dd"),
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span>Quick Comparisons</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant={selectedPreset === preset.label ? "default" : "outline"}
            size="sm"
            onClick={() => onPresetSelect(preset)}
            className="text-xs"
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  );
};
