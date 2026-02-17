import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import { PageLoading } from "@/components/shared/PageLoading";
import AITasksManage from "./AITasksManage";
import AITasksManage4 from "./AITasksManage4";

type TaskOptionMode = "2opt" | "4opt";

const AITasksManageUnified = () => {
  const { t } = useTranslation();
  useLanguageSync();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const mode: TaskOptionMode = searchParams.get("mode") === "4opt" ? "4opt" : "2opt";

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate("/");
    }
  }, [isAdmin, adminLoading, navigate]);

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
    return <PageLoading text={t("admin.aiTasksManage.loading")} />;
  }
  if (!isAdmin) return null;

  const generateHref = mode === "4opt" ? "/admin/tasks/generate?mode=4opt" : "/admin/tasks/generate";

  return (
    <div className="p-6">
      <div className="container-custom">
        <AdminBreadcrumb
          items={[
            { label: t("admin.sidebar.categories.taskManagement") },
            { label: t("admin.sidebar.items.manageAITasks") },
          ]}
        />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">{t("admin.aiTasksManage.title")}</h1>
            <p className="text-muted-foreground mt-1">
              View and manage your 2-option or 4-option AI tasks
            </p>
            <Tabs value={mode} onValueChange={(v) => setMode(v as TaskOptionMode)} className="mt-4">
              <TabsList className="grid w-full max-w-xs grid-cols-2">
                <TabsTrigger value="2opt">2 options (A/B)</TabsTrigger>
                <TabsTrigger value="4opt">4 options (A/B/C/D)</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <Button onClick={() => navigate(generateHref)}>
            <Plus className="h-4 w-4 mr-2" />
            {t("admin.aiTasksManage.generateTasks")}
          </Button>
        </div>
        {mode === "4opt" ? <AITasksManage4 embedded /> : <AITasksManage embedded />}
      </div>
    </div>
  );
};

export default AITasksManageUnified;
