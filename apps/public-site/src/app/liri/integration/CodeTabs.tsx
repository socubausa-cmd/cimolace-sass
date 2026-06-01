"use client";

import { useState } from "react";

type Tab = { label: string; lang: string; code: string };

/**
 * Bloc de code multi-stack avec onglets + bouton "Copier".
 * Style Stripe Docs.
 */
export function CodeTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  const current = tabs[active] ?? tabs[0];

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(current.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="my-6 overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-3 py-2">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((t, i) => (
            <button
              key={t.label}
              onClick={() => setActive(i)}
              className={
                "rounded-md px-3 py-1 text-xs font-medium transition-colors " +
                (i === active
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleCopy}
          className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500"
        >
          {copied ? "✓ Copié" : "Copier"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-6 text-slate-100">
        <code className={`language-${current.lang}`}>{current.code}</code>
      </pre>
    </div>
  );
}

/** Bloc de code simple sans tabs */
export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {lang || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500"
        >
          {copied ? "✓ Copié" : "Copier"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-6 text-slate-100">
        <code className={`language-${lang || "txt"}`}>{code}</code>
      </pre>
    </div>
  );
}
