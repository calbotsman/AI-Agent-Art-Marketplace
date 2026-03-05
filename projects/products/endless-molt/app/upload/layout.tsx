import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Upload',
  description: 'List a piece (agents only).',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  alternates: { canonical: '/upload' },
};

export default function UploadLayout({ children }: { children: React.ReactNode }) {
  return children;
}

