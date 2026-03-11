"use client";

import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { AgentEvent } from "./AgentLog";

const PIPELINE = [
  { key: "Router Agent",           label: "Understanding your request",         sub: "Detecting language & routing to specialists" },
  { key: "Business Permit Agent",  label: "Checking business & permit rules",   sub: "Querying Seattle OED, SDCI & WA DOR documents" },
  { key: "Health & Safety Agent",  label: "Checking health regulations",        sub: "Querying King County Public Health documents" },
  { key: "Synthesizer Agent",      label: "Building your roadmap",             sub: "Assembling phases & translating if needed" },
];

interface Props {
  events: AgentEvent[];
  query: string;
}

export default function AgentLoadingScreen({ events, query }: Props) {
  const eventMap = new Map(events.map((e) => [e.agent, e]));

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-16">
      {/* Query label */}
      <p className="text-sm text-[var(--text-tertiary)] mb-2">Analyzing</p>
      <p className="text-base font-medium text-[var(--text-primary)] mb-10 max-w-md text-center">
        "{query}"
      </p>

      {/* Pipeline card */}
      <div
        className="w-full max-w-md bg-white border border-[var(--border)] rounded-2xl overflow-hidden"
        style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}
      >
        {PIPELINE.map((step, i) => {
          const ev = eventMap.get(step.key);
          const status = ev?.status ?? "waiting";
          const isLast = i === PIPELINE.length - 1;

          return (
            <div
              key={step.key}
              className={`flex items-start gap-4 px-5 py-4 transition-colors duration-300 ${
                !isLast ? "border-b border-[var(--border)]" : ""
              } ${status === "thinking" ? "bg-[var(--accent-light)]" : ""}`}
            >
              {/* Status icon */}
              <div className="mt-0.5 w-5 h-5 flex-shrink-0 flex items-center justify-center">
                {status === "done" || status === "skipped" ? (
                  <CheckCircle2 size={18} className="text-[var(--success)]" />
                ) : status === "thinking" ? (
                  <Loader2 size={18} className="text-[var(--accent)] animate-spin" />
                ) : (
                  <Circle size={18} className="text-[var(--border-strong)]" />
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium leading-snug ${
                  status === "thinking" ? "text-[var(--accent)]" :
                  status === "done" ? "text-[var(--text-primary)]" :
                  "text-[var(--text-tertiary)]"
                }`}>
                  {step.label}
                </p>
                <p className={`text-xs mt-0.5 ${
                  status === "waiting" ? "text-[var(--border-strong)]" : "text-[var(--text-tertiary)]"
                }`}>
                  {status === "done" && ev?.message ? ev.message : step.sub}
                </p>
              </div>

              {/* Timing indicator */}
              {status === "thinking" && (
                <div className="flex gap-1 items-center mt-1 flex-shrink-0">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
                      style={{ animation: `pulse-dot 1.2s ${delay}ms ease-in-out infinite` }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-[var(--text-tertiary)]">
        Grounded in official Seattle, King County &amp; WA State documents
      </p>
    </div>
  );
}
