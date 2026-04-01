'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { NotificationPopover, type NotificationItem } from './notification-popover';

const POLL_INTERVAL_MS = 30_000;
const LAST_SEEN_KEY_PREFIX = 'cs_notifications_last_seen_';

interface NotificationBellProps {
  portalType: 'client' | 'admin';
}

export function NotificationBell({ portalType }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  // EC-14: Track in-flight fetch so we can abort it on unmount
  const fetchAbortRef = useRef<AbortController | null>(null);

  const storageKey = `${LAST_SEEN_KEY_PREFIX}${portalType}`;

  const getLastSeen = useCallback((): string => {
    if (typeof window === 'undefined') return new Date(0).toISOString();
    try {
      return localStorage.getItem(storageKey) || new Date(0).toISOString();
    } catch {
      return new Date(0).toISOString();
    }
  }, [storageKey]);

  const updateLastSeen = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(storageKey, new Date().toISOString());
    } catch {
      // Silently skip — private browsing may block localStorage
    }
  }, [storageKey]);

  const fetchNotifications = useCallback(async () => {
    // EC-14: Cancel any previous in-flight fetch before starting a new one
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    try {
      const endpoint =
        portalType === 'client'
          ? '/api/client/notifications/feed'
          : '/api/admin/notifications/feed';
      const res = await fetch(endpoint, { signal: controller.signal });
      // EC-14: Guard against state updates after unmount
      if (controller.signal.aborted) return;
      if (!res.ok) return;
      const data = (await res.json()) as { notifications: NotificationItem[] };
      if (controller.signal.aborted) return;
      setNotifications(data.notifications);

      const lastSeen = getLastSeen();
      const lastSeenDate = new Date(lastSeen);
      const count = data.notifications.filter(
        (n) => new Date(n.timestamp) > lastSeenDate
      ).length;
      setUnreadCount(count);
    } catch (err) {
      // Ignore AbortError from unmount or rapid re-mount; silently skip all others
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }, [portalType, getLastSeen]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      // EC-14: Abort any pending fetch when the component unmounts
      fetchAbortRef.current?.abort();
    };
  }, [fetchNotifications]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      // When opening, mark all as seen after a brief delay
      setTimeout(() => {
        updateLastSeen();
        setUnreadCount(0);
      }, 1000);
    }
  };

  const handleMarkAllRead = () => {
    updateLastSeen();
    setUnreadCount(0);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-white/80 hover:text-white hover:bg-forest-light h-9 w-9"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-[#C15B2E] rounded-full leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[380px] p-0"
        sideOffset={8}
      >
        <NotificationPopover
          notifications={notifications}
          lastSeenTimestamp={getLastSeen()}
          onMarkAllRead={handleMarkAllRead}
          portalType={portalType}
        />
      </PopoverContent>
    </Popover>
  );
}
