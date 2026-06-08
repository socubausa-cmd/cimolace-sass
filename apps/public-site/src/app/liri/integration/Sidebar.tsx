"use client";

import { useEffect, useState } from "react";

const SECTIONS = [
  {
    group: "Démarrer",
    items: [
      { href: "#overview", label: "Vue d'ensemble" },
      { href: "#quickstart", label: "Quickstart (5 min)" },
    ],
  },
  {
    group: "Concepts",
    items: [
      { href: "#architecture", label: "Architecture" },
      { href: "#modes", label: "Modes LIRI" },
      { href: "#auth", label: "Authentification" },
    ],
  },
  {
    group: "Intégrer",
    items: [
      { href: "#sdk", label: "SDK JavaScript" },
      { href: "#embed", label: "Embed widget" },
      { href: "#wordpress", label: "WordPress" },
      { href: "#wix", label: "Wix" },
      { href: "#react", label: "React / Next.js" },
    ],
  },
  {
    group: "API REST",
    items: [
      { href: "#api-auth", label: "Authentification API" },
      { href: "#api-sessions", label: "Sessions live" },
      { href: "#api-tokens", label: "Tokens participants" },
      { href: "#api-multilang", label: "Multilingue" },
      { href: "#api-tts", label: "TTS / STT" },
      { href: "#api-masterclass", label: "Masterclass Factory" },
    ],
  },
  {
    group: "Webhooks",
    items: [
      { href: "#webhooks-config", label: "Configuration" },
      { href: "#webhooks-events", label: "Events disponibles" },
      { href: "#webhooks-signature", label: "Vérification signature" },
    ],
  },
  {
    group: "LIRI Credits",
    items: [
      { href: "#credits-overview", label: "Vue d'ensemble" },
      { href: "#credits-tarifs", label: "Tarifs par modèle" },
      { href: "#credits-packs", label: "Packs de recharge" },
    ],
  },
  {
    group: "Production",
    items: [
      { href: "#securite", label: "Sécurité" },
      { href: "#errors", label: "Codes d'erreur" },
      { href: "#changelog", label: "Changelog" },
    ],
  },
];

export function Sidebar() {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );

    const ids = SECTIONS.flatMap((g) => g.items.map((i) => i.href.slice(1)));
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="sticky top-24 max-h-[calc(100vh-6rem)] overflow-y-auto pb-12 pr-4 text-sm">
      {SECTIONS.map((group) => (
        <div key={group.group} className="mb-6">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {group.group}
          </h3>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const id = item.href.slice(1);
              const isActive = activeId === id;
              return (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className={
                      "block rounded-md px-3 py-1.5 text-[13px] transition-colors " +
                      (isActive
                        ? "bg-indigo-50 font-medium text-indigo-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")
                    }
                  >
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
