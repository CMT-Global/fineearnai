import { Users, Link, Percent, TrendingUp, AlertCircle } from "lucide-react";

export default function LandingReferralProgramStep() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          Invite Friends, <span className="text-gradient">Boost Your Income</span>
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          ProfitChips is better with friends. Build a team and earn from their success too.
        </p>
      </div>

      {/* Visual Team Tree */}
      <div className="glass-card p-6">
        <div className="flex flex-col items-center">
          <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center mb-2">
            <span className="text-primary-foreground font-bold">YOU</span>
          </div>
          <div className="w-0.5 h-6 bg-primary/50"></div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="w-0.5 h-4 bg-primary/30 mx-auto"></div>
              <div className="w-10 h-10 bg-primary/30 rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
            </div>
            <div className="text-center">
              <div className="w-0.5 h-4 bg-primary/30 mx-auto"></div>
              <div className="w-10 h-10 bg-primary/30 rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
            </div>
            <div className="text-center">
              <div className="w-0.5 h-4 bg-primary/30 mx-auto"></div>
              <div className="w-10 h-10 bg-primary/30 rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-3">Your referral team</p>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="glass-card p-4 flex items-start gap-4">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Link className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">Share Your Unique Link</h3>
            <p className="text-sm text-muted-foreground">
              Every earner gets a personal referral link to share with friends and family.
            </p>
          </div>
        </div>

        <div className="glass-card p-4 flex items-start gap-4 border-primary/30">
          <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Percent className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">Earn 10% Commission</h3>
            <p className="text-sm text-muted-foreground">
              When your referrals complete tasks, you earn 10% of their task earnings — automatically added to your balance.
            </p>
          </div>
        </div>

        <div className="glass-card p-4 flex items-start gap-4">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">No Limit on Referrals</h3>
            <p className="text-sm text-muted-foreground">
              The more people you invite, the more you earn. Some earners have built teams of 50+ people!
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>Referral commissions are available on Premium, Pro, and Elite plans. Basic plan members can still invite friends but won't earn commission.</p>
      </div>
    </div>
  );
}
