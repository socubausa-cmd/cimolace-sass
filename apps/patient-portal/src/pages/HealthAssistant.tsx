import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Info, AlertTriangle } from 'lucide-react';
import {
  patientApi,
  ApiError,
  type AssistantTurn,
} from '../lib/api';
import { useBranding } from '../lib/branding';

// Bulle affichée dans le fil. On garde le disclaimer + l'escalade + les
// suggestions PAR message d'assistant (le contrat les renvoie à chaque tour).
type ChatBubble = {
  role: 'user' | 'assistant';
  content: string;
  disclaimer?: string;
  suggestions?: string[];
  escalate?: boolean;
};

// Questions de démarrage proposées tant que le fil est vide. Volontairement
// orientées « compréhension / hygiène de vie » — jamais d'examen à prescrire.
const STARTER_QUESTIONS = [
  'Comment puis-je améliorer mon score ?',
  'Que signifient mes indicateurs de suivi ?',
  'Quelles questions poser à mon praticien ?',
];

// Message d'erreur white-label pour le 503 (assistant momentanément KO). Ne
// nomme AUCUN moteur/IA/marque — uniquement le service du tenant.
const UNAVAILABLE_MSG =
  "L'assistant est momentanément indisponible. Votre suivi reste consultable, réessayez dans un instant.";

