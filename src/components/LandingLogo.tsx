import { Cpu } from "lucide-react";

function LandingLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-10 h-10 flex items-center justify-center">
        <div className="absolute inset-0 bg-primary/20 rounded-lg blur-sm" />
        <div className="relative w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
          <Cpu className="w-5 h-5 text-primary-foreground" />
        </div>
      </div>
      <span className="text-xl font-bold text-foreground">
        Profit<span className="text-gradient">Chips</span>
      </span>
    </div>
  );
}

export default LandingLogo;
