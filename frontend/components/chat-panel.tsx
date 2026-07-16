"use client";

import { useState } from "react";
import { api } from "@/lib/api";

interface Turn {
  role: "user" | "assistant";
  text: string;
  mode?: "live" | "mock";
}

export function ChatPanel() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || pending) return;

    setTurns((t) => [...t, { role: "user", text: message }]);
    setInput("");
    setPending(true);
    try {
      const res = await api.chat(message);
      setTurns((t) => [
        ...t,
        { role: "assistant", text: res.answer, mode: res.mode },
      ]);
    } catch (err) {
      setTurns((t) => [
        ...t,
        { role: "assistant", text: `Error: ${(err as Error).message}` },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className="flex h-full min-h-[320px] flex-col rounded-lg p-4"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
    >
      <h2 className="mb-3 text-sm font-semibold">Ask about your data</h2>

      <div className="flex-1 space-y-3 overflow-y-auto">
        {turns.length === 0 && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Try: “How is my traffic trending?” — answers are grounded in the
            metrics you’ve synced.
          </p>
        )}
        {turns.map((turn, i) => (
          <div key={i} className="text-sm">
            <div
              className="mb-0.5 text-xs font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              {turn.role === "user" ? "You" : "AnalyticsOS"}
              {turn.mode === "mock" && " (mock — add ANTHROPIC_API_KEY for live)"}
            </div>
            <p
              className="whitespace-pre-wrap"
              style={{
                color:
                  turn.role === "user"
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
              }}
            >
              {turn.text}
            </p>
          </div>
        ))}
        {pending && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Thinking…
          </p>
        )}
      </div>

      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          aria-label="Ask a question about your analytics"
          className="min-w-0 flex-1 rounded-md px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--page)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--series-1)", color: "#fff" }}
        >
          Send
        </button>
      </form>
    </section>
  );
}
