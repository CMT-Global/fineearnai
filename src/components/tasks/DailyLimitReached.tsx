import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Calendar, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DailyLimitReachedProps {
  tasksCompleted: number;
  dailyLimit: number;
  membershipPlan: string;
  onUpgrade: () => void;
}

export const DailyLimitReached = ({
  tasksCompleted,
  dailyLimit,
  membershipPlan,
  onUpgrade,
}: DailyLimitReachedProps) => {
  const { t } = useTranslation();
  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="text-center space-y-4 pb-4">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          <Trophy className="h-8 w-8 text-primary" />
        </div>
        <div>
          <CardTitle className="text-2xl font-bold">
            {t("tasks.dailyLimit.congratulations")} 🎉
          </CardTitle>
          <CardDescription className="text-base mt-2">
            {t("tasks.dailyLimit.completedAllTasks")}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Stats Display */}
        <div className="bg-card rounded-lg p-4 border">
          <div className="flex items-center justify-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">{t("tasks.stats.todaysProgress")}</span>
          </div>
          <div className="text-center">
            <span className="text-4xl font-bold text-primary">{tasksCompleted}</span>
            <span className="text-2xl text-muted-foreground">/{dailyLimit}</span>
            <p className="text-sm text-muted-foreground mt-1">{t("tasks.dailyLimit.tasksCompleted")}</p>
          </div>
        </div>

        {/* Current Plan Badge */}
        <div className="flex justify-center">
          <Badge variant="outline" className="text-sm px-4 py-2">
            {t("tasks.dailyLimit.currentPlan")}: {membershipPlan.charAt(0).toUpperCase() + membershipPlan.slice(1)}
          </Badge>
        </div>

        {/* Call to Action */}
        <div className="space-y-3">
          <Button 
            onClick={onUpgrade} 
            className="w-full h-12 text-base font-semibold"
            size="lg"
          >
            <TrendingUp className="mr-2 h-5 w-5" />
            {t("tasks.dailyLimit.upgradePlan")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("tasks.dailyLimit.unlockMoreTasks")}
          </p>
        </div>

        {/* Come Back Tomorrow Message */}
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <Calendar className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">{t("tasks.dailyLimit.comeBackTomorrow")}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("tasks.dailyLimit.resetAtMidnight")}
          </p>
        </div>

        {/* Additional Info */}
        <div className="text-center text-xs text-muted-foreground pt-2 border-t">
          {t("tasks.dailyLimit.greatJobToday")}
        </div>
      </CardContent>
    </Card>
  );
};
