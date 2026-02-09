import { Suspense } from 'react';
import JoinClient from './JoinClient';

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
