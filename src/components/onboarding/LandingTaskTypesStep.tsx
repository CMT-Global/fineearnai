import { Building2, ShoppingBag, UtensilsCrossed, Clock } from "lucide-react";

const taskTypes = [
  {
    icon: Building2,
    title: "Hotel Reviews",
    example: "Was this guest happy with their room?",
    time: "1-2 min",
  },
  {
    icon: ShoppingBag,
    title: "Product Reviews",
    example: "Would this buyer recommend this item?",
    time: "1-2 min",
  },
  {
    icon: UtensilsCrossed,
    title: "Restaurant Feedback",
    example: "Did this diner enjoy their meal?",
    time: "1-3 min",
  },
];

export default function LandingTaskTypesStep() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          What <span className="text-gradient">Tasks</span> Look Like
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          You'll analyze different types of reviews. Each task takes just 1-3 minutes.
        </p>
      </div>

      <div className="grid gap-4">
        {taskTypes.map((task, index) => (
          <div key={index} className="glass-card p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <task.icon className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{task.title}</h3>
              <p className="text-sm text-muted-foreground italic">"{task.example}"</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {task.time}
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card p-4 bg-primary/5 border-primary/20">
        <p className="text-sm text-center text-foreground">
          <span className="font-medium">Your work matters:</span> Your answers help AI companies build smarter, more human-like technology used by millions worldwide.
        </p>
      </div>
    </div>
  );
}
