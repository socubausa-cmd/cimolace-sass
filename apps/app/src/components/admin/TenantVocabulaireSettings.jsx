/**
 * TenantVocabulaireSettings — LE VOCABULAIRE DE L'ÉCOLE, section de /liri/reglages.
 *
 * ── À QUOI SERT CET ÉCRAN, ET POURQUOI IL N'EXISTAIT PAS AVANT ───────────────
 * Les extraits courts publiés par l'école affichent désormais la PAROLE en très gros
 * (le sous-titre n'est plus un ornement de bas de trame, il EST le contenu du clip).
 * La transcription automatique, elle, écrit ce qu'elle ENTEND : sur le replay de
 * référence elle a écrit « Je suis Shao, cinquième Manikongo » là où l'orateur dit
 * « Je suis Cheo ». En 18 px la faute passait ; en 110 px elle est lue par tout le
 * monde, sous le nom de l'école.
 *
 * On fait bien relire ces lignes par un modèle, mais c'est mesuré : deux tours sur le
 * même corpus ont donné 3 corrections sur 9, puis 1 sur 9. Et « Cheo » n'est de toute
 * façon devinable par AUCUN modèle — ce n'est pas un mot de la langue, c'est le nom de
 * l'orateur. L'information existe pourtant : elle est écrite sur sa diapo. Elle n'était
 * juste jamais donnée au correcteur.
 *
 * Cet écran la lui donne. C'est le créateur qui remplit, parce que c'est lui — et lui
 * seul — qui sait comment s'écrivent les noms de son enseignement.
 *
 * ── CE QU'IL FAUT SAVOIR POUR MODIFIER CE FICHIER ───────────────────────────
 * · La donnée vit dans `public.tenant_glossary` (migration 20260727180000), pas dans
 *   `tenants.metadata`. Elle est lue par le worker qui fabrique les extraits
 *   (apps/worker/src/jobs/short-sous-titres.js).
 * · Les CLÉS restent celles des colonnes (`term`, `variants`, `category`, `note`,
 *   `active`) de la base jusqu'à ce composant : le français est dans les libellés, pas
 *   dans le schéma. Une donnée qui change de nom à chaque étage finit mal branchée.
 * · L'enregistrement REMPLACE la liste entière (PUT). C'est ce qui permet de supprimer.
 *   Corollaire : ce composant doit afficher TOUT ce qui existe, entrées en pause
 *   comprises — masquer une ligne reviendrait à la supprimer au prochain envoi.
 *
 * Palette : charte LIRI (fond #262624 · panneau #30302e · champ #2b2a27 · encre #f5f4ee
 * · corail = actions · or). Les teintes de TEXTE sont volontairement plus claires que
 * les teintes d'APLAT du même nom : sur ce panneau, le corail de fond (#d97757) ne
 * tient que 4,24:1 en texte, sa version claire (#e08b6c) tient 5,09:1.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SpellCheck, Plus, Trash2, Save, Loader2, Check, AlertCircle, AlertTriangle, Play, Pause,
} from 'lucide-react';
import { tenantsApi } from '@/lib/api-v2';

/* Jetons locaux — même charte que TenantAdminSettingsPage, recopiée ici pour que le
   composant reste autonome (c'est déjà le patron des sections voisines). Contrastes
   vérifiés sur le panneau #30302e et sur la carte d'entrée #34332f. */
const T = {
  surface:     '#2b2a27', // champ de saisie
  surfaceCard: '#30302e', // panneau de section
  surface2:    '#34332f', // carte d'une entrée
  border:      'rgba(245,244,238,0.09)',
  borderMid:   'rgba(245,244,238,0.15)',
  gold:        '#d99a4e', // 5,47:1 sur le panneau
  goldClair:   '#e6cc92', // 7,08:1 sur l'aplat or pâle de l'avertissement
  coral:       '#d97757', // APLAT d'action uniquement
  coralTexte:  '#e08b6c', // 5,09:1 — le corail lisible en texte
  coralInk:    '#1f1e1c', // 5,34:1 sur aplat corail
  danger:      '#ef8a78', // 5,37:1 — version claire de #e2553f, illisible en texte
  success:     '#9fbf8f', // 6,50:1
  t1: '#f5f4ee',
  t2: '#b0ada3',          // 5,89:1 sur le panneau — plancher des textes secondaires
  tPlaceholder: '#9a978d', // 4,91:1 dans le champ #2b2a27
};

/**
 * ⚠️ LES EXEMPLES SONT DANS LES PLACEHOLDERS (« Cheo », « Shao, Chao ») : ce sont eux qui
 * expliquent quoi écrire, ils doivent donc être LISIBLES. Or la page hôte impose
 * `.liri-reglages-scope input::placeholder { color: #82807a }` — 3,35:1, sous le
 * plancher de 4,5:1. On reprend la main par spécificité, sans toucher à la page.
 */
