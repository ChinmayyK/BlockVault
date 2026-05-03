import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlowingSeparator } from './glowing-separator';

interface ModalProps {
  isOpen?: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
  showSeparator?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-xl',
  xl: 'max-w-2xl',
  '2xl': 'max-w-4xl',
};

export function Modal({
  isOpen = true,
  onClose,
  title,
  subtitle,
  children,
  footer,
  className,
  contentClassName,
  showSeparator = true,
  size = 'xl',
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className={cn(
          "relative w-full bg-black border border-white/10 shadow-2xl rounded-2xl",
          "animate-in fade-in-0 zoom-in-95 duration-200",
          sizeClasses[size],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || subtitle) && (
          <>
            <div className="flex items-start justify-between p-6 pb-0">
              <div className="flex-1">
                {title && (
                  <h2 className="text-2xl font-semibold text-white tracking-tight">
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="text-sm text-white/60 mt-1">
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {showSeparator && <div className="px-6 pt-4"><GlowingSeparator /></div>}
          </>
        )}

        {/* Content */}
        <div className={cn("p-6", contentClassName)}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <>
            <div className="px-6"><GlowingSeparator /></div>
            <div className="p-6 pt-4">
              {footer}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Modal Card Component for content sections
export function ModalCard({ 
  children, 
  className,
  variant = 'default' 
}: { 
  children: ReactNode; 
  className?: string;
  variant?: 'default' | 'bordered' | 'elevated';
}) {
  const variants = {
    default: 'bg-white/5 border-white/10',
    bordered: 'bg-black border border-white/20',
    elevated: 'bg-white/10 border-white/20 shadow-lg',
  };

  return (
    <div className={cn(
      "rounded-lg p-4",
      variants[variant],
      className
    )}>
      {children}
    </div>
  );
}

// Modal Section Component
export function ModalSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {title && (
        <h3 className="text-sm font-medium text-white/80 uppercase tracking-wider">
          {title}
        </h3>
      )}
      <div>{children}</div>
    </div>
  );
}


