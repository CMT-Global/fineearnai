import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange as DateRangeType } from "@/hooks/useAdminAnalytics";

interface DateRangeSelectorProps {
  value: DateRangeType;
  onChange: (range: DateRangeType) => void;
}

const presets = [
  { label: "Today", days: 0 },
  { label: "Yesterday", days: 1 },
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days", days: 30 },
  { label: "Last 90 Days", days: 90 },
];

export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();

  const handlePresetClick = (days: number) => {
    const endDate = new Date();
    const startDate = days === 0 
      ? new Date()                    // Today: same as end date
      : days === 1 
        ? subDays(endDate, 1)         // Yesterday: 1 day back
        : subDays(endDate, days - 1); // Multi-day range
    
    onChange({
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(days === 1 ? startDate : endDate, "yyyy-MM-dd"),
    });
  };

  const handleCustomApply = () => {
    if (customStartDate && customEndDate) {
      onChange({
        startDate: format(customStartDate, "yyyy-MM-dd"),
        endDate: format(customEndDate, "yyyy-MM-dd"),
      });
      setIsCustomOpen(false);
    }
  };

  const isPresetActive = (days: number) => {
    const endDate = new Date();
    const startDate = days === 0 
      ? new Date()
      : days === 1 
        ? subDays(endDate, 1)
        : subDays(endDate, days - 1);
    
    const expectedEnd = days === 1 ? startDate : endDate;
    
    return (
      value.startDate === format(startDate, "yyyy-MM-dd") &&
      value.endDate === format(expectedEnd, "yyyy-MM-dd")
    );
  };

  const getDisplayText = () => {
    const preset = presets.find((p) => isPresetActive(p.days));
    if (preset) return preset.label;
    return `${format(new Date(value.startDate), "MMM dd, yyyy")} - ${format(new Date(value.endDate), "MMM dd, yyyy")}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((preset) => (
        <Button
          key={preset.label}
          variant={isPresetActive(preset.days) ? "default" : "outline"}
          size="sm"
          onClick={() => handlePresetClick(preset.days)}
        >
          {preset.label}
        </Button>
      ))}
      
      <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <CalendarIcon className="h-4 w-4" />
            Custom Range
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4 bg-card z-50" align="start">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Calendar
                mode="single"
                selected={customStartDate}
                onSelect={setCustomStartDate}
                disabled={(date) => date > new Date()}
                initialFocus
                className={cn("pointer-events-auto")}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Calendar
                mode="single"
                selected={customEndDate}
                onSelect={setCustomEndDate}
                disabled={(date) => 
                  date > new Date() || 
                  (customStartDate ? date < customStartDate : false)
                }
                className={cn("pointer-events-auto")}
              />
            </div>
            
            <Button 
              onClick={handleCustomApply}
              disabled={!customStartDate || !customEndDate}
              className="w-full"
            >
              Apply Custom Range
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <div className="text-sm text-muted-foreground ml-2">
        Showing: {getDisplayText()}
      </div>
    </div>
  );
}