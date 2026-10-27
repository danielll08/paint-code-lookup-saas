import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid flex-1 lg:grid-cols-[1.02fr_0.98fr]">
      <aside className="relative hidden border-r border-ink-950/15 bg-paper-deep p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="flex items-center justify-between gap-4">
          <Logo />
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-400">Dossier / 2026</span>
        </div>

        <div className="max-w-md py-12">
          <p className="flex items-center gap-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-ink-500">
            <span className="h-1.5 w-1.5 bg-brand-600" aria-hidden />
            Account access / 01
          </p>
          <h2 className="mt-4 font-display text-[clamp(2.4rem,3.4vw,3.5rem)] font-semibold leading-[1.03] tracking-[-0.04em] text-ink-950">
            The paint code,
            <br />
            before the coffee.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-500">
            One registration. Two data sources. An exact OEM paint code in about three seconds - ready to mix, save or
            print.
          </p>

          <div className="mt-8 border border-ink-950/20 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-ink-950/15 bg-paper px-4 py-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">Specimen / 002</span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-950">
                <span className="h-1.5 w-1.5 bg-emerald-600" />
                Match found
              </span>
            </div>

            <div className="grid grid-cols-[1fr_4.75rem]">
              <div className="p-4">
                <span className="plate inline-flex h-7 items-center border border-ink-950/20 bg-white px-2 text-xs font-bold text-ink-950">
                  YC26 WCA
                </span>
                <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-400">OEM paint code</p>
                <p className="mt-1 font-mono text-5xl font-medium leading-none tracking-[-0.05em] text-ink-950">LY9T</p>
                <p className="mt-1.5 text-xs text-ink-500">Mythos Black Metallic</p>
              </div>
              <div className="flex items-end border-l border-ink-950/15 bg-[#17181c] p-3">
                <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/50">Metallic</span>
              </div>
            </div>
          </div>

          <ul className="mt-8 space-y-3">
            {["No paint code = no charge", "Free re-checks for 30 days", "Top-up credits never expire"].map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-ink-600">
                <span className="grid h-4 w-4 place-items-center border border-brand-200 bg-white text-brand-600">
                  <svg viewBox="0 0 20 20" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
                    <path d="m4.5 10.5 3.4 3.4 7.6-7.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-400">
          © PaintCode Finder · Built for UK bodyshops
        </p>
      </aside>

      <div className="flex flex-1 flex-col items-center justify-center bg-paper px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 lg:hidden">
          <Logo />
        </div>
        <div className="w-full max-w-md">
          <div className="border border-ink-950/20 bg-white">
            <div className="h-1 bg-brand-600" />
            <div className="p-6 sm:p-8">{children}</div>
          </div>
          <p className="mt-5 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-ink-400">
            Secure account / No paint code = no charge
          </p>
        </div>
      </div>
    </div>
  );
}
