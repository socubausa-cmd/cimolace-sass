import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Star, ShieldCheck, ArrowRight } from 'lucide-react';
import { boutiqueApi } from '@/lib/api-v2';

const PRODUCT = 'femme-nouvelle';

/**
 * Page de témoignage AUTONOME (`/temoignage`).
 *
 * On l'envoie aux lectrices qu'on sollicite. Elles ne doivent PAS atterrir sur
 * l'argumentaire de vente : on ne demande pas un avis en tendant un bon de
 * commande. La page ne contient donc que la couverture, la demande, et le
 * formulaire. Le lien vers le livre n'apparaît qu'APRÈS l'envoi, discrètement.
 */
const CSS = `
.tm-root{--tm-base:#262624;--tm-ink:#f5f1e9;--tm-muted:#a8a49c;--tm-dim:#9b958a;
  --tm-coral:#d97757;--tm-coral-soft:#e0926a;--tm-amber:#e6b878;
  --tm-line:rgba(245,241,233,.10);--tm-line-soft:rgba(245,241,233,.06);
  background:var(--tm-base);color:var(--tm-ink);min-height:100vh;
  font-family:Inter,system-ui,sans-serif;display:flex;flex-direction:column;}
#root .tm-root .tm-serif,.tm-root .tm-serif{font-family:Fraunces,Georgia,'Times New Roman',serif !important;}
.tm-wrap{width:100%;max-width:620px;margin:0 auto;padding:44px 20px 64px;flex:1;}
.tm-cover{display:block;width:104px;height:auto;border-radius:9px;border:1px solid var(--tm-line);margin-bottom:26px;}
.tm-h1{font-size:clamp(28px,5.4vw,40px);line-height:1.1;letter-spacing:-.02em;margin:0;text-wrap:balance;}
.tm-lead{color:var(--tm-muted);font-size:16px;line-height:1.7;margin:16px 0 0;}
.tm-card{border:1px solid var(--tm-line);border-radius:14px;padding:24px;background:transparent;margin-top:32px;}
.tm-root :is(input,textarea,select){width:100%;background:rgba(245,241,233,.04);border:1px solid var(--tm-line);
  border-radius:10px;padding:12px 14px;color:var(--tm-ink);font-size:15px;font-family:inherit;}
.tm-root :is(input,textarea,select):focus-visible{outline:2px solid var(--tm-coral);outline-offset:1px;border-color:transparent;}
.tm-root ::placeholder{color:var(--tm-dim);}
.tm-root :is(a,button,input,textarea,select):focus-visible{outline:2px solid var(--tm-coral);outline-offset:2px;}
.tm-label{display:block;font-size:12.5px;color:var(--tm-muted);margin:0 0 6px;font-weight:500;}
.tm-hint{font-size:12.5px;color:var(--tm-dim);line-height:1.55;margin:6px 0 0;}
.tm-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;padding:14px 26px;border-radius:11px;
  font-weight:700;font-size:15px;border:1px solid transparent;cursor:pointer;min-height:48px;
  background:var(--tm-coral);color:#241610;transition:background-color .18s ease;}
.tm-btn:hover:not(:disabled){background:var(--tm-coral-soft);}
.tm-btn:disabled{opacity:.55;cursor:not-allowed;}
.tm-stars{display:flex;gap:6px;}
.tm-stars button{background:none;border:0;padding:4px;cursor:pointer;line-height:0;border-radius:6px;}
.tm-row{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));}
.tm-foot{border-top:1px solid var(--tm-line-soft);padding:22px 20px;text-align:center;}
@media (prefers-reduced-motion:reduce){.tm-root *{transition:none !important;}}
`;

function pickApiError(e) {
  const d = e?.response?.data;
  const m = d?.error?.message ?? d?.message;
  return Array.isArray(m) ? m.join(' ') : (typeof m === 'string' ? m : null);
}

