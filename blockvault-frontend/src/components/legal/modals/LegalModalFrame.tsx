import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { GlowingSeparator } from '@/components/ui/glowing-separator';

interface LegalModalFrameProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  widthClassName?: string;
  className?: string;
  contentClassName?: string;
  overlayClassName?: string;
  headerAccent?: 'blue' | 'green' | 'violet';
}

const iconAccentMap: Record<NonNullable<LegalModalFrameProps['headerAccent']>, string> = {
  blue: 'bg-accent-blue/10 text-accent-blue border-accent-blue/30 shadow-[0_0_15px_hsl(var(--accent-blue-glow))]',
  green: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 shadow-[0_0_15px_rgba(52,211,153,0.3)]',
  violet: 'bg-violet-500/10 text-violet-500 border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.3)]',
};

export function LegalModalFrame({
  icon,
  title,
  subtitle,
  onClose,
  children,
  footer,
  widthClassName = 'max-w-2xl',
  className,
  contentClassName,
  overlayClassName,
  headerAccent = 'blue',
}: LegalModalFrameProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[999] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm",
        overlayClassName,
      )}
    >
      <div
        className={cn(
          `legal-modal flex w-full ${widthClassName} max-h-[88vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl`,
          'animate-in fade-in-0 zoom-in-95 duration-200',
          className,
        )}
      >
        <div className="flex items-start justify-between px-6 py-5">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-xl border',
                iconAccentMap[headerAccent],
              )}
            >
              {icon}
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <Button
            onClick={onClose}
            variant="modal-ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="mx-6"><GlowingSeparator /></div>
        <div className={cn('flex-1 overflow-y-auto px-6 py-6', contentClassName)}>
          {children}
        </div>
        {footer && (
          <>
            <div className="mx-6"><GlowingSeparator /></div>
            <div className="flex items-center justify-end gap-3 px-6 py-4">
              {footer}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

