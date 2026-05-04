import { cn } from "@/lib/utils";

interface GlowingSeparatorProps {
  className?: string;
}

export function GlowingSeparator({ className }: GlowingSeparatorProps) {
  return (
    <div className={cn("h-[1px] w-full separator-glow", className)} />
  );
}
