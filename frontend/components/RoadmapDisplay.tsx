"use client";

import { ExternalLink } from "lucide-react";

interface Props {
  roadmap: string;
  language: string;
}

function linkifyUrls(text: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      // Reset regex state
      urlRegex.lastIndex = 0;
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 underline underline-offset-2 text-sm break-all"
        >
          {part}
          <ExternalLink size={12} className="flex-shrink-0" />
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function RoadmapDisplay({ roadmap, language }: Props) {
  const lines = roadmap.split("\n");

  return (
    <div className="roadmap-content text-sm text-slate-700 space-y-1">
      {language !== "English" && (
        <div className="mb-3 inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-xs font-medium px-3 py-1 rounded-full">
          <span>🌐</span>
          <span>Translated to {language}</span>
        </div>
      )}
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;

        const isNumbered = /^\d+\./.test(line.trim());
        const isSection = /^[A-Z][A-Z\s&]+:/.test(line.trim()) || line.trim().endsWith(":");
        const isSources = /^sources?:/i.test(line.trim());

        if (isSources) {
          return (
            <p key={i} className="font-semibold text-slate-500 text-xs uppercase tracking-wide mt-4 pt-3 border-t border-slate-200">
              {linkifyUrls(line)}
            </p>
          );
        }
        if (isSection) {
          return (
            <p key={i} className="font-bold text-slate-800 mt-4 text-base">
              {linkifyUrls(line)}
            </p>
          );
        }
        if (isNumbered) {
          return (
            <p key={i} className="pl-0 leading-relaxed">
              {linkifyUrls(line)}
            </p>
          );
        }
        return (
          <p key={i} className="leading-relaxed">
            {linkifyUrls(line)}
          </p>
        );
      })}
    </div>
  );
}
