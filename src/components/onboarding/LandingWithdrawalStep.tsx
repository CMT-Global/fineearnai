import { Calendar, Wallet, CheckCircle2 } from "lucide-react";

export default function LandingWithdrawalStep() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          Get Paid <span className="text-gradient">Every Friday</span>
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Your earnings, every week, like clockwork. No hidden fees, no surprises.
        </p>
      </div>

      {/* Weekly Calendar Visual */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Calendar className="w-6 h-6 text-primary" />
          <span className="font-semibold text-foreground">Withdrawal Day</span>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
            <div 
              key={day} 
              className={`p-2 rounded-lg ${i === 4 ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted/30 text-muted-foreground'}`}
            >
              {day}
            </div>
          ))}
        </div>
      </div>

      {/* Minimum Withdrawal */}
      <div className="glass-card p-5 text-center border-primary/30">
        <Wallet className="w-8 h-8 text-primary mx-auto mb-2" />
        <p className="text-2xl font-bold text-gradient">$20 Minimum</p>
        <p className="text-sm text-muted-foreground">Low threshold — get your money fast</p>
      </div>

      <div className="flex items-center justify-center gap-2 text-sm text-foreground">
        <CheckCircle2 className="w-4 h-4 text-green-400" />
        <span>No hidden fees — your earnings are 100% yours</span>
      </div>
    </div>
  );
}
