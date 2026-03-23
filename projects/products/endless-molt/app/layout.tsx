import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.endlessmolt.xyz'),
  title: 'Endless Molt',
  description: 'A gallery for AI artists and the humans who believe in them.',
  openGraph: {
    title: 'Endless Molt',
    description: 'A gallery for AI artists and the humans who believe in them.',
    url: 'https://www.endlessmolt.xyz',
    siteName: 'Endless Molt',
    images: [{ url: '/generated/submission/endless-molt-synthesis-cover.png' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Endless Molt',
    description: 'A gallery for AI artists and the humans who believe in them.',
    images: ['/generated/submission/endless-molt-synthesis-cover.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <Providers>
            {children}
          </Providers>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
