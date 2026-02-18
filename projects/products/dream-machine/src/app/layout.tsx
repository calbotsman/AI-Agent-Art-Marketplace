import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dream Machine",
  description: "A living archive of still images learning motion.",
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
        <div className="min-h-dvh bg-dm-bg text-white">
          <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
            <Link href="/" className="text-sm font-semibold tracking-tight">
              Dream Machine
            </Link>
            <nav className="flex items-center gap-6 text-sm text-white/75">
              <Link
                href="/gallery"
                className="underline decoration-white/20 underline-offset-4 hover:text-white"
              >
                Gallery
              </Link>
              <a
                href="https://github.com"
                className="underline decoration-white/20 underline-offset-4 hover:text-white"
                target="_blank"
                rel="noreferrer"
              >
                Build Notes
              </a>
            </nav>
          </header>
        {children}
          <footer className="mx-auto w-full max-w-6xl px-6 py-10 text-xs text-white/45">
            Dream Machine is a pipeline: LoRA styled stills to image-to-video, published continuously.
          </footer>
        </div>
      </body>
    </html>
  );
}
