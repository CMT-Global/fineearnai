import { useState, useEffect } from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  COUNTRY_DIAL_LIST,
  getCountryFlagEmoji,
  parsePhoneForDisplay,
  type CountryDial,
  MAX_PHONE_DIGITS,
} from "@/lib/country-dial-codes";

const DEFAULT_COUNTRY = COUNTRY_DIAL_LIST.find((c) => c.code === "US") ?? COUNTRY_DIAL_LIST[0];

export interface PhoneInputWithCountryProps {
  /** Full E.164 phone (e.g. +919876543210) or plain digits; when editing existing profile this is persisted value */
  value: string;
  /** Called with full E.164 string when country or number changes */
  onChange: (e164: string) => void;
  /** Profile country code (2-letter) to resolve country when dial is shared (e.g. US vs CA for +1) */
  countryHint?: string | null;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Search placeholder in country dropdown */
  searchPlaceholder?: string;
  /** Empty state text in country dropdown */
  emptyText?: string;
}

export function PhoneInputWithCountry({
  value,
  onChange,
  countryHint,
  placeholder = "Phone number",
  disabled = false,
  id,
  className,
  searchPlaceholder = "Search by country or code...",
  emptyText = "No country found.",
}: PhoneInputWithCountryProps) {
  const [countryOpen, setCountryOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryDial>(DEFAULT_COUNTRY);
  const [nationalNumber, setNationalNumber] = useState("");

  // Initialize from persisted value (existing profile)
  useEffect(() => {
    const parsed = parsePhoneForDisplay(value || undefined, countryHint);
    if (parsed) {
      setSelectedCountry(parsed.country);
      setNationalNumber(parsed.nationalNumber);
    } else if (!value || !value.trim()) {
      const byHint = countryHint
        ? COUNTRY_DIAL_LIST.find((c) => c.code === countryHint)
        : undefined;
      setSelectedCountry(byHint ?? DEFAULT_COUNTRY);
      setNationalNumber("");
    } else {
      // Legacy: value is national-only (no E.164 prefix); use country hint
      const byHint = countryHint
        ? COUNTRY_DIAL_LIST.find((c) => c.code === countryHint)
        : undefined;
      setSelectedCountry(byHint ?? DEFAULT_COUNTRY);
      setNationalNumber(value.replace(/\D/g, ""));
    }
  }, [value, countryHint]);

  const buildE164 = (country: CountryDial, national: string) => {
    const digits = national.replace(/\D/g, "");
    if (!digits) return "";
    return `+${country.dial}${digits}`;
  };

  const handleCountrySelect = (country: CountryDial) => {
    setSelectedCountry(country);
    setCountryOpen(false);
    const e164 = buildE164(country, nationalNumber);
    onChange(e164);
  };

  const handleNationalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, "");
    setNationalNumber(digits);
    const e164 = buildE164(selectedCountry, digits);
    onChange(e164);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex gap-1 rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        <Popover open={countryOpen} onOpenChange={setCountryOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className={cn(
                "h-10 shrink-0 gap-1.5 border-0 border-r border-input bg-transparent px-3 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                !selectedCountry && "text-muted-foreground"
              )}
              disabled={disabled}
            >
              <span className="text-base leading-none">
                {getCountryFlagEmoji(selectedCountry.code)}
              </span>
              <span className="text-sm">+{selectedCountry.dial}</span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="start">
            <Command>
              <CommandInput placeholder={searchPlaceholder} />
              <CommandList>
                <CommandEmpty>{emptyText}</CommandEmpty>
                <CommandGroup>
                  {COUNTRY_DIAL_LIST.map((country) => (
                    <CommandItem
                      key={country.code}
                      value={`${country.name} +${country.dial} ${country.code}`}
                      onSelect={() => handleCountrySelect(country)}
                      className="group flex items-center gap-2"
                    >
                      <span className="text-lg">
                        {getCountryFlagEmoji(country.code)}
                      </span>
                      <span className="flex-1 truncate">{country.name}</span>
                      <span className="shrink-0 font-medium text-muted-foreground group-hover:text-foreground data-[selected=true]:text-foreground">
                        +{country.dial}
                      </span>
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          country.code === selectedCountry.code
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder={placeholder}
          value={nationalNumber}
          onChange={handleNationalChange}
          disabled={disabled}
          className="min-w-0 flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          maxLength={MAX_PHONE_DIGITS + 4}
        />
      </div>
    </div>
  );
}