const VOCA_CSS = `
.liri-reglages-scope .liri-voca input::placeholder { color: ${T.tPlaceholder}; }
`;

const champ = {
  width: '100%', borderRadius: 8, border: `1px solid ${T.border}`,
  background: T.surface, color: T.t1, padding: '8px 10px', fontSize: 13, outline: 'none',
};
const surFocus = (e) => { e.target.style.borderColor = 'rgba(217,154,78,0.30)'; };
const surBlur = (e) => { e.target.style.borderColor = T.border; };

/* Suggestions de NATURE. Volontairement une liste OUVERTE (datalist) et non un menu
   fermé : la colonne est du texte libre, et l'amorce livrée en base emploie déjà
   « titre » et « peuple », que personne n'avait prévus. Guider, pas enfermer. */
const NATURES = ['personne', 'lignée', 'lieu', 'peuple', 'titre', 'école', "terme d'enseignement"];

/** Même normalisation que le serveur : c'est elle qui décide si deux lignes font doublon. */
function cleTerme(mot) {
  return String(mot ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Une entrée neuve : active par défaut — on n'ajoute pas un mot pour qu'il ne serve pas. */
const entreeVierge = () => ({ term: '', variants: [], category: '', note: '', active: true });

export default function TenantVocabulaireSettings() {
  const [entrees, setEntrees] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [enregistre, setEnregistre] = useState(false);
  const [erreur, setErreur] = useState('');
  const [indisponible, setIndisponible] = useState(null);
  const [modifie, setModifie] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const r = await tenantsApi.getVocabulaire();
      setEntrees(Array.isArray(r?.entrees) ? r.entrees : []);
      setIndisponible(r?.indisponible ?? null);
      setErreur('');
      setModifie(false);
    } catch (e) {
      setErreur(e?.message || 'Vocabulaire illisible pour le moment.');
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const modifier = (index, champModifie, valeur) => {
    setEntrees((liste) => liste.map((e, i) => (i === index ? { ...e, [champModifie]: valeur } : e)));
    setModifie(true);
    setEnregistre(false);
  };

  const ajouter = () => {
    setEntrees((liste) => [...liste, entreeVierge()]);
    setModifie(true);
    setEnregistre(false);
  };

  const supprimer = (index) => {
    setEntrees((liste) => liste.filter((_, i) => i !== index));
    setModifie(true);
    setEnregistre(false);
  };

  /* Doublons signalés AVANT l'envoi. Le serveur les fusionne en silence (il le doit :
     la base porte une contrainte d'unicité) — mais un créateur qui voit deux lignes
     partir et une seule revenir croit à une perte de données. On le prévient. */
  const doublons = useMemo(() => {
    const vus = new Set();
    const enDouble = new Set();
    for (const e of entrees) {
      const c = cleTerme(e.term);
      if (!c) continue;
      if (vus.has(c)) enDouble.add(c);
      vus.add(c);
    }
    return enDouble;
  }, [entrees]);

  const sansTerme = entrees.some((e) => !String(e.term || '').trim());

  const enregistrer = async () => {
    setEnvoi(true);
    setErreur('');
    setEnregistre(false);
    try {
      // On envoie la liste TELLE QU'ELLE EST À L'ÉCRAN, y compris les lignes vides :
      // le serveur est le seul juge du nettoyage, et il rend la liste relue en base.
      // Filtrer ici ferait exister deux règles de nettoyage qui divergeraient un jour.
      const r = await tenantsApi.saveVocabulaire(entrees);
      setEntrees(Array.isArray(r?.entrees) ? r.entrees : []);
      setIndisponible(r?.indisponible ?? null);
      setModifie(false);
      setEnregistre(true);
      setTimeout(() => setEnregistre(false), 3000);
    } catch (e) {
      setErreur(e?.message || "Échec de l'enregistrement du vocabulaire.");
    } finally {
      setEnvoi(false);
    }
  };

  const actives = entrees.filter((e) => e.active && String(e.term || '').trim()).length;

  return (
    <div className="liri-voca" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{VOCA_CSS}</style>
      {/* LA PHRASE QUI JUSTIFIE L'ÉCRAN. Elle porte l'exemple RÉEL, pas une abstraction :
          c'est ce qui fait comprendre en trois secondes quoi écrire dans les champs. */}
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: T.t2 }}>
        La transcription automatique de vos séances écrit ce qu'elle <em>entend</em> — elle a
        écrit <strong style={{ color: T.t1 }}>« Shao »</strong> là où il faut
        lire <strong style={{ color: T.t1 }}>« Cheo »</strong> — et ce texte s'affiche
        maintenant en très grand dans vos extraits publiés&nbsp;: les noms que vous inscrivez
        ici font autorité sur son orthographe.
      </p>

      {/* La table peut ne pas être en place (les migrations Cimolace s'appliquent
          hors-bande). On le DIT : une liste vide et rassurante ferait croire à un
          glossaire vide alors que rien ne peut être enregistré. */}
      {indisponible && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, borderRadius: 10,
          background: 'rgba(217,154,78,0.10)', border: '1px solid rgba(217,154,78,0.30)',
          padding: 14, fontSize: 12.5, lineHeight: 1.5, color: T.goldClair,
        }}>
          <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
          <span>{indisponible}</span>
        </div>
      )}

      {erreur && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10,
          background: 'rgba(226,85,63,0.10)', border: '1px solid rgba(226,85,63,0.30)',
          padding: 14, fontSize: 13, color: T.danger,
        }}>
          <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
          {erreur}
        </div>
      )}

      {chargement ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.t2, padding: '12px 0' }}>
          <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} /> Chargement du vocabulaire…
        </div>
      ) : (
        <>
          {entrees.length === 0 && !indisponible && (
            <div style={{
              borderRadius: 10, border: `1px dashed ${T.borderMid}`, background: 'rgba(245,244,238,0.03)',
              padding: 20, fontSize: 13, lineHeight: 1.55, color: T.t2,
            }}>
              <SpellCheck style={{ width: 18, height: 18, color: T.gold, marginBottom: 8 }} />
              <p style={{ margin: 0 }}>
                Aucun nom déclaré. Commencez par ceux que la machine écorche le plus souvent&nbsp;:
                votre nom, ceux de vos maîtres et lignées, les lieux et les termes propres à votre
                enseignement.
              </p>
            </div>
          )}

          {entrees.map((e, index) => {
            const enDouble = doublons.has(cleTerme(e.term));
            return (
              <div
                key={index}
                style={{
                  borderRadius: 12,
                  /**
                   * ⚠️ UNE ENTRÉE EN PAUSE N'EST PAS GRISÉE — mesuré, pas supposé.
                   * Le réflexe (`opacity: 0.62`) fait tomber les libellés secondaires
                   * (#b0ada3 sur #34332f) de 5,63:1 à 3,13:1, sous le plancher de 4,5:1 :
                   * un état « en pause » ne doit pas coûter la LISIBILITÉ de ce qu'on met
                   * en pause. On le dit donc autrement — trait discontinu, fond plus
                   * sombre, pastille explicite — et chaque texte garde sa pleine valeur.
                   */
                  border: enDouble
                    ? '1px solid rgba(226,85,63,0.35)'
                    : e.active ? `1px solid ${T.border}` : `1px dashed rgba(217,154,78,0.35)`,
                  background: e.active ? T.surface2 : '#2d2c29',
                  padding: 14,
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}
              >
                {!e.active && (
                  <span style={{
                    alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5,
                    borderRadius: 999, background: 'rgba(217,154,78,0.12)',
                    border: '1px solid rgba(217,154,78,0.30)', padding: '3px 9px',
                    fontSize: 11.5, fontWeight: 600, color: T.goldClair,
                  }}>
                    <Pause style={{ width: 11, height: 11 }} /> En pause — ne sert pas aux sous-titres
                  </span>
                )}

                {/* Ligne 1 : l'orthographe qui fait foi + les graphies fautives constatées.
                    Grille qui retombe en colonne sous 560 px (aucune media query possible
                    en style en ligne : `repeat(auto-fit, minmax(…))` fait le même travail). */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.t2 }}>Orthographe exacte</span>
                    <input
                      style={{ ...champ, fontWeight: 600 }}
                      onFocus={surFocus}
                      onBlur={surBlur}
                      value={e.term}
                      onChange={(ev) => modifier(index, 'term', ev.target.value)}
                      placeholder="Cheo"
                      maxLength={80}
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.t2 }}>
                      Ce que la machine écrit à la place
                    </span>
                    {/* Saisie en texte, découpée à la virgule seulement au moment de la
                        frappe : un tableau reconstruit à chaque touche empêcherait
                        d'écrire une virgule, et donc d'en saisir plusieurs. */}
                    <input
                      style={champ}
                      onFocus={surFocus}
                      onBlur={surBlur}
                      value={(e.variants || []).join(', ')}
                      onChange={(ev) => modifier(
                        index,
                        'variants',
                        ev.target.value.split(',').map((v) => v.trim()).filter(Boolean),
                      )}
                      placeholder="Shao, Chao"
                    />
                  </label>
                </div>

                {/* Ligne 2 : nature (part au modèle avec le terme) + mémo (pour l'humain). */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.t2 }}>Nature</span>
                    <input
                      style={champ}
                      onFocus={surFocus}
                      onBlur={surBlur}
                      list="liri-vocabulaire-natures"
                      value={e.category}
                      onChange={(ev) => modifier(index, 'category', ev.target.value)}
                      placeholder="personne"
                      maxLength={40}
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.t2 }}>
                      Mémo (pour vous, jamais publié)
                    </span>
                    <input
                      style={champ}
                      onFocus={surFocus}
                      onBlur={surBlur}
                      value={e.note}
                      onChange={(ev) => modifier(index, 'note', ev.target.value)}
                      placeholder="Entendu « Shao » dans le replay du 12/03"
                      maxLength={500}
                    />
                  </label>
                </div>

                {enDouble && (
                  <p style={{ margin: 0, fontSize: 12, color: T.danger }}>
                    Ce nom apparaît deux fois. À l'enregistrement, les deux lignes n'en feront
                    qu'une — complétez-en une seule.
                  </p>
                )}

                {/* Ligne 3 : pause / reprise et retrait. Séparés VISUELLEMENT et en libellé,
                    parce qu'ils ne s'annulent pas de la même façon : la pause se reprend,
                    le retrait efface l'entrée. */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 12, flexWrap: 'wrap', borderTop: `1px solid ${T.border}`, paddingTop: 10,
                }}>
                  <button
                    type="button"
                    onClick={() => modifier(index, 'active', !e.active)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8,
                      background: 'transparent', border: `1px solid ${T.border}`,
                      color: e.active ? T.t2 : T.gold, padding: '5px 10px', fontSize: 12, cursor: 'pointer',
                    }}
                    title={e.active
                      ? "Suspendre : l'entrée reste ici mais ne sert plus aux sous-titres"
                      : 'Réactiver cette entrée'}
                  >
                    {e.active
                      ? <><Pause style={{ width: 13, height: 13 }} /> Mettre en pause</>
                      : <><Play style={{ width: 13, height: 13 }} /> En pause — reprendre</>}
                  </button>

                  <button
                    type="button"
                    onClick={() => supprimer(index)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8,
                      background: 'transparent', border: '1px solid rgba(226,85,63,0.30)',
                      color: T.danger, padding: '5px 10px', fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    <Trash2 style={{ width: 13, height: 13 }} /> Retirer
                  </button>
                </div>
              </div>
            );
          })}

          {/* Une seule datalist pour toutes les lignes — les navigateurs la partagent par id. */}
          <datalist id="liri-vocabulaire-natures">
            {NATURES.map((n) => <option key={n} value={n} />)}
          </datalist>

          <button
            type="button"
            onClick={ajouter}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              borderRadius: 8, background: 'transparent', border: `1px dashed ${T.borderMid}`,
              color: T.coralTexte, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus style={{ width: 15, height: 15 }} /> Ajouter un nom
          </button>

          {/* Barre de bas de section : ce qui part au moteur, l'état, l'action. */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, flexWrap: 'wrap', paddingTop: 4,
          }}>
            <span style={{ fontSize: 12, color: T.t2 }}>
              {actives === 0
                ? 'Aucun nom actif : la relecture des sous-titres se fera sans vocabulaire.'
                : `${actives} nom${actives > 1 ? 's' : ''} actif${actives > 1 ? 's' : ''} — utilisé${actives > 1 ? 's' : ''} au prochain extrait fabriqué.`}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {sansTerme && (
                <span style={{ fontSize: 12, color: T.t2 }}>
                  Les lignes sans orthographe ne seront pas conservées.
                </span>
              )}
              {modifie && !enregistre && (
                <span style={{ fontSize: 12, color: T.gold }}>Modifications non enregistrées</span>
              )}
              {enregistre && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: T.success }}>
                  <Check style={{ width: 15, height: 15 }} /> Vocabulaire enregistré
                </span>
              )}
              <button
                type="button"
                onClick={enregistrer}
                disabled={envoi}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8,
                  background: T.coral, color: T.coralInk, padding: '8px 16px',
                  fontSize: 13, fontWeight: 600, border: 'none',
                  cursor: envoi ? 'default' : 'pointer', opacity: envoi ? 0.5 : 1,
                }}
              >
                {envoi
                  ? <Loader2 className="animate-spin" style={{ width: 15, height: 15 }} />
                  : <Save style={{ width: 15, height: 15 }} />}
                Enregistrer le vocabulaire
              </button>
            </div>
          </div>

          {/* Le seul conseil qui évite un dégât réel : une variante est un remplacement
              aveugle sur TOUTES les transcriptions de l'école. */}
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: T.t2 }}>
            Dans « ce que la machine écrit à la place », ne mettez que des graphies
            <strong style={{ color: T.t1 }}> réellement constatées</strong> dans vos
            transcriptions&nbsp;: elles sont remplacées automatiquement partout. L'orthographe
            exacte suffit pour le reste — elle est fournie comme référence à la relecture.
          </p>
        </>
      )}
    </div>
  );
}
