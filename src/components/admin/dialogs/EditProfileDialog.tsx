import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserManagement } from "@/hooks/useUserManagement";
import { UserCheck, Globe, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getCountryName } from "@/lib/countries";
import { PhoneInputWithCountry } from "@/components/settings/PhoneInputWithCountry";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES } from "@/lib/country-language-map";

// Helper function to get country flag emoji from country code
const getCountryFlag = (countryCode: string | null | undefined): string => {
  if (!countryCode || countryCode.length !== 2) return "🌍";
  const code = countryCode.toUpperCase();
  // Convert country code to flag emoji using regional indicator symbols
  const flag = code
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
  return flag;
};

const EARNING_GOALS = ["$50/week", "$100/week", "$200/week", "$200/month", "$500/month", "Other"];
const MOTIVATIONS = ["Extra income", "Full-time", "Learning AI", "New online side hustle", "Other"];
const HOW_DID_YOU_HEAR = ["Social media", "Search", "Friend / referral", "Advertisement", "Other"];

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  username: string;
  currentProfile: {
    full_name?: string | null;
    phone?: string | null;
    country?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    timezone?: string | null;
    preferred_language?: string | null;
    earning_goal?: string | null;
    motivation?: string | null;
    how_did_you_hear?: string | null;
    usdt_bep20_address?: string | null;
  };
  onSuccess?: () => void;
}

export const EditProfileDialog = ({
  open,
  onOpenChange,
  userId,
  username,
  currentProfile,
  onSuccess,
}: EditProfileDialogProps) => {
  const { t } = useTranslation();
  const { updateUserProfile } = useUserManagement();
  
  const [fullName, setFullName] = useState(currentProfile.full_name || "");
  const [phone, setPhone] = useState(currentProfile.phone || "");
  const [country, setCountry] = useState(currentProfile.country || "");
  const [firstName, setFirstName] = useState(currentProfile.first_name || "");
  const [lastName, setLastName] = useState(currentProfile.last_name || "");
  const [timezone, setTimezone] = useState(currentProfile.timezone || "");
  const [preferredLanguage, setPreferredLanguage] = useState(currentProfile.preferred_language || "");
  const [earningGoal, setEarningGoal] = useState(currentProfile.earning_goal || "");
  const [motivation, setMotivation] = useState(currentProfile.motivation || "");
  const [howDidYouHear, setHowDidYouHear] = useState(currentProfile.how_did_you_hear || "");
  const [usdtBep20, setUsdtBep20] = useState(currentProfile.usdt_bep20_address || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setFullName(currentProfile.full_name || "");
      setPhone(currentProfile.phone || "");
      setCountry(currentProfile.country || "");
      setFirstName(currentProfile.first_name || "");
      setLastName(currentProfile.last_name || "");
      setTimezone(currentProfile.timezone || "");
      setPreferredLanguage(currentProfile.preferred_language || "");
      setEarningGoal(currentProfile.earning_goal || "");
      setMotivation(currentProfile.motivation || "");
      setHowDidYouHear(currentProfile.how_did_you_hear || "");
      setUsdtBep20(currentProfile.usdt_bep20_address || "");
    }
  }, [open, currentProfile]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await updateUserProfile.mutateAsync({
        userId,
        profileData: {
          full_name: fullName || null,
          phone: phone || null,
          country: country || null,
          first_name: firstName || null,
          last_name: lastName || null,
          timezone: timezone || null,
          preferred_language: preferredLanguage || null,
          earning_goal: earningGoal || null,
          motivation: motivation || null,
          how_did_you_hear: howDidYouHear || null,
          usdt_bep20_address: usdtBep20.trim() || null,
        },
      });
      
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      // Error is handled by the mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Edit Profile
          </DialogTitle>
          <DialogDescription>
            Update profile information for {username}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
            </div>
            <div className="space-y-2">
              <Label>Last name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Full name (legacy)</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="e.g. America/New_York" />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              Phone
            </Label>
            <PhoneInputWithCountry
              id="phone"
              value={phone}
              onChange={setPhone}
              countryHint={country}
              placeholder="Enter phone number"
              searchPlaceholder="Search by country or code..."
              emptyText="No country found."
            />
          </div>

          {/* Country */}
          <div className="space-y-2">
            <Label htmlFor="country" className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              Country
            </Label>
            <div className="flex items-center gap-2">
              {country && country.length === 2 && (
                <span className="text-2xl flex-shrink-0" title={getCountryName(country) || country}>
                  {getCountryFlag(country)}
                </span>
              )}
              <Input
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                placeholder="Enter country code (e.g., US, IN, GB)"
                maxLength={2}
                className="uppercase flex-1"
              />
            </div>
            {country && country.length === 2 && getCountryName(country) && (
              <p className="text-xs text-muted-foreground">
                {getCountryName(country)}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Enter a 2-letter country code (ISO 3166-1 alpha-2)
            </p>
          </div>
          <div className="space-y-2">
            <Label>Preferred language</Label>
            <Select value={preferredLanguage || undefined} onValueChange={setPreferredLanguage}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((l) => (
                  <SelectItem key={l} value={l}>{LANGUAGE_NAMES[l]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Earning goal</Label>
            <Select value={earningGoal || undefined} onValueChange={setEarningGoal}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {EARNING_GOALS.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Motivation</Label>
            <Select value={motivation || undefined} onValueChange={setMotivation}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {MOTIVATIONS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>How did you hear about us</Label>
            <Select value={howDidYouHear || undefined} onValueChange={setHowDidYouHear}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {HOW_DID_YOU_HEAR.map((h) => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>USDT BEP20 address (audited)</Label>
            <Input
              value={usdtBep20}
              onChange={(e) => setUsdtBep20(e.target.value)}
              placeholder="0x..."
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">Changes are logged in audit.</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || updateUserProfile.isPending}
          >
            {isSubmitting || updateUserProfile.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
