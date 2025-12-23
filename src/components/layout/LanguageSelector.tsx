import { useState } from "react";
import { Languages, Check, ChevronsUpDown, Loader2 } from "lucide-react";
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
import { useLanguage } from "@/contexts/LanguageContext";
import { SUPPORTED_LANGUAGES, getLanguageName, getLanguageFlag, SupportedLanguage } from "@/lib/country-language-map";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export function LanguageSelector() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { userLanguage, isLoading, updateUserLanguage, isAutoDetected } = useLanguage();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleLanguageChange = async (languageCode: SupportedLanguage) => {
    if (languageCode === userLanguage) {
      setOpen(false);
      return;
    }

    setIsUpdating(true);
    try {
      await updateUserLanguage(languageCode);
      toast.success(t('language.select') + `: ${getLanguageName(languageCode)}`);
      setOpen(false);
    } catch (error) {
      console.error("Failed to update language:", error);
      toast.error("Failed to update language. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const currentLanguageName = getLanguageName(userLanguage);
  const currentLanguageFlag = getLanguageFlag(userLanguage);

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
              <Languages className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col items-start min-w-0">
                <span className="text-xs text-muted-foreground">{t('language.current')}</span>
                <span className="text-sm font-medium truncate flex items-center gap-1">
                  <span>{currentLanguageFlag}</span>
                  <span>{currentLanguageName}</span>
                  {isAutoDetected && (
                    <span className="text-xs text-muted-foreground">({t('language.autoDetected')})</span>
                  )}
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
        <PopoverContent 
          className="w-[300px] p-0 bg-popover z-50" 
          align="start"
          sideOffset={4}
        >
          <Command className="bg-popover">
            <CommandInput 
              placeholder={t('language.select') + '...'} 
              className="bg-popover"
            />
            <CommandList className="bg-popover">
              <CommandEmpty>{t('common.error')}</CommandEmpty>
              <CommandGroup>
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const isSelected = lang === userLanguage;
                  const langName = getLanguageName(lang);
                  const langFlag = getLanguageFlag(lang);
                  
                  return (
                    <CommandItem
                      key={lang}
                      value={`${lang} ${langName}`}
                      onSelect={() => handleLanguageChange(lang)}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-lg">{langFlag}</span>
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium truncate">
                              {langName}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              {lang.toUpperCase()}
                            </span>
                          </div>
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
        </PopoverContent>
      </Popover>
    </div>
  );
}
