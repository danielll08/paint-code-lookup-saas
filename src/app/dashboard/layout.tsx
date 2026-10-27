import Link from "next/link";
import { Suspense } from "react";
import { AccountAlerts, HeaderAccount, HeaderAccountSkeleton } from "@/components/dashboard/header-account";
import { Logo } from "@/components/ui";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex flex-1 flex-col bg-paper">
      <header className="sticky top-0 z-30 border-b border-ink-950/15 bg-paper">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-7">
            <Logo href="/dashboard" compact />
            <nav className="hidden items-center gap-5 md:flex">
              {[
                ["/dashboard", "01", "Lookup"],
                ["/dashboard/billing", "02", "Billing"],
                ["/about", "03", "About"],
              ].map(([href, number, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="group inline-flex items-baseline gap-1.5 text-sm text-ink-600 transition-colors hover:text-ink-950"
                >
                  <span className="font-mono text-[9px] text-ink-400 transition-colors group-hover:text-brand-600">{number}</span>
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          {/* Session-dependent: streams in behind the static shell. */}
          <Suspense fallback={<HeaderAccountSkeleton />}>
            <HeaderAccount />
          </Suspense>
        </div>
      </header>
      <Suspense fallback={null}>
        <AccountAlerts />
      </Suspense>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
