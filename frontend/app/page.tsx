"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Globe, Building2, ArrowRight, Search } from "lucide-react";
import AgentLog, { AgentEvent } from "@/components/AgentLog";
import AgentLoadingScreen from "@/components/AgentLoadingScreen";
import RoadmapPhases, { RoadmapData } from "@/components/RoadmapPhases";
import RoadmapDisplay from "@/components/RoadmapDisplay";

const LANGUAGES = [
  { code: "English",    native: "English" },
  { code: "Spanish",    native: "Español" },
  { code: "Vietnamese", native: "Tiếng Việt" },
  { code: "Somali",     native: "Soomaali" },
  { code: "Chinese",    native: "中文" },
  { code: "Tagalog",    native: "Tagalog" },
];

type Category = { label: string; query: string };

const CATEGORIES: Record<string, Category[]> = {
  English: [
    { label: "Open a food truck",         query: "I want to open a food truck in Seattle" },
    { label: "Start a restaurant",        query: "How do I open a small restaurant in Seattle?" },
    { label: "Register an LLC",           query: "I want to register a new LLC in Washington State" },
    { label: "Get a health permit",       query: "What health permits do I need to sell food in Seattle?" },
    { label: "Open a coffee shop",        query: "I want to open a coffee shop in Seattle" },
    { label: "Start a catering business", query: "How do I start a catering business in Seattle?" },
  ],
  Spanish: [
    { label: "Abrir un food truck",       query: "Quiero abrir un negocio de food truck en Seattle" },
    { label: "Abrir un restaurante",      query: "¿Cómo abro un pequeño restaurante en Seattle?" },
    { label: "Registrar una LLC",         query: "Quiero registrar una LLC en Washington" },
    { label: "Permiso de salud",          query: "¿Qué permisos de salud necesito para vender comida en Seattle?" },
    { label: "Abrir cafetería",           query: "Quiero abrir una cafetería en Seattle" },
    { label: "Negocio de catering",       query: "¿Cómo inicio un negocio de catering en Seattle?" },
  ],
  Vietnamese: [
    { label: "Mở xe bán thức ăn",        query: "Tôi muốn mở xe bán thức ăn ở Seattle" },
    { label: "Mở nhà hàng",              query: "Làm thế nào để mở nhà hàng ở Seattle?" },
    { label: "Đăng ký LLC",              query: "Tôi muốn đăng ký LLC ở Washington" },
    { label: "Giấy phép sức khỏe",       query: "Tôi cần giấy phép sức khỏe gì để bán thức ăn ở Seattle?" },
  ],
  Somali: [
    { label: "Fur gawaarida cuntooyinka", query: "Waxaan rabaa inaan fur gawaarida cuntooyinka Seattle" },
    { label: "Fur makhaayadda",           query: "Sideen u furayaa makhaayadda yar ee Seattle?" },
    { label: "Diiwaan LLC",              query: "Waxaan rabaa inaan diiwaan gaaliyo LLC Washington" },
  ],
  Chinese: [
    { label: "开餐车",                    query: "我想在西雅图开一辆餐车" },
    { label: "开餐厅",                    query: "如何在西雅图开一家小餐厅？" },
    { label: "注册LLC",                   query: "我想在华盛顿州注册一家LLC" },
    { label: "获取健康许可证",             query: "在西雅图销售食品需要哪些健康许可证？" },
  ],
  Tagalog: [
    { label: "Magbukas ng food truck",    query: "Gusto kong magbukas ng food truck sa Seattle" },
    { label: "Magbukas ng restaurant",    query: "Paano ako magbubukas ng maliit na restaurant sa Seattle?" },
    { label: "Magrehistro ng LLC",        query: "Gusto kong mag-rehistro ng LLC sa Washington" },
  ],
};

type AppState = "idle" | "loading" | "result";
type Result =
  | { type: "json"; data: RoadmapData; language: string }
  | { type: "text"; text: string;      language: string };

const HEADER = (
  <header className="bg-white border-b border-[var(--border)] px-4 sm:px-6 py-3.5 flex items-center">
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 bg-[var(--accent)] rounded-lg flex items-center justify-center flex-shrink-0">
        <Building2 size={14} className="text-white" />
      </div>
      <span className="text-sm font-semibold text-[var(--text-primary)]">CivicPulse</span>
      <span className="hidden sm:inline text-xs text-[var(--text-tertiary)] ml-1">· Seattle City Navigator</span>
    </div>
  </header>
);

