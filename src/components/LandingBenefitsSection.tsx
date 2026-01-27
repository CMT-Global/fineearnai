import { 
    Clock, 
    MapPin, 
    DollarSign, 
    Wallet, 
    BookOpen, 
    Sparkles 
  } from "lucide-react";
  
  const benefits = [
    {
      icon: Clock,
      title: "Flexible Hours",
      description: "Work at any time of the day as long as you complete your weekly targets. Perfect for any schedule.",
    },
    {
      icon: MapPin,
      title: "Work From Anywhere",
      description: "Whether you're on a beach or at home with family, you can mold your work around your life.",
    },
    {
      icon: DollarSign,
      title: "Competitive Pay",
      description: "We believe in fair compensation for the work you do, reflected in above-market rates.",
    },
    {
      icon: Wallet,
      title: "Quick Payments",
      description: "Withdraw earnings easily using PayPal, Payoneer, Airtm, bank transfer, and more.",
    },
    {
      icon: BookOpen,
      title: "User-Friendly Guides",
      description: "Access comprehensive study materials and practice quizzes to boost your success rate.",
    },
    {
      icon: Sparkles,
      title: "Work in AI",
      description: "Get into AI work right away, even without technical experience. Build in-demand skills.",
    },
  ];
  
  export default function LandingBenefitsSection() {
    return (
      <section id="benefits" className="section-padding relative">
        <div className="container-custom">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left Content */}
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Why Choose <span className="text-gradient">ProfitChips</span>?
              </h2>
              <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                We are committed to providing a fair, supportive, and healthy environment 
                where everyone can succeed and grow with AI.
              </p>
              
              {/* Highlight Box */}
              <div className="glass-card p-6 border-l-4 border-l-primary">
                <h3 className="text-xl font-bold text-foreground mb-3">
                  #AIForGood — Your Voice Matters
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  AI has the power to solve some of the world's biggest challenges when developed 
                  ethically and responsibly. Your work ensures that voices from different places, 
                  backgrounds, and beliefs are represented in AI models.
                </p>
              </div>
            </div>
  
            {/* Right Grid */}
            <div className="grid sm:grid-cols-2 gap-4">
              {benefits.map((benefit, index) => (
                <div
                  key={benefit.title}
                  className="group p-6 rounded-2xl bg-card/40 border border-border/50 hover:bg-card/80 hover:border-primary/30 transition-all duration-300"
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <benefit.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }
  