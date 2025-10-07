import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Sparkles, Wallet, Users, TrendingUp, Shield, Zap } from "lucide-react";

const Landing = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-[hsl(var(--wallet-deposit))]" />
            <span className="text-xl font-bold">FineEarn</span>
          </div>
          <div className="flex gap-3">
            <Link to="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link to="/signup">
              <Button className="bg-gradient-to-r from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] text-white hover:opacity-90">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--wallet-deposit))]/10 border border-[hsl(var(--wallet-deposit))]/20 text-sm font-medium text-[hsl(var(--wallet-deposit))]">
            <Zap className="h-4 w-4" />
            Earn While Training AI
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Turn Your Time Into{" "}
            <span className="bg-gradient-to-r from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] bg-clip-text text-transparent">
              Real Income
            </span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Complete simple AI training tasks and earn money. No special skills required. 
            Work at your own pace, from anywhere in the world.
          </p>
          
          <div className="flex gap-4 justify-center pt-4">
            <Link to="/signup">
              <Button size="lg" className="bg-gradient-to-r from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] text-white hover:opacity-90">
                Start Earning Now
              </Button>
            </Link>
            <Button size="lg" variant="outline">
              Learn More
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 pt-12 max-w-2xl mx-auto">
            <div>
              <div className="text-3xl font-bold text-[hsl(var(--wallet-tasks))]">1M+</div>
              <div className="text-sm text-muted-foreground">Active Users</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[hsl(var(--wallet-earnings))]">$5M+</div>
              <div className="text-sm text-muted-foreground">Paid Out</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[hsl(var(--wallet-referrals))]">50M+</div>
              <div className="text-sm text-muted-foreground">Tasks Completed</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">How FineEarn Works</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Three simple steps to start earning money online
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card className="p-6 space-y-4 border-2 hover:border-[hsl(var(--wallet-deposit))] transition-all hover:shadow-lg">
            <div className="h-12 w-12 rounded-xl bg-[hsl(var(--wallet-deposit))]/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-[hsl(var(--wallet-deposit))]" />
            </div>
            <h3 className="text-xl font-semibold">1. Sign Up Free</h3>
            <p className="text-muted-foreground">
              Create your account in seconds. No credit card required to start earning.
            </p>
          </Card>

          <Card className="p-6 space-y-4 border-2 hover:border-[hsl(var(--wallet-earnings))] transition-all hover:shadow-lg">
            <div className="h-12 w-12 rounded-xl bg-[hsl(var(--wallet-earnings))]/10 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-[hsl(var(--wallet-earnings))]" />
            </div>
            <h3 className="text-xl font-semibold">2. Complete Tasks</h3>
            <p className="text-muted-foreground">
              Choose between AI responses. Simple tasks that take 30-40 minutes daily.
            </p>
          </Card>

          <Card className="p-6 space-y-4 border-2 hover:border-[hsl(var(--wallet-tasks))] transition-all hover:shadow-lg">
            <div className="h-12 w-12 rounded-xl bg-[hsl(var(--wallet-tasks))]/10 flex items-center justify-center">
              <Wallet className="h-6 w-6 text-[hsl(var(--wallet-tasks))]" />
            </div>
            <h3 className="text-xl font-semibold">3. Get Paid</h3>
            <p className="text-muted-foreground">
              Withdraw your earnings via crypto. Fast, secure, and reliable payments.
            </p>
          </Card>
        </div>
      </section>

      {/* Benefits */}
      <section className="container mx-auto px-4 py-20 bg-muted/30">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Why Choose FineEarn?</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Join thousands of users earning money by helping train AI
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className="flex gap-4 items-start">
            <div className="h-10 w-10 rounded-lg bg-[hsl(var(--wallet-earnings))]/10 flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-[hsl(var(--wallet-earnings))]" />
            </div>
            <div>
              <h3 className="font-semibold mb-2">Secure & Transparent</h3>
              <p className="text-sm text-muted-foreground">
                Your earnings are protected. Track every transaction in real-time.
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="h-10 w-10 rounded-lg bg-[hsl(var(--wallet-referrals))]/10 flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5 text-[hsl(var(--wallet-referrals))]" />
            </div>
            <div>
              <h3 className="font-semibold mb-2">Referral Program</h3>
              <p className="text-sm text-muted-foreground">
                Earn commission from your referrals' tasks and deposits.
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="h-10 w-10 rounded-lg bg-[hsl(var(--wallet-tasks))]/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-5 w-5 text-[hsl(var(--wallet-tasks))]" />
            </div>
            <div>
              <h3 className="font-semibold mb-2">Flexible Plans</h3>
              <p className="text-sm text-muted-foreground">
                Upgrade anytime to unlock higher earnings and more daily tasks.
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="h-10 w-10 rounded-lg bg-[hsl(var(--wallet-deposit))]/10 flex items-center justify-center flex-shrink-0">
              <Zap className="h-5 w-5 text-[hsl(var(--wallet-deposit))]" />
            </div>
            <div>
              <h3 className="font-semibold mb-2">No Experience Needed</h3>
              <p className="text-sm text-muted-foreground">
                Anyone can start earning. Simple tasks require only basic comprehension.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20">
        <Card className="p-12 text-center bg-gradient-to-r from-[hsl(var(--wallet-deposit))]/10 to-[hsl(var(--wallet-tasks))]/10 border-2">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Earning?</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join FineEarn today and start making money by training AI. 
            No commitments, cancel anytime.
          </p>
          <Link to="/signup">
            <Button size="lg" className="bg-gradient-to-r from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] text-white hover:opacity-90">
              Create Free Account
            </Button>
          </Link>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[hsl(var(--wallet-deposit))]" />
              <span className="font-semibold">FineEarn</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 FineEarn. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">About</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
