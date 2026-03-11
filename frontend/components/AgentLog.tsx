"use client";

import { CheckCircle2, Circle, Loader2 } from "lucide-react";

export type AgentEvent = {
  agent: string;
  status: "waiting" | "thinking" | "done" | "skipped";
  message?: string;
};

const AGENTS = [
  { key: "Router Agent",          label: "Router",          desc: "Intent & language detection" },
  { key: "Business Permit Agent", label: "Business Permit", desc: "Licenses & permit rules" },
  { key: "Health & Safety Agent", label: "Health & Safety", desc: "Health regulations" },
  { key: "Synthesizer Agent",     label: "Synthesizer",     desc: "Builds final roadmap" },
];

interface Props { events: AgentEvent[] }

export default function AgentLog({ events }: Props) {
  const map = new Map(events.map((e) => [e.agent, e]));

  return (
    <div>
      <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-widest mb-3">
        Agent Pipeline
      </p>
      <div className="space-y-1.5">
        {AGENTS.map(({ key, label, desc }) => {
          const ev = map.get(key);
          const status = ev?.status ?? "waiting";

          return (
            <div
              key={key}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all duration-200 ${
                status === "thinking" ? "bg-[var(--accent-light)] border-blue-200" :
                status === "done"     ? "bg-[var(--success-light)] border-green-200" :
                status === "skipped"  ? "bg-[var(--bg)] border-[var(--border)] opacity-50" :
                                        "bg-[var(--bg)] border-[var(--border)] opacity-40"
              }`}
            >
              <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                {status === "done" || status === "skipped"
                  ? <CheckCircle2 size={14} className={status === "done" ? "text-[var(--success)]" : "text-[var(--text-tertiary)]"} />
                  : status === "thinking"
                  ? <Loader2 size={14} className="text-[var(--accent)] animate-spin" />
                  : <Circle size={14} className="text-[var(--border-strong)]" />
                }
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-medium leading-none ${
                  status === "thinking" ? "text-[var(--accent)]" :
                  status === "done"     ? "text-[var(--text-primary)]" :
                                          "text-[var(--text-tertiary)]"
                }`}>
                  {label}
                </p>
                <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5 truncate">
                  {ev?.message && status === "done" ? ev.message : desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