/** Notation cliquable — sur mobile, un vrai bouton par étoile vaut mieux qu'un menu. */
function NoteSelector({ value, onChange }) {
  return (
    <div className="tm-stars" role="radiogroup" aria-label="Votre note">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n}
          aria-label={`${n} étoile${n > 1 ? 's' : ''}`} onClick={() => onChange(n)}>
          <Star size={28} strokeWidth={1.6}
            style={{ color: n <= value ? 'var(--tm-amber)' : 'var(--tm-dim)' }}
            fill={n <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
}

export default function TemoignagePage() {
  const [product, setProduct] = useState(null);
  const [form, setForm] = useState({
    authorName: '', authorRole: '', rating: 5, reviewText: '', buyerEmail: '', website: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => { document.title = 'Votre témoignage — La Femme Nouvelle'; }, []);
  useEffect(() => {
    boutiqueApi.product(PRODUCT).then(setProduct).catch(() => { /* la page vit sans */ });
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = useCallback(async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const r = await boutiqueApi.submitReview(PRODUCT, {
        ...form,
        rating: Number(form.rating),
        authorRole: form.authorRole || undefined,
        buyerEmail: form.buyerEmail || undefined,
      });
      setDone(r);
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (err) {
      setError(pickApiError(err) || 'Envoi impossible pour le moment. Réessayez dans un instant.');
    } finally { setBusy(false); }
  }, [form]);

  return (
    <div className="tm-root">
      <style>{CSS}</style>
      <div className="tm-wrap">
        {product?.coverUrl && (
          <img src={product.coverUrl} alt={`Couverture — ${product.title}`} className="tm-cover" />
        )}

        {done ? (
          <div>
            <Check size={34} aria-hidden="true" style={{ color: 'var(--tm-coral)' }} />
            <h1 className="tm-h1 tm-serif" style={{ marginTop: 14 }}>Merci.</h1>
            <p className="tm-lead">
              {done.message || 'Votre témoignage est bien arrivé. Il sera relu, puis publié.'}
              {done.verified && ' Il portera la mention « achat vérifié ».'}
            </p>
            <p className="tm-hint" style={{ marginTop: 18 }}>
              {form.buyerEmail
                ? 'Un accusé de réception vient de partir à votre adresse.'
                : 'Rien ne sera publié sous votre nom sans avoir été relu.'}
            </p>
            <a href="/femme-nouvelle" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 30,
              color: 'var(--tm-dim)', fontSize: 14, textDecoration: 'none',
            }}>
              Voir la page du livre <ArrowRight size={15} aria-hidden="true" />
            </a>
          </div>
        ) : (
          <>
            <p style={{
              fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase',
              color: 'var(--tm-amber)', fontWeight: 600, margin: 0,
            }}>
              {product?.title || 'On t’a jugée sans t’entendre'}
            </p>
            <h1 className="tm-h1 tm-serif" style={{ marginTop: 12 }}>Votre témoignage</h1>
            <p className="tm-lead">
              Vous avez lu le livre. Ce que vous en direz aidera d’autres femmes à oser l’ouvrir.
              Deux minutes suffisent — et vous pouvez signer d’un prénom seul.
            </p>

            <form onSubmit={submit} className="tm-card" style={{ display: 'grid', gap: 18 }}>
              <div>
                <label className="tm-label" htmlFor="tm-note">Votre note</label>
                <NoteSelector value={Number(form.rating)}
                  onChange={(n) => setForm((f) => ({ ...f, rating: n }))} />
                <input id="tm-note" type="hidden" value={form.rating} readOnly />
              </div>

              <div>
                <label className="tm-label" htmlFor="tm-texte">Votre témoignage</label>
                <textarea id="tm-texte" required minLength={10} maxLength={2000} rows={6}
                  value={form.reviewText} onChange={set('reviewText')}
                  placeholder="Ce que ce livre a changé pour vous…" />
              </div>

              <div className="tm-row">
                <div>
                  <label className="tm-label" htmlFor="tm-nom">Votre nom ou prénom</label>
                  <input id="tm-nom" required minLength={2} maxLength={80} autoComplete="given-name"
                    value={form.authorName} onChange={set('authorName')} />
                </div>
                <div>
                  <label className="tm-label" htmlFor="tm-ville">Ville (facultatif)</label>
                  <input id="tm-ville" maxLength={80} value={form.authorRole}
                    onChange={set('authorRole')} placeholder="Libreville" />
                </div>
              </div>

              <div>
                <label className="tm-label" htmlFor="tm-mail">E-mail de votre achat (facultatif)</label>
                <input id="tm-mail" type="email" autoComplete="email"
                  value={form.buyerEmail} onChange={set('buyerEmail')} placeholder="vous@exemple.com" />
                <p className="tm-hint">
                  Si elle correspond à un achat, votre avis portera la mention « achat vérifié ».
                  Elle sert aussi à vous envoyer un accusé de réception. Elle n’est jamais affichée.
                </p>
              </div>

              {/* Pot de miel : invisible pour une humaine, rempli par les robots. */}
              <input type="text" name="website" value={form.website} onChange={set('website')}
                tabIndex={-1} autoComplete="off" aria-hidden="true"
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />

              {error && <p style={{ color: 'var(--tm-coral-soft)', fontSize: 13.5, margin: 0 }}>{error}</p>}

              <button type="submit" className="tm-btn" disabled={busy} style={{ justifySelf: 'start' }}>
                {busy ? <Loader2 size={17} aria-hidden="true" className="animate-spin" /> : <Check size={17} aria-hidden="true" />}
                Envoyer mon témoignage
              </button>

              <p className="tm-hint" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: 0 }}>
                <ShieldCheck size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                Rien n’est publié automatiquement : chaque témoignage est relu avant d’apparaître.
              </p>
            </form>
          </>
        )}
      </div>

      <footer className="tm-foot">
        <p className="tm-serif" style={{ margin: 0, fontSize: 13, letterSpacing: '.1em', color: 'var(--tm-amber)' }}>
          LA FEMME NOUVELLE
        </p>
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--tm-dim)' }}>
          Ngowazulu Nemayekou — MK5 · prorascience.org
        </p>
      </footer>
    </div>
  );
}
