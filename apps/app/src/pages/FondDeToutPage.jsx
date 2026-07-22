import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  BookOpen, ChevronDown, Crown, Atom, Layers, Compass,
  Cloud, Droplets, Database, Map, ArrowRight, MessageCircle,
  Eye, Zap, Star, Sparkles, Shield, Lock, Scale,
  Quote, FileText, GraduationCap
} from 'lucide-react';
import { activeTenantConfig as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';

const PUBLIC = isnaTenantConfig.branding.publicSiteOrigin;
const PAGE_URL = `${PUBLIC}/fond-de-tout`;
const SITE_NAME = `${isnaTenantConfig.branding.name} · LIRI`;

const LawBox = ({ title, children }) => (
  <div className="bg-[var(--school-accent)]/[0.08] border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] rounded-xl p-5 my-4">
    <div className="flex items-center gap-2 mb-2">
      <Scale className="w-4 h-4 text-[var(--school-accent)]" />
      <span className="text-xs font-bold text-[var(--school-accent)] uppercase tracking-wider">Loi : {title}</span>
    </div>
    <p className="text-gray-200 leading-relaxed font-medium">{children}</p>
  </div>
);

const AxiomBox = ({ id, title, children }) => (
  <div className="bg-amber-500/[0.06] border border-amber-500/25 rounded-xl p-5 my-3">
    <div className="flex items-center gap-2 mb-2">
      <Shield className="w-4 h-4 text-amber-400" />
      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Axiome {id} — {title}</span>
    </div>
    <p className="text-gray-300 leading-relaxed">{children}</p>
  </div>
);

const TE = ({ number, title, children }) => (
  <div className="bg-[#2a2724] border border-white/5 rounded-xl p-6 my-5 hover:border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] transition-all">
    <div className="flex items-center gap-2 mb-3">
      <Sparkles className="w-4 h-4 text-[var(--school-accent)]" />
      <span className="text-sm font-bold text-[var(--school-accent)]">Expérience de pensée {number}</span>
    </div>
    <h4 className="text-lg font-serif font-bold text-white mb-3">{title}</h4>
    <div className="text-gray-300 text-base leading-relaxed space-y-3">{children}</div>
  </div>
);

const BQ = ({ children }) => (
  <div className="border-l-4 border-[var(--school-accent)] pl-5 py-3 my-5">
    <p className="text-lg font-serif italic text-[color-mix(in_srgb,var(--school-accent)_90%,transparent)] leading-relaxed">{children}</p>
  </div>
);

const DT = ({ headers, rows }) => (
  <div className="overflow-x-auto my-4">
    <table className="w-full text-sm border-collapse">
      <thead><tr>{headers.map((h, i) => <th key={i} className="text-left text-[var(--school-accent)] text-xs uppercase tracking-wider py-3 px-4 border-b border-white/10 bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)]">{h}</th>)}</tr></thead>
      <tbody>{rows.map((row, i) => <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">{row.map((cell, j) => <td key={j} className="py-3 px-4 text-gray-300">{cell}</td>)}</tr>)}</tbody>
    </table>
  </div>
);

const navItems = [
  { id: 'prologue', s: 'Prologue' }, { id: 'ch1', s: 'Ch.1' }, { id: 'ch2', s: 'Ch.2' },
  { id: 'ch3', s: 'Ch.3' }, { id: 'ch4', s: 'Ch.4' }, { id: 'ch5', s: 'Ch.5' },
  { id: 'ch6', s: 'Ch.6' }, { id: 'ch7', s: 'Ch.7' }, { id: 'epilogue', s: 'Épilogue' }, { id: 'annexes', s: 'Annexes' },
];

const FondDeToutPage = () => {
  const [ac, setAc] = useState('prologue');
  const go = (id) => { setAc(id); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return (
    <div className="min-h-screen bg-[#262624] text-white">
      <Helmet>
        <title>{`Le Fond de Tout — Livre I | ${SITE_NAME}`}</title>
        <meta name="description" content="Le Fond de Tout — Livre I de la Prorascience par le 5ᵉ Manikongo. Ontologie fondamentale, Potentia Prima, champ de permission Φ, 9 axiomes de la Singularité et les 10 équations fondamentales." />
        <link rel="canonical" href={PAGE_URL} />
        <meta property="og:type" content="book" />
        <meta property="og:title" content={`Le Fond de Tout — Livre I | ${SITE_NAME}`} />
        <meta property="og:description" content="Livre I de la Prorascience : ontologie, Potentia Prima, champ de permission et les 10 équations fondamentales." />
        <meta property="og:url" content={PAGE_URL} />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`Le Fond de Tout — Livre I | ${SITE_NAME}`} />
        <meta name="twitter:description" content="Ontologie, Potentia Prima, champ de permission et les 10 équations fondamentales." />
        <meta name="keywords" content="Prorascience, Le Fond de Tout, Potentia Prima, ontologie, champ de permission, Manikongo, Vibratinium, qualia, axiomes, équations fondamentales" />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org', '@type': 'Book', name: 'Le Fond de Tout — Livre I',
          author: { '@type': 'Person', name: '5ᵉ Manikongo', alternateName: 'Ngowazulu' },
          publisher: { '@type': 'Organization', name: SITE_NAME },
          inLanguage: 'fr', url: PAGE_URL,
          description: 'Ontologie fondamentale, Potentia Prima, champ de permission et les 10 équations fondamentales.'
        })}</script>
      </Helmet>

      {/* HERO */}
      <section className="relative py-28 md:py-40 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#262624] via-[#2a2724]/60 to-[#262624]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] rounded-full blur-[300px]" />
        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[var(--school-accent)] text-xs font-bold uppercase tracking-widest border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]">
            <BookOpen className="w-4 h-4" /> Prorascience · Livre I
          </span>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-white leading-tight">
            Le Fond de<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--school-accent)] via-yellow-400 to-[var(--school-accent)]">Tout</span>
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto">Par le <span className="text-[var(--school-accent)] font-semibold">5ᵉ Manikongo</span> — Fondateur du Système Prorascience</p>
          <div className="bg-[#2a2724]/80 border border-white/5 rounded-xl p-5 max-w-lg mx-auto">
            <p className="text-lg font-serif italic text-gray-300">« Rien ne peut partir de rien, car le rien n'est pas un état. »</p>
          </div>
          <p className="text-xs text-gray-600 uppercase tracking-widest">© PRORASCIENCE — NGOWAZULU · ISNA — Première édition</p>
          <ChevronDown className="w-6 h-6 text-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] mx-auto animate-bounce" />
        </div>
      </section>

      {/* NAV — RAIL LATÉRAL vertical à DROITE (desktop) + barre horizontale (mobile).
          Déplacé du haut (barre horizontale) vers un rail sur le côté droit (demande fondateur). */}
      <nav aria-label="Chapitres" className="fixed right-3 top-1/2 z-40 hidden max-h-[82vh] w-[104px] -translate-y-1/2 flex-col gap-1.5 overflow-y-auto rounded-2xl border border-white/10 bg-[#2a2724]/95 p-2 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.65)] backdrop-blur-xl lg:flex">
        <span className="px-2 pb-1 pt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-white/35">Chapitres</span>
        {navItems.map(n => (
          <button key={n.id} onClick={() => go(n.id)} className={`shrink-0 rounded-lg px-3 py-2 text-left text-xs font-bold transition-all ${ac === n.id ? 'border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_22%,transparent)] text-[var(--school-accent)]' : 'border border-transparent text-gray-400 hover:bg-white/5 hover:text-white'}`}>{n.s}</button>
        ))}
      </nav>
      <div className="sticky top-20 z-30 mb-8 border-b border-white/5 bg-[#262624]/95 py-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-4xl gap-2 overflow-x-auto px-4">
          {navItems.map(n => (
            <button key={n.id} onClick={() => go(n.id)} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${ac === n.id ? 'border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)]' : 'border border-white/5 bg-white/5 text-gray-400 hover:text-white'}`}>{n.s}</button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-6 pb-20 space-y-16">

        {/* PROLOGUE */}
        <section id="prologue" className="space-y-5 scroll-mt-28">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] flex items-center justify-center"><Quote className="w-5 h-5 text-[var(--school-accent)]" /></div>
            <div><span className="text-xs text-[var(--school-accent)] font-bold uppercase tracking-wider">Prologue</span><h2 className="text-2xl md:text-3xl font-serif font-bold text-white">La question que personne ne pose correctement</h2></div>
          </div>
          <p className="text-gray-300 leading-relaxed">Tout le monde a posé cette question au moins une fois. Pas à voix haute. Dans ce moment silencieux, la nuit, quand le mental s'arrête une seconde :</p>
          <BQ>Pourquoi est-ce qu'il y a quelque chose plutôt que rien ?</BQ>
          <p className="text-gray-300 leading-relaxed">Les scientifiques disent : <span className="text-white font-semibold">le Big Bang</span>. Mais un enfant de huit ans peut répondre : et avant le Big Bang ? Les religieux disent : <span className="text-white font-semibold">Dieu</span>. Mais le même enfant demande : et qui a créé Dieu ? Les philosophes disent : la question est mal posée. Mais ça ne satisfait personne.</p>
          <LawBox title="Prorascience">La question est bien posée. C'est la réponse qu\'on cherchait au mauvais endroit.</LawBox>
          <BQ>À la fin, tu ne croiras pas. Tu comprendras. Ce n'est pas la même chose.</BQ>
        </section>

        {/* CH1 */}
        <section id="ch1" className="space-y-5 scroll-mt-28">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-orange-500/10 border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] flex items-center justify-center"><Layers className="w-5 h-5 text-[var(--school-accent)]" /></div>
            <div><span className="text-xs text-[var(--school-accent)] font-bold uppercase tracking-wider">Chapitre 1</span><h2 className="text-2xl md:text-3xl font-serif font-bold text-white">Le Plancher</h2></div>
          </div>
          <TE number="1" title="La Chambre qu'on ne peut pas vider">
            <p>Imagine une grande chambre remplie. Tu commences à tout enlever. La chambre est vide. Mais est-elle vraiment vide ? Non. Il reste l'air. Tu pompes l\'air — il reste la chaleur. Tu refroidis jusqu\'au zéro absolu — il reste le rayonnement.</p>
            <p>Tu blindes tout — il reste les neutrinos. Tu élimines tout ça — la physique quantique te dit : <span className="text-white font-semibold">il reste encore quelque chose</span>. Le vide quantique fluctue. Il y a une énergie de point zéro qu'on ne peut pas enlever.</p>
            <p className="text-amber-300 font-semibold">Tu ne peux pas vider la chambre complètement. Il y a un plancher.</p>
          </TE>
          <LawBox title="Potentia Prima">Le Potentia Prima est ce plancher ontologique irréductible. Il est ce qu'on obtient quand on réduit tout jusqu\'à ce qu\'on ne puisse plus rien enlever sans tout perdre.</LawBox>
          <TE number="2" title="La Bibliothèque Irréductible">
            <p>Imagine une bibliothèque immense. Tu réduis tout. À un moment tu arrives à quelque chose que tu ne peux plus enlever : <span className="text-white font-semibold">l'alphabet</span>.</p>
            <p>Si tu enlèves l'alphabet — tous les livres disparaissent. Passés, présents et futurs. L\'alphabet n\'est pas un livre. Il ne raconte rien. Mais sans lui aucune histoire n\'est possible.</p>
          </TE>
          <BQ>Le Potentia Prima est l'alphabet de la réalité. Il ne contient aucune forme — mais sans lui aucune forme n\'est possible.</BQ>
          <h3 className="text-xl font-serif font-bold text-white mt-6">La démonstration par réduction</h3>
          <p className="text-gray-300 leading-relaxed">Trois éléments : 1, 2, 3.</p>
          <DT headers={["Type", "Combinaisons", "Nombre"]} rows={[["Ordre 2", "12, 13, 21, 23, 31, 32", "6 qualia"], ["Ordre 3", "123, 132, 213, 231, 312, 321", "6 qualia"], ["TOTAL", "Portée ontologique", "12 qualia"]]} />
          <p className="text-gray-300 leading-relaxed">Peut-on enlever 1 ? <span className="text-white font-semibold">Non</span>. Si on enlève 1, 2 et 3 — même la possibilité de former quoi que ce soit disparaît. <span className="text-[var(--school-accent)] font-semibold">1, 2, 3 sont le plancher. Le mur ontologique.</span></p>
          <h3 className="text-xl font-serif font-bold text-white mt-6">Ce que le Potentia Prima n'est pas</h3>
          <DT headers={["Ce qu'on croit", "Ce que c'est vraiment"]} rows={[["Un endroit", "Pas spatial — antérieur à l'espace"], ["Un moment", "Pas temporel — antérieur au temps"], ["Une énergie", "Antérieur à l'énergie — il la permet"], ["Un dieu", "Pas d'intention, pas de volonté, pas de plan"], ["Le néant", "Le néant ne permet rien. Le PP permet tout."], ["Une substance", "Une structure de permission"]]} />
        </section>

        {/* CH2 */}
        <section id="ch2" className="space-y-5 scroll-mt-28">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] flex items-center justify-center"><Eye className="w-5 h-5 text-[var(--school-accent)]" /></div>
            <div><span className="text-xs text-[var(--school-accent)] font-bold uppercase tracking-wider">Chapitre 2</span><h2 className="text-2xl md:text-3xl font-serif font-bold text-white">L'État Primordial</h2></div>
          </div>
          <TE number="3" title="Le Miroir sans Visage">
            <p>Imagine un miroir ontologique parfait. Il n'a pas de visage propre. Présente-lui une pomme — il montre une pomme. Présente-lui le chiffre 4 dans un système {'{1,2,3}'} — il oscille entre 1, 2, 3 sans pouvoir se fixer.</p>
            <p>Et si tu regardes le miroir sans rien présenter ? Tu vois toi-même. Car tu es une géométrie permise dans ce système.</p>
          </TE>
          <LawBox title="Effet Vibratinium">Le fond ontologique reconnaît ce qui lui appartient, oscille sur ce qui lui est étranger, et reflète celui qui le regarde — car tout observateur est lui-même une forme permise.</LawBox>
          <TE number="4" title="La Superposition des Visages">
            <p>L'Apocalypse décrit une créature avec quatre visages simultanés : lion, homme, aigle, taureau. Pas l\'un après l\'autre — <span className="text-white font-semibold">simultanément</span>.</p>
            <p>Dans {'{1,2,3}'} : tu regardes → 1. Tu insistes → non, 2. Non, 3. Tu t'arrêtes → ce n\'est ni 1, ni 2, ni 3. Mais ce n\'est pas non plus sans 1, sans 2, sans 3.</p>
          </TE>
          <BQ>Ni 1, ni 2, ni 3. Et pourtant : pas sans 1, pas sans 2, pas sans 3. C'est l\'état de superposition ontologique — le paradoxe irréductible du fond de la réalité.</BQ>
        </section>

        {/* CH3 */}
        <section id="ch3" className="space-y-5 scroll-mt-28">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center"><Compass className="w-5 h-5 text-emerald-400" /></div>
            <div><span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Chapitre 3</span><h2 className="text-2xl md:text-3xl font-serif font-bold text-white">Le Champ de Permission</h2></div>
          </div>
          <DT headers={["Pensée ordinaire", "Prorascience"]} rows={[["La réalité existe d'abord", "Les lois existent d'abord"], ["On observe → on déduit les lois", "Les lois autorisent → la réalité se manifeste"], ["Les lois sont des descriptions", "Les lois sont des architectures"], ["La réalité est la source", "La réalité est la trace"]]} />
          <TE number="5" title="L'Architecte et le Bâtiment">
            <p>Les plans ne sont pas le bâtiment. Mais le bâtiment est impossible sans les plans. L'architecte n\'est pas une personne. Les plans émergent des propriétés des matériaux et des lois de la gravité.</p>
            <p className="text-emerald-300 font-semibold">La géométrie s'impose. Personne ne la choisit.</p>
          </TE>
          <LawBox title="Antériorité de la Loi">Une loi est une architecture relationnelle qui s'impose par nécessité. Elle n\'est pas choisie — elle est inévitable. La réalité n\'est pas la source de la loi — elle en est la trace.</LawBox>
          <TE number="6" title="La Grammaire avant les Phrases">
            <p>La grammaire existe avant les phrases qu'elle autorise. Elle autorise certaines combinaisons et en interdit d\'autres. Personne ne l\'a inventée. Elle s\'est imposée.</p>
            <p className="text-emerald-300 font-semibold">Le champ de permission Φ est la grammaire de la réalité.</p>
          </TE>
          <DT headers={["Constante", "Ce qu'elle est vraiment"]} rows={[["Vitesse de la lumière c", "Limite de la portée relationnelle de l'espace-temps"], ["Constante de Planck ℏ", "Le qualia minimal d'énergie"], ["Constante G", "La géométrie de la relation masse-espace"]]} />
          <BQ>Les constantes physiques sont les murs ontologiques de notre système cosmologique.</BQ>
        </section>

        {/* CH4 */}
        <section id="ch4" className="space-y-5 scroll-mt-28">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center"><Cloud className="w-5 h-5 text-[var(--school-accent)]" /></div>
            <div><span className="text-xs text-[var(--school-accent)] font-bold uppercase tracking-wider">Chapitre 4</span><h2 className="text-2xl md:text-3xl font-serif font-bold text-white">Le Nuage</h2></div>
          </div>
          <TE number="7" title="La Météo Ontologique">
            <p>Les nuages sont chargés. L'eau est réelle mais pas encore tombée. Toutes les pluies possibles coexistent en suspension. La topographie détermine déjà où l\'eau ira.</p>
            <p className="text-amber-300 font-semibold">Le nuage, c'est ψ — l\'onde ontologique. La pluie, c\'est l\'effondrement. La topographie, c\'est le champ de permission Φ.</p>
          </TE>
          <TE number="8" title="L'Orchestre Silencieux">
            <p>Un orchestre est prêt, baguette en l'air. La musique n\'a pas encore commencé. Mais dans cette seconde de silence — <span className="text-white font-semibold">toute la musique est déjà là</span>.</p>
            <p>Le premier coup de baguette — c'est ε, le seuil. Le temps τ naît avec la première note, pas avant.</p>
          </TE>
          <BQ>Avant le premier coup de baguette, le temps n'existe pas encore pour cette musique.</BQ>
          <div className="bg-[#2a2724] border border-white/10 rounded-xl p-5 text-center my-4">
            <p className="text-xl font-mono text-[var(--school-accent)] font-bold">Ω(α) = Σ α! / (α - n)!</p>
          </div>
          <DT headers={["Entropie α", "Portée Ω", "Signification"]} rows={[["3", "12 qualia", "Simple"], ["4", "60 qualia", "Modéré"], ["10", "9 864 100", "Élevé"], ["Notre cosmos", "Ω immense", "Quasi-infini"]]} />
          <LawBox title="Règle d'Or — Non-Répétition">Toute combinaison valide doit contenir une différenciation minimum entre ses composants. En physique : principe d'exclusion de Pauli. En Prorascience : loi ontologique universelle.</LawBox>
        </section>

        {/* CH5 */}
        <section id="ch5" className="space-y-5 scroll-mt-28">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center"><Droplets className="w-5 h-5 text-orange-400" /></div>
            <div><span className="text-xs text-orange-400 font-bold uppercase tracking-wider">Chapitre 5</span><h2 className="text-2xl md:text-3xl font-serif font-bold text-white">La Première Pluie</h2></div>
          </div>
          <TE number="9" title="La Goutte qui fait Déborder">
            <p>Un verre rempli à ras bord. Une goutte de plus. Le dôme cède. Cette dernière goutte n'a pas créé le débordement. Elle a simplement <span className="text-white font-semibold">atteint le seuil</span>.</p>
          </TE>
          <LawBox title="Loi de l'Effondrement">L'effondrement n\'est pas causé par un événement extérieur. Il est la conséquence inévitable de la tension interne de l\'onde ontologique.</LawBox>
          <DT headers={["Ce qui naît", "Description"]} rows={[["Le qualia effectif", "Une réalité distincte, irréductible, manifestée"], ["Le temps τ₀", "L'irréversibilité — un avant et un après"], ["La trace", "Le Vibratinium enregistre — l'empreinte ne disparaît pas"]]} />
          <h3 className="text-xl font-serif font-bold text-white mt-6">Naissance de l'espace-temps</h3>
          <p className="text-gray-300 leading-relaxed">L'effondrement primordial produit le qualia fondamental : <span className="text-[var(--school-accent)] font-bold">{'{C, D}'} — contraction et dilatation</span>.</p>
          <DT headers={["Tendance", "Ce qu'elle génère"]} rows={[["C — Contraction", "L'espace"], ["D — Dilatation", "Le temps τ₂"], ["Δ = |C - D|", "L'énergie"]]} />
          <TE number="10" title="L'Arc et la Flèche">
            <p>L'énergie d\'un arc est la tension entre la rigidité du bois et l\'étirement de la corde. L\'énergie cosmologique est la mesure de la tension entre deux tendances opposées.</p>
          </TE>
        </section>

        {/* CH6 */}
        <section id="ch6" className="space-y-5 scroll-mt-28">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center"><Database className="w-5 h-5 text-rose-400" /></div>
            <div><span className="text-xs text-rose-400 font-bold uppercase tracking-wider">Chapitre 6</span><h2 className="text-2xl md:text-3xl font-serif font-bold text-white">La Mémoire du Fond</h2></div>
          </div>
          <TE number="11" title="L'Empreinte dans l'Argile">
            <p>Tu poses ta main dans l'argile. Tu la retires. L\'empreinte reste. Tu détruis l\'argile en poudre. La main n\'est plus là. Mais <span className="text-white font-semibold">la preuve que cette main a existé</span> reste. L\'information ne disparaît pas — elle se disperse.</p>
          </TE>
          <AxiomBox id="S8" title="Non-Néantisation">Ce qui a existé ne retourne pas au néant. L'existence laisse une irréversibilité informationnelle que rien ne peut effacer — seulement disperser.</AxiomBox>
          <h3 className="text-xl font-serif font-bold text-white mt-6">La preuve rétroactive — « Je fus »</h3>
          <p className="text-gray-300 leading-relaxed">Tu existes. Ta géométrie pouvait-elle ne pas être permise ? Non. Si elle n'avait pas été permise dans Φ, tu ne serais pas là pour poser la question.</p>
          <LawBox title="Loi de Permission Rétroactive">Toute existence prouve sa propre permission. « Si j'existe, donc je fus » — mon existence prouve qu\'il existait avant moi un potentiel de moi, latent dans le fond.</LawBox>
        </section>

        {/* CH7 */}
        <section id="ch7" className="space-y-5 scroll-mt-28">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] flex items-center justify-center"><Map className="w-5 h-5 text-[var(--school-accent)]" /></div>
            <div><span className="text-xs text-[var(--school-accent)] font-bold uppercase tracking-wider">Chapitre 7</span><h2 className="text-2xl md:text-3xl font-serif font-bold text-white">La Carte Complète</h2></div>
          </div>
          <h3 className="text-xl font-serif font-bold text-white">Les 10 Équations Fondamentales</h3>
          <div className="space-y-3">
            {[
              { id:"E1", n:"Portée ontologique", eq:"Ω(α) = Σ α!/(α-n)!", d:"Combien de réalités possibles depuis un PP d'entropie α" },
              { id:"E2", n:"Non-Zéro", eq:"I(P) ≥ I_min > 0", d:"Tout réel possède une information minimale non nulle" },
              { id:"E3", n:"Permission", eq:"∃x : x ∈ Φ(P)", d:"Exister prouve qu'on était permis dans le champ" },
              { id:"E4", n:"Effondrement", eq:"ψ →[ε] Q(n)_effectif", d:"L'onde s'effondre au seuil vers un qualia réel" },
              { id:"E5", n:"Énergie", eq:"Δ = |C - D|", d:"Tension entre contraction et dilatation" },
              { id:"E6", n:"Irréversibilité", eq:"τ > 0 ⟹ I_trace > 0", d:"Tout effondrement laisse une trace non nulle" },
              { id:"E7", n:"Encapsulation", eq:"C ↔ E ⟹ ∃P ⊃ {C,E}", d:"Tout couple causal circulaire implique un Potentiel" },
              { id:"E8", n:"Temps ontologique", eq:"ψ →[ε] Q(n) ⟹ τ₀ > 0", d:"L'irréversibilité naît de tout effondrement" },
              { id:"E9", n:"Temps physique", eq:"Q(2)_{C,D} ⟹ τ₂ = f(D)", d:"Le temps mesurable est porté par la tendance D" },
              { id:"E10", n:"Relation des temps", eq:"τ₂ ⊂ τ₀ ⊄ τ₂", d:"τ₂ instance de τ₀, mais τ₀ plus universel" },
            ].map(e => (
              <div key={e.id} className="bg-[#2a2724] border border-white/5 rounded-xl p-5 hover:border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] transition-all group">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] flex items-center justify-center shrink-0"><span className="text-xs font-bold text-[var(--school-accent)]">{e.id}</span></div>
                  <div><h4 className="text-base font-bold text-white">{e.n}</h4><p className="font-mono text-sm text-[var(--school-accent)]">{e.eq}</p><p className="text-sm text-gray-400">{e.d}</p></div>
                </div>
              </div>
            ))}
          </div>
          <DT headers={["Physique", "Statut", "Prorascience"]} rows={[["Big Bang", "Confirmé+", "Seuil ε"], ["Vide quantique", "Confirme NZ", "Instance de ψ"], ["Exclusion Pauli", "Étendu", "Règle d'Or"], ["Énergie sombre", "Réinterprétée", "Qualia non effondrés"], ["Multivers", "Compatible", "Autres effondrements"]]} />
          <DT headers={["Dieu (théiste)", "Potentia Prima"]} rows={[["A une intention", "Aucune intention — structure"], ["Posé comme axiome de foi", "Déduit par nécessité logique"], ["Non falsifiable", "Équations testables"], ["Personne", "Condition structurelle impersonnelle"]]} />
        </section>

        {/* EPILOGUE */}
        <section id="epilogue" className="space-y-5 scroll-mt-28">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] flex items-center justify-center"><Star className="w-5 h-5 text-[var(--school-accent)]" /></div>
            <div><span className="text-xs text-[var(--school-accent)] font-bold uppercase tracking-wider">Épilogue</span><h2 className="text-2xl md:text-3xl font-serif font-bold text-white">Ce que tu es dans ce système</h2></div>
          </div>
          <p className="text-gray-300 leading-relaxed">Tu es un <span className="text-white font-semibold">qualia d'ordre très élevé</span>. Tu es une combinaison de briques fondamentales dont la géométrie était permise dans le Potentia Prima de ce cosmos. Tu t\'es manifesté après l\'effondrement. Tu portes une trace irréductible dans le Vibratinium.</p>
          <p className="text-gray-300 leading-relaxed">Et maintenant tu fais quelque chose de remarquable : <span className="text-[var(--school-accent)] font-semibold">tu lis le champ de permission qui t'a produit</span>.</p>
          <div className="bg-gradient-to-br from-[var(--school-accent)]/[0.08] to-transparent border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] rounded-2xl p-8 text-center">
            <p className="text-lg md:text-xl font-serif italic text-gray-200 leading-relaxed max-w-2xl mx-auto">
              « Le cosmos n'est pas gouverné par des lois. Il est rendu possible par la possibilité, structuré par l\'information, lisible par des lois. Et toi qui lis — <span className="text-[var(--school-accent)] font-bold">tu es la preuve que sa géométrie était suffisamment riche pour produire quelqu\'un capable de la lire</span>. »
            </p>
          </div>
        </section>

        {/* ANNEXES */}
        <section id="annexes" className="space-y-6 scroll-mt-28">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gray-500/10 border border-gray-500/30 flex items-center justify-center"><FileText className="w-5 h-5 text-gray-400" /></div>
            <div><span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Annexes</span><h2 className="text-2xl md:text-3xl font-serif font-bold text-white">Lois · Axiomes · Grandeurs</h2></div>
          </div>

          <h3 className="text-xl font-serif font-bold text-white">I — Les Lois par Niveau</h3>
          <h4 className="text-sm text-[var(--school-accent)] uppercase tracking-wider font-bold">Niveau 0 — Potentia Prima</h4>
          <LawBox title="NZ">Tout réel possède une information minimale non nulle.</LawBox>
          <LawBox title="Du Mur">Le Potentia Prima est ce qu'on ne peut pas supprimer sans détruire toute permission.</LawBox>
          <h4 className="text-sm text-emerald-400 uppercase tracking-wider font-bold mt-4">Niveau 1 — Champ de Permission</h4>
          <LawBox title="Permission">Rien n'existe hors de sa permission ontologique.</LawBox>
          <LawBox title="Antériorité">La loi précède la réalité — elle est la géométrie dont la réalité est la trace.</LawBox>
          <LawBox title="Règle d'Or">Toute combinaison valide exige une différenciation minimum.</LawBox>
          <h4 className="text-sm text-[var(--school-accent)] uppercase tracking-wider font-bold mt-4">Niveau 2 — Onde Ontologique</h4>
          <LawBox title="Encapsulation">Tout couple causal circulaire implique un Potentiel P qui les contient.</LawBox>
          <LawBox title="Portée">La portée ontologique est bornée par l'entropie de base α.</LawBox>
          <h4 className="text-sm text-orange-400 uppercase tracking-wider font-bold mt-4">Niveau 3 — Effondrement</h4>
          <LawBox title="Irréversibilité">Tout effondrement génère le temps τ₀ et une trace non nulle.</LawBox>
          <LawBox title="Rétroactive">Toute existence prouve sa propre permission.</LawBox>
          <h4 className="text-sm text-rose-400 uppercase tracking-wider font-bold mt-4">Niveau 4 — Manifeste</h4>
          <LawBox title="Énergie">Δ = |C - D| — la tension dans un système contraint.</LawBox>
          <LawBox title="Non-Néantisation">Ce qui a existé ne retourne pas au néant.</LawBox>

          <h3 className="text-xl font-serif font-bold text-white mt-8">II — Axiomes de la Singularité</h3>
          <AxiomBox id="S1" title="Possibilité">La possibilité est ontologiquement première sur toute forme, toute loi et toute information.</AxiomBox>
          <AxiomBox id="S2" title="Non-Antériorité du Temps">Le temps ne peut précéder ce qui le rend possible.</AxiomBox>
          <AxiomBox id="S3" title="Éternité">L'éternité n\'est pas un temps infini mais l\'absence de temps.</AxiomBox>
          <AxiomBox id="S4" title="Localisation du Temps">Le temps apparaît lorsque l'éternité est localisée par l\'espace.</AxiomBox>
          <AxiomBox id="S5" title="Singularité">La singularité est la limite où les distinctions espace–temps–énergie cessent d'être définissables.</AxiomBox>
          <AxiomBox id="S6" title="Potentia Prima">Le PP est l'état de virtualité ontologique absolue qui autorise toute distinction sans en contenir aucune.</AxiomBox>
          <AxiomBox id="S7" title="La Fin">La fin d'un univers est la dissolution de ses différenciations, non leur annihilation.</AxiomBox>
          <AxiomBox id="S8" title="Non-Néantisation">Ce qui a existé ne peut retourner au néant, car l'existence implique une irréversibilité ontologique.</AxiomBox>
          <AxiomBox id="S9" title="Antériorité de la Loi">La loi est une architecture relationnelle stabilisée dans le champ de permission avant tout effondrement.</AxiomBox>

          <h3 className="text-xl font-serif font-bold text-white mt-8">III — Grandeurs Fondamentales</h3>
          <DT headers={["Symbole", "Nom", "Définition"]} rows={[
            ["P", "Potentiel d'être", "Virtualité ontologique — fond irréductible"],
            ["α", "Entropie de base", "Nombre d'éléments dans le Potentia Prima"],
            ["Q(n)", "Qualia d'ordre n", "Combinaison permise de n éléments distincts"],
            ["Ω", "Portée ontologique", "Nombre total de qualia permis dans le système"],
            ["Φ", "Champ de permission", "Espace de tous les qualia et lois permis"],
            ["ψ", "Onde ontologique", "Superposition de tous les qualia en suspension"],
            ["ε", "Seuil d'effondrement", "Information minimale nécessaire à la manifestation"],
            ["τ₀", "Temps ontologique", "Irréversibilité universelle née de tout effondrement"],
            ["τ₂", "Temps physique", "Séquence mesurable portée par la tendance D"],
            ["C", "Contraction", "Tendance génératrice de l'espace"],
            ["D", "Dilatation", "Tendance génératrice du temps physique"],
            ["Δ", "Différentiel C/D", "Mesure de la tension = énergie"],
            ["V", "Vibratinium", "Support de mémoire des géométries permises"],
          ]} />
        </section>

        {/* CTA */}
        <section className="text-center space-y-6">
          <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-[var(--school-accent)] to-transparent mx-auto" />
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/formations/catalogue"><Button className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 gap-2 h-12 px-8 text-base font-bold"><GraduationCap className="w-5 h-5" /> Voir les formations</Button></Link>
            <Link to="/ecoles"><Button variant="outline" className="border-white/20 hover:bg-white/5 text-white h-12 px-8 text-base"><BookOpen className="w-5 h-5 mr-2" /> Les 21 Sciences</Button></Link>
          </div>
        </section>

        <div className="text-center py-4 border-t border-white/5">
          <p className="text-sm text-gray-600">© PRORASCIENCE — NGOWAZULU · ISNA — Manikongo MK5 — Première édition</p>
        </div>
      </div>
    </div>
  );
};

export default FondDeToutPage;
