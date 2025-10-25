import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Briefcase, ArrowDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PlanTabsProps {
  personalPlans: any[];
  businessPlans: any[];
  renderPlanCards: (plans: any[], variant?: 'vertical' | 'horizontal') => React.ReactNode;
}

export function PlanTabs({ personalPlans, businessPlans, renderPlanCards }: PlanTabsProps) {
  // Separate free plan from paid personal plans
  const freePlan = personalPlans.find(p => p.account_type === 'free');
  const paidPersonalPlans = personalPlans.filter(p => p.account_type === 'personal');
  
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

        {/* Paid Personal Plans - Responsive 3 Column Grid with Staggered Animation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-7xl mx-auto">
          {paidPersonalPlans.map((plan, index) => (
            <div key={plan.id} className="animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
              {renderPlanCards([plan])}
            </div>
          ))}
        </div>

        {/* Separator */}
        <div className="max-w-7xl mx-auto mt-12">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t-2 border-dashed border-muted-foreground/30" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-4 py-2 text-muted-foreground font-semibold">
                Or start with Free Trial
              </span>
            </div>
          </div>
        </div>

        {/* Comparison Callout with Animated Arrow Pointing Up */}
        <Alert className="max-w-4xl mx-auto bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-2 border-blue-200 dark:border-blue-800">
          <AlertDescription className="flex items-center justify-center gap-3 text-center">
            <ArrowDown className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-bounce rotate-180" />
            <span className="font-semibold text-blue-900 dark:text-blue-100">
              Compare with paid plans above to earn up to 4X more!
            </span>
          </AlertDescription>
        </Alert>

        {/* Free Trial Card - Horizontal Layout at Bottom */}
        {freePlan && (
          <div className="max-w-7xl mx-auto">
            {renderPlanCards([freePlan], 'horizontal')}
          </div>
        )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-7xl mx-auto">
            {renderPlanCards(businessPlans)}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
