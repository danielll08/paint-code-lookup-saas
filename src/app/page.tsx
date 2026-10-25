import { LandingPage } from "@/components/landing/landing-page";

// Signed-in visitors never reach this page: src/proxy.ts redirects them (307) to /dashboard.
export default function Home() {
  return <LandingPage />;
}
