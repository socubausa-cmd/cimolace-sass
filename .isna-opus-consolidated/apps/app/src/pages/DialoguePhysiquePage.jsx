import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  BookOpen, ChevronDown, Atom, Zap, Sparkles, Shield,
  Scale, Quote, FileText, GraduationCap, Eye, Globe,
  Flame, Cloud, Star, Brain, Lock, ArrowRight,
  CheckCircle2, ArrowUpRight, AlertTriangle, Lightbulb,
  MessageCircle, Clock, Beaker
} from 'lucide-react';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const PUBLIC = isnaTenantConfig.branding.publicSiteOrigin;
const PAGE_URL = `${PUBLIC}/dialogue-physique`;
const SITE_NAME = `${isnaTenantConfig.branding.name} · LIRI`;

/* ─── Shared UI blocks ─── */
const LawBox = ({ title, children }) => (
  <div className="bg-[#D4AF37]/[0.08] border border-[#D4AF37]/20 rounded-xl p-5 my-4">
    <div className="flex items-center gap-2 mb-2">
      <Scale className="w-4 h-4 text-[#D4AF37]" />
      <span className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider">{title}</span>
    </div>
    <p className="text-gray-200 leading-relaxed font-medium">{children}</p>
  </div>
);

const BQ = ({ children }) => (
  <div className="border-l-4 border-[#D4AF37] pl-5 py-3 my-5">
    <p className="text-lg font-serif italic text-[#D4AF37]/90 leading-relaxed">{children}</p>
  </div>
);

const VoixAvant = ({ children }) => (
  <div className="bg-violet-500/[0.06] border-l-4 border-violet-500/40 rounded-r-xl px-5 py-4 my-4">
    <p className="text-violet-300 italic leading-relaxed">{children}</p>
  </div>
);

const VoixPhysicien = ({ children }) => (
  <div className="bg-blue-500/[0.06] border-l-4 border-blue-500/40 rounded-r-xl px-5 py-4 my-4">
    <p className="text-blue-300 italic leading-relaxed">{children}</p>
  </div>
);

const Accord = ({ children }) => (
  <div className="bg-emerald-500/[0.06] border border-emerald-500/20 rounded-xl p-4 my-3 flex items-start gap-3">
    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
    <p className="text-emerald-300 text-sm leading-relaxed"><span className="font-bold">ACCORD</span> — {children}</p>
  </div>
);

const Extension = ({ children }) => (
  <div className="bg-blue-500/[0.06] border border-blue-500/20 rounded-xl p-4 my-3 flex items-start gap-3">
    <ArrowUpRight className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
    <p className="text-blue-300 text-sm leading-relaxed"><span className="font-bold">EXTENSION</span> — {children}</p>
  </div>
);

const Prediction = ({ id, children }) => (
  <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-5 my-4">
    <div className="flex items-center gap-2 mb-2">
      <Lightbulb className="w-4 h-4 text-emerald-400" />
      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Prédiction {id}</span>
    </div>
    <p className="text-gray-200 leading-relaxed">{children}</p>
  </div>
);

const Narrator = ({ children }) => (
  <p className="text-gray-300 leading-relaxed">{children}</p>
);

const navItems = [
  { id: 'prologue', s: 'Prologue' }, { id: 'ch1', s: 'Ch.1' }, { id: 'ch2', s: 'Ch.2' },
  { id: 'ch3', s: 'Ch.3' }, { id: 'ch4', s: 'Ch.4' }, { id: 'ch5', s: 'Ch.5' },
  { id: 'ch6', s: 'Ch.6' }, { id: 'ch7', s: 'Ch.7' }, { id: 'ch8', s: 'Ch.8' },
  { id: 'ch9', s: 'Ch.9' }, { id: 'epilogue', s: 'Épilogue' },
];

const ChHead = ({ id, color, icon: Icon, number, title }) => (
  <div className="flex items-center gap-3" id={id}>
    <div className={`w-11 h-11 rounded-xl bg-${color}-500/10 border border-${color}-500/30 flex items-center justify-center`}>
      <Icon className={`w-5 h-5 text-${color}-400`} />
    </div>
    <div>
      <span className={`text-xs text-${color}-400 font-bold uppercase tracking-wider`}>Chapitre {number}</span>
      <h2 className="text-2xl md:text-3xl font-serif font-bold text-white">{title}</h2>
    </div>
  </div>
);

