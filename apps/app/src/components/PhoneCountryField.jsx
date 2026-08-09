import React, { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { PAYS_TEL, PAYS_AUTRE, PAYS_PAR_DEFAUT, trouverPays, nettoyerLocal, validerLocal, composerE164 } from '@/lib/phonePays';

/**
 * Champ téléphone « pays d'abord » pour la prise de rendez-vous : le visiteur choisit
 * son pays (l'indicatif est imposé et affiché), puis saisit UNIQUEMENT son numéro
 * local. La longueur nationale est validée en direct et le parent reçoit toujours
 * l'international complet (« +241066863336 ») — jamais de numéro ambigu.
 *
 * onChange(e164, { ok }) est appelé à chaque frappe ; e164 = '' tant que vide.
 */
export default function PhoneCountryField({ onChange, onEnter, label = 'WhatsApp', autoFocus = false }) {
  const [iso, setIso] = useState(PAYS_PAR_DEFAUT);
  const [local, setLocal] = useState('');
  const pays = useMemo(() => trouverPays(iso) || PAYS_AUTRE, [iso]);
  const verdict = useMemo(() => validerLocal(pays, local), [pays, local]);

  const emettre = (p, l) => {
    const v = validerLocal(p, l);
    onChange?.(l ? composerE164(p, l) : '', { ok: v.ok });
  };
  const changerPays = (nouvelIso) => {
    const p = trouverPays(nouvelIso) || PAYS_AUTRE;
    const l = nettoyerLocal(p, local);
    setIso(nouvelIso); setLocal(l); emettre(p, l);
  };
  const changerLocal = (saisie) => {
    const l = nettoyerLocal(pays, saisie);
    setLocal(l); emettre(pays, l);
  };

  const autre = pays.iso === PAYS_AUTRE.iso;
  const bordure = local && !verdict.ok ? 'border-[#d97757]/70' : verdict.ok ? 'border-[#7fb98a]/50' : 'border-white/10';

  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#f5f4ee]/50">{label}</span>
      <div className="flex gap-2">
        <select value={iso} onChange={(e) => changerPays(e.target.value)} aria-label="Pays du numéro"
          className="w-[42%] min-w-0 shrink-0 rounded-lg border border-white/10 bg-[#262624] px-2 py-2.5 text-sm text-[#f5f4ee] outline-none focus:border-[#d97757]">
          {PAYS_TEL.map((p) => (
            <option key={p.iso} value={p.iso}>{p.drapeau} {p.nom}</option>
          ))}
          <option value={PAYS_AUTRE.iso}>{PAYS_AUTRE.drapeau} {PAYS_AUTRE.nom}</option>
        </select>
        <div className={`relative flex min-w-0 flex-1 items-center rounded-lg border bg-[#262624] transition-colors focus-within:border-[#d97757] ${bordure}`}>
          {!autre && <span className="shrink-0 pl-3 text-sm font-semibold text-[#f5f4ee]/60">+{pays.cc}</span>}
          <input type="tel" inputMode="tel" value={local} autoFocus={autoFocus} aria-label="Numéro de téléphone local"
            onChange={(e) => changerLocal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); } }}
            placeholder={autre ? '+indicatif puis numéro' : pays.iso === 'GA' ? '06 00 00 00 0' : 'numéro local'}
            className="w-full min-w-0 bg-transparent px-2 py-2.5 text-sm text-[#f5f4ee] outline-none placeholder:text-[#f5f4ee]/35" />
          {verdict.ok && <Check className="mr-2.5 h-4 w-4 shrink-0 text-[#7fb98a]" />}
        </div>
      </div>
      <p className={`mt-1 min-h-[16px] text-[11px] ${local && !verdict.ok ? 'text-[#e8a184]' : 'text-[#f5f4ee]/40'}`}>
        {local && !verdict.ok
          ? verdict.message
          : verdict.ok
            ? `Numéro enregistré : +${autre ? local : `${pays.cc} ${local}`}`
            : autre
              ? 'Saisissez le numéro complet avec son indicatif (ex : +590 690 00 00 00).'
              : `L’indicatif +${pays.cc} est ajouté automatiquement — saisissez uniquement votre numéro.`}
      </p>
    </label>
  );
}
