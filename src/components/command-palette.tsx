'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquare,
  TrendingUp,
  BookOpen,
  GitBranch,
  Users,
  CreditCard,
  Settings,
  HelpCircle,
  MessageCircle,
  BarChart2,
  Calendar,
  AlertTriangle,
  UserCheck,
  Shield,
  Wrench,
  Radio,
  Webhook,
  Mail,
  Key,
  Activity,
  Zap,
  FileText,
  Server,
  Brain,
  Star,
} from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';

// ---- Types ----

interface CommandEntry {
  label: string;
  href: string;
  icon: React.ReactNode;
  shortcut?: string;
}

// ---- Page lists ----

const clientPages: CommandEntry[] = [
  { label: 'Dashboard', href: '/client', icon: <LayoutDashboard /> },
  { label: 'Conversations', href: '/client/conversations', icon: <MessageSquare />, shortcut: 'G C' },
  { label: 'Revenue', href: '/client/revenue', icon: <TrendingUp /> },
  { label: 'Knowledge Base', href: '/client/knowledge', icon: <BookOpen /> },
  { label: 'Flows', href: '/client/flows', icon: <GitBranch /> },
  { label: 'Team', href: '/client/team', icon: <Users /> },
  { label: 'Billing', href: '/client/billing', icon: <CreditCard /> },
  { label: 'Settings', href: '/client/settings', icon: <Settings /> },
  { label: 'Help', href: '/client/help', icon: <HelpCircle /> },
  { label: 'Discussions', href: '/client/discussions', icon: <MessageCircle /> },
];

const adminClientViewPages: CommandEntry[] = [
  { label: 'Overview', href: '/dashboard', icon: <LayoutDashboard />, shortcut: 'G D' },
  { label: 'Leads', href: '/leads', icon: <UserCheck /> },
  { label: 'Conversations', href: '/conversations', icon: <MessageSquare />, shortcut: 'G C' },
  { label: 'Escalations', href: '/escalations', icon: <AlertTriangle /> },
  { label: 'Scheduled', href: '/scheduled', icon: <Calendar /> },
  { label: 'Analytics', href: '/analytics', icon: <BarChart2 /> },
  { label: 'Settings', href: '/settings', icon: <Settings /> },
  { label: 'Discussions', href: '/discussions', icon: <MessageCircle /> },
];

const adminPages: CommandEntry[] = [
  { label: 'Admin Dashboard', href: '/admin', icon: <LayoutDashboard /> },
  { label: 'Clients', href: '/admin/clients', icon: <Users /> },
  { label: 'Users', href: '/admin/users', icon: <UserCheck /> },
  { label: 'Communications', href: '/admin/agency', icon: <Radio /> },
  { label: 'Discussions', href: '/admin/discussions', icon: <MessageCircle /> },
  { label: 'Team', href: '/admin/team', icon: <Users /> },
  { label: 'Roles', href: '/admin/roles', icon: <Shield /> },
  { label: 'Audit Log', href: '/admin/audit-log', icon: <FileText /> },
  { label: 'Flow Templates', href: '/admin/flow-templates', icon: <GitBranch /> },
  { label: 'Flow Analytics', href: '/admin/analytics', icon: <BarChart2 /> },
  { label: 'Variant Results', href: '/admin/template-performance', icon: <Activity /> },
  { label: 'A/B Tests', href: '/admin/ab-tests', icon: <Zap /> },
  { label: 'Reputation', href: '/admin/reputation', icon: <Star /> },
  { label: 'AI Effectiveness', href: '/admin/ai-effectiveness', icon: <Brain /> },
  { label: 'AI Quality', href: '/admin/ai-quality', icon: <Brain /> },
  { label: 'Billing', href: '/admin/billing', icon: <CreditCard /> },
  { label: 'Plans', href: '/admin/billing/plans', icon: <CreditCard /> },
  { label: 'Coupons', href: '/admin/billing/coupons', icon: <CreditCard /> },
  { label: 'Reports', href: '/admin/reports', icon: <FileText /> },
  { label: 'Platform Health', href: '/admin/platform-analytics', icon: <Server /> },
  { label: 'Costs \u0026 Usage', href: '/admin/usage', icon: <Activity /> },
  { label: 'Phone Numbers', href: '/admin/phone-numbers', icon: <Radio /> },
  { label: 'Twilio Account', href: '/admin/twilio', icon: <Radio /> },
  { label: 'Voice AI', href: '/admin/voice-ai', icon: <Brain /> },
  { label: 'Compliance', href: '/admin/compliance', icon: <Shield /> },
  { label: 'Webhook Logs', href: '/admin/webhook-logs', icon: <Webhook /> },
  { label: 'Email Templates', href: '/admin/email-templates', icon: <Mail /> },
  { label: 'API Keys', href: '/admin/api-keys', icon: <Key /> },
  { label: 'System Settings', href: '/admin/settings', icon: <Wrench /> },
];

// ---- Props ----

export interface CommandPaletteProps {
  /** When true, shows admin-level pages (agency view). Omit or false for client portal. */
  isAdmin?: boolean;
}

// ---- Component ----

export function CommandPalette({ isAdmin = false }: CommandPaletteProps) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  // Keyboard shortcuts: Cmd+K toggles, Escape closes
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Palette container */}
      <div className="fixed left-1/2 top-[20%] -translate-x-1/2 z-50 w-full max-w-lg px-4">
        <Command className="rounded-xl border shadow-lg bg-popover text-popover-foreground">
          <CommandInput placeholder="Search pages\u2026" autoFocus />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            {isAdmin ? (
              <>
                <CommandGroup heading="Client View">
                  {adminClientViewPages.map((item) => (
                    <CommandItem
                      key={item.href}
                      value={item.label}
                      onSelect={() => handleSelect(item.href)}
                    >
                      {item.icon}
                      {item.label}
                      {item.shortcut && (
                        <CommandShortcut>{item.shortcut}</CommandShortcut>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Admin">
                  {adminPages.map((item) => (
                    <CommandItem
                      key={item.href}
                      value={item.label}
                      onSelect={() => handleSelect(item.href)}
                    >
                      {item.icon}
                      {item.label}
                      {item.shortcut && (
                        <CommandShortcut>{item.shortcut}</CommandShortcut>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : (
              <CommandGroup heading="Pages">
                {clientPages.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={item.label}
                    onSelect={() => handleSelect(item.href)}
                  >
                    {item.icon}
                    {item.label}
                    {item.shortcut && (
                      <CommandShortcut>{item.shortcut}</CommandShortcut>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </div>
    </>
  );
}