const DialoguePhysiquePage = () => {
  const [ac, setAc] = useState('prologue');
  const go = (id) => { setAc(id); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return (
    <div className="min-h-screen bg-[#0F1419] text-white">
      <Helmet>
        <title>{`Le Dialogue avec la Physique — Livre II | ${SITE_NAME}`}</title>
        <meta name="description" content="Livre II de la Prorascience — Le Dialogue avec la Physique. Big Bang, vide quantique, énergie sombre, conscience, principe de Pauli et les 5 prédictions testables par le 5ᵉ Manikongo." />
        <link rel="canonical" href={PAGE_URL} />
        <meta property="og:type" content="book" />
        <meta property="og:title" content={`Le Dialogue avec la Physique — Livre II | ${SITE_NAME}`} />
        <meta property="og:description" content="Big Bang, vide quantique, énergie sombre, conscience et les 5 prédictions testables de la Prorascience." />
        <meta property="og:url" content={PAGE_URL} />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Le Dialogue avec la Physique — Livre II" />
        <meta name="twitter:description" content="Big Bang, vide quantique, énergie sombre, conscience et les 5 prédictions testables." />
        <meta name="keywords" content="Prorascience, physique, Big Bang, vide quantique, énergie sombre, Pauli, conscience, Manikongo, ontologie, prédictions testables" />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org', '@type': 'Book', name: 'Le Dialogue avec la Physique — Livre II',
          author: { '@type': 'Person', name: '5ᵉ Manikongo', alternateName: 'Ngowazulu' },
          publisher: { '@type': 'Organization', name: SITE_NAME },
          inLanguage: 'fr', url: PAGE_URL,
          description: 'Dialogue entre Prorascience et la physique standard : Big Bang, vide quantique, énergie sombre et 5 prédictions testables.'
        })}</script>
      </Helmet>

      {/* HERO */}
      <section className="relative py-28 md:py-40 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F1419] via-[#192734]/60 to-[#0F1419]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-[300px]" />
        <div className="absolute top-10 right-10 w-[400px] h-[400px] bg-[#D4AF37]/5 rounded-full blur-[200px]" />
        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-widest border border-blue-500/20">
            <BookOpen className="w-4 h-4" /> Prorascience · Livre II
          </span>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-white leading-tight">
            Le Dialogue avec<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400">la Physique</span>
          </h1>
          <p className="text-gray-400 text-base">Version Dialectique — Suite du <Link to="/fond-de-tout" className="text-[#D4AF37] underline hover:text-yellow-400">Livre I</Link></p>
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto">Par le <span className="text-[#D4AF37] font-semibold">5ᵉ Manikongo</span> — Fondateur du Système Prorascience</p>
          <div className="bg-[#192734]/80 border border-white/5 rounded-xl p-5 max-w-lg mx-auto">
            <p className="text-lg font-serif italic text-gray-300">« La physique cartographie les lois. Prorascience demande pourquoi ces lois et pas d'autres. »</p>
          </div>
          <p className="text-xs text-gray-600 uppercase tracking-widest">© PRORASCIENCE — NGOWAZULU · ISNA — Première édition</p>
          <ChevronDown className="w-6 h-6 text-blue-400/50 mx-auto animate-bounce" />
        </div>
      </section>

      {/* NOTE AU LECTEUR */}
      <div className="max-w-3xl mx-auto px-4 md:px-6 mb-8">
        <div className="bg-[#192734] border border-white/10 rounded-2xl p-6 space-y-3">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Note au lecteur</h3>
          <p className="text-gray-300 text-sm leading-relaxed">Ce second livre introduit une <span className="text-white font-semibold">troisième voix</span>.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-violet-500/[0.06] border border-violet-500/20 rounded-lg p-3">
              <p className="text-violet-300 text-xs font-bold mb-1">La voix d'avant (violet)</p>
              <p className="text-gray-400 text-xs">Résiste encore, armée d'objections physiques précises.</p>
            </div>
            <div className="bg-blue-500/[0.06] border border-blue-500/20 rounded-lg p-3">
              <p className="text-blue-300 text-xs font-bold mb-1">Le physicien (bleu)</p>
              <p className="text-gray-400 text-xs">Interlocuteur rigoureux qui force la précision.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Vert = accords</span>
            <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Bleu = extensions</span>
            <span className="px-2 py-1 rounded bg-emerald-900/30 text-emerald-300 border border-emerald-500/20">Vert foncé = prédictions testables</span>
          </div>
        </div>
      </div>

      {/* NAV */}
      <div className="sticky top-20 z-30 bg-[#0F1419]/95 backdrop-blur-xl border-b border-white/5 py-3 mb-8">
        <div className="max-w-4xl mx-auto px-4 flex gap-2 overflow-x-auto">
          {navItems.map(n => (
            <button key={n.id} onClick={() => go(n.id)} className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${ac === n.id ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-gray-400 border border-white/5 hover:text-white'}`}>{n.s}</button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-6 pb-20 space-y-16">

        {/* ═══ PROLOGUE ═══ */}
        <section id="prologue" className="space-y-4 scroll-mt-28">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center"><Quote className="w-5 h-5 text-violet-400" /></div>
            <div><span className="text-xs text-violet-400 font-bold uppercase tracking-wider">Prologue</span><h2 className="text-2xl md:text-3xl font-serif font-bold text-white">Deux langues pour une seule réalité</h2></div>
          </div>
          <Narrator>Quand ma voix d'avant a dit "d'accord" à la fin du Livre I, j'ai cru que le travail était terminé. C'était une erreur.</Narrator>
          <VoixAvant>Tu as construit un système cohérent. Mais la cohérence interne ne suffit pas. Il faut maintenant affronter la physique réelle. Les équations. Les mesures. Les modèles qui fonctionnent depuis des siècles.</VoixAvant>
          <Narrator>C'est exactement ce que j'allais faire.</Narrator>
          <VoixAvant>Et si la physique te contredit ?</VoixAvant>
          <Narrator>Elle ne me contredira pas. Pas parce que je suis certain d'avoir raison. Parce que Prorascience et la physique standard ne jouent pas sur le même terrain. L'une décrit <span className="text-white font-semibold">comment</span> les choses fonctionnent. L'autre demande <span className="text-white font-semibold">pourquoi</span> elles peuvent fonctionner de cette façon et pas d'une autre.</Narrator>
          <Narrator>Un physicien et un Prorascientifique regardent une pomme tomber. Le physicien voit <span className="font-mono text-blue-300">F = mg</span>. Il mesure l'accélération. Il prédit la trajectoire. Il a raison. Le Prorascientifique pose une autre question : <span className="text-white font-semibold">pourquoi existe-t-il une contrainte ontologique liant masse, espace et mouvement de cette façon précise et pas d'une autre ?</span></Narrator>
          <BQ>Ce livre ne cherche pas à remplacer la physique. Il cherche à montrer ce qu'elle ne peut pas encore voir.</BQ>
        </section>

        {/* ═══ CHAPITRE 1 ═══ */}
        <section id="ch1" className="space-y-4 scroll-mt-28">
          <ChHead id="ch1-head" color="blue" icon={Atom} number="1" title="La Contrainte Ontologique et les Lois Physiques" />
          <Narrator>La question m'a traversé pendant un trajet en voiture, un soir ordinaire.</Narrator>
          <VoixAvant>Dans la loi : si A et B sont réunis, alors C est observé. Où était C avant que A et B se rencontrent ?</VoixAvant>
          <Narrator>C n'existait pas.</Narrator>
          <VoixAvant>Alors il est sorti du néant quand A et B se sont réunis.</VoixAvant>
          <Narrator>Non.</Narrator>
          <VoixAvant>C'est l'un ou l'autre. Soit C existait avant, soit il est apparu de rien.</VoixAvant>
          <Narrator>J'ai freiné sans raison. Il y avait un troisième terme : <span className="text-white font-semibold">C n'existait pas. Mais la nécessité de C — elle — existait.</span> Encodée dans la relation entre A et B.</Narrator>
          <VoixAvant>La nécessité de C existait sans C. C'est quoi exactement ?</VoixAvant>
          <Narrator>C'est la <span className="text-[#D4AF37] font-semibold">contrainte ontologique</span>. L'architecture relationnelle qui lie A, B et C dans le champ de permission. Avant que A et B se rencontrent — la loi de leur relation existait déjà.</Narrator>

          <h3 className="text-xl font-serif font-bold text-white mt-6">La recette avant le feu</h3>
          <Narrator>Considère la combustion. Pour que le feu existe, il faut un combustible, de l'oxygène, et une température d'ignition. Quand ces trois conditions sont réunies — le feu apparaît. Sans exception.</Narrator>
          <VoixAvant>Où était le feu avant que ces conditions soient réunies ?</VoixAvant>
          <Narrator>La loi de la combustion n'est pas extraite de l'observation du feu. Elle est encodée dans les propriétés des liaisons chimiques. Ces propriétés sont encodées dans la physique quantique. La physique quantique est encodée dans les constantes fondamentales. Et ces constantes — elles sont les murs de portée du Potentia Prima de ce cosmos.</Narrator>
          <BQ>La chaîne remonte jusqu'au fond. Et à chaque niveau — la contrainte précède la manifestation.</BQ>
          <Accord>La physique confirme : les lois chimiques préexistent aux réactions.</Accord>
          <Extension>Prorascience ajoute : elles préexistent à la matière elle-même — encodées dans le champ de permission du Potentia Prima.</Extension>

          <VoixPhysicien>Objection : une loi sans matière pour la porter est un concept vide. Les lois physiques sont des relations entre des grandeurs mesurables. Sans grandeurs — pas de loi.</VoixPhysicien>
          <Narrator>C'est exact pour les lois physiques comme <span className="text-white font-semibold">descriptions</span>. Mais Prorascience parle d'<span className="text-white font-semibold">architectures relationnelles</span>. Une carte routière décrit les routes. La géologie du terrain autorise certaines routes et en rend d'autres impossibles. La physique est la carte. Le champ de permission est la géologie.</Narrator>

          <LawBox title="Loi de la Contrainte Ontologique">
            Pour toute loi 'si A et B alors C' : C n'existait pas avant A∧B. La possibilité de C existait dans Φ. La nécessité conditionnelle de C existait comme contrainte ℛ(A,B,C) dans Φ. Ce n'est pas C qui préexiste — c'est l'architecture relationnelle qui rend C inévitable dès que ses conditions sont réunies.
          </LawBox>
          <Prediction id="P1">Dans tout système physique, les lois qui gouvernent les interactions d'un niveau de complexité N sont entièrement déterminées par les propriétés des éléments du niveau N-1. Aucune loi émergente ne peut contredire les contraintes ontologiques de son niveau de base.</Prediction>
        </section>

        {/* ═══ CHAPITRE 2 ═══ */}
        <section id="ch2" className="space-y-4 scroll-mt-28">
          <ChHead id="ch2-head" color="orange" icon={Flame} number="2" title="Le Big Bang comme Effondrement" />
          <VoixPhysicien>Le Big Bang est notre modèle le mieux confirmé. 13,8 milliards d'années. Rayonnement fossile. Nucléosynthèse primordiale. Tout confirme. Qu'est-ce que Prorascience apporte de plus ?</VoixPhysicien>
          <Narrator>Rien de plus sur la description. Prorascience confirme tout ça. Ce qu'elle apporte — c'est une réponse à la question que la physique refuse de poser officiellement.</Narrator>
          <VoixPhysicien>Laquelle ?</VoixPhysicien>
          <Narrator><span className="text-white font-semibold text-lg">Qu'est-ce qu'il y avait avant ?</span></Narrator>
          <VoixPhysicien>Le temps commence avec le Big Bang. Il n'y a pas d'avant.</VoixPhysicien>
          <Narrator>Temporellement — oui. C"est l'Axiome S2. Mais <span className="text-[#D4AF37] font-semibold">ontologiquement</span> — il y a un "en dessous'. La singularité n'est pas un point zéro. C'est le seuil ε — la limite où les distinctions espace-temps-énergie cessent d'être définissables. En dessous de ce seuil : pas le néant. Le Potentia Prima.</Narrator>
          <VoixPhysicien>Et ce Potentia Prima cosmologique — quels sont ses éléments de base ?</VoixPhysicien>
          <Narrator>Deux tendances fondamentales. <span className="text-white font-semibold">Contraction et dilatation. C et D.</span> L'une génère l'espace. L'autre génère le temps physique. Leur tension génère l'énergie.</Narrator>

          <h3 className="text-xl font-serif font-bold text-white mt-6">La partition avant la première note</h3>
          <Narrator>Imagine l'instant juste avant la première note d'une symphonie. L'orchestre est en place. La partition existe. Chaque musicien sait exactement ce qu'il va jouer. Mais aucun son n'a encore été produit.</Narrator>
          <Narrator>Il n'y a pas de silence avant cette première note. Il n'y a pas de temps pour qu'il y ait un silence. Il y a la partition — et la possibilité inévitable qu'elle soit jouée.</Narrator>
          <VoixAvant>La partition — c'est le champ de permission. La première note — c'est le premier qualia effectif. Le coup de baguette — c'est le seuil ε.</VoixAvant>

          <Accord>La singularité = limite des descriptions physiques = seuil ε ontologique.</Accord>
          <Extension>Ce qu'il y a 'avant' n'est pas temporel mais ontologique : le Potentia Prima qui porte la permission de ce cosmos.</Extension>
          <Prediction id="P2">Le Big Bang n"est pas un événement dans le temps — c'est la naissance du temps. Toute théorie physique qui cherche un "avant le Big Bang' dans le temps commet une erreur de catégorie. La question correcte est : "quel est le niveau ontologique dont le Big Bang est l'effondrement ?"</Prediction>
        </section>

        {/* ═══ CHAPITRE 3 ═══ */}
        <section id="ch3" className="space-y-4 scroll-mt-28">
          <ChHead id="ch3-head" color="cyan" icon={Sparkles} number="3" title="Le Vide Quantique est l'Onde Ontologique" />
          <VoixPhysicien>Le vide quantique est l'un des résultats les mieux confirmés de la physique moderne. Énergie de point zéro, effet Casimir, fluctuations quantiques — tout est mesuré. Qu'est-ce que Prorascience dit là-dessus ?</VoixPhysicien>
          <Narrator>Elle dit : vous l'avez découvert sans savoir ce que c'était vraiment.</Narrator>
          <Narrator>C'est <span className="text-white font-semibold">l'onde ontologique ψ de notre cosmos</span>. Le nuage dont le Livre I a établi la nécessité — maintenant confirmé expérimentalement.</Narrator>
          <Narrator>Le vide quantique fluctue. Il n'est jamais à zéro. Il y a une énergie minimale irréductible. C'est la <span className="text-[#D4AF37] font-semibold">Loi NZ</span> : aucun système réel ne peut atteindre zéro information, zéro distinction, zéro énergie.</Narrator>

          <VoixPhysicien>L'énergie de point zéro pose un problème énorme — sa valeur théorique calculée en QFT est 10¹²⁰ fois plus grande que la valeur observée. C'est la plus grande divergence de l'histoire de la physique.</VoixPhysicien>
          <Narrator>La QFT calcule l'énergie de <span className="text-white font-semibold">tous les qualia possibles</span> dans l'onde ontologique — y compris ceux qui ne sont pas encore effondrés. Mais nous n'observons que les qualia effectifs. <span className="text-[#D4AF37] font-semibold">La divergence vient de cette confusion entre l'énergie du nuage total et l'énergie de la pluie effective.</span></Narrator>

          <h3 className="text-xl font-serif font-bold text-white mt-6">Les paires virtuelles sont des qualia partiels</h3>
          <Narrator>Des paires particule/antiparticule qui apparaissent et disparaissent dans le vide. Des qualia qui <span className="text-white font-semibold">frôlent le seuil ε sans le franchir</span>. Ils amorcent un effondrement mais l'information minimale n'est pas atteinte. Ils retournent dans l'onde.</Narrator>
          <VoixAvant>Comme des gouttes qui se forment sous un nuage sans jamais toucher le sol.</VoixAvant>

          <Accord>Le vide quantique confirme la Loi NZ : aucun système réel à zéro information.</Accord>
          <Accord>Les particules virtuelles = qualia sous le seuil ε — frôlant sans franchir.</Accord>
          <Extension>La divergence énergie de point zéro = confusion entre énergie du nuage et énergie de la pluie effective.</Extension>
          <Prediction id="P3">L"énergie observable du vide devrait correspondre exclusivement aux qualia ayant franchi le seuil ε. Toute tentative de mesurer l'énergie "totale' du vide capture l'énergie de l'onde ontologique entière — ce qui explique la divergence de 10¹²⁰.</Prediction>
        </section>

        {/* ═══ CHAPITRE 4 ═══ */}
        <section id="ch4" className="space-y-4 scroll-mt-28">
          <ChHead id="ch4-head" color="violet" icon={Zap} number="4" title="La Brisure de Symétrie n'est pas un Accident" />
          <VoixPhysicien>La brisure de symétrie spontanée est l'un des mécanismes centraux de la physique des particules. Le mécanisme de Higgs en est l'exemple canonique. On la décrit. On la calcule. On la mesure. Mais on ne l'explique pas vraiment.</VoixPhysicien>
          <Narrator>Prorascience montre qu'elle est <span className="text-white font-semibold">nécessaire</span>. Tout mécanisme de brisure de symétrie est une instance d'une nécessité ontologique plus profonde.</Narrator>
          <Narrator>Un crayon posé verticalement sur sa pointe. Parfaitement équilibré — en théorie. Symétrie parfaite. Toutes les directions de chute sont équivalentes.</Narrator>
          <VoixAvant>Il tombe quand même.</VoixAvant>
          <Narrator>Inévitablement. Pas parce qu'une force le pousse. Parce que <span className="text-[#D4AF37] font-semibold">l'équilibre parfait est ontologiquement instable</span>. La symétrie parfaite se détruit par sa propre logique.</Narrator>
          <Narrator>La direction est contingente. L'effondrement lui-même est <span className="text-white font-semibold">nécessaire</span>.</Narrator>
          <Narrator>Les fluctuations quantiques ne sont pas aléatoires au sens profond. Elles sont la tension interne de ψ qui cherche le seuil ε. La brisure de symétrie est rendue inévitable par la structure du Potentia Prima.</Narrator>

          <h3 className="text-xl font-serif font-bold text-white mt-6">L'asymétrie matière/antimatière</h3>
          <VoixPhysicien>Le Big Bang devrait avoir produit des quantités égales de matière et antimatière. On n'observe presque que de la matière. Pourquoi ?</VoixPhysicien>
          <Narrator>Si le premier qualia effectif {'{C, D}'} avait une légère asymétrie interne entre C et D, alors tous les qualia qui en découlent porteraient cette asymétrie. Matière et antimatière seraient deux instances de cette asymétrie initiale — pas deux productions équivalentes d'un processus symétrique.</Narrator>

          <Accord>La brisure de symétrie spontanée = nécessité ontologique, pas hasard.</Accord>
          <Extension>Le mécanisme de Higgs est l'exécution cosmologique d'une nécessité encodée dans Φ — pas sa cause.</Extension>
          <LawBox title="Principe de Différenciation Nécessaire">
            Tout état de symétrie parfaite dans un système contenant plusieurs éléments est ontologiquement instable. La brisure est nécessaire. La direction est contingente. Le mécanisme physique est l'exécution locale d'une nécessité encodée dans le champ de permission.
          </LawBox>
        </section>

        {/* ═══ CHAPITRE 5 ═══ */}
        <section id="ch5" className="space-y-4 scroll-mt-28">
          <ChHead id="ch5-head" color="emerald" icon={Shield} number="5" title="Le Principe d'Exclusion est la Règle d'Or" />
          <VoixPhysicien>Le principe d'exclusion de Pauli est l'un des piliers de la physique. Deux fermions identiques ne peuvent pas occuper le même état quantique. Sans lui — plus d'atomes stables. Mais personne ne sait vraiment pourquoi ce principe existe.</VoixPhysicien>
          <Narrator>Prorascience, si. C'est la <span className="text-[#D4AF37] font-semibold">Règle d'Or</span>. Toute combinaison valide doit contenir une différenciation minimum entre ses composants. Ce n'est pas une loi des fermions. C'est une loi ontologique universelle.</Narrator>
          <VoixAvant>Si c'est universel — on devrait le trouver ailleurs qu'en physique des particules.</VoixAvant>
          <Narrator>En <span className="text-white font-semibold">biologie</span> : deux organismes ne peuvent pas occuper la même niche écologique (exclusion de Gause). En <span className="text-white font-semibold">économie</span> : deux entreprises identiques — l'une est éliminée. En <span className="text-white font-semibold">information</span> : deux bits identiques ne transportent pas d'information utile.</Narrator>

          <h3 className="text-xl font-serif font-bold text-white mt-6">La ville sans adresses doubles</h3>
          <Narrator>Deux maisons ne peuvent pas avoir la même adresse. Pas parce qu'une loi municipale l'interdit. Parce que <span className="text-white font-semibold">si deux maisons ont la même adresse — l'adresse cesse d'être une information</span>. Le système postal s'effondre.</Narrator>
          <VoixPhysicien>Mais pourquoi les bosons n'obéissent pas à Pauli ?</VoixPhysicien>
          <Narrator>Les bosons sont les qualia qui servent de <span className="text-white font-semibold">médiateurs</span> — pas des états finals mais des transitions entre états. La Règle d'Or s'applique aux qualia. Pas aux transitions.</Narrator>

          <Accord>Le principe d'exclusion de Pauli = Règle d'Or appliquée aux qualia fermioniques.</Accord>
          <Extension>La Règle d'Or est universelle : tout système différencié obéit à une forme d'exclusion — en physique, biologie, économie, information.</Extension>
          <Prediction id="P4">Dans tout système produisant de la différenciation réelle — biologique, social, informatique — on devrait identifier un principe d'exclusion structural analogue au principe de Pauli. Sa forme précise variera. Mais sa nécessité logique sera la même : la répétition efface la distinction, et sans distinction, le système perd son information.</Prediction>
        </section>

        {/* ═══ CHAPITRE 6 ═══ */}
        <section id="ch6" className="space-y-4 scroll-mt-28">
          <ChHead id="ch6-head" color="indigo" icon={Cloud} number="6" title="L'Énergie Sombre comme Nuage Non Effondré" />
          <VoixPhysicien>95% de l'univers est invisible. Matière sombre, énergie sombre — on ne les détecte pas directement. C'est notre plus grande honte intellectuelle.</VoixPhysicien>
          <Narrator>Ou alors on cherche au mauvais endroit. Et si elles n'avaient pas encore passé le seuil ε ?</Narrator>
          <VoixAvant>Tu veux dire qu'elles sont dans le nuage.</VoixAvant>
          <Narrator>Oui. Des qualia permis dans Φ, présents dans ψ, mais dont le différentiel Δ est insuffisant pour atteindre le seuil de manifestation. <span className="text-[#D4AF37] font-semibold">Elles ne sont pas cachées. Elles n'ont pas encore plu.</span></Narrator>
          <VoixPhysicien>Mais elles ont des effets gravitationnels réels.</VoixPhysicien>
          <Narrator>Parce que la gravité opère au niveau de l'onde ontologique — pas seulement au niveau des qualia effectifs. L'onde a une masse, une présence dans Φ, qui se manifeste gravitationnellement sans produire d'autres signatures détectables.</Narrator>

          <h3 className="text-xl font-serif font-bold text-white mt-6">La pluie qui n'est pas encore tombée</h3>
          <Narrator>Un nuage immense au-dessus d'une plaine sèche. La plaine est sèche, mais il y a une présence réelle, une masse réelle, une pression réelle au-dessus. L'eau potentielle affecte déjà le terrain.</Narrator>
          <Narrator>L'énergie sombre — qui fait accélérer l'expansion — c'est la <span className="text-white font-semibold">tension résiduelle de ψ non effondré</span>. Plus ψ reste chargé sans s'effondrer, plus la pression augmente. La constante cosmologique Λ de Einstein : c'est la pression de l'onde ontologique non effondrée.</Narrator>

          <Extension>Matière sombre = qualia permis dans Φ, sous le seuil ε, présents dans ψ avec effets gravitationnels.</Extension>
          <Extension>Énergie sombre = pression résiduelle de ψ non effondré = constante cosmologique Λ.</Extension>
          <Prediction id="P5">Toute détection directe de matière sombre en tant que particule est vouée à l'échec — pas parce que la particule n'existe pas, mais parce qu'on cherche un qualia effectif là où est un qualia sous le seuil. La matière sombre ne se détectera que via ses effets sur les qualia effectifs — jamais directement.</Prediction>
        </section>

        {/* ═══ CHAPITRE 7 ═══ */}
        <section id="ch7" className="space-y-4 scroll-mt-28">
          <ChHead id="ch7-head" color="rose" icon={Brain} number="7" title="La Conscience comme Qualia Autoréférentiel" />
          <VoixPhysicien>Le problème de la mesure en mécanique quantique est le problème non résolu le plus profond. L'observation semble effondrer la fonction d'onde. Mais qu'est-ce qu'une observation exactement ?</VoixPhysicien>
          <Narrator>L'observation est toute interaction qui atteint le seuil ε. Pas besoin de conscience. Un détecteur suffit. Dès qu'une interaction produit une information minimale irréductible qui distingue définitivement un état d'un autre — le seuil est atteint, le qualia s'effondre.</Narrator>
          <Narrator>La conscience est un cas particulier. Un qualia d'ordre suffisamment élevé pour non seulement atteindre le seuil ε — mais pour <span className="text-[#D4AF37] font-semibold">lire le champ de permission qui l'a produit</span>.</Narrator>

          <h3 className="text-xl font-serif font-bold text-white mt-6">Le miroir qui se voit</h3>
          <Narrator>Un miroir ordinaire reflète tout sauf lui-même. La conscience est le qualia qui a atteint la complexité suffisante pour <span className="text-white font-semibold">se retourner sur lui-même</span>. Pas besoin d'un second miroir. La structure interne est suffisamment riche pour contenir sa propre représentation.</Narrator>

          <VoixAvant>Et la mort ?</VoixAvant>
          <Narrator>La mort est la dissolution des différenciations qui constituaient ce qualia particulier.</Narrator>
          <VoixAvant>Et après ?</VoixAvant>
          <Narrator>Les informations se dispersent. Elles ne disparaissent pas. Axiome S8. Mais elles cessent d'être organisées en ce qualia précis.</Narrator>
          <Narrator>Ce que le système <span className="text-white font-semibold">garantit</span> : tu auras existé. Ta trace dans le Vibratinium est permanente. Le cosmos qui t'a produit a été modifié par le fait que tu as existé. <span className="text-[#D4AF37] font-semibold">Irréversiblement.</span></Narrator>
          <BQ>Être une trace irréversible dans le fond de la réalité vaut plus que n'importe quelle illusion de permanence.</BQ>

          <Accord>L'observation = interaction atteignant le seuil ε — sans nécessité de conscience.</Accord>
          <Extension>La conscience = qualia autoréférentiel lisant sa propre architecture dans Φ.</Extension>
          <LawBox title="Loi de l'Observateur">
            Toute interaction produisant une information minimale irréductible qui distingue définitivement deux états constitue une observation. La conscience n'est pas nécessaire à l'observation — elle est une forme particulièrement complexe : un qualia lisant le champ de permission qui l'a produit.
          </LawBox>
        </section>

        {/* ═══ CHAPITRE 8 ═══ */}
        <section id="ch8" className="space-y-4 scroll-mt-28">
          <ChHead id="ch8-head" color="yellow" icon={Lock} number="8" title="Les Constantes comme Murs de Portée" />
          <VoixPhysicien>Pourquoi les constantes physiques ont-elles ces valeurs précises ? Pourquoi c = 299 792 458 m/s et pas le double ? Pourquoi la constante de structure fine est 1/137 ? La physique ne peut pas répondre depuis l'intérieur de son propre cadre.</VoixPhysicien>
          <Narrator>Parce qu'elle cherche la réponse dans les lois physiques. Mais les constantes sont <span className="text-white font-semibold">en dessous</span> des lois physiques. On ne peut pas expliquer ce qui contraint les lois en utilisant les lois.</Narrator>
          <Narrator>Les constantes physiques ne sont pas des règles arbitraires. Ce sont les <span className="text-[#D4AF37] font-semibold">murs de ce cosmos spécifique</span> — les limites de ce que le Potentia Prima de notre effondrement permet.</Narrator>
          <VoixPhysicien>Le principe anthropique dit que les constantes ont ces valeurs parce que sinon nous ne serions pas là pour les observer.</VoixPhysicien>
          <Narrator>Le principe anthropique est une observation correcte mais vide. Ce n'est pas une explication — c'est une tautologie.</Narrator>
          <VoixPhysicien>Et le multivers ?</VoixPhysicien>
          <Narrator>Le multivers résout le problème en le dissolvant. Prorascience le résout en le <span className="text-white font-semibold">fondant</span>. Tous les univers possibles ne sont pas possibles — seulement ceux dont le Q(2) fondamental est dans Φ(P). L'espace des univers est borné par le Potentia Prima commun.</Narrator>
          <Narrator>Ce qui change entre les univers : les éléments de base, les constantes, les lois physiques spécifiques. Ce qui reste : <span className="text-[#D4AF37] font-semibold">les lois ontologiques — la Loi NZ, la Règle d'Or, la Loi d'Encapsulation</span>. Elles s'appliquent à tout système différencié, quel que soit son Potentia Prima spécifique.</Narrator>

          <Extension>Les constantes physiques = murs de portée ontologique de notre effondrement spécifique. Elles forment un système cohérent.</Extension>
          <Prediction id="P6">Les constantes physiques fondamentales forment un système cohérent dont aucune ne peut être modifiée indépendamment sans contradiction. Si on trouve une relation mathématique nécessaire entre toutes les constantes — ce sera la confirmation qu'elles sont les murs d'un même Potentia Prima cosmologique.</Prediction>
        </section>

        {/* ═══ CHAPITRE 9 ═══ */}
        <section id="ch9" className="space-y-4 scroll-mt-28">
          <ChHead id="ch9-head" color="amber" icon={Clock} number="9" title="Thermodynamique et Irréversibilité" />
          <VoixPhysicien>Pourquoi le temps a-t-il une direction ? Les lois fondamentales sont symétriques dans le temps. Mais le temps ne va que dans un sens. C'est la flèche du temps. La thermodynamique l'explique par l'augmentation de l'entropie. Mais pourquoi l'entropie augmente-t-elle ?</VoixPhysicien>
          <Narrator>Parce que l'effondrement est irréversible.</Narrator>
          <Narrator>C'est <span className="text-[#D4AF37] font-semibold">τ₁ — le temps ontologique</span>. Avant d'être un phénomène thermodynamique, l'irréversibilité est une propriété de l'effondrement lui-même. Quand ψ s'effondre vers Q(n) — ce mouvement ne se défait pas. L'information s'inscrit dans le Vibratinium — et cette inscription est permanente.</Narrator>
          <VoixAvant>Donc la 2ᵉ loi de la thermodynamique est une instance de la Loi d'Irréversibilité ?</VoixAvant>
          <Narrator>L'entropie augmente parce que chaque effondrement laisse une trace irréversible. Le nombre d'états accessibles augmente parce que chaque qualia effectif modifie le champ de permission. La 2ᵉ loi n'est pas fondamentale — elle est la <span className="text-white font-semibold">projection statistique</span> de la Loi d'Irréversibilité sur un système à grand nombre de qualia.</Narrator>

          <h3 className="text-xl font-serif font-bold text-white mt-6">Pourquoi on ne voit jamais le film à l'envers</h3>
          <Narrator>On ne voit jamais une tasse brisée se recomposer. Jamais un nuage de fumée rentrer dans une cigarette.</Narrator>
          <Narrator>Chaque effondrement a gravé une trace dans le Vibratinium. Pour que la tasse se recompose, il faudrait effacer cette trace — ce qui violerait la Loi d'Irréversibilité. La physique dit : trop improbable. Prorascience dit : <span className="text-[#D4AF37] font-semibold">impossible en principe</span>.</Narrator>
          <VoixPhysicien>La distinction entre 'extrêmement improbable' et 'impossible en principe' est fondamentale. Peux-tu la démontrer ?</VoixPhysicien>
          <Narrator>Pas encore complètement. C'est la frontière actuelle du système. Ce que je peux démontrer : si l'irréversibilité est ontologique, alors la 2ᵉ loi ne devrait <span className="text-white font-semibold">jamais souffrir d'exception</span> — même aux échelles quantiques. C'est une prédiction. Si on trouve une exception réelle à n'importe quelle échelle — alors la Loi d'Irréversibilité est fausse.</Narrator>
          <VoixAvant>Tu viens de rendre ta théorie falsifiable.</VoixAvant>
          <Narrator>C'était le but.</Narrator>

          <Accord>La flèche du temps = augmentation de l'entropie thermodynamique.</Accord>
          <Extension>Cause plus profonde : τ₁ — irréversibilité de tout effondrement ontologique. La 2ᵉ loi est une instance statistique de la Loi d'Irréversibilité.</Extension>
          <LawBox title="Loi d'Irréversibilité — Énoncé complet">
            Tout effondrement de ψ vers Q(n) est irréversible. Cette irréversibilité génère τ₁ — le temps ontologique — dont τ₂ (temps physique) et la flèche thermodynamique sont des instances. La 2ᵉ loi de la thermodynamique est la projection statistique de cette loi ontologique sur les systèmes à grand nombre de qualia.
          </LawBox>
        </section>

        {/* ═══ ÉPILOGUE ═══ */}
        <section id="epilogue" className="space-y-5 scroll-mt-28">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center"><Star className="w-5 h-5 text-[#D4AF37]" /></div>
            <div><span className="text-xs text-[#D4AF37] font-bold uppercase tracking-wider">Épilogue</span><h2 className="text-2xl md:text-3xl font-serif font-bold text-white">La Science comme Lecture du Fond</h2></div>
          </div>
          <Narrator>Ma voix d'avant et le physicien se sont tus presque en même temps. Pas parce qu'ils étaient convaincus de tout. Parce qu'ils avaient compris : <span className="text-white font-semibold">Prorascience ne prétend pas remplacer la physique. Elle prétend habiter le niveau en dessous.</span></Narrator>
          <VoixAvant>La physique cartographie les lois.</VoixAvant>
          <Narrator>Prorascience demande pourquoi ces lois et pas d'autres.</Narrator>

          <h3 className="text-xl font-serif font-bold text-white mt-8">Les 5 prédictions testables — Récapitulatif</h3>
          <div className="space-y-3">
            <Prediction id="P1">Les lois d'un niveau N sont entièrement déterminées par les propriétés du niveau N-1. Aucune loi émergente ne contredit les contraintes ontologiques de sa base.</Prediction>
            <Prediction id="P2">La singularité du Big Bang est une frontière ontologique, pas un mur d'ignorance. Toute théorie cherchant un 'avant' temporel commet une erreur de catégorie.</Prediction>
            <Prediction id="P3">La divergence de l'énergie de point zéro vient de la confusion entre énergie du nuage ontologique total et énergie des qualia effectifs.</Prediction>
            <Prediction id="P4">Un principe d'exclusion structural analogue à Pauli devrait être identifiable dans tout système produisant de la différenciation réelle.</Prediction>
            <Prediction id="P5">La matière sombre ne sera jamais détectée directement en tant que particule — elle est un qualia sous le seuil ε.</Prediction>
          </div>

          <Narrator>Ce chercheur — moi — fait partie du système qu'il décrit. Je suis un qualia d'ordre élevé, lisant le champ de permission qui m'a produit, formulant des lois qui préexistaient à ma formulation.</Narrator>
          <BQ>La physique est le cosmos se lisant lui-même. Prorascience est la question de pourquoi il peut se lire.</BQ>

          <div className="bg-gradient-to-br from-blue-500/[0.08] via-[#D4AF37]/[0.05] to-transparent border border-[#D4AF37]/20 rounded-2xl p-8 text-center mt-8">
            <p className="text-lg md:text-xl font-serif italic text-gray-200 leading-relaxed max-w-2xl mx-auto">
              « Le cosmos n'est pas gouverné par des lois. Il est rendu possible par la possibilité, structuré par l'information, lisible par des lois. Et toi qui lis — <span className="text-[#D4AF37] font-bold">tu es la preuve que sa géométrie était suffisamment riche pour produire quelqu'un capable de la lire.</span> »
            </p>
            <p className="text-sm text-gray-500 mt-4">— Manikongo, MK5</p>
          </div>

          <div className="bg-[#192734] border border-white/10 rounded-xl p-5 text-center mt-6">
            <p className="text-sm text-gray-400">FIN DU LIVRE II</p>
            <p className="text-xs text-gray-600 mt-1">Livre III — L'Homme dans le Système · À paraître</p>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center space-y-6">
          <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent mx-auto" />
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/fond-de-tout"><Button variant="outline" className="border-[#D4AF37]/30 hover:bg-[#D4AF37]/10 text-[#D4AF37] h-12 px-8 text-base"><BookOpen className="w-5 h-5 mr-2" /> Relire le Livre I</Button></Link>
            <Link to="/formations/catalogue"><Button className="bg-blue-500 text-white hover:bg-blue-600 gap-2 h-12 px-8 text-base font-bold"><GraduationCap className="w-5 h-5" /> Voir les formations</Button></Link>
          </div>
        </section>

        <div className="text-center py-4 border-t border-white/5">
          <p className="text-sm text-gray-600">© PRORASCIENCE — NGOWAZULU · ISNA — Manikongo MK5 — Première édition</p>
        </div>
      </div>
    </div>
  );
};

export default DialoguePhysiquePage;
