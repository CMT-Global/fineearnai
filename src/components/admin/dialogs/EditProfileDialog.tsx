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

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  username: string;
  currentProfile: {
    full_name?: string | null;
    phone?: string | null;
    country?: string | null;
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens or profile changes
  useEffect(() => {
    if (open) {
      setFullName(currentProfile.full_name || "");
      setPhone(currentProfile.phone || "");
      setCountry(currentProfile.country || "");
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

        <div className="space-y-4 py-4">
          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="fullName" className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              Full Name
            </Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter full name"
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              Phone
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter phone number"
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
