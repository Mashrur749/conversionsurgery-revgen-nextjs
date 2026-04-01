'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface LeadNavData {
  leadIds: string[];
  filters: string;
}

interface LeadNavigationProps {
  currentLeadId: string;
}

export function LeadNavigation({ currentLeadId }: LeadNavigationProps) {
  const router = useRouter();
  const [prevId, setPrevId] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);
  const [position, setPosition] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('cs-lead-nav-list');
      if (!stored) return;

      const data: LeadNavData = JSON.parse(stored);
      const idx = data.leadIds.indexOf(currentLeadId);
      if (idx === -1) return;

      setPrevId(idx > 0 ? data.leadIds[idx - 1] : null);
      setNextId(idx < data.leadIds.length - 1 ? data.leadIds[idx + 1] : null);
      setPosition(`${idx + 1} of ${data.leadIds.length}`);
    } catch {
      // localStorage unavailable or corrupted — hide navigation
    }
  }, [currentLeadId]);

  // Only render when navigating from the leads table
  if (!prevId && !nextId) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1">
        {position && (
          <span className="text-xs text-muted-foreground mr-1">{position}</span>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!prevId}
              onClick={() => {
                if (prevId) router.push(`/leads/${prevId}`);
              }}
              aria-label="Previous lead"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Previous lead</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!nextId}
              onClick={() => {
                if (nextId) router.push(`/leads/${nextId}`);
              }}
              aria-label="Next lead"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Next lead</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
