"use client";

import type { ComponentProps } from "react";
import { cn } from "@/components/ui";

/** Text input styled like a UK number plate (yellow rear plate with GB band). */
export function PlateInput({
  className,
  size = "lg",
  ...props
}: Omit<ComponentProps<"input">, "size"> & { size?: "md" | "lg" }) {
  return (
    <div
      className={cn(
        "flex w-full overflow-hidden rounded-xl border-[3px] border-slate-900 bg-plate-yellow shadow-[0_2px_0_rgba(15,23,42,0.35)]",
        "focus-within:ring-4 focus-within:ring-brand-500/40",
        className,
      )}
    >
      <div className="flex w-12 shrink-0 flex-col items-center justify-end bg-[#003399] pb-1.5 text-white sm:w-14">
        <span className="mb-1 text-[10px] leading-none text-yellow-300" aria-hidden>
          ★
        </span>
        <span className="plate text-sm font-bold leading-none">UK</span>
      </div>
      <input
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={20}
        className={cn(
          "plate w-full min-w-0 bg-transparent px-4 text-center font-bold text-slate-950 outline-none placeholder:text-slate-900/30",
          size === "lg" ? "h-16 text-4xl sm:h-20 sm:text-5xl" : "h-12 text-2xl",
        )}
        {...props}
      />
    </div>
  );
}
