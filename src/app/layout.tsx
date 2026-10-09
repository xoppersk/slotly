import type { Metadata, Viewport } from "next";
import { Newsreader, Work_Sans, IBM_Plex_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

import "./globals.css";

/**
 * Slotly root layout. Type system (Flagship UI Designs · Slotly · System):
 *  - Newsreader — display / serif warmth (headings, hero copy, summary titles)
 *  - Work Sans — body text
 *  - IBM Plex Mono — tabular numerals, prices, booking references
 * Loaded via next/font at build time (network available at build). If
 * next/font ever fails in an offline sandbox, the system font stacks
 * declared in globals.css take over.
 */
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-newsreader",
  display: "swap",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-work-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Slotly — the slot you want, simply",
    template: "%s · Slotly",
  },
  description:
    "Slotly is the calm, dependable booking platform for service businesses. Customers pick a slot; owners fill their day.",
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0e7c6b",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${newsreader.variable} ${workSans.variable} ${plexMono.variable} font-sans`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              classNames: {
                toast: "rounded-[0.5rem] border border-border bg-card",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
