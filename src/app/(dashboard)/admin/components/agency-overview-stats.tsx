import { Card, CardContent } from '@/components/ui/card';
import {
  Users,
  Phone,
  MessageSquare,
  PhoneOff,
  TrendingUp,
  UserCheck,
} from 'lucide-react';

interface Props {
  totalClients: number;
  activeClients: number;
  pendingClients: number;
  cancelledClients: number;
  totalPhoneNumbers: number;
  totalTeamMembers: number;
  todayMessagesSent: number;
  todayMissedCallsCaptured: number;
}

export function AgencyOverviewStats({
  totalClients,
  activeClients,
  pendingClients,
  cancelledClients,
  totalPhoneNumbers,
  totalTeamMembers,
  todayMessagesSent,
  todayMissedCallsCaptured,
}: Props) {
  const stats = [
    {
      label: 'Total Clients',
      value: totalClients,
      icon: Users,
      color: 'bg-sage-light text-forest',
      description: `${activeClients} active, ${pendingClients} pending`,
    },
    {
      label: 'Phone Numbers',
      value: totalPhoneNumbers,
      icon: Phone,
      color: 'bg-[#E8F5E9] text-[#3D7A50]',
      description: `Assigned to ${totalPhoneNumbers} clients`,
    },
    {
      label: 'Team Members',
      value: totalTeamMembers,
      icon: UserCheck,
      color: 'bg-moss-light text-olive',
      description: `Across all clients`,
    },
    {
      label: 'Messages (Today)',
      value: todayMessagesSent,
      icon: MessageSquare,
      color: 'bg-[#FFF3E0] text-olive',
      description: `Sent today`,
    },
    {
      label: 'Missed Calls (Today)',
      value: todayMissedCallsCaptured,
      icon: PhoneOff,
      color: 'bg-[#FDEAE4] text-sienna',
      description: `Captured today`,
    },
    {
      label: 'Pending Setup',
      value: pendingClients,
      icon: TrendingUp,
      color: 'bg-[#FFF3E0] text-terracotta',
      description: `Clients awaiting activation`,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
