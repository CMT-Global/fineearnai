import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface CountryStats {
  country_code: string;
  country_name: string;
  user_count: number;
  total_deposits: number;
  percentage: number;
}

interface CountrySegmentationCardProps {
  data: CountryStats[];
  dateRange: { startDate: string; endDate: string };
}

export const CountrySegmentationCard = ({ data, dateRange }: CountrySegmentationCardProps) => {
  // Sort by user_count descending and add rank (1-20)
  const rankedData = [...data]
    .sort((a, b) => b.user_count - a.user_count)
    .slice(0, 20) // Take top 20
    .map((country, index) => ({
      ...country,
      rank: index + 1
    }));
  
  const maxUsers = Math.max(...rankedData.map(c => c.user_count), 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            User Segmentation by Country
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {format(new Date(dateRange.startDate), "MMM dd")} - {format(new Date(dateRange.endDate), "MMM dd")}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Geographic distribution of users and deposit volumes
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {rankedData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No country data available for the selected period
            </div>
          ) : (
            rankedData.map((country) => (
              <div key={country.country_code} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="font-bold text-sm min-w-[2rem] text-muted-foreground">
                      #{country.rank}
                    </div>
                    <span 
                      className="text-2xl"
                      title={country.country_name}
                    >
                      {country.country_code ? 
                        String.fromCodePoint(...[...country.country_code.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) 
                        : '🌍'
                      }
                    </span>
                    <div>
                      <div className="font-medium">{country.country_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {country.user_count} users • ${country.total_deposits.toLocaleString()} deposits
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-muted-foreground">
                    {country.percentage.toFixed(1)}%
                  </div>
                </div>
                <Progress 
                  value={(country.user_count / maxUsers) * 100} 
                  className="h-2"
                />
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
