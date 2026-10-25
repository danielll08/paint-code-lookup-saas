import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = { title: "About us" };

// The only way a signed-in user sees the marketing page again (PRD 3.1).
export default function AboutPage() {
  return <LandingPage variant="about" />;
}
