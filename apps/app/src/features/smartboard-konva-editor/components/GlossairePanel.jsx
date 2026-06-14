/**
 * GlossairePanel - Module 8 : Glossaire intelligent.
 * Detecte les mots-cles importants dans les textes de la scene active.
 * Permet de les surligner ou de les afficher en gras automatiquement.
 */
import React, { useMemo, useState } from 'react';
import { BookOpen, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// Mots de liaison a ignorer
const STOPWORDS = new Set([
  'le','la','les','un','une','des','de','du','en','et','ou','mais','donc','car',
  'ni','or','que','qui','quoi','dont','ou','si','je','tu','il','elle','nous','vous',
  'ils','elles','me','te','se','y','ce','cet','cette','ces','mon','ton','son','ma',
  'ta','sa','mes','tes','ses','notre','votre','leur','nos','vos','leurs','au','aux',
  'par','pour','sur','sous','dans','avec','sans','entre','vers','chez','a','the',
  'of','and','or','in','is','to','it','an','be','as','at','so','by','from','but',
  'are','was','were','have','has','had','will','would','can','could','should','may',
]);

function extractKeywords(scenes) {
  const freq = {};
  scenes.forEach((s) => {
    s.objects.forEach((o) => {
      if (o.type !== 'text') return;
      const words = (o.content?.text || '')
        .toLowerCase()
        .replace(/[^a-za-z0-9\u00c0-\u024f\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOPWORDS.has(w));
      words.forEach((w) => {
        freq[w] = (freq[w] || 0) + 1;
      });
    });
  });
  return Object.entries(freq)
    .filter(([, count]) => count >= 1)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 30)
    .map(([word, count]) => ({ word, count }));
}

export default function GlossairePanel({ scenes, onHighlightKeyword, className }) {
  const [expanded, setExpanded] = useState(false);
  const [glossaryTerms, setGlossaryTerms] = useState([]);
  const [newTerm, setNewTerm] = useState('');

  const keywords = useMemo(() => extractKeywords(scenes || []), [scenes]);

  const addTerm = () => {
    const t = newTerm.trim().toLowerCase();
    if (t && !glossaryTerms.includes(t)) {
      setGlossaryTerms((prev) => [...prev, t]);
    }
    setNewTerm('');
  };

  return (
    <div className={cn('rounded-xl border border-white/[0.08] bg-[#0d1020]/95', className)}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2"
      >
        <BookOpen className="h-3.5 w-3.5 shrink-0 text-teal-400/80" />
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/40">
            Glossaire (Module 8)
          </p>
          <p className="text-[10px] text-white/60">
            {keywords.length} mots-cles detectes
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-3 w-3 shrink-0 text-white/30" />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0 text-white/30" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-white/[0.07] px-2 pb-3 pt-2 space-y-3">
          {/* Mots-cles detectes automatiquement */}
          <div>
            <p className="mb-1.5 text-[8px] font-semibold uppercase tracking-wider text-white/30">
              Detectes automatiquement
            </p>
            {keywords.length === 0 ? (
              <p className="text-[9px] text-white/25 text-center py-2">Ajoutez du texte sur le canvas</p>
            ) : (
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto [scrollbar-width:thin]">
                {keywords.map(({ word, count }) => {
                  const isGlossary = glossaryTerms.includes(word);
                  return (
                    <button
                      key={word}
                      type="button"
                      onClick={() => {
                        if (!glossaryTerms.includes(word)) {
                          setGlossaryTerms((prev) => [...prev, word]);
                        }
                        onHighlightKeyword && onHighlightKeyword(word);
                      }}
                      className={cn(
                        'flex items-center gap-0.5 rounded-lg px-1.5 py-0.5 text-[9px] transition-colors',
                        isGlossary
                          ? 'bg-teal-600/30 text-teal-200 border border-teal-500/40'
                          : 'bg-white/[0.05] text-white/55 border border-white/10 hover:bg-white/[0.1]',
                      )}
                      title={'Frequence : ' + count}
                    >
                      {count > 2 && <Star className="h-2 w-2 text-[var(--school-accent)]" />}
                      {word}
                      {count > 1 && <span className="text-[7px] opacity-50">x{count}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Termes du glossaire personnalise */}
          <div>
            <p className="mb-1.5 text-[8px] font-semibold uppercase tracking-wider text-white/30">
              Mon glossaire ({glossaryTerms.length})
            </p>
            {glossaryTerms.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {glossaryTerms.map((t) => (
                  <span
                    key={t}
                    className="flex items-center gap-1 rounded-lg bg-teal-900/40 border border-teal-500/30 px-2 py-0.5 text-[9px] text-teal-200"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => setGlossaryTerms((prev) => prev.filter((x) => x !== t))}
                      className="text-[8px] text-teal-400/50 hover:text-teal-200"
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-1">
              <input
                type="text"
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTerm()}
                placeholder="Ajouter un terme..."
                className="h-7 flex-1 rounded-lg border border-white/10 bg-black/40 px-2 text-[9px] text-white placeholder-white/25 outline-none focus:border-teal-500/50"
              />
              <button
                type="button"
                onClick={addTerm}
                className="h-7 rounded-lg border border-teal-500/30 bg-teal-900/30 px-2 text-[9px] text-teal-300 hover:bg-teal-800/40"
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
