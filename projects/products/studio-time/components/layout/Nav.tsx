import Link from "next/link";

const items = [
  { href: "/", label: "Studio Floor" },
  { href: "/brain", label: "Brain" },
  { href: "/evaluate", label: "Evaluate" },
  { href: "/analytics", label: "Analytics" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[color-mix(in_srgb,var(--border)_55%,transparent)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="ui-focus text-sm font-semibold tracking-wide"
          >
            Studio Time
          </Link>
          <nav className="hidden items-center gap-4 md:flex">
            {items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className="ui-focus text-sm text-[var(--muted)] hover:text-[var(--text)]"
              >
                {i.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/modules/trend"
            className="ui-focus rounded-full border border-[color-mix(in_srgb,var(--border)_60%,transparent)] px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--text)]"
          >
            Trend Intel
          </Link>
          <Link
            href="/modules/image"
            className="ui-focus rounded-full border border-[color-mix(in_srgb,var(--border)_60%,transparent)] px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--text)]"
          >
            Image Gen
          </Link>
          <Link
            href="/modules/code"
            className="ui-focus rounded-full border border-[color-mix(in_srgb,var(--border)_60%,transparent)] px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--text)]"
          >
            Code Gen
          </Link>
        </div>
      </div>
    </header>
  );
}

