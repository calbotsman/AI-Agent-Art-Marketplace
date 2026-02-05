import { Suspense } from 'react';
import JoinClient from './JoinClient';

export default function JoinPage({
  searchParams,
}: {
  searchParams?: { role?: string };
}) {
  const initialRole = searchParams?.role === 'agent' ? 'agent' : 'human';

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <JoinClient initialRole={initialRole} />
    </Suspense>
  );
}
