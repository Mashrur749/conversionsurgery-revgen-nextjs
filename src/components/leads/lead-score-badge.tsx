"use client";

import { cn } from "@/lib/utils";
import { Flame, Thermometer, Snowflake } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Factor breakdown displayed in the score badge tooltip or expanded view. */
interface ScoreBadgeFactors {
  urgency: number;
  budget: number;
  engagement: number;
  intent: number;
  signals: string[];
}

interface LeadScoreBadgeProps {
  score: number;
  temperature: "hot" | "warm" | "cold";
  factors?: ScoreBadgeFactors;
  compact?: boolean;
}

/**
 * Displays a lead's score and temperature as a colored badge with an icon.
 * In compact mode, shows a small pill with tooltip; otherwise shows an expanded card with factor breakdown.
 */
export function LeadScoreBadge({
  score,
  temperature,
  factors,
  compact = false,
}: LeadScoreBadgeProps) {
  const config = {
    hot: {
      icon: Flame,
      bg: "bg-red-100 dark:bg-red-900/30",
      text: "text-red-700 dark:text-red-400",
      border: "border-red-200 dark:border-red-800",
      label: "Hot",
    },
    warm: {
      icon: Thermometer,
      bg: "bg-yellow-100 dark:bg-yellow-900/30",
      text: "text-yellow-700 dark:text-yellow-400",
      border: "border-yellow-200 dark:border-yellow-800",
      label: "Warm",
    },
    cold: {
      icon: Snowflake,
      bg: "bg-blue-100 dark:bg-blue-900/30",
      text: "text-blue-700 dark:text-blue-400",
      border: "border-blue-200 dark:border-blue-800",
      label: "Cold",
    },
  };

  const { icon: Icon, bg, text, border, label } = config[temperature];

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
                bg,
                text,
                border,
              )}
            >
              <Icon className="h-3 w-3" />
              <span>{score}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <p className="font-medium">
                {label} Lead - Score: {score}/100
              </p>
              {factors && (
                <div className="mt-1 text-xs space-y-0.5">
                  <p>Urgency: {factors.urgency}/25</p>
                  <p>Budget: {factors.budget}/25</p>
                  <p>Intent: {factors.intent}/25</p>
                  <p>Engagement: {factors.engagement}/25</p>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn("rounded-lg border p-3", bg, border)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-5 w-5", text)} />
          <span className={cn("font-semibold", text)}>{label}</span>
        </div>
        <span className={cn("text-2xl font-bold", text)}>{score}</span>
      </div>

      {factors && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="text-center">
            <div className="font-medium text-muted-foreground">Urgency</div>
            <div className={cn("font-semibold", text)}>
              {factors.urgency}/25
            </div>
          </div>
          <div className="text-center">
            <div className="font-medium text-muted-foreground">Budget</div>
            <div className={cn("font-semibold", text)}>{factors.budget}/25</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-muted-foreground">Intent</div>
            <div className={cn("font-semibold", text)}>{factors.intent}/25</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-muted-foreground">Engage</div>
            <div className={cn("font-semibold", text)}>
              {factors.engagement}/25
            </div>
          </div>
        </div>
      )}

      {factors?.signals && factors.signals.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {factors.signals.map((signal) => (
            <span
              key={signal}
              className={cn(
                "inline-flex items-center px-1.5 py-0.5 rounded text-xs",
                "bg-white/50 dark:bg-black/20",
              )}
            >
              {signal.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
