'use client';

import Link from 'next/link';
import {
  Phone,
  FileText,
  AlertTriangle,
  Calendar,
  DollarSign,
  MessageSquare,
  Shield,
  Clock,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  link?: string;
}

interface NotificationPopoverProps {
  notifications: NotificationItem[];
  lastSeenTimestamp: string;
  onMarkAllRead: () => void;
  portalType: 'client' | 'admin';
}

const ICON_MAP: Record<string, LucideIcon> = {
  phone: Phone,
  'file-text': FileText,
  'alert-triangle': AlertTriangle,
  calendar: Calendar,
  'dollar-sign': DollarSign,
  'message-square': MessageSquare,
  shield: Shield,
  clock: Clock,
  'book-open': BookOpen,
};

function getIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || MessageSquare;
}

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) return 'Just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function NotificationPopover({
  notifications,
  lastSeenTimestamp,
  onMarkAllRead,
  portalType,
}: NotificationPopoverProps) {
  const lastSeenDate = new Date(lastSeenTimestamp);
  const viewAllHref =
    portalType === 'client' ? '/client/notifications' : '/admin/notifications';

  if (notifications.length === 0) {
    return (
      <div className="p-6 text-center">
        <MessageSquare className="size-8 mx-auto mb-2 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground">
          No notifications yet
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          You&apos;ll see updates here when something needs your attention.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">Notifications</h3>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-[#6B7E54] hover:text-[#1B2F26] h-auto py-1 px-2"
          onClick={onMarkAllRead}
        >
          Mark all as read
        </Button>
      </div>

      {/* Notification list */}
      <ScrollArea className="max-h-[400px]">
        <div className="divide-y">
          {notifications.map((notification) => {
            const isUnread = new Date(notification.timestamp) > lastSeenDate;
            const IconComponent = getIcon(notification.icon);

            const content = (
              <div
                className={cn(
                  'flex gap-3 px-4 py-3 transition-colors hover:bg-accent/50',
                  isUnread && 'border-l-2 border-l-[#D4754A] bg-[#D4754A]/5'
                )}
              >
                <div
                  className={cn(
                    'flex-shrink-0 flex items-center justify-center size-8 rounded-full mt-0.5',
                    isUnread
                      ? 'bg-[#D4754A]/15 text-[#C15B2E]'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <IconComponent className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm leading-tight',
                      isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'
                    )}
                  >
                    {notification.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {notification.description}
                  </p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    {formatRelativeTime(notification.timestamp)}
                  </p>
                </div>
              </div>
            );

            if (notification.link) {
              return (
                <Link key={notification.id} href={notification.link} className="block">
                  {content}
                </Link>
              );
            }

            return <div key={notification.id}>{content}</div>;
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t px-4 py-2">
        <Link
          href={viewAllHref}
          className="block text-center text-xs font-medium text-[#6B7E54] hover:text-[#1B2F26] py-1"
        >
          View all notifications
        </Link>
      </div>
    </div>
  );
}
