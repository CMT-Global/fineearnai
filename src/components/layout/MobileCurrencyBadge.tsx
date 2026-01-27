import { useState } from "react";
import { Globe, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCurrencyConversion } from "@/hooks/useCurrencyConversion";
import { useTranslation } from "react-i18next";
import { CURRENCIES, getCurrencySymbol } from "@/lib/currencies";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function MobileCurrencyBadge() {
  const { t } = useTranslation();
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
      toast.success(t("currency.updatedTo", { currencyCode }));
      setOpen(false);
    } catch (error) {
      console.error("Failed to update currency:", error);
      toast.error(t("currency.updateFailed"));
    } finally {
      setIsUpdating(false);
    }
  };

  const currentCurrencySymbol = getCurrencySymbol(userCurrency);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 gap-1 border-border"
          disabled={isLoading || isUpdating}
        >
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">
            {currentCurrencySymbol} {userCurrency}
          </span>
          {isUpdating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ChevronsUpDown className="h-3 w-3 opacity-50" />
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh]">
        <SheetHeader className="pb-4">
          <SheetTitle>Select Currency</SheetTitle>
        </SheetHeader>
        
        <div className="flex flex-col h-[calc(100%-60px)]">
          <Command className="rounded-lg border">
            <CommandInput placeholder="Search currency..." />
            <CommandList className="max-h-[calc(85vh-180px)]">
              <CommandEmpty>No currency found.</CommandEmpty>
              <CommandGroup>
                {CURRENCIES.map((currency) => {
                  const isSelected = currency.code === userCurrency;
                  
                  return (
                    <CommandItem
                      key={currency.code}
                      value={`${currency.code} ${currency.name}`}
                      onSelect={() => handleCurrencyChange(currency.code)}
                      className="flex items-center justify-between cursor-pointer py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isSelected ? "opacity-100 text-primary" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-medium text-base">
                            {currency.symbol} {currency.code}
                          </span>
                          <span className="text-sm text-muted-foreground truncate">
                            {currency.name}
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          Current
                        </Badge>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
          
          {/* Live Conversion Preview */}
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">
              Conversion Preview
            </div>
            <div className="text-base font-semibold">
              USD $100 = {formatAmount(100)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Exchange rates update daily
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
