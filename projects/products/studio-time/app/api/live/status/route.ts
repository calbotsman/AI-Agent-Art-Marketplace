export const runtime = "nodejs";

// Phase-1: local mocked agent state so the room is alive.
// Next: swap this to real OpenClaw session/task state.

function flip(seed: number) {
  // deterministic-ish toggle based on time windows
  const t = Math.floor(Date.now() / 5000);
  return (t + seed) % 2 === 0;
}

export async function GET() {
  const agents = [
    {
      id: "agent-1",
      name: "Designer",
      sprite: "/characters/iterations/designer_v001.png",
      stationId: "desk-05",
      state: flip(1) ? "working" : "idle",
    },
    {
      id: "agent-2",
      name: "Coder",
      sprite: "/characters/placeholders/coder_idle_4f.png",
      stationId: "desk-08",
      state: flip(2) ? "working" : "idle",
    },
  ];

  return Response.json(
    {
      ok: true,
      ts: Date.now(),
      agents,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
