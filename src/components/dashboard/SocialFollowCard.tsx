import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Facebook, Instagram, Send, Music } from "lucide-react";
import { TelegramGroupsDialog } from "@/components/shared/TelegramGroupsDialog";

export const SocialFollowCard = () => {
  const [telegramDialogOpen, setTelegramDialogOpen] = useState(false);

  const socialLinks = [
    {
      name: "Facebook",
      url: "https://facebook.com/fineearn",
      icon: Facebook,
      color: "bg-[#1877F2] hover:bg-[#0d65d9]",
      description: "Join other members",
      isExternal: true
    },
    {
      name: "Instagram", 
      url: "https://www.instagram.com/fineearnofficial/",
      icon: Instagram,
      color: "bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#FCAF45] hover:opacity-90",
      description: "Daily earning tips",
      isExternal: true
    },
    {
      name: "Telegram",
      url: "", // No direct URL - opens dialog
      icon: Send,
      color: "bg-[#0088cc] hover:bg-[#0077b5]",
      description: "Get Daily Updates",
      isExternal: false
    },
    {
      name: "TikTok",
      url: "https://www.tiktok.com/@fineearn",
      icon: Music,
      color: "bg-black hover:bg-gray-900",
      description: "Viral earning hacks",
      isExternal: true
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {socialLinks.map((social) => {
            // Telegram button opens dialog instead of direct link
            if (social.name === "Telegram") {
              return (
                <Button
                  key={social.name}
                  onClick={() => setTelegramDialogOpen(true)}
                  className={`w-full h-auto py-4 flex flex-col items-center gap-2 
                             ${social.color} text-white transition-all duration-300
                             hover:scale-105 hover:shadow-lg`}
                  type="button"
                  aria-label="Open Telegram groups dialog"
                >
                  <social.icon className="w-6 h-6" />
                  <div className="flex flex-col items-center">
                    <span className="font-semibold">{social.name}</span>
                    <span className="text-xs opacity-90">{social.description}</span>
                    <span className="text-xs opacity-75 mt-0.5">(3 groups)</span>
                  </div>
                </Button>
              );
            }

            // Other social links remain as external links
            return (
              <Button
                key={social.name}
                asChild
                className={`w-full h-auto py-4 ${social.color} text-white transition-all duration-300 hover:scale-105 hover:shadow-lg`}
              >
                <a
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 w-full"
                >
                  <social.icon className="w-6 h-6" />
                  <div className="flex flex-col items-center">
                    <span className="font-semibold">{social.name}</span>
                    <span className="text-xs opacity-90">{social.description}</span>
                  </div>
                </a>
              </Button>
            );
          })}
        </div>
        
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-center text-muted-foreground">
            💡 <span className="font-medium">Pro tip:</span> Our social followers get{" "}
            <span className="text-primary font-semibold">early access</span> to new earning 
            opportunities and exclusive bonus campaigns!
          </p>
        </div>
      </CardContent>

      {/* Telegram Groups Dialog */}
      <TelegramGroupsDialog 
        open={telegramDialogOpen} 
        onOpenChange={setTelegramDialogOpen} 
      />
    </Card>
  );
};
