import type { Metadata } from "next";
import { Archivo, Barlow_Semi_Condensed, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const displayFont = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const plateFont = Barlow_Semi_Condensed({
  variable: "--font-plate",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "PaintCode Finder - car paint code by registration",
    template: "%s | PaintCode Finder",
  },
  description:
    "Find the exact OEM paint code for any car from its registration number or VIN in seconds. Built for bodyshops, garages and paint mixers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-GB"
      className={`${geistSans.variable} ${geistMono.variable} ${displayFont.variable} ${plateFont.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
