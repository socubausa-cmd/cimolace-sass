import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import QRCode from 'react-qr-code';
import { Copy, Check, Trash2, Users, UserPlus, Loader2 } from 'lucide-react';
import { liveJoinApi } from '@/lib/api-v2';

/**
 * Gestion des LIENS D'ACCÈS d'un live (scénario A), pour le professeur.
 * Deux modes au choix :
 *   - « Lien de classe »   : un lien/QR rejouable par toute la classe.
 *   - « Liens individuels » : un code one-time par élève (anti-partage).
 */
export default function LiveJoinLinksPage() {
  const { id: sessionId } = useParams();
  const [mode, setMode] = useState('class');
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [studentsText, setStudentsText] = useState('');
  const [count, setCount] = useState(5);

  const refresh = useCallback(async () => {
    try {
      const res = await liveJoinApi.list(sessionId);
      setCodes(res?.codes ?? []);
    } catch (e) {
      setError(e?.message || 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { refresh(); }, [refresh]);

  const joinUrl = (code) => `${window.location.origin}/live/rejoindre?code=${code}`;

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    } catch { /* clipboard indispo */ }
  };

  const generate = async () => {
    setBusy(true); setError('');
    try {
      if (mode === 'class') {
        await liveJoinApi.generate(sessionId, { mode: 'class' });
      } else {
        const students = studentsText.split('\n').map((s) => s.trim()).filter(Boolean);
        await liveJoinApi.generate(sessionId, students.length ? { mode: 'individual', students } : { mode: 'individual', count: Number(count) || 1 });
      }
      await refresh();
    } catch (e) {
      setError(e?.message || 'Génération impossible.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (codeId) => {
    setBusy(true);
    try { await liveJoinApi.revoke(sessionId, codeId); await refresh(); }
    catch (e) { setError(e?.message || 'Révocation impossible.'); }
    finally { setBusy(false); }
  };

  const classCode = codes.find((c) => c.mode === 'class' && c.status === 'active');
  const individualCodes = codes.filter((c) => c.mode === 'individual');

  const tab = (id, label, Icon) => (
    <button
      type="button"
      onClick={() => setMode(id)}
      className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-[13px] font-semibold transition-colors ${
        mode === id ? 'border-[#d97757] bg-[color-mix(in_srgb,#d97757_16%,transparent)] text-white' : 'border-white/15 bg-white/5 text-stone-300 hover:border-white/30'
      }`}
    >
      <Icon size={15} /> {label}
    </button>
  );

  return (
    <div className="min-h-[100dvh] bg-[#262624] text-white" style={{ '--school-accent': '#d97757' }}>
      <Helmet><title>Liens d'accès au live</title></Helmet>
      <main className="mx-auto w-full max-w-2xl px-5 py-10">
        <h1 className="text-[20px] font-bold text-[#f5f4ee]">Liens d'accès au live</h1>
        <p className="mt-1 text-[13px] text-[#b0ada3]">
          Choisissez comment vos élèves rejoignent la séance. Les liens donnent accès à la salle uniquement — aucun compte requis.
        </p>

        <div className="mt-6 flex gap-3">
          {tab('class', 'Lien de classe', Users)}
          {tab('individual', 'Liens individuels', UserPlus)}
        </div>

        {error && <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

        {/* ── Mode CLASSE ── */}
        {mode === 'class' && (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[13px] text-[#b0ada3]">Un seul lien, partageable — toute la classe l'utilise pour entrer. Idéal projeté ou envoyé au groupe.</p>
            {classCode ? (
              <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <div className="rounded-lg bg-white p-3"><QRCode value={joinUrl(classCode.code)} size={120} /></div>
                <div className="flex-1">
                  <div className="text-[11px] uppercase tracking-wide text-[#82807a]">Code</div>
                  <div className="font-mono text-2xl font-bold tracking-[0.3em] text-[#d97757]">{classCode.code}</div>
                  <div className="mt-3 flex items-center gap-2">
                    <input readOnly value={joinUrl(classCode.code)} className="w-full truncate rounded-md border border-white/15 bg-white/5 px-3 py-2 text-[12px] text-stone-300" />
                    <button type="button" onClick={() => copy(joinUrl(classCode.code), 'class')} className="shrink-0 rounded-md bg-[#d97757] px-3 py-2 text-black hover:bg-[#c2683f]">
                      {copied === 'class' ? <Check size={15} /> : <Copy size={15} />}
                    </button>
                  </div>
                  <button type="button" onClick={() => revoke(classCode.id)} disabled={busy} className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-stone-400 hover:text-red-300">
                    <Trash2 size={13} /> Révoquer ce lien
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={generate} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-md bg-[#d97757] px-4 py-2.5 text-[13px] font-semibold text-black hover:bg-[#c2683f] disabled:opacity-60">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Users size={15} />} Générer le lien de classe
              </button>
            )}
          </div>
        )}

        {/* ── Mode INDIVIDUEL ── */}
        {mode === 'individual' && (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[13px] text-[#b0ada3]">Un code à usage unique par élève — non partageable. Collez les noms (un par ligne) ou choisissez un nombre.</p>
            <textarea
              rows={4}
              value={studentsText}
              onChange={(e) => setStudentsText(e.target.value)}
              placeholder={'Marie Diallo\nPaul Nkemba\n…'}
              className="mt-3 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-[#d97757] focus:outline-none"
            />
            <div className="mt-2 flex items-center gap-3">
              <span className="text-[12px] text-[#82807a]">ou sans noms :</span>
              <input type="number" min={1} max={200} value={count} onChange={(e) => setCount(e.target.value)} className="w-20 rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white" />
              <span className="text-[12px] text-[#82807a]">codes</span>
            </div>
            <button type="button" onClick={generate} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-md bg-[#d97757] px-4 py-2.5 text-[13px] font-semibold text-black hover:bg-[#c2683f] disabled:opacity-60">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Générer les codes
            </button>

            {individualCodes.length > 0 && (
              <div className="mt-5 divide-y divide-white/[0.06] rounded-lg border border-white/10">
                {individualCodes.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="font-mono text-[15px] font-semibold tracking-[0.2em] text-[#d97757]">{c.code}</span>
                    <span className="flex-1 truncate text-[13px] text-stone-300">{c.label || '—'}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${c.status === 'used' ? 'bg-white/10 text-stone-400' : c.status === 'revoked' ? 'bg-red-500/15 text-red-300' : 'bg-[#9fbf8f]/15 text-[#c9dcbf]'}`}>
                      {c.status === 'used' ? 'utilisé' : c.status === 'revoked' ? 'révoqué' : 'actif'}
                    </span>
                    <button type="button" onClick={() => copy(joinUrl(c.code), c.id)} className="rounded p-1.5 text-stone-400 hover:text-white" title="Copier le lien">
                      {copied === c.id ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    {c.status === 'active' && (
                      <button type="button" onClick={() => revoke(c.id)} disabled={busy} className="rounded p-1.5 text-stone-400 hover:text-red-300" title="Révoquer">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {loading && <div className="mt-6 flex items-center gap-2 text-sm text-stone-400"><Loader2 size={15} className="animate-spin" /> Chargement…</div>}
      </main>
    </div>
  );
}
