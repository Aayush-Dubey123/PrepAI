import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/src/components/navigation/header";
import { CookieConsent } from "@/src/components/compliance/cookie-consent";
import { ToastProvider } from "@/src/components/ui/feedback/ToastProvider";
import { NavigationProgressBar } from "@/src/components/navigation/navigation-progress";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PrepAI — AI Technical Interviews",
  description: "Next-generation autonomous technical interview & candidate assessment platform.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#f4f6fa] text-[#0f172a] min-h-screen`}>
        <ClerkProvider>
          <ToastProvider>
            <NavigationProgressBar />
            <Header />
            {children}
            <CookieConsent />
          </ToastProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
