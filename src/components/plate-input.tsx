"use client";

import type { ComponentProps } from "react";
import { cn } from "@/components/ui";

/** Registration/VIN field with a slim UK plate band - the plate is a reference, not the whole interface. */
export function PlateInput({
  className,
  size = "lg",
  value,
  ...props
}: Omit<ComponentProps<"input">, "size"> & { size?: "md" | "lg" }) {
  const strValue = typeof value === "string" ? value : "";
  const isLong = strValue.length > 8;

  return (
    <div
      className={cn(
        "group relative flex w-full overflow-hidden border border-ink-950/25 bg-white",
        "transition-colors duration-200 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600/15",
        className,
      )}
    >
      <div className="relative flex w-11 shrink-0 flex-col items-center justify-center gap-1 border-r border-ink-950/20 bg-ink-950 text-white sm:w-12">
        <span className="leading-none text-plate-yellow" aria-hidden>
          {isLong ? (
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
              <path d="M3 5h18v14H3V5Zm2 2v10h14V7H5Zm2 2h10v2H7V9Zm0 4h6v2H7v-2Z" />
            </svg>
          ) : (
            <span className="text-[10px]">★</span>
          )}
        </span>
        <span className="plate text-[10px] font-bold leading-none sm:text-[11px]">{isLong ? "VIN" : "UK"}</span>
      </div>
      <input
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={20}
        value={value}
        className={cn(
          "plate relative z-10 w-full min-w-0 bg-transparent px-4 text-center font-bold text-ink-950 outline-none placeholder:text-ink-300",
          size === "lg"
            ? isLong
              ? "h-16 text-xl tracking-normal sm:h-[4.5rem] sm:text-3xl"
              : "h-16 text-4xl sm:h-[4.5rem] sm:text-5xl"
            : isLong
              ? "h-12 text-base tracking-normal"
              : "h-12 text-2xl",
        )}
        {...props}
      />
    </div>
  );
}
