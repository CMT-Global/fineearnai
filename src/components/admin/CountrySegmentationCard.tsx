import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { format } from "date-fns";
import { getCountryName } from "@/lib/countries";

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
  isLoading?: boolean;
}

const ITEMS_PER_PAGE = 10;

export const CountrySegmentationCard = ({ data, dateRange, isLoading }: CountrySegmentationCardProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  
  // Calculate number of days in range
  const daysDiff = Math.round(
    (new Date(dateRange.endDate).getTime() - new Date(dateRange.startDate).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1; // +1 to include both start and end dates

  // Sort by user_count descending and add rank
  const sortedData = [...data]
    .sort((a, b) => b.user_count - a.user_count)
    .map((country, index) => ({
      ...country,
      rank: index + 1
    }));
  
  // Calculate pagination
  const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedData = sortedData.slice(startIndex, endIndex);
  
  const maxUsers = Math.max(...sortedData.map(c => c.user_count), 1);
  
  // Reset to page 1 when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [data.length, dateRange.startDate, dateRange.endDate]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            User Segmentation by Country
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {daysDiff} {daysDiff === 1 ? 'Day' : 'Days'} ({format(new Date(dateRange.startDate), "MMM dd")} - {format(new Date(dateRange.endDate), "MMM dd")})
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Geographic distribution of users and deposit volumes
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {isLoading && paginatedData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading country data...
            </div>
          ) : paginatedData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No country data available for the selected period
            </div>
          ) : (
            <>
              {paginatedData.map((country) => (
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
                        <div className="font-medium">{getCountryName(country.country_code) || country.country_code}</div>
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
              ))}
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1}-{Math.min(endIndex, sortedData.length)} of {sortedData.length} countries
                  </div>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
