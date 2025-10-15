import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

const TASK_CATEGORIES = [
  "Sentiment Analysis",
  "Hotel Review Sentiment",
  "Product Review Sentiment",
  "Business Review Sentiment",
  "Social Media Sentiment",
  "Customer Feedback Sentiment",
  "Fact Checking",
  "Tone Analysis",
  "Grammar Correction",
  "Summarization",
  "Translation",
];

const DIFFICULTY_LEVELS = ["easy", "medium", "hard"];

const AITasksGenerate = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [quantity, setQuantity] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    navigate("/");
    return null;
  }

  const handleGenerate = async () => {
    if (!category || !difficulty) {
      toast.error("Please select category and difficulty");
      return;
    }

    if (quantity < 1 || quantity > 25) {
      toast.error("Quantity must be between 1 and 25");
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-ai-tasks", {
        body: { category, difficulty, quantity },
      });

      if (error) throw error;

      toast.success(`Successfully generated ${data.tasksCreated} tasks!`);
      navigate("/admin/tasks/manage");
    } catch (error: any) {
      console.error("Error generating tasks:", error);
      toast.error(error.message || "Failed to generate tasks");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <AdminBreadcrumb 
          items={[
            { label: "Task Management" },
            { label: "Generate AI Tasks" }
          ]} 
        />
        
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Generate AI Tasks</h1>
          <p className="text-muted-foreground mt-1">
            Use AI to automatically generate training tasks
          </p>
        </div>

        <Card className="p-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger id="difficulty">
                  <SelectValue placeholder="Select difficulty" />
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
              <Label htmlFor="quantity">Number of Tasks</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                max={25}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              />
              <p className="text-sm text-muted-foreground">
                Generate between 1 and 25 tasks at once
              </p>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !category || !difficulty}
              className="w-full"
              size="lg"
            >
              <Sparkles className="h-5 w-5 mr-2" />
              {isGenerating ? "Generating..." : "Generate Tasks"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AITasksGenerate;