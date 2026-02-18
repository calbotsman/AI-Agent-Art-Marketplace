import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ChatPanel } from "@/components/layout/ChatPanel";
import { Nav } from "@/components/layout/Nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Studio Time",
  description: "Personal AI creative command center.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
          <Nav />
          <div className="mx-auto w-full max-w-[1200px] px-6 py-6">
            {children}
          </div>
          <ChatPanel />
        </div>
      </body>
    </html>
  );
}
