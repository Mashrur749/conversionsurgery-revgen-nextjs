'use client';

import { useEffect } from 'react';

interface RecentClient {
  id: string;
  name: string;
  timestamp: number;
}

const RECENT_CLIENTS_KEY = 'cs-recent-clients';
const MAX_RECENT = 5;

interface Props {
  clientId: string;
  clientName: string;
}

/**
 * Invisible component that records a client visit to localStorage
 * for the "Recently Viewed" feature on the clients list page.
 */
export function TrackRecentView({ clientId, clientName }: Props) {
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_CLIENTS_KEY);
      let recent: RecentClient[] = [];
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          recent = parsed.filter(
            (item): item is RecentClient =>
              typeof item === 'object' &&
              item !== null &&
              typeof (item as Record<string, unknown>).id === 'string' &&
              typeof (item as Record<string, unknown>).name === 'string' &&
              typeof (item as Record<string, unknown>).timestamp === 'number'
          );
        }
      }

      // Remove existing entry for this client
      recent = recent.filter((rc) => rc.id !== clientId);

      // Add to front
      recent.unshift({
        id: clientId,
        name: clientName,
        timestamp: Date.now(),
      });

      // Trim to max
      recent = recent.slice(0, MAX_RECENT);

      localStorage.setItem(RECENT_CLIENTS_KEY, JSON.stringify(recent));
    } catch {
      // localStorage may be unavailable — fail silently
    }
  }, [clientId, clientName]);

  return null;
}
