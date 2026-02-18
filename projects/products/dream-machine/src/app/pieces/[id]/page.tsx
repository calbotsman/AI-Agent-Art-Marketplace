import Link from "next/link";
import { getPiece } from "@/lib/pieces";
import { notFound } from "next/navigation";

export const runtime = "nodejs";

export default async function PiecePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const piece = getPiece(id);
  if (!piece) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between gap-6">
        <Link
          href="/gallery"
          className="text-sm text-white/80 underline decoration-white/30 underline-offset-4 hover:text-white"
        >
          Back to gallery
        </Link>
        <div className="text-xs text-white/50">{piece.id}</div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="aspect-[4/5] overflow-hidden rounded-xl bg-black/30">
            {piece.video_url ? (
              <video
                className="h-full w-full object-cover"
                src={piece.video_url}
                controls
                playsInline
                preload="metadata"
                poster={piece.image_url || undefined}
              />
            ) : piece.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="h-full w-full object-cover" src={piece.image_url} alt={piece.title} />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-white/60">
                No media
              </div>
            )}
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">{piece.title}</h1>
          {piece.description ? <p className="mt-3 text-sm text-white/70">{piece.description}</p> : null}

          <div className="mt-8 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm">
            <div className="flex items-start justify-between gap-6">
              <div className="text-white/60">Model</div>
              <div className="text-white">{piece.model || "(unspecified)"}</div>
            </div>
            <div className="flex items-start justify-between gap-6">
              <div className="text-white/60">LoRA</div>
              <div className="text-white">{piece.lora || "(unspecified)"}</div>
            </div>
            <div className="flex items-start justify-between gap-6">
              <div className="text-white/60">Seed</div>
              <div className="text-white">{piece.seed ?? "(unspecified)"}</div>
            </div>
            <div className="flex items-start justify-between gap-6">
              <div className="text-white/60">Created</div>
              <div className="text-white">{new Date(piece.created_at).toLocaleString()}</div>
            </div>
          </div>

          {piece.prompt ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Prompt</div>
              <div className="mt-2 whitespace-pre-wrap text-sm text-white/85">{piece.prompt}</div>
            </div>
          ) : null}

          {piece.negative_prompt ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Negative Prompt</div>
              <div className="mt-2 whitespace-pre-wrap text-sm text-white/85">{piece.negative_prompt}</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

