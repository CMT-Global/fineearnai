import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Facebook, Instagram, Mail, MapPin, Music } from "lucide-react";
import LandingLogo from "./LandingLogo";

// X (Twitter) icon: Lucide has no dedicated X logo, use a simple SVG
function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const footerLinks = {
  Platform: [
    { name: "How It Works", href: "#how-it-works" },
    { name: "Projects", href: "#projects" },
    { name: "Benefits", href: "#benefits" },
    { name: "FAQ", href: "#faq" },
  ],
  Company: [
    { name: "About Us", href: "#" },
  ],
  Legal: [
    { name: "Terms of Service", href: "#" },
    { name: "Privacy Policy", href: "#" },
    { name: "Cookie Policy", href: "#" },
    { name: "Code of Ethics", href: "#" },
  ],
};

interface SocialLinkConfig {
  url: string;
  enabled: boolean;
}

interface LandingFooterContactConfig {
  address: string;
  supportEmail: string;
  socialLinks: {
    facebook: SocialLinkConfig;
    instagram: SocialLinkConfig;
    tiktok: SocialLinkConfig;
    x: SocialLinkConfig;
  };
}

const DEFAULT_CONTACT: LandingFooterContactConfig = {
  address: "123 Innovation Drive, Tech City, TC 12345",
  supportEmail: "support@profitchips.com",
  socialLinks: {
    facebook: { url: "https://facebook.com/ProfitChips", enabled: true },
    instagram: { url: "https://www.instagram.com/ProfitChipsofficial/", enabled: true },
    tiktok: { url: "https://www.tiktok.com/@ProfitChips", enabled: true },
    x: { url: "https://x.com/ProfitChips", enabled: true },
  },
};

const SOCIAL_META: { key: keyof LandingFooterContactConfig["socialLinks"]; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "facebook", label: "Facebook", icon: Facebook },
  { key: "instagram", label: "Instagram", icon: Instagram },
  { key: "tiktok", label: "TikTok", icon: Music },
  { key: "x", label: "X", icon: XIcon },
];

export default function LandingFooter() {
  const { data: contactConfig } = useQuery({
    queryKey: ["landing-footer-contact"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("value")
        .eq("key", "landing_footer_contact")
        .maybeSingle();
      if (error) throw error;
      return (data?.value as unknown) as LandingFooterContactConfig | null;
    },
  });

  const contact: LandingFooterContactConfig = contactConfig
    ? {
        address: contactConfig.address ?? DEFAULT_CONTACT.address,
        supportEmail: contactConfig.supportEmail ?? DEFAULT_CONTACT.supportEmail,
        socialLinks: {
          facebook: { ...DEFAULT_CONTACT.socialLinks.facebook, ...contactConfig.socialLinks?.facebook },
          instagram: { ...DEFAULT_CONTACT.socialLinks.instagram, ...contactConfig.socialLinks?.instagram },
          tiktok: { ...DEFAULT_CONTACT.socialLinks.tiktok, ...contactConfig.socialLinks?.tiktok },
          x: { ...DEFAULT_CONTACT.socialLinks.x, ...contactConfig.socialLinks?.x },
        },
      }
    : DEFAULT_CONTACT;

  const enabledSocials = SOCIAL_META.filter(({ key }) => contact.socialLinks[key]?.enabled !== false);

  return (
    <footer className="bg-card/50 border-t border-border/50">
      <div className="container-custom px-4 md:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 lg:gap-12">
          {/* Brand - same position as before */}
          <div className="col-span-2 lg:col-span-2">
            <LandingLogo />
            <p className="mt-4 text-muted-foreground text-sm leading-relaxed max-w-sm">
              ProfitChips connects people worldwide with opportunities to earn by contributing
              to AI development. Get paid to shape the future of technology.
            </p>
          </div>

          {/* Platform, Company, Legal - kept in their original positions (cols 3, 4, 5) */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="font-semibold text-foreground mb-4">{category}</h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Contact section - same style as Platform, Company, Legal */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Contact</h3>
            <div className="space-y-4">
              {contact.address?.trim() && (
                <div className="flex gap-3 items-center">
                  <MapPin className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden />
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {contact.address}
                  </p>
                </div>
              )}
              {contact.supportEmail?.trim() && (
                <a
                  href={`mailto:${contact.supportEmail}`}
                  className="flex gap-3 items-center text-sm text-muted-foreground hover:text-primary transition-colors group"
                >
                  <Mail className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden />
                  <span>{contact.supportEmail}</span>
                </a>
              )}
              {enabledSocials.length > 0 && (
                <div className="flex items-center gap-2 flex-nowrap pt-1">
                  {enabledSocials.map(({ key, label, icon: Icon }) => {
                    const link = contact.socialLinks[key];
                    const href = link?.url?.trim() || "#";
                    return (
                      <a
                        key={key}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background/60 text-muted-foreground transition-all duration-200 hover:border-primary/50 hover:bg-primary/10 hover:text-primary hover:scale-105"
                        aria-label={label}
                      >
                        <Icon className="w-4 h-4" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} ProfitChips. All rights reserved.
          </p>
          {contact.supportEmail?.trim() && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="w-4 h-4 shrink-0" />
              <a
                href={`mailto:${contact.supportEmail}`}
                className="hover:text-primary transition-colors"
              >
                {contact.supportEmail}
              </a>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
