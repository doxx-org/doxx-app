import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import {
  Plus_Jakarta_Sans,
  Poltawski_Nowy,
  Roboto_Mono,
} from "next/font/google";
import { AppFooter, Navbar } from "@/components/layout";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { WalletConnectionProvider } from "@/components/wallet/WalletConnectionProvider";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
});

const poltawskiNowy = Poltawski_Nowy({
  variable: "--font-poltawski-nowy",
  style: ["italic"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DoXX App",
  description: "The Fastest Fully On-Chain DEX With CEX-Level Performance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${plusJakartaSans.variable} ${robotoMono.variable} ${poltawskiNowy.variable} antialiased`}
      >
        <WalletConnectionProvider>
          <QueryProvider>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
              <Navbar />
              <main className="flex min-h-screen flex-col">{children}</main>
              <AppFooter />
              <Toaster />
            </ThemeProvider>
          </QueryProvider>
        </WalletConnectionProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
