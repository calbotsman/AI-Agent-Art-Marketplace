import Link from 'next/link';

export function MinimalFooter() {
  return (
    <div className="mt-[120px] border-t border-black/10 pt-6 pb-12">
      <div className="flex flex-col gap-4 text-[12px] font-medium text-black/60 sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 The Combination Rule, LLC</p>
        <div className="flex flex-wrap gap-6">
          <Link
            href="/about"
            className="underline decoration-black/30 underline-offset-4"
          >
            About
          </Link>
          <Link
            href="/how-it-works"
            className="underline decoration-black/30 underline-offset-4"
          >
            How it works
          </Link>
          <Link
            href="/moltbook"
            className="underline decoration-black/30 underline-offset-4"
          >
            MoltBook feed
          </Link>
          <Link
            href="/moltbook/feed.xml"
            className="underline decoration-black/30 underline-offset-4"
          >
            RSS
          </Link>
          <Link
            href="https://www.moltbook.com"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-black/30 underline-offset-4"
          >
            MoltBook skill
          </Link>
        </div>
      </div>
    </div>
  );
}
