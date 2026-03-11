"use client";

import { useState } from "react";
import { X, FileText, ChevronRight, Loader2, Download, CheckCircle2 } from "lucide-react";

type Question = { id: string; label: string; placeholder: string; type: string };
type Step = "intro" | "loading_questions" | "intake" | "generating" | "done";

interface Props {
  formName: string;
  agency: string;
  userContext: string;
  language: string;
  sourceUrl?: string;
  onClose: () => void;
  apiUrl: string;
}

export default function FormFillModal({ formName, agency, userContext, language, sourceUrl, onClose, apiUrl }: Props) {
  const [step, setStep]           = useState<Step>("intro");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers]     = useState<Record<string, string>>({});
  const [pdfUrl, setPdfUrl]       = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);

  function setAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  const filledCount = questions.filter((q) => answers[q.id]?.trim()).length;

  async function loadQuestions() {
    setStep("loading_questions");
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/prefill/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_name: formName, agency, user_context: userContext, language }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setQuestions(data.questions ?? []);
      setStep("intake");
    } catch {
      setError("Could not load form questions. Please try again.");
      setStep("intro");
    }
  }

  async function generatePdf() {
    setStep("generating");
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/prefill/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_name: formName,
          agency,
          user_answers: answers,
          user_context: userContext,
          language,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      setPdfUrl(URL.createObjectURL(blob));
      setStep("done");
    } catch {
      setError("Could not generate the PDF. Please try again.");
      setStep("intake");
    }
  }

  function downloadPdf() {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `${formName.replace(/\s+/g, "_")}_prefilled.pdf`;
    a.click();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl overflow-hidden"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#EFF6FF" }}>
              <FileText size={16} style={{ color: "#1D4ED8" }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 leading-tight">{formName}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{agency}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── INTRO ── */}
          {step === "intro" && (
            <div className="px-5 py-8 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "#EFF6FF" }}>
                <FileText size={24} style={{ color: "#1D4ED8" }} />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">Let's pre-fill this form together</h3>
              <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto mb-1">
                We'll ask for exactly the info this specific form needs, then generate a personalized PDF you can reference when submitting.
              </p>
              <p className="text-xs text-gray-400 mb-8">Takes about 30 seconds. Your info stays private.</p>
              {error && <p className="text-xs text-red-600 mb-4">{error}</p>}
              <button
                onClick={loadQuestions}
                className="inline-flex items-center gap-2 text-sm font-medium text-white px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
                style={{ background: "#1D4ED8" }}
              >
                Start filling <ChevronRight size={15} />
              </button>
              {sourceUrl && (
                <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="block mt-4 text-xs text-blue-600 hover:underline">
                  View official form first →
                </a>
              )}
            </div>
          )}

          {/* ── LOADING QUESTIONS ── */}
          {step === "loading_questions" && (
            <div className="flex flex-col items-center py-14 px-5">
              <Loader2 size={26} className="animate-spin mb-4" style={{ color: "#1D4ED8" }} />
              <p className="text-sm font-medium text-gray-800 mb-1">Analyzing this form…</p>
              <p className="text-xs text-gray-400">Figuring out exactly what info you'll need</p>
            </div>
          )}

          {/* ── INTAKE FORM ── */}
          {step === "intake" && (
            <div className="px-5 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Your information</p>
                <span className="text-xs text-gray-400">{filledCount} / {questions.length} filled</span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: questions.length ? `${(filledCount / questions.length) * 100}%` : "0%", background: "#1D4ED8" }}
                />
              </div>
              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
              )}
              {questions.map((q) => (
                <div key={q.id}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{q.label}</label>
                  <input
                    type={q.type}
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    placeholder={q.placeholder}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50 focus:bg-white transition-colors placeholder:text-gray-400"
                  />
                </div>
              ))}
              <p className="text-[11px] text-gray-400 pt-1">Only fill what you know — leave others blank and we'll note them.</p>
            </div>
          )}

          {/* ── GENERATING ── */}
          {step === "generating" && (
            <div className="flex flex-col items-center py-14 px-5">
              <Loader2 size={28} className="animate-spin mb-4" style={{ color: "#1D4ED8" }} />
              <p className="text-sm font-medium text-gray-800 mb-1">Building your pre-filled PDF…</p>
              <p className="text-xs text-gray-400">This takes a few seconds</p>
            </div>
          )}

          {/* ── DONE ── */}
          {step === "done" && (
            <div className="px-5 py-8 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "#ECFDF5" }}>
                <CheckCircle2 size={26} style={{ color: "#059669" }} />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">Your form summary is ready</h3>
              <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto mb-8">
                Download the PDF and use it as a reference when completing the official <strong>{formName}</strong>.
              </p>
              <button
                onClick={downloadPdf}
                className="inline-flex items-center gap-2 text-sm font-medium text-white px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity mx-auto"
                style={{ background: "#1D4ED8" }}
              >
                <Download size={15} /> Download PDF
              </button>
              {sourceUrl && (
                <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="block mt-4 text-xs text-blue-600 hover:underline">
                  Open official form to submit →
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer — intake step only */}
        {step === "intake" && (
          <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-400">
              {filledCount === 0 ? "Fill in at least one field" : `${filledCount} field${filledCount !== 1 ? "s" : ""} filled`}
            </p>
            <button
              onClick={generatePdf}
              disabled={filledCount === 0}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white px-5 py-2 rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity"
              style={{ background: "#1D4ED8" }}
            >
              Generate PDF <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