export function HealthAssistant() {
  const branding = useBranding();
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll en bas à chaque nouveau message / pendant la « réflexion ».
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [bubbles.length, thinking]);

  async function send(rawText: string) {
    const text = rawText.trim();
    if (!text || thinking) return;
    setError(null);

    // Historique = le fil courant (user + assistant), avant d'ajouter la
    // nouvelle question. Le serveur tronque aux ~6 derniers tours.
    const history: AssistantTurn[] = bubbles.map((b) => ({
      role: b.role,
      content: b.content,
    }));

    setBubbles((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setThinking(true);

    try {
      const res = await patientApi.askAssistant(text, history);
      setBubbles((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.reply,
          disclaimer: res.disclaimer,
          suggestions: res.suggestions,
          escalate: res.escalate,
        },
      ]);
    } catch (e) {
      // 503 = assistant indisponible : message dédié rassurant. Tout le reste
      // (401/404/500…) : on remonte le message renvoyé par le serveur.
      const msg =
        e instanceof ApiError && e.status === 503
          ? UNAVAILABLE_MSG
          : (e as Error)?.message || UNAVAILABLE_MSG;
      setError(msg);
    } finally {
      setThinking(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  const canSend = !!input.trim() && !thinking;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <header style={{ marginBottom: 20 }}>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: '#1e1e1e',
          }}
        >
          <Sparkles size={22} color="var(--brand-primary)" /> Assistant santé
        </h2>
        <p style={{ color: '#8a8580', marginTop: 6, fontSize: 14 }}>
          Votre assistant de suivi {branding.name} — posez vos questions sur vos
          indicateurs, votre roue d'équilibre et votre hygiène de vie.
        </p>
        {/* Note permanente non-diagnostic (indépendante de la réponse du serveur). */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
            marginTop: 10,
            padding: '10px 12px',
            background: 'var(--brand-primary-soft)',
            border: '1px solid var(--brand-primary)',
            borderRadius: 10,
            color: 'var(--brand-primary)',
            fontSize: 12.5,
            lineHeight: 1.5,
          }}
        >
          <Info size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Réponses éducatives, <strong>pas un diagnostic</strong>. Elles ne remplacent pas l'avis
            de votre praticien.
          </span>
        </div>
      </header>

      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          border: '1px solid #ece7e1',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 520,
        }}
      >
        {/* Fil de conversation */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            padding: 20,
            overflowY: 'auto',
            maxHeight: 460,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {bubbles.length === 0 && !thinking && (
            <EmptyState onPick={send} brandName={branding.name} />
          )}

          {bubbles.map((b, i) =>
            b.role === 'user' ? (
              <UserBubble key={i} text={b.content} />
            ) : (
              <AssistantBubble key={i} bubble={b} onPickSuggestion={send} />
            ),
          )}

          {thinking && <ThinkingBubble />}
        </div>

        {/* Erreur (ex. 503) */}
        {error && (
          <div
            style={{
              padding: '10px 16px',
              background: '#fef2f2',
              color: '#991b1b',
              fontSize: 13,
              borderTop: '1px solid #fecaca',
            }}
          >
            {error}
          </div>
        )}

        {/* Zone de saisie */}
        <form
          onSubmit={handleSubmit}
          style={{
            borderTop: '1px solid #ece7e1',
            padding: 12,
            display: 'flex',
            gap: 8,
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Écrivez votre question…"
            disabled={thinking}
            aria-label="Votre question"
            style={{
              flex: 1,
              padding: '11px 14px',
              border: '1px solid #ece7e1',
              borderRadius: 10,
              fontSize: 14,
              background: thinking ? '#fafaf8' : '#fff',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={!canSend}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '11px 20px',
              background: canSend ? 'var(--brand-primary)' : '#b0aaa2',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              cursor: canSend ? 'pointer' : 'not-allowed',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            <Send size={16} /> {thinking ? '…' : 'Envoyer'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── État vide : intro + questions suggérées au démarrage ──────────────
function EmptyState({
  onPick,
  brandName,
}: {
  onPick: (q: string) => void;
  brandName: string;
}) {
  return (
    <div style={{ textAlign: 'center', margin: 'auto 0', padding: '24px 8px' }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: 'var(--brand-primary-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px',
        }}
      >
        <Sparkles size={26} color="var(--brand-primary)" />
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#1e1e1e' }}>
        Bienvenue dans votre assistant de suivi
      </div>
      <p
        style={{
          color: '#8a8580',
          fontSize: 13,
          maxWidth: 440,
          margin: '8px auto 18px',
          lineHeight: 1.5,
        }}
      >
        Je m'appuie sur vos données de suivi {brandName} pour vous aider à
        comprendre vos indicateurs. Mes réponses sont éducatives et ne
        remplacent pas l'avis de votre praticien.
      </p>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          justifyContent: 'center',
        }}
      >
        {STARTER_QUESTIONS.map((q) => (
          <SuggestionChip key={q} label={q} onClick={() => onPick(q)} />
        ))}
      </div>
    </div>
  );
}

// ── Bulle patient ─────────────────────────────────────────────────────
function UserBubble({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div
        style={{
          maxWidth: '78%',
          padding: '10px 14px',
          borderRadius: 14,
          borderBottomRightRadius: 4,
          background: 'var(--brand-primary)',
          color: '#fff',
          fontSize: 14,
          lineHeight: 1.45,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {text}
      </div>
    </div>
  );
}

// ── Bulle assistant : encart urgences (si escalate) + texte + disclaimer
//    + chips de relance ─────────────────────────────────────────────────
function AssistantBubble({
  bubble,
  onPickSuggestion,
}: {
  bubble: ChatBubble;
  onPickSuggestion: (q: string) => void;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{ maxWidth: '88%', width: '100%' }}>
        {bubble.escalate && <EmergencyBanner />}

        <div
          style={{
            padding: '12px 14px',
            borderRadius: 14,
            borderBottomLeftRadius: 4,
            background: '#f4f0ea',
            color: '#1e1e1e',
            fontSize: 14,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {bubble.content}
        </div>

        {bubble.disclaimer && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              padding: '8px 12px',
              marginTop: 6,
              background: '#fafaf8',
              border: '1px solid #ece7e1',
              borderRadius: 10,
              color: '#8a8580',
              fontSize: 11.5,
              lineHeight: 1.45,
            }}
          >
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{bubble.disclaimer}</span>
          </div>
        )}

        {bubble.suggestions && bubble.suggestions.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 10,
            }}
          >
            {bubble.suggestions.map((s) => (
              <SuggestionChip
                key={s}
                label={s}
                onClick={() => onPickSuggestion(s)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Encart urgences (escalate === true) ───────────────────────────────
function EmergencyBanner() {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        gap: 10,
        padding: 12,
        marginBottom: 8,
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: 10,
        color: '#991b1b',
      }}
    >
      <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ fontSize: 13, lineHeight: 1.45 }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>
          Situation potentiellement urgente
        </div>
        Si vous êtes en situation d'urgence, appelez immédiatement le 15 ou le
        112 et contactez votre praticien.
      </div>
    </div>
  );
}

// ── Indicateur « réflexion » ──────────────────────────────────────────
function ThinkingBubble() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div
        style={{
          padding: '12px 16px',
          borderRadius: 14,
          borderBottomLeftRadius: 4,
          background: '#f4f0ea',
          color: '#8a8580',
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <Dot delay="0ms" />
          <Dot delay="160ms" />
          <Dot delay="320ms" />
        </span>
        <span>L'assistant réfléchit…</span>
        <style>{`@keyframes patientAssistantBlink {0%,80%,100%{opacity:.25}40%{opacity:1}}`}</style>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: 'var(--brand-primary)',
        display: 'inline-block',
        animation: `patientAssistantBlink 1.2s ${delay} infinite ease-in-out`,
      }}
    />
  );
}

// ── Chip de question (réutilisée pour starters + suggestions) ─────────
function SuggestionChip({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '7px 13px',
        background: '#fff',
        border: '1px solid var(--brand-primary)',
        color: 'var(--brand-primary)',
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: 500,
        cursor: 'pointer',
        lineHeight: 1.3,
        textAlign: 'left',
      }}
    >
      {label}
    </button>
  );
}
