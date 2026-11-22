import React, { type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export interface ShimmerButtonProps extends ComponentPropsWithoutRef<"button"> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  className?: string;
  children?: React.ReactNode;
}

export const ShimmerButton = React.forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      shimmerColor = "#ffffff",
      shimmerDuration = "3s",
      borderRadius = "6px",
      background = "#000000",
      className,
      children,
      style,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        style={{
          borderRadius,
          ...style,
        }}
        className={cn(
          "group relative flex cursor-pointer items-center justify-center overflow-hidden border border-white/15 px-6 py-2.5 text-white shadow-2xl transition-all duration-300 active:scale-[0.99]",
          className,
        )}
        {...props}
      >
        {/* Rotating shimmering border beam */}
        <div
          className="pointer-events-none absolute -inset-[150%] z-0"
          style={{
            background: `conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 270deg, ${shimmerColor} 330deg, transparent 360deg)`,
            animation: `shimmer-spin ${shimmerDuration} linear infinite`,
          }}
        />

        {/* Inner button backdrop */}
        <div
          className="pointer-events-none absolute inset-[1px] z-[1] transition-colors"
          style={{
            borderRadius: `calc(${borderRadius} - 1px)`,
            background,
          }}
        />

        {/* Shimmer sweep reflection */}
        <div
          className="pointer-events-none absolute inset-0 z-[2]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 35%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.03) 65%, transparent 100%)",
            backgroundSize: "200% 100%",
            animation: "shimmer-sweep 2.8s ease-in-out infinite",
          }}
        />

        {/* Subtle inset highlight */}
        <div
          className="pointer-events-none absolute inset-0 z-[3] rounded-[inherit] shadow-[inset_0_-8px_10px_#ffffff18] transition-all duration-300 group-hover:shadow-[inset_0_-6px_10px_#ffffff2f]"
        />

        {/* Button Content */}
        <div className="relative z-10 flex w-full items-center justify-center gap-2">
          {children}
        </div>
      </button>
    );
  },
);

ShimmerButton.displayName = "ShimmerButton";
export default ShimmerButton;
