import Link from "next/link";
import { ButtonLink, Logo } from "@/components/ui";
import { HeroSearch } from "./hero-search";
import { PricingTabs } from "./pricing-tabs";

const STEPS = [
  { title: "Enter the registration", body: "Type the number plate (or VIN) of the car you are repairing." },
  { title: "We scan source data", body: "We query manufacturer-grade vehicle databases and fall back to a second source automatically." },
  { title: "Get the exact paint code", body: "The OEM paint code, colour name and finish - in about 3 seconds." },
];

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
];

/** Public marketing page. `variant="about"` is the signed-in "About us" view. */
export function LandingPage({ variant = "home" }: { variant?: "home" | "about" }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="flex items-center gap-2 text-sm">
            <a href="#pricing" className="hidden px-3 py-2 font-medium text-slate-600 hover:text-slate-900 sm:block">
              Pricing
            </a>
            {variant === "about" ? (
              <ButtonLink href="/dashboard" size="sm">
                Go to dashboard
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="ghost" size="sm">
                  Log in
                </ButtonLink>
                <ButtonLink href="/signup" size="sm">
                  Sign up free
                </ButtonLink>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="bg-gradient-to-b from-white to-slate-50 px-4 pb-20 pt-16 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              For bodyshops, garages & paint mixers
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
              Find any car&apos;s paint code from its registration
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600">
              The exact OEM paint code, colour name and finish in seconds. No more hunting for the sticker in the door shut.
            </p>
          </div>
          <div className="mt-10">
            <HeroSearch />
          </div>
        </section>

        <section className="px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-3xl font-bold tracking-tight">How it works</h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-900 font-bold text-plate-yellow">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-16 bg-slate-100/70 px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-3xl font-bold tracking-tight">Simple, credit-based pricing</h2>
            <p className="mx-auto mb-10 mt-3 max-w-xl text-center text-slate-600">
              1 credit = 1 successful paint code lookup. Failed lookups are always refunded.
            </p>
            <PricingTabs />
          </div>
        </section>

        <section className="px-4 py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-bold tracking-tight">Questions</h2>
            <dl className="mt-10 space-y-4">
              {FAQ.map((item) => (
                <div key={item.q} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <dt className="font-semibold">{item.q}</dt>
                  <dd className="mt-2 text-sm text-slate-600">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-8 text-sm text-slate-500">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
          <span>© PaintCode Finder</span>
          <div className="flex gap-4">
            <Link href="/about" className="hover:text-slate-900">
              About us
            </Link>
            <a href="#pricing" className="hover:text-slate-900">
              Pricing
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
