import Link from "next/link";
import { ButtonLink, cn, Logo } from "@/components/ui";
import { HeroSearch } from "./hero-search";
import { PaintRegistryBanner } from "./paint-registry-banner";
import { PricingTabs } from "./pricing-tabs";

const STEPS = [
  {
    title: "Enter the registration",
    body: "Type the number plate (or VIN) of the car you are repairing. Our plate-style box keeps it quick on any device.",
  },
  {
    title: "We scan source data",
    body: "We query manufacturer-grade vehicle databases and fall back to a second source automatically.",
  },
  {
    title: "Get the exact paint code",
    body: "The OEM paint code, colour name and finish - in about 3 seconds, ready to mix or print.",
  },
];

const STEP_WORDS = ["Reg", "Scan", "Code"];

const FAQ = [
  {
    q: "What if no paint code is found?",
    a: "You are not charged. If our data sources don't hold the paint code for that car, the credit is refunded to your balance automatically.",
  },
  {
    q: "Do I pay again to look up the same car?",
    a: "No. Any car you looked up in the last 30 days is shown again instantly from your history, free of charge.",
  },
  {
    q: "Do top-up credits expire?",
    a: "Never - even if you cancel a monthly plan, credits you bought as a top-up stay on your account.",
  },
  {
    q: "Can I print the result for the workshop?",
    a: "Yes. Every successful lookup has a one-click workshop job sheet with the vehicle, paint code, finish and label location.",
  },
];

const TRUST_POINTS = ["3-second lookups", "OEM-grade data", "No paint code = no charge"];

const STATS = [
  { value: "3s", label: "Average lookup time" },
  { value: "2", label: "Data sources checked" },
  { value: "30d", label: "Free re-checks" },
  { value: "£0", label: "When no code is found" },
];

const PALETTE = ["#1b2026", "#c8102e", "#a89a7d", "#44584a", "#536273", "#d9d2c2"];

const FOOTER_SWATCHES = ["#c8102e", "#1b2026", "#8c8578", "#d9d2c2", "#44584a", "#536273", "#a89a7d", "#7a2a2f"];

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="m4.5 10.5 3.4 3.4 7.6-7.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 10h12m-5-5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-center gap-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-ink-500", className)}>
      <span className="h-1.5 w-1.5 shrink-0 bg-brand-600" aria-hidden />
      {children}
    </p>
  );
}

