import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Home, 
  Zap, 
  Wallet, 
  Users, 
  Crown, 
  Settings, 
  Sparkles,
  DollarSign,
  TrendingUp,
  UserPlus,
  LogOut,
  History
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { WalletCard } from "@/components/wallet/WalletCard";

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user?.id)
      .maybeSingle();
    
    if (data) {
      setProfile(data);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))] flex flex-col">
        <div className="p-6 border-b border-[hsl(var(--sidebar-border))]">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-[hsl(var(--wallet-deposit))]" />
            <span className="text-xl font-bold">FineEarn</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-fg))]">
            <Home className="h-5 w-5" />
            <span>Dashboard</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[hsl(var(--sidebar-accent))] transition-colors">
            <Zap className="h-5 w-5" />
            <span>Tasks</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[hsl(var(--sidebar-accent))] transition-colors">
            <Wallet className="h-5 w-5" />
            <span>Wallet</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[hsl(var(--sidebar-accent))] transition-colors">
            <Users className="h-5 w-5" />
            <span>Referrals</span>
          </a>
          <button 
            onClick={() => navigate("/plans")}
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[hsl(var(--sidebar-accent))] transition-colors w-full text-left"
          >
            <Crown className="h-5 w-5" />
            <span>Membership</span>
          </button>
          <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[hsl(var(--sidebar-accent))] transition-colors">
            <Settings className="h-5 w-5" />
            <span>Settings</span>
          </a>
        </nav>

        <div className="p-4 border-t border-[hsl(var(--sidebar-border))]">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] flex items-center justify-center text-white text-sm font-bold">
              {profile.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile.username}</p>
              <p className="text-xs text-[hsl(var(--sidebar-fg))]/60 capitalize">{profile.membership_plan} Plan</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full mt-2 text-xs text-[hsl(var(--sidebar-fg))]/60 hover:text-[hsl(var(--sidebar-fg))]"
            onClick={signOut}
          >
            <LogOut className="h-3 w-3 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-card border-b px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Welcome back, {profile.username}!</h1>
              <p className="text-muted-foreground">Manage your account and track your progress.</p>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => navigate("/plans")}
              >
                <Crown className="h-4 w-4" />
                Membership
                <span className="text-xs bg-[hsl(var(--wallet-referrals))]/10 text-[hsl(var(--wallet-referrals))] px-2 py-0.5 rounded-full capitalize">
                  {profile.membership_plan}
                </span>
              </Button>
              <Button 
                className="gap-2 bg-gradient-to-r from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] text-white hover:opacity-90"
                onClick={() => navigate("/plans")}
              >
                <Sparkles className="h-4 w-4" />
                Upgrade Account
              </Button>
              <Button variant="outline" className="gap-2">
                <DollarSign className="h-4 w-4" />
                Manage Wallet
              </Button>
            </div>
          </div>
        </header>

        {/* Info Alert */}
        <div className="mx-8 mt-6">
          <Card className="p-4 bg-[hsl(var(--wallet-earnings))]/5 border-[hsl(var(--wallet-earnings))]/20">
            <div className="flex gap-3">
              <div className="h-5 w-5 rounded-full bg-[hsl(var(--wallet-earnings))]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="h-3 w-3 text-[hsl(var(--wallet-earnings))]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-[hsl(var(--wallet-earnings))] mb-1">What is FineEarn?</h3>
                <p className="text-sm text-foreground/80 mb-2">
                  FineEarn is an AI training platform that allows you and your team to earn online by training AI. You mainly earn in 2 ways:
                </p>
                <ol className="text-sm text-foreground/80 space-y-1 ml-4 list-decimal">
                  <li>You earn from the AI Training tasks you do yourself. The tasks are simple as long as you understand English and only take 30 to 40 minutes daily.</li>
                  <li>You also earn a commission from every AI task completed by people you invite if you have an upgraded account.</li>
                </ol>
                <p className="text-sm text-foreground/80 mt-2">
                  This allows you to earn yourself and also to create a team and employ people under you.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-6 p-8">
          <WalletCard 
            type="deposit"
            balance={profile.deposit_wallet_balance}
            subtitle="For account upgrades"
          />

          <WalletCard 
            type="earnings"
            balance={profile.earnings_wallet_balance}
            subtitle="From tasks & referrals"
          />

          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Tasks Today</p>
                <p className="text-3xl font-bold">{profile.tasks_completed_today}</p>
                <p className="text-xs text-muted-foreground mt-1">0 total completed</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-[hsl(var(--wallet-tasks))]/10 flex items-center justify-center">
                <Zap className="h-6 w-6 text-[hsl(var(--wallet-tasks))]" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Referrals</p>
                <p className="text-3xl font-bold">0</p>
                <p className="text-xs text-muted-foreground mt-1">$0.00 earned</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-[hsl(var(--wallet-referrals))]/10 flex items-center justify-center">
                <UserPlus className="h-6 w-6 text-[hsl(var(--wallet-referrals))]" />
              </div>
            </div>
          </Card>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-3 gap-6 px-8 pb-8">
          {/* Today's Progress */}
          <Card className="col-span-2 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                <h2 className="font-semibold">Today's Progress</h2>
              </div>
              <Button size="sm" className="bg-[hsl(var(--wallet-tasks))] text-white hover:opacity-90">
                Start Tasks
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Keep up the great work!</p>
                <p className="text-sm text-muted-foreground">
                  Complete AI training tasks to earn money and help improve artificial intelligence
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Daily Progress</span>
                  <span className="font-medium">{profile.tasks_completed_today}/10 tasks</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))]"
                    style={{ width: `${(profile.tasks_completed_today / 10) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="p-6">
            <h2 className="font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Zap className="h-4 w-4 text-[hsl(var(--wallet-tasks))]" />
                Start AI Tasks
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={() => navigate("/transactions")}
              >
                <History className="h-4 w-4 text-[hsl(var(--wallet-earnings))]" />
                Transaction History
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <UserPlus className="h-4 w-4 text-[hsl(var(--wallet-referrals))]" />
                Invite Friends
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={() => navigate("/plans")}
              >
                <Crown className="h-4 w-4 text-[hsl(var(--wallet-deposit))]" />
                Upgrade Plan
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
