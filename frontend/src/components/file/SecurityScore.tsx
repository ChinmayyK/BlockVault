import React, { useEffect, useState } from 'react';
import {
  Lock,
  Search,
  Scissors,
  Fingerprint,
  Link2,
  Check,
  X,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/* ------------------------------------------------------------------ */
/*  Score computation                                                  */
/* ------------------------------------------------------------------ */

export interface SecurityCategory {
  key: string;
  label: string;
  icon: React.ReactNode;
  passed: boolean;
  points: number;
  color: string;
}

export function computeSecurityScore(file: any): { score: number; categories: SecurityCategory[] } {
  const categories: SecurityCategory[] = [
    {
      key: 'encryption',
      label: 'Encryption',
      icon: <Lock className="w-3.5 h-3.5" />,
      passed: !!file?.encrypted,
      points: 20,
      color: 'text-indigo-400',
    },
    {
      key: 'scan',
      label: 'Risk Scan',
      icon: <Search className="w-3.5 h-3.5" />,
      passed: true, // scan always runs on upload
      points: 20,
      color: 'text-cyan-400',
    },
    {
      key: 'redaction',
      label: 'Redactions',
      icon: <Scissors className="w-3.5 h-3.5" />,
      passed: file?.redaction_status === 'completed',
      points: 20,
      color: 'text-purple-400',
    },
    {
      key: 'proof',
      label: 'ZK Proof',
      icon: <Fingerprint className="w-3.5 h-3.5" />,
      passed: file?.proof_status === 'verified',
      points: 20,
      color: 'text-emerald-400',
    },
    {
      key: 'anchor',
      label: 'Blockchain Anchor',
      icon: <Link2 className="w-3.5 h-3.5" />,
      passed: !!file?.tx_hash,
      points: 20,
      color: 'text-amber-400',
    },
  ];

  const score = categories.reduce((sum, c) => (c.passed ? sum + c.points : sum), 0);
  return { score, categories };
}

/* ------------------------------------------------------------------ */
/*  Ring gauge constants                                                */
/* ------------------------------------------------------------------ */

const RING_SIZE = 120;
const STROKE_WIDTH = 8;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function getScoreColor(score: number): { stroke: string; text: string; glow: string } {
  if (score >= 80) return { stroke: 'stroke-emerald-500', text: 'text-emerald-400', glow: 'drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]' };
  if (score >= 50) return { stroke: 'stroke-amber-500', text: 'text-amber-400', glow: 'drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' };
  return { stroke: 'stroke-rose-500', text: 'text-rose-400', glow: 'drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' };
}

function getScoreLabel(score: number): string {
  if (score === 100) return 'Maximum';
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Moderate';
  return 'Weak';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface SecurityScoreProps {
  file: any;
  className?: string;
}

export const SecurityScore: React.FC<SecurityScoreProps> = ({ file, className }) => {
  const { score, categories } = computeSecurityScore(file);
  const colors = getScoreColor(score);
  const label = getScoreLabel(score);

  // Animate the ring on mount
  const [animatedOffset, setAnimatedOffset] = useState(CIRCUMFERENCE);

  useEffect(() => {
    const targetOffset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;
    // Small delay to trigger CSS transition
    const timer = setTimeout(() => setAnimatedOffset(targetOffset), 60);
    return () => clearTimeout(timer);
  }, [score]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('space-y-4', className)}>
        {/* Header */}
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> Security Score
        </h4>

        <div className="bg-muted/30 border rounded-lg p-4 shadow-inner">
          {/* Ring + Score */}
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <svg
                width={RING_SIZE}
                height={RING_SIZE}
                className={cn('score-ring-svg', colors.glow)}
                style={{ transform: 'rotate(-90deg)' }}
              >
                {/* Background track */}
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  className="stroke-muted/50"
                  strokeWidth={STROKE_WIDTH}
                />
                {/* Score arc */}
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  className={cn(colors.stroke)}
                  strokeWidth={STROKE_WIDTH}
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={animatedOffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
                />
              </svg>
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn('text-2xl font-bold tabular-nums', colors.text)}>{score}</span>
                <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-widest">/ 100</span>
              </div>
            </div>

            {/* Label + Short summary */}
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-bold', colors.text)}>{label} Protection</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                {score === 100
                  ? 'All security operations have been completed.'
                  : `${categories.filter(c => c.passed).length} of ${categories.length} security checks passed.`}
              </p>
            </div>
          </div>

          {/* Breakdown */}
          <div className="mt-4 space-y-1.5">
            {categories.map((cat) => (
              <Tooltip key={cat.key}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-default',
                      cat.passed
                        ? 'bg-emerald-500/5 hover:bg-emerald-500/10'
                        : 'bg-muted/20 hover:bg-muted/30 opacity-60'
                    )}
                  >
                    <span className={cn(cat.passed ? cat.color : 'text-muted-foreground/50')}>
                      {cat.icon}
                    </span>
                    <span className={cn('flex-1 font-medium', cat.passed ? 'text-foreground' : 'text-muted-foreground')}>
                      {cat.label}
                    </span>
                    <span className="flex items-center gap-1">
                      {cat.passed ? (
                        <span className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-emerald-400" />
                        </span>
                      ) : (
                        <span className="w-4 h-4 rounded-full bg-muted/40 flex items-center justify-center">
                          <X className="w-2.5 h-2.5 text-muted-foreground/40" />
                        </span>
                      )}
                      <span className={cn('text-[10px] tabular-nums font-mono', cat.passed ? 'text-emerald-400' : 'text-muted-foreground/40')}>
                        +{cat.points}
                      </span>
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs">
                  {cat.passed ? `${cat.label} verified` : `${cat.label} not yet applied`}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
