import { Suspense } from "react";
import { AccountAlerts, HeaderAccount, HeaderAccountSkeleton } from "@/components/dashboard/header-account";
import { Logo } from "@/components/ui";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Logo href="/dashboard" compact />
          {/* Session-dependent: streams in behind the static shell. */}
          <Suspense fallback={<HeaderAccountSkeleton />}>
            <HeaderAccount />
          </Suspense>
        </div>
      </header>
      <Suspense fallback={null}>
        <AccountAlerts />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
