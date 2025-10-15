import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { toast } from "sonner";
import { ArrowLeft, Wallet, RefreshCw, Key, Activity } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function UserDetail() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [walletType, setWalletType] = useState<"deposit" | "earnings">("deposit");
  const [actionType, setActionType] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const [editedProfile, setEditedProfile] = useState<any>({});

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (isAdmin && userId) {
      loadUserData();
    }
  }, [isAdmin, userId]);

  const loadUserData = async () => {
    setLoading(true);
    try {
      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);
      setEditedProfile(profileData);

      // Load transactions
      const { data: transactionsData } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      setTransactions(transactionsData || []);

      // Load referrals
      const { data: referralsData } = await supabase
        .from("profiles")
        .select("username, email, created_at, membership_plan")
        .eq("referred_by", userId);
      setReferrals(referralsData || []);

      // Load audit logs for this user
      const { data: auditData } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("target_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      setAuditLogs(auditData || []);

    } catch (error) {
      console.error("Error loading user data:", error);
      toast.error("Failed to load user data");
    } finally {
      setLoading(false);
    }
  };

  const handleWalletAdjustment = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!reason.trim()) {
      toast.error("Please provide a reason");
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("adjust-wallet-balance", {
        body: {
          userId,
          walletType,
          amount: parseFloat(amount),
          reason,
          actionType,
        },
      });

      if (error) throw error;

      toast.success(`Wallet ${actionType}ed successfully`);
      setWalletDialogOpen(false);
      setAmount("");
      setReason("");
      loadUserData();
    } catch (error: any) {
      toast.error(error.message || "Failed to adjust wallet");
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateProfile = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke("update-user-profile", {
        body: {
          userId,
          updates: {
            full_name: editedProfile.full_name,
            phone: editedProfile.phone,
            country: editedProfile.country,
            membership_plan: editedProfile.membership_plan,
            account_status: editedProfile.account_status,
          },
        },
      });

      if (error) throw error;

      toast.success("Profile updated successfully");
      loadUserData();
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setProcessing(false);
    }
  };

  const handleResetDailyLimits = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke("reset-daily-limits", {
        body: { userId },
      });

      if (error) throw error;

      toast.success("Daily limits reset successfully");
      loadUserData();
    } catch (error: any) {
      toast.error(error.message || "Failed to reset limits");
    } finally {
      setProcessing(false);
    }
  };

  const handleGenerateMasterLogin = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-master-login", {
        body: { userId },
      });

      if (error) throw error;

      const loginUrl = `${window.location.origin}/master-login?token=${data.token}`;
      
      // Copy to clipboard
      await navigator.clipboard.writeText(loginUrl);
      toast.success("Master login URL copied to clipboard! Valid for 15 minutes.");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate master login");
    } finally {
      setProcessing(false);
    }
  };

  if (authLoading || adminLoading || loading || !profile) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-[hsl(0,0%,98%)] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/admin/users")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Users
            </Button>
            <h1 className="text-3xl font-bold">{profile.username}</h1>
            <Badge
              variant={
                profile.account_status === "active"
                  ? "default"
                  : profile.account_status === "suspended"
                  ? "secondary"
                  : "destructive"
              }
            >
              {profile.account_status}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleGenerateMasterLogin}
              disabled={processing}
            >
              <Key className="h-4 w-4 mr-2" />
              Master Login
            </Button>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="wallet">Wallet</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="referrals">Referrals</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Username (Read-only)</Label>
                    <Input value={profile.username} disabled />
                  </div>
                  <div>
                    <Label>Email (Read-only)</Label>
                    <Input value={profile.email} disabled />
                  </div>
                  <div>
                    <Label>Full Name</Label>
                    <Input
                      value={editedProfile.full_name || ""}
                      onChange={(e) =>
                        setEditedProfile({ ...editedProfile, full_name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={editedProfile.phone || ""}
                      onChange={(e) =>
                        setEditedProfile({ ...editedProfile, phone: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Country</Label>
                    <Input
                      value={editedProfile.country || ""}
                      onChange={(e) =>
                        setEditedProfile({ ...editedProfile, country: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Membership Plan</Label>
                    <Select
                      value={editedProfile.membership_plan}
                      onValueChange={(value) =>
                        setEditedProfile({ ...editedProfile, membership_plan: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                        <SelectItem value="vip">VIP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Account Status</Label>
                    <Select
                      value={editedProfile.account_status}
                      onValueChange={(value) =>
                        setEditedProfile({ ...editedProfile, account_status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="banned">Banned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Referral Code</Label>
                    <Input value={profile.referral_code} disabled />
                  </div>
                  <div>
                    <Label>Tasks Completed Today</Label>
                    <div className="flex gap-2">
                      <Input value={profile.tasks_completed_today} disabled />
                      <Button
                        variant="outline"
                        onClick={handleResetDailyLimits}
                        disabled={processing}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>Skips Today</Label>
                    <Input value={profile.skips_today} disabled />
                  </div>
                  <div>
                    <Label>Member Since</Label>
                    <Input
                      value={new Date(profile.created_at).toLocaleDateString()}
                      disabled
                    />
                  </div>
                </div>
                <Button onClick={handleUpdateProfile} disabled={processing}>
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wallet">
            <Card>
              <CardHeader>
                <CardTitle>Wallet Balances</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Deposit Wallet</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        ${parseFloat(profile.deposit_wallet_balance).toFixed(2)}
                      </div>
                      <Button
                        className="mt-4 w-full"
                        onClick={() => {
                          setWalletType("deposit");
                          setWalletDialogOpen(true);
                        }}
                      >
                        <Wallet className="h-4 w-4 mr-2" />
                        Adjust Balance
                      </Button>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Earnings Wallet</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        ${parseFloat(profile.earnings_wallet_balance).toFixed(2)}
                      </div>
                      <Button
                        className="mt-4 w-full"
                        onClick={() => {
                          setWalletType("earnings");
                          setWalletDialogOpen(true);
                        }}
                      >
                        <Wallet className="h-4 w-4 mr-2" />
                        Adjust Balance
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Wallet</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          {new Date(tx.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>{tx.type}</TableCell>
                        <TableCell>{tx.wallet_type}</TableCell>
                        <TableCell>${parseFloat(tx.amount).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={tx.status === "completed" ? "default" : "secondary"}>
                            {tx.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{tx.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="referrals">
            <Card>
              <CardHeader>
                <CardTitle>Referrals ({referrals.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrals.map((ref, i) => (
                      <TableRow key={i}>
                        <TableCell>{ref.username}</TableCell>
                        <TableCell>{ref.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{ref.membership_plan}</Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(ref.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle>Audit Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>{log.action_type}</TableCell>
                        <TableCell>
                          <pre className="text-xs">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust {walletType === "deposit" ? "Deposit" : "Earnings"} Wallet</DialogTitle>
            <DialogDescription>
              Current balance: ${parseFloat(
                walletType === "deposit"
                  ? profile.deposit_wallet_balance
                  : profile.earnings_wallet_balance
              ).toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Action</Label>
              <Select value={actionType} onValueChange={(v: any) => setActionType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Credit (Add)</SelectItem>
                  <SelectItem value="debit">Debit (Subtract)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Reason</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for adjustment"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWalletDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleWalletAdjustment} disabled={processing}>
              {processing ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}