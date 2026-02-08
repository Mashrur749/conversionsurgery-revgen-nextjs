import { Card, CardContent } from '@/components/ui/card';
import { Phone, PhoneOff, MessageSquare, AlertCircle, TrendingUp } from 'lucide-react';

interface Props {
  totalNumbers: number;
  assignedNumbers: number;
  availableForAssignment: number;
  totalMessagesSent: number;
  totalMissedCalls: number;
}

export function PhoneNumbersStats({
  totalNumbers,
  assignedNumbers,
  availableForAssignment,
  totalMessagesSent,
  totalMissedCalls,
}: Props) {
  const stats = [
    {
      label: 'Total Numbers',
      value: totalNumbers,
      icon: Phone,
      color: 'bg-blue-100 text-blue-600',
      description: 'Owned numbers',
    },
    {
      label: 'Assigned',
      value: assignedNumbers,
      icon: PhoneOff,
      color: 'bg-green-100 text-green-600',
      description: 'Currently in use',
    },
    {
      label: 'Available',
      value: availableForAssignment,
      icon: TrendingUp,
      color: 'bg-purple-100 text-purple-600',
      description: 'Clients ready to assign',
    },
    {
      label: 'Messages (Today)',
      value: totalMessagesSent,
      icon: MessageSquare,
      color: 'bg-amber-100 text-amber-600',
      description: 'All numbers combined',
    },
    {
      label: 'Missed Calls (Today)',
      value: totalMissedCalls,
      icon: AlertCircle,
      color: 'bg-rose-100 text-rose-600',
      description: 'Captured across all numbers',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {stat.label}
                  </p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {stat.description}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
