import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, X, Percent, Save, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface VipCommissionCardProps {
  userId: string;
  username: string;
  /** The current vip_deposit_commission_rate from profiles (null = not a VIP) */
  currentRate: number | null;
  onSuccess: () => void;
}

export const VipCommissionCard = ({
  userId,
  username,
  currentRate,
  onSuccess,
}: VipCommissionCardProps) => {
  const { toast } = useToast();
  const [rateInput, setRateInput] = useState<string>(
    currentRate !== null ? (currentRate * 100).toFixed(2) : ""
  );
  const [editing, setEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isVip = currentRate !== null && currentRate > 0;

  // Sync input whenever the currentRate prop changes (after successful save + query refetch)
  useEffect(() => {
    if (!editing) {
      setRateInput(currentRate !== null ? (currentRate * 100).toFixed(2) : "");
    }
  }, [currentRate, editing]);

  const callSetVipCommission = async (rate: number | null) => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "set_vip_commission", userId, vipData: { rate } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: rate === null ? "VIP commission removed" : "VIP commission updated",
        description:
          rate === null
            ? `VIP commission has been removed for ${username}.`
            : `VIP commission set to ${(rate * 100).toFixed(2)}% for ${username}.`,
      });
      setEditing(false);
      onSuccess();
    } catch (err: any) {
      toast({
        title: "Failed to update VIP commission",
        description: err.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    const pct = parseFloat(rateInput);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast({
        title: "Invalid rate",
        description: "Please enter a value between 0 and 100.",
        variant: "destructive",
      });
      return;
    }
    await callSetVipCommission(pct / 100);
  };

  const handleRemove = async () => {
    await callSetVipCommission(null);
    setRateInput("");
  };

  return (
    <Card className={isVip ? "border-yellow-400/60 bg-yellow-50/5" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className={`h-5 w-5 ${isVip ? "text-yellow-500" : "text-muted-foreground"}`} />
            VIP Deposit Commission
          </CardTitle>
          {isVip ? (
            <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-400/50 gap-1">
              <Sparkles className="h-3 w-3" />
              VIP Active — {(currentRate! * 100).toFixed(2)}%
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Not a VIP
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {isVip
            ? `${username} earns ${(currentRate! * 100).toFixed(2)}% on every deposit made by their referred users. This overrides the plan-level rate.`
            : `Grant ${username} a personalised deposit commission rate. When enabled, they earn this % instantly whenever a referred user deposits.`}
        </p>

        {editing ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-[160px]">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  placeholder="e.g. 10"
                  className="pr-8"
                  disabled={isSaving}
                />
                <Percent className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
              <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1.5">
                <Save className="h-4 w-4" />
                {isSaving ? "Saving…" : "Save"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={isSaving}
                onClick={() => {
                  setEditing(false);
                  setRateInput(currentRate !== null ? (currentRate * 100).toFixed(2) : "");
                }}
              >
                Cancel
              </Button>
            </div>
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>Enter a value between 0 and 100. Setting to 0 will disable VIP status.</span>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant={isVip ? "outline" : "default"}
              onClick={() => setEditing(true)}
              className="gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              {isVip ? "Change Rate" : "Enable VIP Commission"}
            </Button>
            {isVip && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={handleRemove}
                disabled={isSaving}
              >
                <X className="h-4 w-4" />
                {isSaving ? "Removing…" : "Remove VIP"}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
