import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Plus,
  Phone,
  Users,
  FileText,
  Settings,
  BarChart3,
} from 'lucide-react';

export function QuickActions() {
  const actions = [
    {
      icon: Plus,
      label: 'Create New Client',
      description: 'Add a new client to manage',
      href: '/admin/clients/new/wizard',
      color: 'bg-forest hover:bg-forest',
    },
    {
      icon: Phone,
      label: 'Manage Phone Numbers',
      description: 'Purchase or assign numbers',
      href: '/admin/clients',
      color: 'bg-[#3D7A50] hover:bg-[#3D7A50]',
    },
    {
      icon: Users,
      label: 'View All Clients',
      description: 'See all managed accounts',
      href: '/admin/clients',
      color: 'bg-olive hover:bg-olive-light',
    },
    {
      icon: BarChart3,
      label: 'View Reports',
      description: 'A/B testing & performance',
      href: '#',
      color: 'bg-olive hover:bg-olive-light',
      disabled: true,
    },
    {
      icon: FileText,
      label: 'Generate Bi-Weekly Report',
      description: 'Create client reports',
      href: '#',
      color: 'bg-sienna hover:bg-sienna/90',
      disabled: true,
    },
    {
      icon: Settings,
      label: 'Twilio Settings',
      description: 'Configure Twilio account',
      href: '/admin/twilio',
      color: 'bg-sage hover:bg-forest-light',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Card
            key={action.label}
            className={`hover:shadow-lg transition-shadow ${
              action.disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <CardContent className="p-6">
              <Button
                asChild={!action.disabled}
                disabled={action.disabled}
                variant="ghost"
                className="w-full h-auto justify-start p-0 hover:bg-transparent"
              >
                <Link
                  href={action.href}
                  className={`w-full flex flex-col items-start gap-3 ${
                    action.disabled ? 'cursor-not-allowed' : ''
                  }`}
                >
                  <div className={`p-2 rounded-lg text-white ${action.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-sm">{action.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {action.description}
                    </p>
                  </div>
                </Link>
              </Button>
              {action.disabled && (
                <p className="text-xs text-muted-foreground mt-2">
                  Coming soon
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
