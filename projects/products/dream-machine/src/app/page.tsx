import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
            Art System
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
            Dream Machine
          </h1>
          <p className="mt-4 text-sm leading-7 text-white/70">
            A continuous pipeline that turns curated aesthetics into new stills, then turns those stills into motion.
            The output is published as a living gallery.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/gallery"
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-black hover:bg-white/90"
            >
              Enter Gallery
            </Link>
            <Link
              href="/api/pieces"
              className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-semibold text-white/85 hover:bg-white/5"
            >
              API: Pieces
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
            Pipeline Shape
          </div>
          <ol className="mt-5 space-y-4 text-sm text-white/75">
            <li>
              <span className="text-white">1.</span> Generate a still (base model + your LoRA + prompt/seed).
            </li>
            <li>
              <span className="text-white">2.</span> Image to video (SVD or AnimateDiff workflow in ComfyUI).
            </li>
            <li>
              <span className="text-white">3.</span> Publish URLs (`image_url`, `video_url`) as a piece in this site.
            </li>
          </ol>
          <p className="mt-6 text-xs text-white/50">
            Next step: wire a worker to poll `GET /api/jobs?status=pending`, run ComfyUI, then PATCH the job with output
            URLs and POST a piece.
          </p>
        </div>
      </div>
    </div>
  );
}
