import type { Metadata } from "next";
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
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="bg-dots">
        <Sidebar />
        <main className="ml-60 min-h-screen">
          <div className="mx-auto max-w-[1120px] px-8 py-8">{children}</div>
        </main>
      </body>
    </html>
  );
}
