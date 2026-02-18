import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import LandingLogo from "./LandingLogo";
import { useInviteOnlyConfig } from "@/hooks/useInviteOnlyConfig";

const navLinks = [
  { name: "How It Works", href: "#how-it-works" },
  { name: "Projects", href: "#projects" },
  { name: "Benefits", href: "#benefits" },
  { name: "FAQ", href: "#faq" },
];

export default function LandingNavbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isInviteOnly } = useInviteOnlyConfig();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border/50"
          : "bg-transparent"
      }`}
    >
      <div className="container-custom">
        <div className="flex items-center justify-between h-20 px-4 md:px-8">
          <Link to="/" className="flex items-center">
            <LandingLogo />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-muted-foreground hover:text-foreground transition-colors duration-200 text-sm font-medium"
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Log In</Link>
            </Button>
            {isInviteOnly ? (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/signup?have_invite=1">I Have an Invite</Link>
                </Button>
                <Button variant="hero" size="default" asChild>
                  <Link to="/signup?request_invite=1">Request Invite</Link>
                </Button>
              </>
            ) : (
              <Button variant="hero" size="default" asChild>
                <Link to="/signup">Get Started</Link>
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-card/95 backdrop-blur-xl border-t border-border animate-fade-in">
            <div className="px-4 py-6 space-y-4">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="block text-foreground hover:text-primary transition-colors py-2 text-lg font-medium"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.name}
                </a>
              ))}
              <div className="pt-4 space-y-3">
                <Button variant="ghost" className="w-full justify-center" asChild>
                  <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>Log In</Link>
                </Button>
                {isInviteOnly ? (
                  <>
                    <Button variant="outline" className="w-full justify-center" asChild>
                      <Link to="/signup?have_invite=1" onClick={() => setIsMobileMenuOpen(false)}>I Have an Invite</Link>
                    </Button>
                    <Button variant="hero" className="w-full justify-center" asChild>
                      <Link to="/signup?request_invite=1" onClick={() => setIsMobileMenuOpen(false)}>Request Invite</Link>
                    </Button>
                  </>
                ) : (
                  <Button variant="hero" className="w-full justify-center" asChild>
                    <Link to="/signup" onClick={() => setIsMobileMenuOpen(false)}>Get Started</Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
