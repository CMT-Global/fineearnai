import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  ShoppingBag, 
  UtensilsCrossed, 
  MessageCircle, 
  Smartphone,
  Briefcase,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

const projects = [
  {
    icon: Building2,
    title: "Hotel Review Sentiment",
    description: "Read hotel reviews and determine if guests were happy, unhappy, or mixed. Help AI understand traveler experiences.",
    tags: ["Easy Start", "Per Task Pay", "Remote"],
    category: "Hospitality",
    color: "from-emerald-500/20 to-teal-500/20",
  },
  {
    icon: ShoppingBag,
    title: "Product Review Analysis",
    description: "Analyze product reviews to identify customer satisfaction levels. Rate sentiment and highlight key opinions.",
    tags: ["High Volume", "Flexible Hours", "Remote"],
    category: "E-Commerce",
    color: "from-primary/20 to-accent/20",
  },
  {
    icon: UtensilsCrossed,
    title: "Restaurant Feedback Sentiment",
    description: "Review restaurant and food delivery feedback. Determine if diners had positive or negative experiences.",
    tags: ["Beginner Friendly", "Daily Tasks", "Remote"],
    category: "Food & Dining",
    color: "from-cyan-500/20 to-blue-500/20",
  },
  {
    icon: MessageCircle,
    title: "Social Media Comment Analysis",
    description: "Analyze comments and reactions on social posts. Help AI understand tone, emotion, and intent in user discussions.",
    tags: ["Quick Tasks", "Ongoing", "Remote"],
    category: "Social Platforms",
    color: "from-violet-500/20 to-purple-500/20",
  },
  {
    icon: Smartphone,
    title: "App Store Review Sentiment",
    description: "Read app reviews and categorize user sentiment. Identify feature requests, complaints, and praise.",
    tags: ["Medium Difficulty", "Bonus Available", "Remote"],
    category: "Mobile Apps",
    color: "from-orange-500/20 to-amber-500/20",
  },
  {
    icon: Briefcase,
    title: "Service Provider Reviews",
    description: "Evaluate reviews for local businesses and service providers. Assess overall customer satisfaction levels.",
    tags: ["Flexible Schedule", "Weekly Pay", "Remote"],
    category: "Professional Services",
    color: "from-rose-500/20 to-pink-500/20",
  },
];

export default function LandingProjectsSection() {
  return (
    <section id="projects" className="section-padding relative">
      <div className="container-custom">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
            Available Tasks
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Analyze Reviews Across <span className="text-gradient">Categories</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Read reviews and answer questions about sentiment, meaning, and quality. Simple tasks, real earnings.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project, index) => (
            <div
              key={project.title}
              className="feature-card group cursor-pointer relative overflow-hidden"
            >
              {/* Gradient Background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${project.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              
              <div className="relative z-10">
                {/* Category */}
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                  {project.category}
                </span>
                
                {/* Icon */}
                <div className="w-14 h-14 mt-4 mb-4 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <project.icon className="w-7 h-7 text-primary" />
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                  {project.title}
                </h3>

                {/* Description */}
                <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                  {project.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-secondary px-3 py-1 rounded-full text-secondary-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* CTA Link */}
                <div className="flex items-center text-primary font-semibold text-sm group-hover:translate-x-2 transition-transform">
                  Start Earning
                  <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Button variant="outline" size="lg">
            View All Task Categories
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  );
}
