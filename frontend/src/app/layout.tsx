import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Speare AI",
  description: "Self-learning intelligence layer for customer support",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <Sidebar />
        <main id="main-content" className="ml-14 min-h-screen bg-[var(--color-bg)] transition-[margin] duration-200">
          <div className="mx-auto max-w-[1100px] px-10 py-10">{children}</div>
        </main>
      </body>
    </html>
  );
}
