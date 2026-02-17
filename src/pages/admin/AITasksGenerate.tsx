import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import { PageLoading } from "@/components/shared/PageLoading";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TASK_CATEGORIES = [
  { value: "Sentiment Analysis", key: "sentiment_analysis" },
  { value: "Hotel Review Sentiment", key: "hotel_review_sentiment" },
  { value: "Product Review Sentiment", key: "product_review_sentiment" },
  { value: "Business Review Sentiment", key: "business_review_sentiment" },
  { value: "Social Media Sentiment", key: "social_media_sentiment" },
  { value: "Customer Feedback Sentiment", key: "customer_feedback_sentiment" },
  { value: "Fact Checking", key: "fact_checking" },
  { value: "Tone Analysis", key: "tone_analysis" },
  { value: "Grammar Correction", key: "grammar_correction" },
  { value: "Summarization", key: "summarization" },
  { value: "Translation", key: "translation" },
];

const DIFFICULTY_LEVELS = ["easy", "medium", "hard"];

export type TaskOptionMode = "2opt" | "4opt";

const AITasksGenerate = () => {
  const { t } = useTranslation();
  useLanguageSync();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [mode, setMode] = useState<TaskOptionMode>(() =>
    searchParams.get("mode") === "4opt" ? "4opt" : "2opt"
  );
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [quantity, setQuantity] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const m = searchParams.get("mode") === "4opt" ? "4opt" : "2opt";
    setMode(m);
  }, [searchParams]);

  const setModeAndUrl = (m: TaskOptionMode) => {
    setMode(m);
    if (m === "4opt") {
      searchParams.set("mode", "4opt");
      setSearchParams(searchParams, { replace: true });
    } else {
      searchParams.delete("mode");
      setSearchParams(searchParams, { replace: true });
    }
  };

  if (adminLoading) {
    return <PageLoading text={t("admin.aiTasksGenerate.loading")} />;
  }

  if (!isAdmin) {
    navigate("/");
    return null;
  }

  const handleGenerate = async () => {
    if (!category || !difficulty) {
      toast.error(t("admin.aiTasksGenerate.errorSelectCategoryAndDifficulty"));
      return;
    }

    if (quantity < 1 || quantity > 25) {
      toast.error(t("admin.aiTasksGenerate.errorQuantityRange"));
      return;
    }

    setIsGenerating(true);

    const edgeFunction = mode === "4opt" ? "generate-ai-tasks-4opt" : "generate-ai-tasks";
    const managePath = mode === "4opt" ? "/admin/tasks/manage?mode=4opt" : "/admin/tasks/manage";

    try {
      const { data, error } = await supabase.functions.invoke(edgeFunction, {
        body: { category, difficulty, quantity },
      });

      if (error) throw error;

      toast.success(t("admin.aiTasksGenerate.successGenerated", { count: data.tasksCreated }));
      navigate(managePath);
    } catch (error: any) {
      console.error("Error generating tasks:", error);
      toast.error(error.message || t("admin.aiTasksGenerate.errorFailedToGenerate"));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <AdminBreadcrumb 
          items={[
            { label: t("admin.sidebar.categories.taskManagement") },
            { label: t("admin.sidebar.items.generateAITasks") }
          ]} 
        />
        
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{t("admin.aiTasksGenerate.title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("admin.aiTasksGenerate.subtitle")}
          </p>
          <Tabs value={mode} onValueChange={(v) => setModeAndUrl(v as TaskOptionMode)} className="mt-4">
            <TabsList className="grid w-full max-w-xs grid-cols-2">
              <TabsTrigger value="2opt">2 options (A/B)</TabsTrigger>
              <TabsTrigger value="4opt">4 options (A/B/C/D)</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Card className="p-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="category">{t("admin.aiTasksGenerate.category")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder={t("admin.aiTasksGenerate.selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {t(`admin.aiTasksGenerate.categories.${cat.key}`, cat.value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="difficulty">{t("admin.aiTasksGenerate.difficulty")}</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger id="difficulty">
                  <SelectValue placeholder={t("admin.aiTasksGenerate.selectDifficulty")} />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTY_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">{t("admin.aiTasksGenerate.numberOfTasks")}</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                max={25}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              />
              <p className="text-sm text-muted-foreground">
                {t("admin.aiTasksGenerate.generateBetween")}
              </p>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !category || !difficulty}
              className="w-full"
              size="lg"
            >
              <Sparkles className="h-5 w-5 mr-2" />
              {isGenerating
                ? t("admin.aiTasksGenerate.generating")
                : mode === "4opt"
                  ? "Generate 4-option tasks"
                  : t("admin.aiTasksGenerate.generateTasks")}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AITasksGenerate;