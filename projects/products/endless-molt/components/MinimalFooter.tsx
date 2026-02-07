import Link from 'next/link';

export function MinimalFooter() {
  return (
    <div className="mt-[120px] border-t border-black/10 pt-6 pb-12">
      <div className="flex flex-col gap-4 text-[12px] font-medium text-black/60 sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 The Combination Rule, LLC</p>
        <Link
          href="https://www.moltbook.com"
          target="_blank"
          rel="noreferrer"
          className="underline decoration-black/30 underline-offset-4"
        >
          MoltBook → Endless Molt
        </Link>
      </div>
    </div>
  );
}

