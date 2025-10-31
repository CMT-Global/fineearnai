import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Facebook, Instagram, Send } from "lucide-react";

export const SocialFollowCard = () => {
  const socialLinks = [
    {
      name: "Facebook",
      url: "https://facebook.com/fineearn",
      icon: Facebook,
      color: "bg-[#1877F2] hover:bg-[#0d65d9]",
      description: "Join 10k+ members"
    },
    {
      name: "Instagram", 
      url: "https://www.instagram.com/fineearnofficial/",
      icon: Instagram,
      color: "bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#FCAF45] hover:opacity-90",
      description: "Daily earning tips"
    },
    {
      name: "Telegram",
      url: "https://t.me/fineearn",
      icon: Send,
      color: "bg-[#0088cc] hover:bg-[#0077b5]",
      description: "Real-time support"
    }
  ];

  return (
    <Card className="border-l-4 border-l-primary shadow-md hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚀</span>
          <CardTitle className="text-xl">Stay Connected, Earn Smarter!</CardTitle>
        </div>
        <CardDescription className="text-base">
          Follow us for <span className="font-semibold text-primary">exclusive earning tips</span>, 
          platform updates, and connect with a thriving community of successful earners.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {socialLinks.map((social) => (
            <a
              key={social.name}
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <Button
                className={`w-full h-auto py-4 flex flex-col items-center gap-2 
                           ${social.color} text-white transition-all duration-300
                           group-hover:scale-105 group-hover:shadow-lg`}
              >
                <social.icon className="w-6 h-6" />
                <div className="flex flex-col items-center">
                  <span className="font-semibold">{social.name}</span>
                  <span className="text-xs opacity-90">{social.description}</span>
                </div>
              </Button>
            </a>
          ))}
        </div>
        
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-center text-muted-foreground">
            💡 <span className="font-medium">Pro tip:</span> Our social followers get{" "}
            <span className="text-primary font-semibold">early access</span> to new earning 
            opportunities and exclusive bonus campaigns!
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
