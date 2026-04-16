import {
  Monitor,
  Bot,
  Clock,
  Coins,
  CheckCircle2,
  Rocket,
  Globe,
  Lock,
  Users,
  TrendingUp,
} from "lucide-react";

/* ─── What We Do ─────────────────────────────────────── */
const whatWeDo = [
  { icon: Monitor, label: "Complete simple online tasks" },
  { icon: Bot,     label: "Help train and improve AI systems" },
  { icon: Clock,   label: "Work anytime, from anywhere" },
  { icon: Coins,   label: "Earn real rewards for your time" },
];

/* ─── Why People Are Joining ─────────────────────────── */
const whyJoin = [
  {
    title: "Easy to Start",
    description: "Sign up and begin in minutes — no experience required.",
  },
  {
    title: "Simple Daily Tasks",
    description: "Tasks take just a few minutes per day and are easy to understand.",
  },
  {
    title: "Earn Consistently",
    description: "The more active you are, the more you earn.",
  },
  {
    title: "Work From Anywhere",
    description: "All you need is your phone or computer and internet access.",
  },
  {
    title: "Grow Your Income",
    description: "Earn even more by inviting others and building a team.",
  },
];

/* ─── Built for Sustainability ───────────────────────── */
const sustainabilityPoints = [
  { icon: TrendingUp, label: "The system remains stable" },
  { icon: Users,      label: "Active users are rewarded fairly" },
  { icon: Globe,      label: "Growth benefits everyone involved" },
];

const AboutSection = () => {
  return (
    <section id="about" className="section-padding relative overflow-hidden">
      {/* Subtle background gradient layer */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-card/30 to-background pointer-events-none" />
      <div className="hero-glow top-1/2 right-0 translate-x-1/2 -translate-y-1/2 opacity-40" />

      <div className="container-custom relative z-10 space-y-24">

        {/* ── SECTION 1: What We Do ─────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left — text */}
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                💡 What We Do
              </span>
            </div>

            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
              ProfitChips is a platform{" "}
              <span className="text-gradient">where you can:</span>
            </h2>

            <ul className="space-y-4 mb-8">
              {whatWeDo.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-4 group">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-foreground/90 text-base font-medium">{label}</span>
                </li>
              ))}
            </ul>

            {/* Tagline card */}
            <div className="glass-card p-5 border-l-4 border-l-primary">
              <p className="text-muted-foreground text-sm leading-relaxed">
                No complex skills needed.{" "}No long hours.{" "}
                <span className="text-foreground font-semibold">
                  Just simple tasks + real earnings.
                </span>
              </p>
            </div>
          </div>

          {/* Right — decorative stat cards */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { value: "100%", label: "Remote", sub: "Work from anywhere" },
              { value: "Daily", label: "Tasks", sub: "Fresh tasks every day" },
              { value: "Fast", label: "Payouts", sub: "Reliable withdrawals" },
              { value: "0", label: "Experience Needed", sub: "Anyone can join" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="group p-6 rounded-2xl bg-card/40 border border-border/50 hover:bg-card/80 hover:border-primary/30 transition-all duration-300 text-center"
              >
                <div className="text-3xl font-extrabold text-gradient mb-1">{stat.value}</div>
                <div className="text-foreground font-semibold text-sm mb-1">{stat.label}</div>
                <div className="text-muted-foreground text-xs">{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Divider ───────────────────────────────────────── */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* ── SECTION 2: Why People Are Joining ─────────────── */}
        <div>
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                🚀 Why People Are Joining
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Why People Are Joining{" "}
              <span className="text-gradient">ProfitChips</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {whyJoin.map((item, i) => (
              <div
                key={item.title}
                className="group relative p-6 rounded-2xl bg-card/40 border border-border/50 hover:bg-card/80 hover:border-primary/30 transition-all duration-300 overflow-hidden"
              >
                {/* Faint step number watermark */}
                <span className="absolute -top-2 -right-2 text-6xl font-black text-primary/5 select-none">
                  {String(i + 1).padStart(2, "0")}
                </span>

                <div className="flex items-start gap-4">
                  <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform duration-300" />
                  <div>
                    <h3 className="text-foreground font-bold text-base mb-1">{item.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Divider ───────────────────────────────────────── */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* ── SECTION 3: Our Vision + Built for Sustainability ─ */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">

          {/* Vision */}
          <div>
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                🌍 Our Vision
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6 leading-tight">
              A <span className="text-gradient">Global Community</span> Earning Together
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed mb-4">
              We believe that{" "}
              <span className="text-foreground font-semibold">anyone, anywhere</span>{" "}
              should have access to online earning opportunities.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              ProfitChips is not just a platform — it's a{" "}
              <span className="text-foreground font-semibold">global community</span> of
              people earning, learning, and growing together while contributing to the
              future of AI.
            </p>

            {/* Globe visual accent */}
            <div className="mt-8 flex items-center gap-4">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Globe className="w-7 h-7 text-primary" />
              </div>
              <div>
                <div className="text-foreground font-bold">Open Worldwide</div>
                <div className="text-muted-foreground text-sm">Available in every country</div>
              </div>
            </div>
          </div>

          {/* Built for Sustainability */}
          <div>
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                🔒 Built for Sustainability
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
              A <span className="text-gradient">Revenue-Sharing</span> Model That Works
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-8">
              Our platform operates on a{" "}
              <span className="text-foreground font-semibold">revenue-sharing model</span>,
              ensuring that:
            </p>

            <div className="space-y-4">
              {sustainabilityPoints.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-4 p-4 rounded-xl bg-card/40 border border-border/50 hover:border-primary/30 hover:bg-card/70 transition-all duration-300 group"
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-foreground/90 font-medium">{label}</span>
                </div>
              ))}
            </div>

            {/* Lock accent card */}
            <div className="glass-card p-5 mt-6 border-l-4 border-l-primary">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-primary flex-shrink-0" />
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Stable, fair, and built to grow with you — every step of the way.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default AboutSection;
