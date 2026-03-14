import React from 'react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Sensitivity levels                                                 */
/* ------------------------------------------------------------------ */

const SENSITIVITY_LEVELS = [
  {
    level: 'High',
    color: 'bg-red-500',
    border: 'border-red-500/50',
    glow: 'shadow-red-500/30',
    description: 'SSN, Credit Cards, Passport, Aadhaar',
  },
  {
    level: 'Medium',
    color: 'bg-amber-500',
    border: 'border-amber-500/50',
    glow: 'shadow-amber-500/30',
    description: 'Names, Emails, Phone Numbers',
  },
  {
    level: 'Low',
    color: 'bg-emerald-500',
    border: 'border-emerald-500/50',
    glow: 'shadow-emerald-500/30',
    description: 'Organizations, Dates, Locations',
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface HeatmapLegendProps {
  visible: boolean;
  className?: string;
}

export const HeatmapLegend: React.FC<HeatmapLegendProps> = ({ visible, className }) => {
  if (!visible) return null;

  return (
    <div
      className={cn(
        'absolute bottom-4 right-4 z-20 w-56 rounded-lg border bg-card/95 backdrop-blur-md p-3 shadow-xl',
        'animate-in fade-in slide-in-from-bottom-2 duration-200',
        className
      )}
    >
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Sensitivity Legend
      </p>
      <div className="space-y-2">
        {SENSITIVITY_LEVELS.map((level) => (
          <div key={level.level} className="flex items-center gap-2.5">
            <div
              className={cn(
                'w-3 h-3 rounded-sm shrink-0 border shadow-sm',
                level.color,
                level.border,
                level.glow
              )}
            />
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-semibold text-foreground">{level.level}</span>
              <p className="text-[9px] text-muted-foreground/70 leading-tight truncate">
                {level.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