export default function Home() {
  const [appState, setAppState]         = useState<AppState>("idle");
  const [query, setQuery]               = useState("");
  const [selectedLang, setSelectedLang] = useState("English");
  const [currentQuery, setCurrentQuery] = useState("");
  const [agentEvents, setAgentEvents]   = useState<AgentEvent[]>([]);
  const [result, setResult]             = useState<Result | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const topRef   = useRef<HTMLDivElement>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  useEffect(() => {
    if (appState === "result") topRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [appState]);

  function updateAgent(agent: string, status: AgentEvent["status"], message?: string) {
    setAgentEvents((prev) => {
      const existing = prev.find((e) => e.agent === agent);
      if (existing) return prev.map((e) => e.agent === agent ? { ...e, status, message: message ?? e.message } : e);
      return [...prev, { agent, status, message }];
    });
  }

  async function submit(q: string) {
    if (!q.trim()) return;
    const userQuery = q.trim();
    setCurrentQuery(userQuery);
    setQuery("");
    setAgentEvents([]);
    setResult(null);
    setAppState("loading");

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userQuery }),
      });
      if (!res.ok || !res.body) throw new Error("API error");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "", currentEvent = "", currentData = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: "))     currentEvent = line.slice(7).trim();
          else if (line.startsWith("data: ")) currentData += line.slice(6);
          else if (line === "") {
            if (currentEvent && currentData) {
              try {
                const data = JSON.parse(currentData);
                if      (currentEvent === "agent_start") updateAgent(data.agent, "thinking", data.message);
                else if (currentEvent === "agent_done")  updateAgent(data.agent, "done",     data.message);
                else if (currentEvent === "agent_skip")  updateAgent(data.agent, "skipped");
                else if (currentEvent === "result") {
                  if (data.roadmap_json) {
                    setResult({ type: "json", data: data.roadmap_json, language: data.language });
                  } else if (data.roadmap_text) {
                    try {
                      const parsed = JSON.parse(data.roadmap_text);
                      setResult({ type: "json", data: parsed, language: data.language });
                    } catch {
                      setResult({ type: "text", text: data.roadmap_text, language: data.language });
                    }
                  }
                  setAppState("result");
                }
              } catch {}
            }
            currentEvent = ""; currentData = "";
          }
        }
      }
    } catch {
      setResult({ type: "text", text: "Could not connect to the backend. Make sure the server is running on port 8000.", language: "English" });
      setAppState("result");
    }
  }

  const categories = CATEGORIES[selectedLang] ?? CATEGORIES["English"];

  // ── IDLE ──────────────────────────────────────────────────────────────────
  if (appState === "idle") {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--bg)]">
        {HEADER}

        <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-10 w-full">
          <div className="w-full max-w-xl">

            {/* Hero text */}
            <div className="text-center mb-8">
              <div className="w-11 h-11 bg-[var(--accent)] rounded-xl flex items-center justify-center mx-auto mb-5 shadow"
                   style={{ boxShadow: "0 4px 14px rgba(29,78,216,0.3)" }}>
                <Building2 size={20} className="text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-tight mb-2">
                Navigate Seattle City Services
              </h1>
              <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed max-w-sm mx-auto">
                Get a step-by-step roadmap with exact forms, offices, and fees — in your language.
              </p>
            </div>

            {/* Language selector */}
            <div className="mb-5">
              <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-widest mb-2.5">
                Your language
              </p>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => setSelectedLang(l.code)}
                    className={`text-sm px-3.5 py-2 rounded-full border font-medium transition-all duration-150 ${
                      selectedLang === l.code
                        ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm"
                        : "bg-white border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                    }`}
                    style={{ minWidth: "fit-content" }}
                  >
                    <span>{l.native}</span>
                    {l.native !== l.code && (
                      <span className={`ml-1.5 text-[11px] ${selectedLang === l.code ? "opacity-75" : "text-[var(--text-tertiary)]"}`}>
                        {l.code}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Search bar */}
            <div className="bg-white border border-[var(--border)] rounded-2xl overflow-hidden mb-5"
                 style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.07)" }}>
              <div className="flex items-start gap-3 px-4 pt-3.5 pb-2">
                <Search size={16} className="text-[var(--text-tertiary)] flex-shrink-0 mt-1" />
                <textarea
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(query); } }}
                  placeholder={
                    selectedLang === "Spanish"    ? "Ej. Quiero abrir un food truck en Seattle..." :
                    selectedLang === "Vietnamese"  ? "Vd. Tôi muốn mở xe bán thức ăn ở Seattle..." :
                    selectedLang === "Chinese"     ? "例如：我想在西雅图开一辆餐车..." :
                    "e.g. I want to open a food truck in Seattle..."
                  }
                  rows={2}
                  className="flex-1 resize-none bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none leading-relaxed"
                />
              </div>
              <div className="flex items-center justify-between px-4 pb-3">
                <p className="text-[11px] text-[var(--text-tertiary)]">Press Enter to submit</p>
                <button
                  onClick={() => submit(query)}
                  disabled={!query.trim()}
                  className="flex items-center gap-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                >
                  Get Roadmap <ArrowRight size={14} />
                </button>
              </div>
            </div>

            {/* Common requests */}
            <div>
              <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-widest mb-2.5">
                Common requests
              </p>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((cat, i) => (
                  <button
                    key={i}
                    onClick={() => submit(cat.query)}
                    className="text-left text-sm bg-white border border-[var(--border)] hover:border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-3.5 py-3 rounded-xl transition-all duration-150 leading-snug"
                    style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-8 text-[11px] text-[var(--text-tertiary)] text-center">
              Grounded in official Seattle.gov, King County &amp; WA State documents
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (appState === "loading") {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--bg)]">
        {HEADER}
        <AgentLoadingScreen events={agentEvents} query={currentQuery} />
      </div>
    );
  }

  // ── RESULT ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <header className="bg-white border-b border-[var(--border)] px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[var(--accent)] rounded-lg flex items-center justify-center flex-shrink-0">
            <Building2 size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">CivicPulse</span>
        </div>
        <button
          onClick={() => { setAppState("idle"); setResult(null); setAgentEvents([]); }}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--border-strong)] px-3 py-1.5 rounded-lg transition-colors"
        >
          ← New search
        </button>
      </header>

      <div ref={topRef} className="flex flex-1">

        {/* Main content — full width on mobile, constrained on desktop */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mb-5 text-xs text-[var(--text-tertiary)]">
              <button onClick={() => setAppState("idle")} className="hover:text-[var(--text-secondary)] transition-colors">
                Home
              </button>
              <span>/</span>
              <span className="text-[var(--text-secondary)] truncate">"{currentQuery}"</span>
            </div>

            {result?.type === "json" ? (
              <RoadmapPhases
                data={result.data}
                language={result.language}
                userContext={currentQuery}
                apiUrl={API_URL}
              />
            ) : result?.type === "text" ? (
              <div className="bg-white border border-[var(--border)] rounded-2xl p-5">
                <RoadmapDisplay roadmap={result.text} language={result.language} />
              </div>
            ) : null}

            {/* Follow-up */}
            <div className="mt-6 bg-white border border-[var(--border)] rounded-2xl p-4"
                 style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <p className="text-xs text-[var(--text-tertiary)] mb-2.5">Ask a follow-up</p>
              <form onSubmit={(e) => { e.preventDefault(); if (query.trim()) submit(query); }} className="flex gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. How much does the food vehicle permit cost?"
                  className="flex-1 text-sm border border-[var(--border)] rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-[var(--bg)] min-w-0"
                />
                <button
                  type="submit"
                  disabled={!query.trim()}
                  className="w-10 h-10 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <Send size={14} />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right sidebar — desktop only */}
        <div className="w-56 flex-shrink-0 border-l border-[var(--border)] bg-white p-4 overflow-y-auto hidden lg:flex flex-col gap-5">
          <AgentLog events={agentEvents} />
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-widest mb-2">
              Sources
            </p>
            {["seattle.gov", "kingcounty.gov", "dor.wa.gov", "sos.wa.gov"].map((src) => (
              <p key={src} className="text-[11px] text-[var(--text-tertiary)] leading-relaxed">{src}</p>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
