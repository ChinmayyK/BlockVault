import { CSSProperties } from "react";
import { cn } from "@/lib/utils";

type Orientation = "vertical" | "horizontal";

interface GlowingDividerProps {
  orientation?: Orientation;
  length?: string;
  className?: string;
}

const gradientStyle = (orientation: Orientation): CSSProperties => {
  const axis = orientation === "vertical" ? "180deg" : "90deg";
  return {
    background: `linear-gradient(${axis}, hsl(var(--accent-blue) / 0) 0%, hsl(var(--accent-blue) / 0.9) 45%, hsl(var(--accent-blue) / 0) 100%)`,
  };
};

const glowStyle = (orientation: Orientation): CSSProperties => {
  const axis = orientation === "vertical" ? "180deg" : "90deg";
  return {
    background: `linear-gradient(${axis}, hsl(var(--accent-blue) / 0) 0%, hsl(var(--accent-blue) / 0.65) 50%, hsl(var(--accent-blue) / 0) 100%)`,
  };
};

export function GlowingDivider({
  orientation = "vertical",
  length,
  className,
}: GlowingDividerProps) {
  const isVertical = orientation === "vertical";
  const sizeStyle: CSSProperties = isVertical
    ? { minHeight: length ?? "12rem" }
    : { minWidth: length ?? "12rem" };

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative isolate pointer-events-none flex-none opacity-95",
        isVertical ? "w-px" : "h-px",
        className,
      )}
      style={sizeStyle}
    >
      <span
        className={cn(
          "block rounded-full",
          isVertical ? "w-full h-full" : "w-full h-full",
        )}
        style={gradientStyle(orientation)}
      />
      <span
        className="absolute inset-0 rounded-full blur-[18px]"
        style={glowStyle(orientation)}
      />
      <span
        className="absolute inset-0 rounded-full blur-[36px] opacity-60"
        style={glowStyle(orientation)}
      />
    </span>
  );
}



