import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

interface TelegramGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
}

interface TelegramGroup {
  name: string;
  url?: string;
  flag: string;
  description: string;
  gradient: string;
  isComingSoon?: boolean;
}

const telegramGroups: TelegramGroup[] = [
  {
    name: "Asia Community",
    url: "https://t.me/FineEarnOfficial",
    flag: "🇵🇭",
    description: "Connect with Asian earners, get local tips & support",
    gradient: "from-blue-500 to-red-500",
    isComingSoon: false
  },
  {
    name: "European Community",
    url: "https://t.me/FINEEARNGROUP",
    flag: "🇪🇺",
    description: "Join European members for global strategies & insights",
    gradient: "from-blue-600 to-yellow-400",
    isComingSoon: false
  },
  {
    name: "Marketing Material (Global)",
    url: "https://t.me/fineearn",
    flag: "📢",
    description: "Get official updates, promotional content & announcements",
    gradient: "from-purple-500 to-pink-500",
    isComingSoon: false
  },
  {
    name: "Africa Community",
    flag: "🌍",
    description: "Coming soon for African earners",
    gradient: "from-green-500 to-yellow-500",
    isComingSoon: true
  },
  {
    name: "Middle East Community",
    flag: "🕌",
    description: "Coming soon for Middle Eastern earners",
    gradient: "from-orange-500 to-red-500",
    isComingSoon: true
  },
  {
    name: "North America Community",
    flag: "🇺🇸",
    description: "Coming soon for North American earners",
    gradient: "from-blue-500 to-red-600",
    isComingSoon: true
  },
  {
    name: "South America Community",
    flag: "🇧🇷",
    description: "Coming soon for South American earners",
    gradient: "from-green-600 to-yellow-400",
    isComingSoon: true
  }
];

export const TelegramGroupsDialog = ({ open, onOpenChange, trigger }: TelegramGroupsDialogProps) => {
  const handleGroupClick = (groupName: string, url: string | undefined, isComingSoon?: boolean) => {
    if (isComingSoon || !url) return;
    
    console.log('Telegram group clicked:', {
      group: groupName,
      timestamp: new Date().toISOString()
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger}
      <DialogContent className="sm:max-w-[90vw] md:max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header with Telegram gradient */}
        <div className="bg-gradient-to-r from-[#0088cc] to-[#0066aa] text-white p-6 rounded-t-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-3xl">💬</span>
              Choose Your FineEarn Community
            </DialogTitle>
            <DialogDescription className="text-white/90 text-base mt-2">
              Join our NEW communities and expanding network in your region
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Groups Grid */}
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {telegramGroups.map((group) => (
              group.isComingSoon ? (
                <div
                  key={group.name}
                  className="opacity-60 cursor-not-allowed text-left rounded-lg"
                >
                  <Card className="h-full border-2 border-muted transition-all duration-300 overflow-hidden">
                    {/* Gradient header */}
                    <div className={`h-2 bg-gradient-to-r ${group.gradient} opacity-50`} />
                    
                    <CardContent className="p-5 space-y-3">
                      {/* Flag and Name */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-4xl" role="img" aria-label={`${group.name} flag`}>
                            {group.flag}
                          </span>
                          <div className="flex-1">
                            <h3 className="font-bold text-lg leading-tight transition-colors">
                              {group.name}
                            </h3>
                            <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold text-muted-foreground bg-muted rounded">
                              Coming Soon
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-muted-foreground leading-relaxed min-h-[2.5rem]">
                        {group.description}
                      </p>

                      {/* Coming soon button */}
                      <div className="pt-2">
                        <div className="w-full py-2 px-4 rounded-md text-center text-sm font-medium bg-muted text-muted-foreground">
                          Coming Soon
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <button
                  key={group.name}
                  onClick={() => handleGroupClick(group.name, group.url, group.isComingSoon)}
                  className="text-left transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg"
                  aria-label={`Join ${group.name} on Telegram`}
                >
                  <Card className="h-full border-2 hover:border-primary hover:shadow-lg transition-all duration-300 overflow-hidden group">
                    {/* Gradient header */}
                    <div className={`h-2 bg-gradient-to-r ${group.gradient}`} />
                    
                    <CardContent className="p-5 space-y-3">
                      {/* Flag and Name */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-4xl" role="img" aria-label={`${group.name} flag`}>
                            {group.flag}
                          </span>
                          <div>
                            <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">
                              {group.name}
                            </h3>
                          </div>
                        </div>
                        <ExternalLink className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                      </div>

                      {/* Description */}
                      <p className="text-sm text-muted-foreground leading-relaxed min-h-[2.5rem]">
                        {group.description}
                      </p>

                      {/* Join button indicator */}
                      <div className="pt-2">
                        <div className={`
                          w-full py-2 px-4 rounded-md text-center text-sm font-medium
                          bg-gradient-to-r ${group.gradient} text-white
                          group-hover:shadow-md transition-shadow duration-300
                        `}>
                          Join Community
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              )
            ))}
          </div>

          {/* Info banner */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
            <p className="text-sm text-center text-muted-foreground">
              💡 <span className="font-medium">Pro tip:</span> Join active communities now! More regions launching soon.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
