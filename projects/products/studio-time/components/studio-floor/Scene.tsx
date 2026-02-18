"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Layout = {
  id: string;
  size: { w: number; h: number };
  safeZones: Record<string, { x0: number; y0: number; x1: number; y1: number }>;
  stations: { id: string; anchor: { x: number; y: number }; hit: { w: number; h: number }; desktopOnly?: boolean }[];
  spawns: Record<string, { x: number; y: number; desktopOnly?: boolean }>;
};

type Agent = {
  id: string;
  name: string;
  sprite: string;
  stationId: string;
  state: "working" | "idle";
};

export function Scene() {
  const [layout, setLayout] = useState<Layout | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    let cancelled = false;

    // room layout
    fetch("/rooms/atelier-v1/layout.json")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setLayout(json);
      })
      .catch(() => {
        if (!cancelled) setLayout(null);
      });

    // live agent state (phase-1 mock)
    const tick = () => {
      fetch(`/api/live/status?t=${Date.now()}`)
        .then((r) => r.json())
        .then((json) => {
          if (!cancelled && json?.agents) setAgents(json.agents);
        })
        .catch(() => {
          // ignore
        });
    };
    tick();
    const id = window.setInterval(tick, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const stationsById = useMemo(() => {
    const map = new Map<string, Layout["stations"][number]>();
    if (!layout) return map;
    for (const s of layout.stations) map.set(s.id, s);
    return map;
  }, [layout]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* background */}
      <Image
        src="/rooms/atelier-v1/background.jpeg"
        alt="Atelier room"
        fill
        priority
        className="object-cover"
      />

      {/* subtle CRT glaze */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 1px, rgba(0,0,0,0) 3px, rgba(0,0,0,0) 6px)",
          mixBlendMode: "overlay",
        }}
      />

      {/* agents */}
      {agents.map((a) => {
        const station = stationsById.get(a.stationId);
        const x = station?.anchor.x ?? 0.5;
        const y = station?.anchor.y ?? 0.8;

        const isWorking = a.state === "working";

        return (
          <div
            key={a.id}
            className="absolute"
            style={{
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              transform: `translate(-50%, -85%) ${isWorking ? "scale(1.02)" : "scale(1)"}`,
              filter: isWorking ? "drop-shadow(0 10px 18px rgba(0,0,0,0.55))" : "drop-shadow(0 6px 12px rgba(0,0,0,0.45))",
            }}
          >
            <div className="relative">
              {/* simple "doing something" tell: pulse ring when working */}
              {isWorking ? (
                <div className="pointer-events-none absolute left-1/2 top-[78%] h-8 w-10 -translate-x-1/2 rounded-full bg-white/10 blur-[1px] animate-pulse" />
              ) : null}

              <Image
                src={a.sprite}
                alt={a.name}
                width={140}
                height={140}
                className="select-none"
                style={{ imageRendering: "auto" }}
              />
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/55 px-3 py-1 text-[11px] text-white backdrop-blur">
                {a.name} · {a.state}
              </div>
            </div>
          </div>
        );
      })}

      {/* dev overlay (optional): show station anchors */}
      {layout ? null : (
        <div className="absolute left-4 top-4 rounded-md bg-black/60 px-3 py-2 text-xs text-white">
          Loading room layout…
        </div>
      )}
    </div>
  );
}
