import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: number | null;
  icon: LucideIcon;
  description?: string;
  highlight?: boolean;
}

export function KpiCard({
  title,
  value,
  change,
  icon: Icon,
  description,
  highlight,
}: KpiCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <Card className={cn(highlight && 'border-primary bg-primary/5')}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon
          className={cn(
            'h-4 w-4',
            highlight ? 'text-primary' : 'text-muted-foreground'
          )}
        />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center gap-2 mt-1">
          {change !== null && change !== undefined && (
            <span
              className={cn(
                'flex items-center text-xs font-medium',
                isPositive && 'text-[#3D7A50]',
                isNegative && 'text-destructive',
                !isPositive && !isNegative && 'text-muted-foreground'
              )}
            >
              {isPositive && <TrendingUp className="h-3 w-3 mr-1" />}
              {isNegative && <TrendingDown className="h-3 w-3 mr-1" />}
              {isPositive && '+'}
              {change}%
            </span>
          )}
          {description && (
            <span className="text-xs text-muted-foreground">{description}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
