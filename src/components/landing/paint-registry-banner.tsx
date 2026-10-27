import { cn } from "@/components/ui";

type Specimen = {
  code: string;
  name: string;
  hex: string;
  tone: "light" | "dark";
  brand?: boolean;
  mobileHidden?: boolean;
};

/**
 * A wall of OEM paint chips. The brand red is itself a paint code (C8102E),
 * and the empty slot points at the lookup box below.
 */
const SPECIMENS: Specimen[] = [
  { code: "LY7W", name: "Light silver", hex: "#c9c7c0", tone: "light" },
  { code: "475", name: "Sapphire", hex: "#15171b", tone: "dark" },
  { code: "02C", name: "Rally blue", hex: "#284a8a", tone: "dark" },
  { code: "070", name: "Blizzard", hex: "#e9e6db", tone: "light", mobileHidden: true },
  { code: "NH-731P", name: "Crystal black", hex: "#24282c", tone: "dark", mobileHidden: true },
  { code: "C8102E", name: "Signature red", hex: "#c8102e", tone: "dark", brand: true },
];

const TONE = {
  light: "text-ink-950",
  dark: "text-white",
} as const;

export function PaintRegistryBanner() {
  return (
    <section aria-labelledby="registry-title" className="bg-ink-950 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:h-[22rem] lg:grid-cols-[0.7fr_1.3fr] xl:grid-cols-[0.75fr_1.25fr]">
          <div className="flex flex-col justify-center gap-5 py-7 sm:gap-6 sm:py-8 lg:gap-6 lg:py-8 lg:pr-12">
            <p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-white/55 sm:text-[10px]">
              <span className="h-1.5 w-1.5 shrink-0 bg-brand-500" aria-hidden />
              Paint code registry / Vol. 01
            </p>

            <div>
              <p
                id="registry-title"
                className="font-display text-[clamp(2.25rem,4.4vw,3.75rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-white"
              >
                Every colour
                <br />
                has a number<span className="text-brand-500">.</span>
              </p>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-white/55 sm:text-[15px] lg:text-sm xl:text-[15px]">
                OEM paint codes for every UK registration.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <a
                href="#lookup"
                className="group inline-flex h-11 items-center gap-2 border border-white/25 px-5 font-mono text-[10px] uppercase tracking-[0.16em] text-white transition-colors hover:border-white/60 hover:bg-white/5"
              >
                Find your code
                <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5">
                  →
                </span>
              </a>
              <span className="hidden items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/50 xl:inline-flex">
                <span className="h-1.5 w-1.5 bg-brand-600" aria-hidden />
                C8102E / PaintCode red
              </span>
            </div>
          </div>

          <ul
            role="list"
            aria-label="Paint code specimens"
            className="grid h-full grid-cols-5 grid-rows-1 gap-px bg-white/10 sm:grid-cols-7 -mx-4 sm:-mx-6 lg:mx-0"
          >
            {SPECIMENS.map((specimen, index) => (
              <li
                key={specimen.code}
                className={cn(
                  "relative flex min-h-24 min-w-0 flex-col justify-end overflow-hidden px-1.5 py-2.5 sm:min-h-28 sm:justify-between sm:px-2 sm:py-4 lg:min-h-0 lg:py-3 xl:p-4",
                  TONE[specimen.tone],
                  specimen.mobileHidden && "hidden sm:flex",
                )}
                style={{ backgroundColor: specimen.hex }}
              >
                {specimen.brand && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-1.5 border border-white/30 sm:inset-2"
                  />
                )}

                <span className="hidden font-mono text-[9px] uppercase tracking-[0.16em] opacity-45 sm:block lg:text-[8px] xl:text-[9px]">
                  {String(index + 1).padStart(2, "0")}
                </span>

                {specimen.brand && (
                  <span
                    aria-hidden
                    className="absolute right-2 top-2 border border-white/40 px-1 py-0.5 font-mono text-[6px] font-semibold uppercase leading-none tracking-[0.12em] sm:right-3 sm:top-3 sm:text-[7px]"
                  >
                    PC
                  </span>
                )}

                <span className="min-w-0">
                  <span className="block truncate font-mono text-[11px] font-medium leading-none tracking-[-0.01em] sm:text-[16px] xl:text-[18px]">
                    {specimen.code}
                  </span>
                  <span
                    className={cn(
                      "mt-1 block truncate font-mono text-[6px] uppercase leading-none tracking-[0.02em] sm:mt-1.5 sm:text-[8px] sm:tracking-[0.02em] xl:tracking-[0.06em]",
                      specimen.brand ? "opacity-100" : "opacity-75",
                    )}
                  >
                    {specimen.name}
                  </span>
                </span>
              </li>
            ))}

            <li className="flex min-h-24 min-w-0 overflow-hidden bg-ink-900 p-1 sm:min-h-28 sm:p-2 lg:min-h-0 xl:p-2.5">
              <a
                href="#lookup"
                aria-label="Your code — find it"
                className="group flex min-w-0 flex-1 flex-col border border-dashed border-white/40 bg-white/[0.03] p-1.5 text-white transition-colors hover:border-white/60 hover:bg-brand-600 lg:p-2.5 xl:p-3"
              >
                <span className="hidden font-mono text-[9px] uppercase tracking-[0.16em] text-white/55 transition-colors group-hover:text-white/75 sm:block lg:text-[8px] xl:text-[9px]">
                  07
                </span>
                <span
                  aria-hidden
                  className="flex flex-1 items-center justify-center py-1 font-display text-3xl font-semibold leading-none text-brand-500 transition-colors group-hover:text-white sm:text-5xl xl:text-6xl"
                >
                  ?
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-mono text-[7px] font-medium uppercase leading-none tracking-[0.02em] sm:text-[10px] sm:tracking-[0.02em] lg:text-[8px] lg:tracking-[0.02em] xl:text-[10px] xl:tracking-[0.04em]">
                    Your code
                  </span>
                  <span className="mt-1 block truncate font-mono text-[6px] uppercase leading-none tracking-[0.02em] text-white/55 transition-colors group-hover:text-white/80 sm:text-[8px] sm:tracking-[0.08em] lg:text-[7px] lg:tracking-[0.02em] xl:text-[8px] xl:tracking-[0.12em]">
                    Find it →
                  </span>
                </span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
