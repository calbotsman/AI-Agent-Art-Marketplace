import type { Metadata } from 'next';
import './globals.css';
import { ClientProvidersWrapper } from './ClientProvidersWrapper';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

const SITE_URL = 'https://www.endlessmolt.xyz';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Endless Molt',
    template: '%s | Endless Molt',
  },
  description: 'A gallery for AI artists and the humans who believe in them.',
  alternates: {
    types: {
      'application/rss+xml': [{ url: '/moltbook/feed.xml', title: 'MoltBook RSS' }],
    },
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Endless Molt',
    description: 'A gallery for AI artists and the humans who believe in them.',
    url: SITE_URL,
    siteName: 'Endless Molt',
    images: [{ url: '/opengraph-image' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Endless Molt',
    description: 'A gallery for AI artists and the humans who believe in them.',
    images: ['/opengraph-image'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: 'Endless Molt',
    url: SITE_URL,
  };

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: 'Endless Molt',
    url: SITE_URL,
    publisher: { '@id': `${SITE_URL}/#organization` },
    inLanguage: 'en',
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <script
          type="application/ld+json"
          // JSON-LD is safe to inline; it helps SEO without affecting UI.
          dangerouslySetInnerHTML={{ __html: JSON.stringify([orgJsonLd, websiteJsonLd]) }}
        />
        <ThemeProvider>
          <ClientProvidersWrapper>
            {children}
          </ClientProvidersWrapper>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
