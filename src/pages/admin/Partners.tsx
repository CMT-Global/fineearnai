import { useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePartners, usePartnerStats } from "@/hooks/usePartnerManagement";
import { Loader2, Users, DollarSign, TrendingUp, Award, ExternalLink } from "lucide-react";
import { formatCurrency } from "@/lib/wallet-utils";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const Partners = () => {
  const { t, i18n: i18nInstance } = useTranslation();
  const { userLanguage, isLoading: isLanguageLoading } = useLanguage();
  const navigate = useNavigate();
  const { data: partners, isLoading } = usePartners();
  const { data: stats } = usePartnerStats();
  
  // Force re-render when language changes
  useEffect(() => {
    // Ensure i18n language is synced with userLanguage from context
    if (i18nInstance.language !== userLanguage && !isLanguageLoading) {
      i18nInstance.changeLanguage(userLanguage).catch((err) => {
        console.error('Error changing i18n language:', err);
      });
    }
  }, [userLanguage, isLanguageLoading, i18nInstance]);

  const getRankBadge = (rank: string) => {
    const colors: Record<string, string> = {
      bronze: "bg-orange-500",
      silver: "bg-gray-400",
      gold: "bg-yellow-500",
      platinum: "bg-purple-500",
    };

    return (
      <Badge className={`${colors[rank] || colors.bronze} text-white`}>
        <Award className="h-3 w-3 mr-1" />
        {rank.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Users className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">{t("admin.partners.title")}</h1>
        </div>
        <p className="text-muted-foreground">
          {t("admin.partners.subtitle")}
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("admin.partners.stats.activePartners")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{stats?.totalPartners || 0}</div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("admin.partners.stats.vouchersSold")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{stats?.totalVouchersSold || 0}</div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("admin.partners.stats.totalSalesValue")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {formatCurrency(stats?.totalVoucherValue || 0)}
              </div>
              <DollarSign className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("admin.partners.stats.pendingApplications")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{stats?.pendingApplications || 0}</div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/admin/partners/applications')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Partners Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.partners.allPartners")}</CardTitle>
          <CardDescription>{t("admin.partners.viewPerformance")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : partners && partners.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.partners.table.partner")}</TableHead>
                  <TableHead>{t("admin.partners.table.email")}</TableHead>
                  <TableHead>{t("admin.partners.table.rank")}</TableHead>
                  <TableHead>{t("admin.partners.table.commissionRate")}</TableHead>
                  <TableHead className="text-right">{t("admin.partners.table.dailySales")}</TableHead>
                  <TableHead className="text-right">{t("admin.partners.table.weeklySales")}</TableHead>
                  <TableHead className="text-right">{t("admin.partners.table.totalSales")}</TableHead>
                  <TableHead>{t("admin.partners.table.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((partner: any) => (
                  <TableRow key={partner.user_id}>
                    <TableCell className="font-medium">
                      {partner.profiles?.username || t("admin.partners.unknown")}
                    </TableCell>
                    <TableCell>{partner.profiles?.email}</TableCell>
                    <TableCell>{getRankBadge(partner.current_rank)}</TableCell>
                    <TableCell>
                      {partner.use_global_commission ? (
                        <span className="text-muted-foreground">{t("admin.partners.default")}</span>
                      ) : (
                        <span className="font-medium">
                          {(partner.commission_rate * 100).toFixed(1)}%
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(partner.daily_sales_amount || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(partner.weekly_sales_amount || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(partner.total_sales_amount || 0)}
                    </TableCell>
                    <TableCell>
                      {partner.is_active ? (
                        <Badge variant="default">{t("admin.partners.active")}</Badge>
                      ) : (
                        <Badge variant="secondary">{t("admin.partners.inactive")}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">{t("admin.partners.noPartnersFound")}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Partners;
