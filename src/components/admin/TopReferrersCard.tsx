import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, DollarSign, Users } from "lucide-react";
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

interface TopReferrer {
  user_id: string;
  username: string;
  country_code: string;
  country_name: string;
  referral_count: number;
  total_commission: number;
  total_referral_deposits: number;
  rank: number;
}

interface TopReferrersCardProps {
  data: TopReferrer[];
  dateRange: { startDate: string; endDate: string };
  isLoading?: boolean;
}

const getRankColor = (rank: number) => {
  if (rank === 1) return "text-yellow-500";
  if (rank === 2) return "text-gray-400";
  if (rank === 3) return "text-amber-600";
  return "text-muted-foreground";
};

const getRankBadgeVariant = (rank: number): "default" | "secondary" | "outline" => {
  if (rank <= 3) return "default";
  if (rank <= 10) return "secondary";
  return "outline";
};

const ITEMS_PER_PAGE = 10;

export const TopReferrersCard = ({ data, dateRange, isLoading }: TopReferrersCardProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  
  // Calculate number of days in range
  const daysDiff = Math.round(
    (new Date(dateRange.endDate).getTime() - new Date(dateRange.startDate).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1; // +1 to include both start and end dates
  
  // Calculate pagination
  const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedData = data.slice(startIndex, endIndex);
  
  // Reset to page 1 when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [data.length, dateRange.startDate, dateRange.endDate]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Top 20 Referrers
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {daysDiff} {daysDiff === 1 ? 'Day' : 'Days'} ({format(new Date(dateRange.startDate), "MMM dd")} - {format(new Date(dateRange.endDate), "MMM dd")})
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Highest performing referrers ranked by total referrals brought in
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {isLoading && paginatedData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading referrer data...
            </div>
          ) : paginatedData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No referrer data available for the selected period
            </div>
          ) : (
            <>
              {paginatedData.map((referrer) => (
                <div 
                  key={referrer.user_id} 
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`font-bold text-lg min-w-[2rem] text-center ${getRankColor(referrer.rank)}`}>
                      #{referrer.rank}
                    </div>
                    <span 
                      className="text-2xl"
                      title={getCountryName(referrer.country_code) || referrer.country_code}
                    >
                      {referrer.country_code ? 
                        String.fromCodePoint(...[...referrer.country_code.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) 
                        : '🌍'
                      }
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{referrer.username}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {referrer.referral_count} refs
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          ${referrer.total_referral_deposits.toLocaleString()} deposits
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={getRankBadgeVariant(referrer.rank)}>
                      ${referrer.total_commission.toLocaleString()}
                    </Badge>
                    <span className="text-xs text-muted-foreground">commission</span>
                  </div>
                </div>
              ))}
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1}-{Math.min(endIndex, data.length)} of {data.length} referrers
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
