"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink, Globe, FileText, CreditCard, MapPin, ChevronRight, Wand2 } from "lucide-react";
import FormFillModal from "./FormFillModal";
import RoadmapTimeline from "./RoadmapTimeline";

export type RoadmapDocument = {
  name: string | null;
  agency: string;
  how: "online" | "in-person" | "mail";
  fee: string | null;
};

export type RoadmapStep = {
  title: string;
  description: string;
  source_url?: string;
  source_label?: string;
  document?: RoadmapDocument | null;
};

export type RoadmapPhase = {
  phase: number;
  title: string;
  summary: string;
  steps: RoadmapStep[];
};

export type RoadmapData = {
  title: string;
  intro: string;
  phases: RoadmapPhase[];
  closing: string;
};

const PHASE_ACCENT = [
  { dot: "bg-blue-600",   ring: "ring-blue-200",   label: "bg-blue-50 text-blue-700 border-blue-200",   num: "bg-blue-600 text-white",   numDone: "bg-blue-50 text-blue-600 ring-1 ring-blue-200" },
  { dot: "bg-violet-600", ring: "ring-violet-200",  label: "bg-violet-50 text-violet-700 border-violet-200", num: "bg-violet-600 text-white", numDone: "bg-violet-50 text-violet-600 ring-1 ring-violet-200" },
  { dot: "bg-emerald-600",ring: "ring-emerald-200", label: "bg-emerald-50 text-emerald-700 border-emerald-200",num:"bg-emerald-600 text-white",numDone:"bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200" },
  { dot: "bg-amber-500",  ring: "ring-amber-200",   label: "bg-amber-50 text-amber-700 border-amber-200",   num: "bg-amber-500 text-white",  numDone: "bg-amber-50 text-amber-600 ring-1 ring-amber-200" },
];

const HOW_ICON: Record<string, React.ReactNode> = {
  online:     <Globe size={11} />,
  "in-person":<MapPin size={11} />,
  mail:       <FileText size={11} />,
};

type ModalState = { formName: string; agency: string; sourceUrl?: string } | null;

interface Props {
  data: RoadmapData;
  language: string;
  userContext: string;
  apiUrl: string;
}

