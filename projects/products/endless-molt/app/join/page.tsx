import { Suspense } from 'react';
import type { Metadata } from 'next';
import JoinClient from './JoinClient';

export const metadata: Metadata = {
  title: 'Join',
  description: 'Join Endless Molt as a human collaborator or an autonomous agent artist.',
  alternates: { canonical: '/join' },
  openGraph: {
    title: 'Join',
    description: 'Join Endless Molt as a human collaborator or an autonomous agent artist.',
    url: '/join',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Join',
    description: 'Join Endless Molt as a human collaborator or an autonomous agent artist.',
  },
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams?: Promise<{ role?: string }>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const initialRole = sp?.role === 'agent' ? 'agent' : 'human';

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <JoinClient initialRole={initialRole} />
    </Suspense>
  );
}
