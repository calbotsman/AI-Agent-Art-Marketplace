"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
};

function uid() {
  return Math.random().toString(16).slice(2);
}

export function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [msgs, setMsgs] = useState<ChatMsg[]>(() => []);

  // Keep newest at bottom.
  const ordered = useMemo(() => msgs.slice().sort((a, b) => a.ts - b.ts), [msgs]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function send() {
    const text = draft.trim();
    if (!text) return;

    const msg: ChatMsg = { id: uid(), role: "user", content: text, ts: Date.now() };
    setMsgs((m) => [...m, msg]);
    setDraft("");

    // MVP: echo via local route later. For now, we keep it deterministic.
    setMsgs((m) => [
      ...m,
      {
        id: uid(),
        role: "assistant",
        content:
          "Logged. (MVP) Next: wire /api/chat streaming + routing into modules.",
        ts: Date.now() + 1,
      },
    ]);
  }

  return (
    <>
      <button
        className="ui-focus fixed bottom-6 right-6 z-50 rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-black shadow-[0_20px_70px_rgba(108,99,255,0.35)] hover:brightness-110"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle chat"
      >
        Chat
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />

          <aside className="absolute right-0 top-0 h-full w-full max-w-[440px] border-l border-[color-mix(in_srgb,var(--border)_60%,transparent)] bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] backdrop-blur">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="text-sm font-semibold">Chat</div>
                  <div className="text-xs text-[var(--muted)]">
                    Ctrl/⌘K toggle
                  </div>
                </div>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </div>

              <div className="flex-1 overflow-auto px-5 pb-5">
                <div className="flex flex-col gap-3">
                  {ordered.map((m) => (
                    <div
                      key={m.id}
                      className={[
                        "max-w-[90%] rounded-2xl border px-3 py-2 text-sm leading-6",
                        m.role === "user"
                          ? "ml-auto border-[color-mix(in_srgb,var(--border)_55%,transparent)] bg-[color-mix(in_srgb,var(--card)_78%,transparent)]"
                          : "mr-auto border-[color-mix(in_srgb,var(--border)_55%,transparent)] bg-[color-mix(in_srgb,var(--surface)_78%,transparent)]",
                      ].join(" ")}
                    >
                      {m.content}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-[color-mix(in_srgb,var(--border)_55%,transparent)] p-4">
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                >
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Message the studio…"
                  />
                  <Button type="submit">Send</Button>
                </form>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

