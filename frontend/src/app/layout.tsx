import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "SupportMind AI",
  description: "Self-learning intelligence layer for customer support",
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
        <main className="ml-14 min-h-screen bg-[var(--color-bg)]">
          <div className="mx-auto max-w-[1100px] px-10 py-10">{children}</div>
        </main>
      </body>
    </html>
  );
}
