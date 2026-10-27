import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/60",
  secondary:
    "border border-ink-950/20 bg-white text-ink-950 hover:border-ink-950/45 hover:bg-paper disabled:text-ink-400",
  ghost: "text-ink-600 hover:bg-ink-950/5 hover:text-ink-950",
  danger: "bg-ink-950 text-white hover:bg-brand-700",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-[2px] font-semibold tracking-[-0.01em] transition-colors duration-150",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
    "disabled:cursor-not-allowed",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("border border-ink-950/15 bg-white", className)}>{children}</div>;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("h-4 w-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** `compact`: icon only on small screens (dashboard header). `tone="light"`: for dark backgrounds. */
export function Logo({
  href = "/",
  compact = false,
  tone = "dark",
}: {
  href?: string;
  compact?: boolean;
  tone?: "dark" | "light";
}) {
  return (
    <Link
      href={href}
      aria-label="PaintCode Finder home"
      className={cn(
        "group flex items-center gap-2.5 font-semibold tracking-tight",
        tone === "light" ? "text-white" : "text-ink-950",
      )}
    >
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center bg-brand-600 font-mono text-[11px] font-semibold leading-none tracking-[0.02em] text-white transition-colors duration-200 group-hover:bg-brand-700",
          tone === "light" && "ring-1 ring-inset ring-white/30",
        )}
      >
        PC
      </span>
      <span className={cn("leading-none", compact && "max-sm:hidden")}>
        <span
          className={cn(
            "block font-display text-[19px] font-semibold leading-none tracking-[-0.025em]",
            tone === "light" ? "text-white" : "text-ink-950",
          )}
        >
          PaintCode <span className={tone === "light" ? "text-white/55" : "text-ink-400"}>Finder</span>
        </span>
        <span
          className={cn(
            "mt-1.5 block font-mono text-[8px] font-medium uppercase leading-none tracking-[0.2em]",
            tone === "light" ? "text-white/50" : "text-ink-400",
          )}
        >
          Paint lab / UK
        </span>
      </span>
    </Link>
  );
}

const ALERT_ICONS = {
  info: "M11 17h2v-6h-2v6Zm1-15C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16ZM11 9h2V7h-2v2Z",
  success: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 14.6-4.2-4.2 1.4-1.4 2.8 2.8 5.8-5.8 1.4 1.4-7.2 7.2Z",
  warning: "M12 2 1 21h22L12 2Zm0 5.4L18.9 19H5.1L12 7.4ZM11 10h2v5h-2v-5Zm0 7h2v2h-2v-2Z",
  error: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z",
} as const;

export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "success" | "warning" | "error";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    info: "bg-brand-50 text-brand-800 ring-brand-100",
    success: "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
    warning: "bg-amber-50 text-amber-900 ring-amber-200/80",
    error: "bg-red-50 text-red-800 ring-red-200/80",
  };

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-[2px] px-4 py-3 text-sm ring-1", tones[tone], className)}
    >
      <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 opacity-70" fill="currentColor" aria-hidden>
        <path d={ALERT_ICONS[tone]} />
      </svg>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
