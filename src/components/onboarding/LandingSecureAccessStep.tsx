import { ShieldCheck, Globe, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface LandingSecureAccessStepProps {
  onComplete: () => void;
}

export default function LandingSecureAccessStep({ onComplete }: LandingSecureAccessStepProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/20 rounded-full mb-4">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          Final Step — <span className="text-gradient">Secure Your Access</span>
        </h2>
      </div>

      {/* Trial & Activation Info */}
      <div className="glass-card p-5 space-y-4">
        <p className="text-foreground leading-relaxed">
          Once you register, you'll start on a <strong className="text-primary">Trainee Account</strong> with full
          access for <strong>3 days (trial)</strong>.
        </p>
        <p className="text-foreground leading-relaxed">
          After your trial ends, you'll need to activate your account to keep working — starting from{" "}
          <strong className="text-gradient">$48/year</strong> (one-time activation fee). You can compare the other
          earning accounts in the Membership plans page after you login.
        </p>
      </div>

      {/* Global Access Differentiator */}
      <div className="glass-card p-5 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">Open to Everyone, Worldwide</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Unlike other platforms which have country restrictions to start earning, we accept users globally. We
              use this activation to filter low-effort signups and protect task availability to serious contributors,
              so quality stays high for everyone.
            </p>
          </div>
        </div>
      </div>

      <div className="text-center pt-2">
        <Button
          variant="hero"
          size="xl"
          onClick={() => {
            onComplete();
            navigate("/signup");
          }}
          className="w-full sm:w-auto"
        >
          Create My Account
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
        <p className="text-xs text-muted-foreground mt-3">
          By clicking, you acknowledge this is a subscription-based platform
        </p>
      </div>
    </div>
  );
}
