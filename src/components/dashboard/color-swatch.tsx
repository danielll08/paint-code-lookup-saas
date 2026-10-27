import { cn } from "@/components/ui";

const COLOR_MAP: Record<string, string> = {
  black: "#17181c",
  white: "#f4f5f7",
  grey: "#64748b",
  gray: "#64748b",
  silver: "#cbd5e1",
  red: "#dc2626",
  blue: "#2563eb",
  green: "#16a34a",
  yellow: "#eab308",
  orange: "#ea580c",
  brown: "#78350f",
  gold: "#d97706",
  purple: "#9333ea",
  beige: "#f5f5dc",
  bronze: "#92400e",
};

/**
 * Returns an approximate hex code and label based on registered color and paint name.
 */
export function resolveApproximateColor(
  paintName: string | null | undefined,
  registeredColor: string | null | undefined,
): { hex: string; isLight: boolean } {
  const combined = `${paintName ?? ""} ${registeredColor ?? ""}`.toLowerCase();

  for (const [name, hex] of Object.entries(COLOR_MAP)) {
    if (combined.includes(name)) {
      const isLight = ["white", "silver", "beige", "yellow"].includes(name);
      return { hex, isLight };
    }
  }

  // Default fallback if unknown
  return { hex: "#334155", isLight: false };
}

interface ColorSwatchProps {
  paintName?: string | null;
  registeredColor?: string | null;
  finish?: string | null;
  className?: string;
}

/**
 * Visual Color Swatch Preview with metallic/pearl/solid luster styling.
 * The sheen gradient is the sample itself (a paint panel), not decoration.
 */
export function ColorSwatch({ paintName, registeredColor, finish, className }: ColorSwatchProps) {
  const { hex } = resolveApproximateColor(paintName, registeredColor);
  const isMetallic = /metallic/i.test(finish ?? "") || /metallic/i.test(paintName ?? "");
  const isPearl = /pearl/i.test(finish ?? "") || /pearl/i.test(paintName ?? "");

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div
        className="relative h-16 w-16 shrink-0 overflow-hidden border border-ink-950/20"
        style={{ backgroundColor: hex }}
        role="img"
        aria-label={`Color sample preview for ${paintName || registeredColor || "vehicle"}`}
      >
        {/* Specular highlight / metallic reflection curve */}
        <div
          className={cn("absolute inset-0", isMetallic || isPearl ? "opacity-80" : "opacity-50")}
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.04) 42%, rgba(0,0,0,0.3) 100%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/25 to-transparent" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Colour preview</p>
          {finish && (
            <span className="border border-ink-950/20 bg-white px-2 py-0.5 text-[10px] font-medium text-ink-600">
              {finish}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-base font-semibold tracking-tight text-ink-950">
          {paintName || registeredColor || "Standard Finish"}
        </p>
        <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-ink-400">{hex}</p>
      </div>
    </div>
  );
}
