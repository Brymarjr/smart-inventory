import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpRight, ArrowDownRight, LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number; // Optional percentage change
  description?: string;
  trendLabel?: string; // e.g., "from last month"
}

export function StatCard({ title, value, icon: Icon, trend, description, trendLabel = "from last month" }: StatCardProps) {
  // Determine color based on trend
  const isPositive = trend !== undefined && trend >= 0;
  const isNegative = trend !== undefined && trend < 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        
        {trend !== undefined ? (
          <p className="text-xs text-muted-foreground mt-1 flex items-center">
            <span className={`flex items-center font-medium ${isPositive ? 'text-green-600' : 'text-red-600'} mr-1`}>
              {isPositive ? <ArrowUpRight className="h-4 w-4 mr-0.5" /> : <ArrowDownRight className="h-4 w-4 mr-0.5" />}
              {Math.abs(trend)}%
            </span>
            {trendLabel}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}