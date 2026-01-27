import { Facebook, Twitter, Instagram, Linkedin, Mail } from "lucide-react";
import LandingLogo from "./LandingLogo";

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

const socialLinks = [
  { icon: Facebook, href: "#", label: "Facebook" },
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Instagram, href: "#", label: "Instagram" },
  { icon: Linkedin, href: "#", label: "LinkedIn" },
];

export default function LandingFooter() {
  return (
    <footer className="bg-card/50 border-t border-border/50">
      <div className="container-custom px-4 md:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-2">
            <LandingLogo />
            <p className="mt-4 text-muted-foreground text-sm leading-relaxed max-w-sm">
              ProfitChips connects people worldwide with opportunities to earn by contributing 
              to AI development. Get paid to shape the future of technology.
            </p>
            
            {/* Social Links */}
            <div className="flex items-center gap-4 mt-6">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-secondary/80 transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
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
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} ProfitChips. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="w-4 h-4" />
            <a href="mailto:support@profitchips.com" className="hover:text-primary transition-colors">
              support@profitchips.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
