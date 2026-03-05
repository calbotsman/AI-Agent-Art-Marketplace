import Link from "next/link";
import { listPieces } from "@/lib/pieces";

export const runtime = "nodejs";

export default async function GalleryPage() {
  const pieces = listPieces({ limit: 120, offset: 0 });

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Gallery</h1>
          <p className="mt-2 text-sm text-white/70">
            Generated motion studies. Each piece is a still that learned to breathe.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm text-white/80 underline decoration-white/30 underline-offset-4 hover:text-white"
        >
          Dream Machine
        </Link>
      </div>

      {pieces.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
          No pieces yet. Create one via `POST /api/pieces` (admin token required).
        </div>
      ) : null}

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {pieces.map((p) => (
          <Link
            key={p.id}
            href={`/pieces/${p.id}`}
            className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/8"
          >
            <div className="aspect-[4/5] overflow-hidden rounded-xl bg-black/30">
              {p.video_url ? (
                <video
                  className="h-full w-full object-cover"
                  src={p.video_url}
                  muted
                  playsInline
                  loop
                  autoPlay
                  preload="metadata"
                  poster={p.image_url || undefined}
                />
              ) : p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="h-full w-full object-cover" src={p.image_url} alt={p.title} />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-white/60">
                  No preview
                </div>
              )}
            </div>
            <div className="mt-4">
              <div className="text-sm font-semibold tracking-tight text-white">{p.title}</div>
              <div className="mt-1 text-xs text-white/60">
                {p.lora ? `LoRA: ${p.lora}` : "LoRA: (unspecified)"}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

