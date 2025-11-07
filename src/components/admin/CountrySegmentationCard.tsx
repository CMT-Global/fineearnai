import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface CountryStats {
  country_code: string;
  country_name: string;
  user_count: number;
  total_deposits: number;
  percentage: number;
}

interface CountrySegmentationCardProps {
  data: CountryStats[];
}

export const CountrySegmentationCard = ({ data }: CountrySegmentationCardProps) => {
  const maxUsers = Math.max(...data.map(c => c.user_count), 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            User Segmentation by Country
          </CardTitle>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Geographic distribution of users and deposit volumes
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No country data available for the selected period
            </div>
          ) : (
            data.map((country) => (
              <div key={country.country_code} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
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
