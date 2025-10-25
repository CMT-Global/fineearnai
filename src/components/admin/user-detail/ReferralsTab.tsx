import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, DollarSign, TrendingUp, Eye } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface ReferralsTabProps {
  userId: string;
  userData: any;
}

export const ReferralsTab = ({ userId, userData }: ReferralsTabProps) => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const limit = 20;

  // Fetch referrals list
  const { data: referralsData, isLoading } = useQuery({
    queryKey: ['admin-user-referrals', userId, page],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: { 
          action: 'get_detailed_user_referrals', 
          userId,
          page,
          limit 
        }
      });

      if (error) throw error;
      return data.result;
    },
    enabled: !!userId,
  });

  if (!userData) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = userData.stats;

  return (
    <div className="space-y-6">
      {/* Referral Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_referrals || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats.active_referrals || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Referral Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(stats.total_referral_earnings || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Commission from referrals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.total_referrals > 0 
                ? ((stats.active_referrals / stats.total_referrals) * 100).toFixed(1)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Active referral rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Referrals List */}
      <Card>
        <CardHeader>
          <CardTitle>Referral Network</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : referralsData?.referrals && referralsData.referrals.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Commission Earned</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referralsData.referrals.map((ref: any) => (
                    <TableRow key={ref.id}>
                      <TableCell className="font-medium">
                        {ref.referred?.username || "-"}
                      </TableCell>
                      <TableCell>{ref.referred?.email || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {ref.referred?.membership_plan || "unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ref.status === 'active' ? 'default' : 'secondary'}>
                          {ref.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        ${(ref.total_commission_earned || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(ref.created_at), "PP")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/users/${ref.referred_id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No referrals yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};