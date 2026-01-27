import { MessageSquare, ThumbsUp, ThumbsDown, Minus } from "lucide-react";

export default function LandingHowItWorksStep() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          How It <span className="text-gradient">Works</span>
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          It's simple: You read reviews, you answer questions, you get paid.
        </p>
      </div>

      <div className="glass-card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <MessageSquare className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
          <div>
            <p className="font-medium text-foreground mb-2">Example Task:</p>
            <div className="bg-background/50 rounded-lg p-4 border border-border/50">
              <p className="text-sm text-muted-foreground italic mb-3">
                "The hotel room was clean and spacious. The staff was friendly, but the WiFi was quite slow. Overall, I'd recommend it for the price."
              </p>
              <p className="text-sm font-medium text-foreground">
                Question: Was this hotel guest satisfied with their stay?
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-center gap-4 pt-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
            <ThumbsUp className="w-4 h-4" />
            Positive
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
            <Minus className="w-4 h-4" />
            Mixed
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            <ThumbsDown className="w-4 h-4" />
            Negative
          </button>
        </div>
      </div>

      <div className="text-center space-y-2">
        <p className="text-foreground font-medium">That's it! No technical skills needed.</p>
        <p className="text-sm text-muted-foreground">
          Your honest opinion helps AI understand human emotions and language better.
        </p>
      </div>
    </div>
  );
}