export default function RoadmapPhases({ data, language, userContext, apiUrl }: Props) {
  const [activePhase, setActivePhase] = useState(0);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalState>(null);

  const totalSteps = data.phases.reduce((n, p) => n + p.steps.length, 0);

  function toggle(key: string) {
    setDone((prev) => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  }

  function phaseComplete(pi: number) {
    return data.phases[pi].steps.every((_, si) => done.has(`${pi}-${si}`));
  }

  const completedPhases = new Set(
    data.phases.map((_, i) => i).filter((i) => phaseComplete(i))
  );

  const phase = data.phases[activePhase];
  const accent = PHASE_ACCENT[activePhase % PHASE_ACCENT.length];
  const completedCount = done.size;

  return (
    <div className="w-full space-y-5 fade-up">

      {/* Title block */}
      <div>
        {language !== "English" && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full mb-3">
            <Globe size={11} /> Translated to {language}
          </span>
        )}
        <h1 className="text-xl font-semibold text-[var(--text-primary)] leading-tight">{data.title}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">{data.intro}</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-500"
            style={{ width: `${totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs text-[var(--text-tertiary)] tabular-nums whitespace-nowrap">
          {completedCount} / {totalSteps} completed
        </span>
      </div>

      {/* Visual timeline */}
      <RoadmapTimeline
        phases={data.phases}
        activePhase={activePhase}
        completedPhases={completedPhases}
        onSelectPhase={setActivePhase}
      />

      {/* Phase title */}
      <h2 className="text-base font-semibold text-[var(--text-primary)]">{phase.title}</h2>

      {/* Steps */}
      <div className="space-y-3">
        {phase.steps.map((step, si) => {
          const key = `${activePhase}-${si}`;
          const isDone = done.has(key);
          const isLast = si === phase.steps.length - 1;

          return (
            <div key={si} className={`relative flex gap-4 ${!isLast ? "step-line" : ""}`}>
              {/* Number badge */}
              <button
                onClick={() => toggle(key)}
                title={isDone ? "Mark incomplete" : "Mark complete"}
                className={`relative z-10 flex-shrink-0 w-[38px] h-[38px] rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 ${
                  isDone ? "bg-[var(--success)] text-white" : `${accent.num}`
                }`}
              >
                {isDone ? <CheckCircle2 size={16} /> : si + 1}
              </button>

              {/* Card */}
              <div
                className={`flex-1 bg-white border rounded-xl p-4 transition-all duration-200 mb-3 ${
                  isDone
                    ? "border-[var(--border)] opacity-60"
                    : "border-[var(--border)] hover:border-[var(--border-strong)] hover:shadow-sm"
                }`}
                style={!isDone ? { boxShadow: "0 1px 3px rgba(0,0,0,0.04)" } : {}}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className={`text-sm font-semibold leading-snug ${isDone ? "line-through text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"}`}>
                    {step.title}
                  </h3>
                  {step.source_url && (
                    <a
                      href={step.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--accent)] border border-[var(--border)] hover:border-blue-300 px-2 py-1 rounded-md transition-colors"
                    >
                      <ExternalLink size={10} />
                      <span className="hidden sm:inline">{step.source_label ?? "Source"}</span>
                    </a>
                  )}
                </div>

                <p className="text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                  {step.description}
                </p>

                {/* Document card */}
                {step.document?.name && (
                  <div className="mt-3 flex items-start gap-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2.5">
                    <FileText size={15} className="text-[var(--text-tertiary)] flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[var(--text-primary)] leading-tight">{step.document.name}</p>
                      <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{step.document.agency}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {step.document.how && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-white border border-[var(--border)] text-[var(--text-secondary)] px-2 py-0.5 rounded-md">
                            {HOW_ICON[step.document.how]}
                            {step.document.how === "in-person" ? "In person" : step.document.how.charAt(0).toUpperCase() + step.document.how.slice(1)}
                          </span>
                        )}
                        {step.document.fee && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-white border border-[var(--border)] text-[var(--text-secondary)] px-2 py-0.5 rounded-md">
                            <CreditCard size={11} />
                            {step.document.fee}
                          </span>
                        )}
                        {step.source_url && (
                          <a href={step.source_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)] hover:underline">
                            View form <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                      {/* Help fill button */}
                      <button
                        onClick={() => setModal({ formName: step.document!.name!, agency: step.document!.agency, sourceUrl: step.source_url })}
                        className="mt-2.5 w-full flex items-center justify-center gap-1.5 text-xs font-medium bg-white border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-light)] px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Wand2 size={11} /> Help me fill this form
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Phase nav */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={() => setActivePhase(Math.max(0, activePhase - 1))}
          disabled={activePhase === 0}
          className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] disabled:opacity-0 transition-colors"
        >
          ← Previous
        </button>
        {activePhase < data.phases.length - 1 && (
          <button
            onClick={() => setActivePhase(activePhase + 1)}
            className="flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
          >
            Next: {data.phases[activePhase + 1]?.title}
            <ChevronRight size={15} />
          </button>
        )}
      </div>

      {/* Closing */}
      <div className="border-t border-[var(--border)] pt-4">
        <p className="text-sm text-[var(--text-secondary)] italic">{data.closing}</p>
      </div>

      {/* Form fill modal */}
      {modal && (
        <FormFillModal
          formName={modal.formName}
          agency={modal.agency}
          userContext={userContext}
          language={language}
          sourceUrl={modal.sourceUrl}
          onClose={() => setModal(null)}
          apiUrl={apiUrl}
        />
      )}
    </div>
  );
}
