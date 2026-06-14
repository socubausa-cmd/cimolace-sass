import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Brain, RotateCcw, ListChecks, CheckCircle, Clock, Layers, ChevronLeft } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/apiBase';
import { authStore } from '@/lib/auth-store';

// ── Design tokens (match StudentForumRedesign / ISNA dark theme) ─────────────
const T = {
  bg:       '#0b0b0f',
  surface:  '#12111a',
  card:     '#17161f',
  border:   'rgba(255,255,255,0.07)',
  gold:     '#D4AF37',
  goldDim:  'rgba(212,175,55,0.10)',
  goldMid:  'rgba(212,175,55,0.25)',
  t1:       '#f0eeff',
  t2:       '#9d9ab8',
  t3:       '#6b6888',
  success:  '#4ade80',
  danger:   '#f87171',
  warn:     '#fbbf24',
};

// ── API helpers ───────────────────────────────────────────────────────────────

function apiFetch(path, opts = {}) {
  const base  = getApiBaseUrl();
  const token = authStore.getToken();
  const slug  = authStore.getTenantSlug();
  return fetch(`${base}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization:   `Bearer ${token}`,
      'X-Tenant-Slug': slug,
      ...(opts.headers || {}),
    },
  }).then(async (r) => {
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body?.message || `HTTP ${r.status}`);
    }
    return r.json();
  });
}

async function fetchStats()            { return apiFetch('/neuro-recall/stats'); }
async function fetchDecks()            { return apiFetch('/neuro-recall/decks'); }
async function fetchDueCards(deckId)   { return apiFetch(`/neuro-recall/decks/${deckId}/due`); }
async function submitReview(cardId, quality) {
  return apiFetch(`/neuro-recall/cards/${cardId}/review`, {
    method: 'POST',
    body: JSON.stringify({ quality }),
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatNextReview(dateStr) {
  if (!dateStr) return 'Maintenant';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  const now = Date.now();
  const diff = d.getTime() - now;
  if (diff <= 0) return 'Maintenant';
  const hours = Math.round(diff / 3_600_000);
  if (hours < 24) return `dans ${hours}h`;
  const days = Math.round(hours / 24);
  return `dans ${days}j`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({ icon: Icon, label, value, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 12, padding: '12px 18px',
      flex: '1 1 140px',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
        background: T.goldDim, border: `1px solid ${T.goldMid}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={17} style={{ color: color || T.gold }} />
      </div>
      <div>
        <div style={{ color: T.t2, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ color: T.t1, fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
      </div>
    </div>
  );
}

// Animated flashcard (CSS 3D flip)
function Flashcard({ card, flipped, onFlip }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={flipped ? 'Voir la question' : 'Voir la réponse'}
      onClick={onFlip}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFlip(); } }}
      style={{
        perspective: 1200,
        cursor: 'pointer',
        width: '100%',
        maxWidth: 620,
        margin: '0 auto',
        userSelect: 'none',
      }}
    >
      <div style={{
        position: 'relative',
        width: '100%',
        paddingBottom: '56%', // 16:9-ish aspect ratio
        transformStyle: 'preserve-3d',
        transition: 'transform 0.55s cubic-bezier(0.4,0,0.2,1)',
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>
        {/* Front — Question */}
        <div style={{
          position: 'absolute', inset: 0,
          background: T.card,
          border: `1px solid ${T.goldMid}`,
          borderRadius: 20,
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '28px 32px',
          boxShadow: `0 0 0 1px ${T.goldMid}, 0 8px 40px rgba(0,0,0,0.5)`,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: T.gold, marginBottom: 16,
            background: T.goldDim, padding: '4px 12px', borderRadius: 20,
            border: `1px solid ${T.goldMid}`,
          }}>
            Question
          </div>
          <p style={{
            color: T.t1, fontSize: 18, fontWeight: 600,
            textAlign: 'center', lineHeight: 1.55, margin: 0,
          }}>
            {card.question}
          </p>
          {card.deck_title && (
            <div style={{
              marginTop: 18, fontSize: 11, color: T.t3,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <Layers size={12} />
              {card.deck_title}
            </div>
          )}
          <div style={{
            marginTop: 16, fontSize: 11, color: T.t3, fontStyle: 'italic',
          }}>
            Cliquer pour voir la réponse
          </div>
        </div>

        {/* Back — Answer */}
        <div style={{
          position: 'absolute', inset: 0,
          background: T.card,
          border: `1px solid ${T.goldMid}`,
          borderRadius: 20,
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '28px 32px',
          boxShadow: `0 0 0 1px ${T.goldMid}, 0 8px 40px rgba(0,0,0,0.5)`,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: T.success, marginBottom: 16,
            background: 'rgba(74,222,128,0.08)', padding: '4px 12px', borderRadius: 20,
            border: '1px solid rgba(74,222,128,0.2)',
          }}>
            Réponse
          </div>
          <p style={{
            color: T.t1, fontSize: 17, fontWeight: 500,
            textAlign: 'center', lineHeight: 1.6, margin: 0,
          }}>
            {card.answer}
          </p>
        </div>
      </div>
    </div>
  );
}

function RatingButtons({ onRate, disabled }) {
  const ratings = [
    { label: 'Difficile', quality: 1, color: T.danger,   bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.25)' },
    { label: 'Correct',   quality: 3, color: T.warn,     bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.25)'  },
    { label: 'Facile',    quality: 5, color: T.success,  bg: 'rgba(74,222,128,0.10)',  border: 'rgba(74,222,128,0.25)'  },
  ];
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
      {ratings.map((r) => (
        <button
          key={r.quality}
          type="button"
          disabled={disabled}
          onClick={() => onRate(r.quality)}
          style={{
            padding: '12px 24px', borderRadius: 12, cursor: disabled ? 'not-allowed' : 'pointer',
            background: r.bg, border: `1px solid ${r.border}`,
            color: r.color, fontSize: 14, fontWeight: 700,
            transition: 'all 0.18s', opacity: disabled ? 0.5 : 1,
            outline: 'none',
          }}
          onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.opacity = '1'; }}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function ProgressRing({ value, max, label, color = T.gold }) {
  const radius = 38;
  const circ   = 2 * Math.PI * radius;
  const pct    = max > 0 ? Math.min(value / max, 1) : 0;
  const dash   = circ * (1 - pct);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={90} height={90} viewBox="0 0 90 90" aria-label={`${label}: ${value} sur ${max}`}>
        <circle cx={45} cy={45} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={7} />
        <circle
          cx={45} cy={45} r={radius} fill="none"
          stroke={color} strokeWidth={7}
          strokeDasharray={circ}
          strokeDashoffset={dash}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x={45} y={49} textAnchor="middle" dominantBaseline="middle"
          fill={T.t1} fontSize={16} fontWeight={800}>{value}</text>
      </svg>
      <span style={{ color: T.t2, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
    </div>
  );
}

function EmptyState({ totalCards }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 24, padding: '56px 24px',
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20,
      textAlign: 'center',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: T.goldDim, border: `1px solid ${T.goldMid}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <CheckCircle size={30} style={{ color: T.gold }} />
      </div>
      <div>
        <h2 style={{ color: T.t1, fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>
          Aucune révision aujourd'hui
        </h2>
        <p style={{ color: T.t2, fontSize: 14, margin: 0 }}>
          Toutes vos cartes sont à jour. Revenez demain pour continuer votre progression.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 32 }}>
        <ProgressRing value={totalCards} max={totalCards || 1} label="Total cartes" />
        <ProgressRing value={0} max={totalCards || 1} label="À réviser" color={T.success} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const TAB_REVIEW = 'review';
const TAB_ALL    = 'all';

export default function StudentNeuroRecallPage() {
  const [tab, setTab]           = useState(TAB_REVIEW);
  const [stats, setStats]       = useState(null);
  const [decks, setDecks]       = useState([]);
  const [queue, setQueue]       = useState([]);   // due cards for current session
  const [cardIdx, setCardIdx]   = useState(0);
  const [flipped, setFlipped]   = useState(false);
  const [rating, setRating]     = useState(false); // submitting
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [sessionDone, setSessionDone] = useState(0); // cards reviewed this session

  const aliveRef = useRef(true);

  // Load stats + all due cards across all decks
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, decksRes] = await Promise.all([
        fetchStats().catch(() => ({ totalCards: 0, dueCards: 0 })),
        fetchDecks().catch(() => []),
      ]);
      if (!aliveRef.current) return;
      const deckList = Array.isArray(decksRes) ? decksRes : (decksRes?.data ?? []);
      setStats(statsRes?.data ?? statsRes);
      setDecks(deckList);

      // Fetch due cards from all decks in parallel (up to 20 per deck, server-enforced)
      const dueByDeck = await Promise.all(
        deckList.map((deck) =>
          fetchDueCards(deck.id)
            .then((r) => {
              const cards = Array.isArray(r) ? r : (r?.data ?? []);
              return cards.map((c) => ({ ...c, deck_title: deck.title }));
            })
            .catch(() => [])
        )
      );
      if (!aliveRef.current) return;
      const allDue = dueByDeck.flat();
      setQueue(allDue);
      setCardIdx(0);
      setFlipped(false);
      setSessionDone(0);
    } catch (err) {
      if (aliveRef.current) setError(String(err?.message || err));
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    void loadData();
    return () => { aliveRef.current = false; };
  }, [loadData]);

  const currentCard = queue[cardIdx] ?? null;

  const handleRate = useCallback(async (quality) => {
    if (!currentCard || rating) return;
    setRating(true);
    try {
      await submitReview(currentCard.id, quality);
    } catch {
      // non-blocking — still advance the card
    }
    if (!aliveRef.current) return;
    const next = cardIdx + 1;
    setSessionDone((n) => n + 1);
    if (next < queue.length) {
      setCardIdx(next);
      setFlipped(false);
    } else {
      // session complete — reload stats
      setCardIdx(queue.length); // triggers "all done" state
      fetchStats()
        .then((r) => { if (aliveRef.current) setStats(r?.data ?? r); })
        .catch(() => {});
    }
    setRating(false);
  }, [currentCard, rating, cardIdx, queue.length]);

  // ── Render ────────────────────────────────────────────────────────────────

  const totalCards = stats?.totalCards ?? 0;
  const dueCards   = stats?.dueCards   ?? 0;
  const sessionAllDone = !loading && (queue.length === 0 || cardIdx >= queue.length);

  return (
    <div style={{ minHeight: '80vh', background: T.bg, color: T.t1 }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: T.goldDim, border: `1px solid ${T.goldMid}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Brain size={21} style={{ color: T.gold }} />
          </div>
          <h1 style={{ color: T.t1, fontSize: 24, fontWeight: 800, margin: 0 }}>
            NeuroRecall — Révisions Espacées
          </h1>
        </div>
        <p style={{ color: T.t2, fontSize: 13.5, margin: '0 0 0 54px' }}>
          Algorithme SM-2 adaptatif — chaque carte est révisée au moment optimal pour maximiser la mémorisation.
        </p>
      </div>

      {/* ── Stats bar ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
        <StatPill
          icon={Clock}
          label="À réviser aujourd'hui"
          value={loading ? '…' : dueCards}
          color={dueCards > 0 ? T.warn : T.success}
        />
        <StatPill
          icon={Layers}
          label="Total cartes"
          value={loading ? '…' : totalCards}
          color={T.gold}
        />
        <StatPill
          icon={CheckCircle}
          label="Faites ce session"
          value={sessionDone}
          color={T.success}
        />
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24,
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 12, padding: 4, width: 'fit-content',
      }}>
        {[
          { id: TAB_REVIEW, label: 'Révisions du jour', icon: Brain },
          { id: TAB_ALL,    label: 'Toutes mes cartes', icon: ListChecks },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
              background: tab === id ? T.goldDim : 'transparent',
              border: tab === id ? `1px solid ${T.goldMid}` : '1px solid transparent',
              color: tab === id ? T.gold : T.t2,
              fontSize: 13.5, fontWeight: tab === id ? 700 : 500,
              transition: 'all 0.18s',
            }}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Error state ── */}
      {error && !loading && (
        <div style={{
          background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
          borderRadius: 12, padding: '16px 20px', marginBottom: 20,
          color: T.danger, fontSize: 13.5,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>⚠</span>
          <span>Erreur : {error}</span>
          <button
            type="button"
            onClick={loadData}
            style={{
              marginLeft: 'auto', padding: '6px 14px', borderRadius: 8,
              background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)',
              color: T.danger, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20,
          padding: '60px 24px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: `3px solid ${T.goldMid}`, borderTopColor: T.gold,
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ color: T.t2, fontSize: 14 }}>Chargement de vos révisions…</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: RÉVISIONS DU JOUR
      ══════════════════════════════════════════════════════════ */}
      {!loading && tab === TAB_REVIEW && (
        <>
          {/* Empty state — no due cards */}
          {sessionAllDone && (
            <EmptyState totalCards={totalCards} />
          )}

          {/* Flashcard review */}
          {!sessionAllDone && currentCard && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>

              {/* Progress bar */}
              <div style={{ width: '100%', maxWidth: 620 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 8,
                }}>
                  <span style={{ color: T.t2, fontSize: 12 }}>
                    Carte {cardIdx + 1} sur {queue.length}
                  </span>
                  <button
                    type="button"
                    onClick={loadData}
                    title="Recommencer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
                      background: T.goldDim, border: `1px solid ${T.goldMid}`,
                      color: T.t3, fontSize: 11, fontWeight: 600,
                    }}
                  >
                    <RotateCcw size={11} /> Recommencer
                  </button>
                </div>
                <div style={{
                  height: 4, borderRadius: 99,
                  background: 'rgba(255,255,255,0.06)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${((cardIdx) / queue.length) * 100}%`,
                    background: `linear-gradient(90deg, ${T.gold}, #f0d060)`,
                    borderRadius: 99,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>

              {/* Flashcard */}
              <Flashcard
                card={currentCard}
                flipped={flipped}
                onFlip={() => setFlipped((f) => !f)}
              />

              {/* Rating — only shown once flipped */}
              {flipped && (
                <div style={{
                  width: '100%', maxWidth: 620,
                  background: T.surface, border: `1px solid ${T.border}`,
                  borderRadius: 16, padding: '20px 24px', textAlign: 'center',
                }}>
                  <p style={{ color: T.t2, fontSize: 13, margin: '0 0 4px' }}>
                    Comment avez-vous trouvé cette carte ?
                  </p>
                  <p style={{ color: T.t3, fontSize: 11, margin: '0 0 4px', fontStyle: 'italic' }}>
                    Votre note ajuste l'intervalle SM-2 (Facile = +5 jours, Correct = +2 jours, Difficile = reset)
                  </p>
                  <RatingButtons onRate={handleRate} disabled={rating} />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: TOUTES MES CARTES
      ══════════════════════════════════════════════════════════ */}
      {!loading && tab === TAB_ALL && (
        <AllCardsTab decks={decks} />
      )}
    </div>
  );
}

// ── AllCardsTab ───────────────────────────────────────────────────────────────

function AllCardsTab({ decks }) {
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [cards, setCards]               = useState([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [deckError, setDeckError]       = useState(null);

  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const openDeck = useCallback(async (deck) => {
    setSelectedDeck(deck);
    setCards([]);
    setDeckError(null);
    setLoadingCards(true);
    try {
      // Fetch all cards, not just due — use a large-interval workaround via fetchDueCards
      // (the only public endpoint per current API)
      const res = await fetchDueCards(deck.id);
      if (!aliveRef.current) return;
      const list = Array.isArray(res) ? res : (res?.data ?? []);
      setCards(list);
    } catch (err) {
      if (aliveRef.current) setDeckError(String(err?.message || err));
    } finally {
      if (aliveRef.current) setLoadingCards(false);
    }
  }, []);

  if (decks.length === 0) {
    return (
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16,
        padding: '48px 24px', textAlign: 'center',
      }}>
        <Brain size={32} style={{ color: T.t3, marginBottom: 12 }} />
        <p style={{ color: T.t2, fontSize: 14 }}>Aucun deck de cartes pour le moment.</p>
        <p style={{ color: T.t3, fontSize: 12, marginTop: 6 }}>
          Les cartes sont générées automatiquement depuis vos sessions de cours.
        </p>
      </div>
    );
  }

  // Deck detail view
  if (selectedDeck) {
    return (
      <div>
        <button
          type="button"
          onClick={() => { setSelectedDeck(null); setCards([]); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, marginBottom: 20,
            padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
            background: T.goldDim, border: `1px solid ${T.goldMid}`,
            color: T.gold, fontSize: 13, fontWeight: 600,
          }}
        >
          <ChevronLeft size={15} /> Retour aux decks
        </button>

        <div style={{ marginBottom: 20 }}>
          <h2 style={{ color: T.t1, fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>
            {selectedDeck.title}
          </h2>
          <span style={{ color: T.t2, fontSize: 12 }}>
            {loadingCards ? 'Chargement…' : `${cards.length} carte(s) en révision active`}
          </span>
        </div>

        {deckError && (
          <p style={{ color: T.danger, fontSize: 13 }}>Erreur : {deckError}</p>
        )}

        {loadingCards && (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', margin: '0 auto',
              border: `3px solid ${T.goldMid}`, borderTopColor: T.gold,
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        )}

        {!loadingCards && cards.length === 0 && !deckError && (
          <div style={{
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 14, padding: '32px 24px', textAlign: 'center',
          }}>
            <p style={{ color: T.t2, fontSize: 13 }}>
              Aucune carte en attente de révision dans ce deck.
            </p>
          </div>
        )}

        {!loadingCards && cards.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cards.map((card) => (
              <div key={card.id} style={{
                background: T.card, border: `1px solid ${T.border}`,
                borderRadius: 12, padding: '14px 18px',
                display: 'grid', gridTemplateColumns: '1fr 1fr auto',
                alignItems: 'start', gap: 16,
              }}>
                <div>
                  <div style={{ color: T.t3, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                    Question
                  </div>
                  <p style={{ color: T.t1, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                    {card.question}
                  </p>
                </div>
                <div>
                  <div style={{ color: T.t3, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                    Réponse
                  </div>
                  <p style={{ color: T.t2, fontSize: 12.5, margin: 0, lineHeight: 1.5 }}>
                    {card.answer}
                  </p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ color: T.t3, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                    Prochaine révision
                  </div>
                  <div style={{
                    fontSize: 11.5, fontWeight: 600,
                    color: card.next_review_at ? T.warn : T.success,
                  }}>
                    {formatNextReview(card.next_review_at)}
                  </div>
                  {card.review_count > 0 && (
                    <div style={{ color: T.t3, fontSize: 10.5, marginTop: 2 }}>
                      {card.review_count} révision(s)
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Deck list view
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
      {decks.map((deck) => (
        <button
          key={deck.id}
          type="button"
          onClick={() => openDeck(deck)}
          style={{
            textAlign: 'left', cursor: 'pointer',
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 16, padding: '20px 22px',
            transition: 'border-color 0.18s, background 0.18s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = T.goldMid;
            e.currentTarget.style.background  = '#1c1a28';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = T.border;
            e.currentTarget.style.background  = T.card;
          }}
        >
          <div style={{
            width: 38, height: 38, borderRadius: 10, marginBottom: 14,
            background: T.goldDim, border: `1px solid ${T.goldMid}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Layers size={18} style={{ color: T.gold }} />
          </div>
          <h3 style={{ color: T.t1, fontSize: 14.5, fontWeight: 700, margin: '0 0 6px' }}>
            {deck.title || 'Deck sans titre'}
          </h3>
          <p style={{ color: T.t3, fontSize: 11.5, margin: '0 0 12px' }}>
            Créé le {formatDate(deck.created_at)}
          </p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 20,
            background: 'rgba(212,175,55,0.08)', border: `1px solid ${T.goldMid}`,
          }}>
            <Brain size={11} style={{ color: T.gold }} />
            <span style={{ color: T.gold, fontSize: 11, fontWeight: 600 }}>Voir les cartes</span>
          </div>
        </button>
      ))}
    </div>
  );
}
