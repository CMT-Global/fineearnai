import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import { PageLoading } from "@/components/shared/PageLoading";
import { toast } from "sonner";
import TaskAnalytics2Opt from "./TaskAnalytics";
import TaskAnalytics4Opt from "./TaskAnalytics4";

type TaskOptionMode = "2opt" | "4opt";

const TaskAnalyticsUnified = () => {
  const { t } = useTranslation();
  useLanguageSync();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const mode: TaskOptionMode = searchParams.get("mode") === "4opt" ? "4opt" : "2opt";

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      toast.error(t("toasts.admin.accessDenied"));
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate, t]);

  const setMode = (m: TaskOptionMode) => {
    if (m === "4opt") {
      searchParams.set("mode", "4opt");
      setSearchParams(searchParams, { replace: true });
    } else {
      searchParams.delete("mode");
      setSearchParams(searchParams, { replace: true });
    }
  };

  if (adminLoading) {
    return <PageLoading text={t("admin.taskAnalytics.loading")} />;
  }
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("admin.taskAnalytics.backToAdmin")}
          </Button>
          <h1 className="text-3xl font-bold mb-2">{t("admin.taskAnalytics.title")}</h1>
          <p className="text-muted-foreground mb-4">
            {t("admin.taskAnalytics.subtitle")}
          </p>
          <Tabs value={mode} onValueChange={(v) => setMode(v as TaskOptionMode)}>
            <TabsList className="grid w-full max-w-xs grid-cols-2">
              <TabsTrigger value="2opt">2 options (A/B)</TabsTrigger>
              <TabsTrigger value="4opt">4 options (A/B/C/D)</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {mode === "4opt" ? (
          <TaskAnalytics4Opt embedded />
        ) : (
          <TaskAnalytics2Opt embedded />
        )}
      </div>
    </div>
  );
};

export default TaskAnalyticsUnified;
