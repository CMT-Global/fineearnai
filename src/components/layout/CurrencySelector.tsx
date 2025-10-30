import { useState } from "react";
import { Globe, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCurrencyConversion } from "@/hooks/useCurrencyConversion";
import { CURRENCIES, getCurrencySymbol } from "@/lib/currencies";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CurrencySelector() {
  const [open, setOpen] = useState(false);
  const { userCurrency, isLoading, updateUserCurrency, convertAmount, formatAmount } = useCurrencyConversion();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleCurrencyChange = async (currencyCode: string) => {
    if (currencyCode === userCurrency) {
      setOpen(false);
      return;
    }

    setIsUpdating(true);
    try {
      await updateUserCurrency(currencyCode);
      toast.success(`Currency updated to ${currencyCode}`);
      setOpen(false);
    } catch (error) {
      console.error("Failed to update currency:", error);
      toast.error("Failed to update currency. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Get sample conversion for $100 USD
  const sampleConversion = convertAmount(100);
  const currentCurrencySymbol = getCurrencySymbol(userCurrency);
  const currentCurrency = CURRENCIES.find(c => c.code === userCurrency);

  return (
    <div className="px-3 py-2 border-t border-b border-border">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto py-2 hover:bg-accent"
            disabled={isLoading || isUpdating}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col items-start min-w-0">
                <span className="text-xs text-muted-foreground">Currency</span>
                <span className="text-sm font-medium truncate">
                  {currentCurrencySymbol} {userCurrency}
                </span>
              </div>
            </div>
            {isUpdating ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search currency..." />
            <CommandList>
              <CommandEmpty>No currency found.</CommandEmpty>
              <CommandGroup>
                {CURRENCIES.map((currency) => {
                  const isSelected = currency.code === userCurrency;
                  const converted = convertAmount(100);
                  
                  return (
                    <CommandItem
                      key={currency.code}
                      value={`${currency.code} ${currency.name}`}
                      onSelect={() => handleCurrencyChange(currency.code)}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium truncate">
                            {currency.symbol} {currency.code}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            {currency.name}
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">
                          Current
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
          
          {/* Live Conversion Preview */}
          <div className="border-t border-border p-3 bg-muted/50">
            <div className="text-xs text-muted-foreground mb-1">
              Conversion Preview
            </div>
            <div className="text-sm font-medium">
              USD $100 = {formatAmount(100)}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
