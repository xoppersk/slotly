import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

import "./globals.css";

/**
 * Slotly root layout. Inter is loaded via next/font at build time
 * (network available at build). If next/font ever fails in an offline
 * sandbox, fall back to the system font stack declared in globals.css.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
        className={`${inter.variable} font-[family-name:var(--font-inter)]`}
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
