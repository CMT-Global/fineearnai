import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Briefcase } from "lucide-react";

interface PlanTabsProps {
  personalPlans: any[];
  businessPlans: any[];
  renderPlanCards: (plans: any[]) => React.ReactNode;
}

export function PlanTabs({ personalPlans, businessPlans, renderPlanCards }: PlanTabsProps) {
  return (
    <Tabs defaultValue="personal" className="w-full">
      <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
        <TabsTrigger value="personal" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Personal & Free
        </TabsTrigger>
        <TabsTrigger value="business" className="flex items-center gap-2">
          <Briefcase className="h-4 w-4" />
          Business Accounts
        </TabsTrigger>
      </TabsList>

      <TabsContent value="personal" className="space-y-6">
        <div className="text-center max-w-2xl mx-auto mb-6">
          <p className="text-muted-foreground">
            Perfect for individuals who want to complete AI training tasks and earn extra income. 
            Start with our free trial or upgrade for higher limits and better earnings.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {renderPlanCards(personalPlans)}
        </div>
      </TabsContent>

      <TabsContent value="business" className="space-y-6">
        <div className="text-center max-w-2xl mx-auto mb-6">
          <p className="text-muted-foreground">
            Designed for individuals serious about maximizing earnings through AI training. 
            Get access to premium features, higher limits, and advanced commission structures.
          </p>
        </div>
        {businessPlans.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Business Plans Coming Soon</h3>
            <p className="text-muted-foreground">
              Premium business plans are currently being prepared. Check back soon!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {renderPlanCards(businessPlans)}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