/** A paint specimen record: one large swatch, its OEM data and the workshop facts around it. */
function HeroPreview() {
  return (
    <div className="w-full max-w-[34rem] lg:ml-auto" aria-hidden>
      <div className="border border-ink-950/20 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-ink-950/15 bg-paper-deep/45 px-4 py-2.5">
          <span className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-ink-500">Specimen / 001</span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-ink-950">
            <span className="h-1.5 w-1.5 bg-emerald-600" />
            Match found
          </span>
        </div>

        <div className="grid sm:grid-cols-[1.05fr_0.95fr]">
          <div className="relative overflow-hidden bg-[#17181c] p-5 text-white sm:p-6">
            <span className="pointer-events-none absolute inset-y-0 left-1/3 w-10 -skew-x-12 bg-white/[0.045]" />
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/50">OEM paint code</p>
            <p className="mt-2 font-mono text-[4.25rem] font-medium leading-none tracking-[-0.05em]">475</p>
            <p className="mt-2 text-sm text-white/75">Black Sapphire Metallic</p>
            <div className="mt-5 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/45">
              <span className="h-px flex-1 bg-white/20" />
              Metallic
            </div>
          </div>

          <div className="flex flex-col justify-between border-t border-ink-950/15 p-5 sm:border-l sm:border-t-0 sm:p-6">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-400">Vehicle</p>
              <p className="mt-1.5 font-display text-xl font-semibold leading-tight tracking-[-0.02em]">BMW 320d M Sport</p>
              <p className="mt-1 text-xs text-ink-500">2019 · Black · Diesel</p>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-ink-950/10 pt-3 text-xs">
              {[
                ["Finish", "Metallic"],
                ["Colour", "Black"],
                ["Source", "OEM"],
                ["Checked", "2 sources"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-400">{label}</dt>
                  <dd className="mt-0.5 font-medium text-ink-950">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="grid grid-cols-6">
          {PALETTE.map((hex) => (
            <span key={hex} className="h-9 border-r border-white/10 last:border-r-0" style={{ backgroundColor: hex }} />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-ink-950/15 bg-paper px-4 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">
          <span>BM19 SAP</span>
          <span className="hidden sm:inline">Ref. PC-001</span>
          <span className="text-brand-600">1 credit</span>
        </div>
      </div>

      <p className="mt-3 font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-ink-400">
        Sample record · live results include VIN and label location
      </p>
    </div>
  );
}

export function LandingPage({ variant = "home" }: { variant?: "home" | "about" }) {
  return (
    <div className="flex flex-1 flex-col bg-paper">
      <div className="border-b border-ink-950/15 bg-paper-deep text-ink-600">
        <div className="mx-auto flex h-8 max-w-7xl items-center justify-between gap-4 px-4 font-mono text-[9px] uppercase tracking-[0.16em] sm:px-6 lg:px-8">
          <span className="whitespace-nowrap">OEM paint data for UK workshops</span>
          <span className="hidden sm:inline">Dossier / 2026</span>
          <span className="hidden whitespace-nowrap sm:inline">No paint code = no charge</span>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-ink-950/15 bg-paper">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-7 md:flex">
            {[
              ["#how-it-works", "01", "How it works"],
              ["#pricing", "02", "Pricing"],
              ["#faq", "03", "FAQ"],
            ].map(([href, number, label]) => (
              <a key={href} href={href} className="group inline-flex items-baseline gap-1.5 text-sm text-ink-600 transition-colors hover:text-ink-950">
                <span className="font-mono text-[9px] text-ink-400 transition-colors group-hover:text-brand-600">{number}</span>
                {label}
              </a>
            ))}
          </nav>
          <nav className="flex items-center gap-1.5 sm:gap-2">
            {variant === "about" ? (
              <ButtonLink href="/dashboard" size="sm">
                Go to dashboard
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="ghost" size="sm" className="max-sm:hidden">
                  Log in
                </ButtonLink>
                <ButtonLink href="/signup" size="sm">
                  Sign up free
                  <ArrowIcon className="h-4 w-4" />
                </ButtonLink>
              </>
            )}
          </nav>
        </div>
      </header>

      <PaintRegistryBanner />

      <main className="flex-1">
        <section className="border-b border-ink-950/15">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-14 pt-8 sm:px-6 sm:pt-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-16 lg:px-8 lg:pb-20 lg:pt-12">
            <div>
              <SectionLabel>OEM paint data / UK registrations</SectionLabel>

              <h1 className="mt-5 max-w-[13ch] font-display text-[clamp(2.85rem,5.6vw,5.1rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-ink-950">
                The paint code,
                <br />
                <span className="text-brand-600">before the mix.</span>
              </h1>

              <p className="mt-5 max-w-[34rem] text-base leading-relaxed text-ink-600 sm:text-lg">
                The exact OEM paint code, colour name and finish from any UK registration. Built for the workshop floor.
              </p>

              <div className="mt-8">
                <HeroSearch />
              </div>

              <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
                {TRUST_POINTS.map((point) => (
                  <li key={point} className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-500">
                    <CheckIcon className="h-3 w-3 text-brand-600" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <HeroPreview />
          </div>

          <div className="border-t border-ink-950/15">
            <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-ink-950/10 sm:grid-cols-4">
              {STATS.map((stat) => (
                <div key={stat.label} className="bg-paper px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
                  <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-400">{stat.label}</dt>
                  <dd className="mt-2 font-display text-3xl font-semibold leading-none tracking-[-0.03em] text-ink-950">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 border-b border-ink-950/15 bg-paper px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col justify-between gap-6 border-b border-ink-950/15 pb-8 lg:flex-row lg:items-end">
              <div>
                <SectionLabel>02 / Procedure</SectionLabel>
                <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-ink-950">
                  Three steps.
                  <br />
                  <span className="text-ink-400">One exact code.</span>
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-ink-500">
                Purpose-built for the workshop floor. Fast enough to use with a customer at the counter.
              </p>
            </div>

            <ol className="grid border-t border-ink-950/10 lg:grid-cols-3">
              {STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className={cn(
                    "py-7 lg:py-9",
                    i < 2 && "border-b border-ink-950/15 lg:border-b-0 lg:border-r",
                    i > 0 && "lg:pl-8",
                    i < 2 && "lg:pr-8",
                  )}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-brand-600">
                      Step 0{i + 1}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-300">{STEP_WORDS[i]}</span>
                  </div>
                  <h3 className="mt-4 font-display text-xl font-semibold tracking-[-0.02em] text-ink-950">{step.title}</h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-500">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-24 border-b border-ink-950/15 bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 border-b border-ink-950/15 pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <SectionLabel>03 / Rate card</SectionLabel>
                <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-ink-950">
                  Simple, credit-based pricing
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-500 sm:text-base">
                  1 credit = 1 successful paint code lookup. Failed lookups are always refunded.
                </p>
              </div>
              <div className="hidden border border-ink-950/15 px-4 py-3 lg:block">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-400">Note</p>
                <p className="mt-1.5 text-sm font-medium text-ink-950">Cancel anytime. Top-up credits never expire.</p>
              </div>
            </div>

            <div className="mt-8">
              <PricingTabs />
            </div>

            <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-400">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <rect x="4" y="10" width="16" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
              </svg>
              Secure checkout by Stripe · Cancel anytime · Top-up credits never expire
            </p>
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 border-b border-ink-950/15 bg-paper-deep/55 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
            <div>
              <SectionLabel>04 / Questions</SectionLabel>
              <h2 className="mt-4 font-display text-[clamp(2.1rem,4vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-ink-950">
                Questions,
                <br />
                answered.
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-500">
                Everything you need to know before your first lookup. Still unsure?{" "}
                <Link href="/about" className="font-semibold text-brand-600 underline decoration-1 underline-offset-4 hover:text-brand-700">
                  Read about us
                </Link>
                .
              </p>
            </div>

            <div className="border-t border-ink-950/20">
              {FAQ.map((item, i) => (
                <details key={item.q} className="group border-b border-ink-950/15">
                  <summary className="flex items-center justify-between gap-4 py-5 text-left">
                    <span className="flex items-baseline gap-3">
                      <span className="font-mono text-[9px] text-ink-400">0{i + 1}</span>
                      <span className="text-base font-semibold tracking-[-0.01em] text-ink-950 sm:text-lg">{item.q}</span>
                    </span>
                    <span className="faq-icon grid h-7 w-7 shrink-0 place-items-center border border-ink-950/20 bg-white text-ink-950 transition-colors group-open:border-brand-600 group-open:bg-brand-600 group-open:text-white">
                      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M10 4v12M4 10h12" strokeLinecap="round" />
                      </svg>
                    </span>
                  </summary>
                  <p className="max-w-2xl pb-5 pl-7 text-sm leading-relaxed text-ink-500 sm:text-[15px]">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-ink-950/15 bg-paper px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="border border-ink-950/20 border-l-2 border-l-brand-600 bg-white">
              <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center lg:p-12">
                <div>
                  <SectionLabel>05 / Start a job</SectionLabel>
                  <h2 className="mt-4 font-display text-[clamp(2rem,3.8vw,3.1rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-ink-950">
                    Stop hunting for the sticker.
                  </h2>
                  <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-500 sm:text-base">
                    Create a free account and make your first lookup in under a minute. No subscription required.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <ButtonLink href="/signup" size="lg" className="whitespace-nowrap">
                    Create free account
                    <ArrowIcon className="h-4 w-4" />
                  </ButtonLink>
                  <a
                    href="#pricing"
                    className="inline-flex h-12 items-center justify-center border border-ink-950/20 px-6 text-[15px] font-semibold text-ink-950 transition-colors hover:border-ink-950/45 hover:bg-paper"
                  >
                    See pricing
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-paper">
        <div aria-hidden className="grid grid-cols-8">
          {FOOTER_SWATCHES.map((hex) => (
            <span key={hex} className="h-1.5" style={{ backgroundColor: hex }} />
          ))}
        </div>

        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-10 border-b border-ink-950/15 pb-8 lg:grid-cols-[1fr_auto]">
            <div>
              <Logo />
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-500">
                OEM paint codes for UK bodyshops, garages and paint mixers. Built for speed on the workshop floor.
              </p>
            </div>

            <nav className="grid grid-cols-3 gap-8 text-sm">
              <div>
                <p className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-ink-400">Product</p>
                <div className="mt-3 flex flex-col gap-2">
                  <a href="#how-it-works" className="text-ink-600 hover:text-ink-950">
                    How it works
                  </a>
                  <a href="#pricing" className="text-ink-600 hover:text-ink-950">
                    Pricing
                  </a>
                  <a href="#faq" className="text-ink-600 hover:text-ink-950">
                    FAQ
                  </a>
                </div>
              </div>
              <div>
                <p className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-ink-400">Account</p>
                <div className="mt-3 flex flex-col gap-2">
                  <Link href="/login" className="text-ink-600 hover:text-ink-950">
                    Log in
                  </Link>
                  <Link href="/signup" className="text-ink-600 hover:text-ink-950">
                    Sign up free
                  </Link>
                  <Link href="/dashboard" className="text-ink-600 hover:text-ink-950">
                    Dashboard
                  </Link>
                </div>
              </div>
              <div>
                <p className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-ink-400">Company</p>
                <div className="mt-3 flex flex-col gap-2">
                  <Link href="/about" className="text-ink-600 hover:text-ink-950">
                    About us
                  </Link>
                </div>
              </div>
            </nav>
          </div>

          <div className="flex flex-col gap-2 pt-4 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-400 sm:flex-row sm:items-center sm:justify-between">
            <span>© PaintCode Finder. All rights reserved.</span>
            <span>Made for UK bodyshops</span>
            <span className="hidden sm:inline">Dossier / 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
