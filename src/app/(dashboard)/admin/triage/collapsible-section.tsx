'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsibleSectionProps {
  label: string;
  count?: number;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({
  label,
  count,
  defaultExpanded = true,
  children,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 group w-full text-left"
        aria-expanded={expanded}
      >
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          {label}
          {count !== undefined && (
            <span className="ml-2 text-muted-foreground font-normal normal-case tracking-normal">
              ({count})
            </span>
          )}
        </h2>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
        )}
      </button>

      {expanded && <div>{children}</div>}
    </div>
  );
}
