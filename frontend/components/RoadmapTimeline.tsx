"use client";

import { CheckCircle2 } from "lucide-react";
import { RoadmapPhase } from "./RoadmapPhases";

const PHASE_COLORS = [
  { dot: "bg-blue-600",    activeLine: "bg-blue-600",    activeText: "text-blue-700",    activeBg: "bg-blue-50 border-blue-200" },
  { dot: "bg-violet-600",  activeLine: "bg-violet-600",  activeText: "text-violet-700",  activeBg: "bg-violet-50 border-violet-200" },
  { dot: "bg-emerald-600", activeLine: "bg-emerald-600", activeText: "text-emerald-700", activeBg: "bg-emerald-50 border-emerald-200" },
  { dot: "bg-amber-500",   activeLine: "bg-amber-500",   activeText: "text-amber-700",   activeBg: "bg-amber-50 border-amber-200" },
];

interface Props {
  phases: RoadmapPhase[];
  activePhase: number;
  completedPhases: Set<number>;
  onSelectPhase: (i: number) => void;
}

export default function RoadmapTimeline({ phases, activePhase, completedPhases, onSelectPhase }: Props) {
  return (
    <div className="w-full">
      {/* Timeline track */}
      <div className="relative flex items-start">
        {/* Background connector line */}
        <div
          className="absolute top-4 left-4 right-4 h-0.5 bg-[var(--border)]"
          style={{ zIndex: 0 }}
        />
        {/* Progress fill line */}
        <div
          className="absolute top-4 left-4 h-0.5 bg-[var(--accent)] transition-all duration-500"
          style={{
            zIndex: 1,
            width: phases.length > 1
              ? `calc(${(activePhase / (phases.length - 1)) * 100}% - ${activePhase === phases.length - 1 ? "2rem" : "2rem"})`
              : "0%",
          }}
        />

        {/* Phase nodes */}
        <div className="relative z-10 w-full flex justify-between">
          {phases.map((phase, i) => {
            const color   = PHASE_COLORS[i % PHASE_COLORS.length];
            const isActive    = i === activePhase;
            const isCompleted = completedPhases.has(i);
            const isPast      = i < activePhase;

            return (
              <button
                key={i}
                onClick={() => onSelectPhase(i)}
                className="flex flex-col items-center gap-2 group"
                style={{ flex: 1, maxWidth: `${100 / phases.length}%` }}
              >
                {/* Node circle */}
                <div
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                    isCompleted
                      ? "bg-[var(--success)] border-[var(--success)] text-white"
                      : isActive
                      ? `${color.dot} border-transparent text-white shadow-md`
                      : isPast
                      ? "bg-blue-100 border-blue-300 text-blue-600"
                      : "bg-white border-[var(--border-strong)] text-[var(--text-tertiary)]"
                  }`}
                >
                  {isCompleted ? <CheckCircle2 size={14} /> : i + 1}
                </div>

                {/* Label */}
                <div className="text-center px-1">
                  <p className={`text-[11px] font-semibold leading-tight transition-colors ${
                    isActive ? color.activeText : "text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]"
                  }`}>
                    {phase.title}
                  </p>
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5 leading-tight hidden sm:block">
                    {phase.steps.length} step{phase.steps.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active phase summary pill */}
      <div className={`mt-4 flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm transition-all ${
        PHASE_COLORS[activePhase % PHASE_COLORS.length].activeBg
      }`}>
        <span className={`text-xs font-semibold uppercase tracking-wide ${
          PHASE_COLORS[activePhase % PHASE_COLORS.length].activeText
        }`}>
          Phase {activePhase + 1}
        </span>
        <span className="text-[var(--text-tertiary)]">·</span>
        <span className="text-[var(--text-secondary)] text-xs">{phases[activePhase]?.summary}</span>
      </div>
    </div>
  );
}
