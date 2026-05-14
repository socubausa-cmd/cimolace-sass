import React, { useState } from 'react';
import SEO from '@/components/SEO';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Crown, Star, Eye, Zap, BookOpen, ArrowRight,
  MessageCircle, ChevronDown, Flame, Heart,
  Sparkles, Calendar, Quote, Sun, Moon,
  Shield, Globe, Users, Compass, Lock
} from 'lucide-react';

const ChapterSection = ({ number, title, color, icon: Icon, children }) => {
  const colorMap = {
    yellow: { border: "border-[#D4AF37]/20", bg: "bg-[#D4AF37]/10", text: "text-[#D4AF37]", accent: "from-[#D4AF37]/10" },
    violet: { border: "border-violet-500/20", bg: "bg-violet-500/10", text: "text-violet-400", accent: "from-violet-500/10" },
    blue: { border: "border-blue-500/20", bg: "bg-blue-500/10", text: "text-blue-400", accent: "from-blue-500/10" },
    emerald: { border: "border-emerald-500/20", bg: "bg-emerald-500/10", text: "text-emerald-400", accent: "from-emerald-500/10" },
    orange: { border: "border-orange-500/20", bg: "bg-orange-500/10", text: "text-orange-400", accent: "from-orange-500/10" },
    rose: { border: "border-rose-500/20", bg: "bg-rose-500/10", text: "text-rose-400", accent: "from-rose-500/10" },
    cyan: { border: "border-cyan-500/20", bg: "bg-cyan-500/10", text: "text-cyan-400", accent: "from-cyan-500/10" },
    indigo: { border: "border-indigo-500/20", bg: "bg-indigo-500/10", text: "text-indigo-400", accent: "from-indigo-500/10" },
    teal: { border: "border-teal-500/20", bg: "bg-teal-500/10", text: "text-teal-400", accent: "from-teal-500/10" },
  };
  const c = colorMap[color] || colorMap.yellow;

  return (
    <section className={`bg-gradient-to-br ${c.accent} to-[#192734] border ${c.border} rounded-2xl p-6 md:p-8 space-y-5`}>
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 ${c.text}`} />
        </div>
        <div>
          {number && <span className={`text-xs font-bold ${c.text} uppercase tracking-wider`}>Chapitre {number}</span>}
          <h2 className="text-xl md:text-2xl font-serif font-bold text-white leading-tight">{title}</h2>
        </div>
      </div>
      <div className="text-gray-300 text-base leading-relaxed space-y-4 pl-1">
        {children}
      </div>
    </section>
  );
};

const VisionQuote = ({ children, color = "yellow" }) => {
  const bgMap = {
    yellow: "bg-[#D4AF37]/10 border-[#D4AF37]/20",
    violet: "bg-violet-500/10 border-violet-500/20",
    blue: "bg-blue-500/10 border-blue-500/20",
    cyan: "bg-cyan-500/10 border-cyan-500/20",
    emerald: "bg-emerald-500/10 border-emerald-500/20",
    orange: "bg-orange-500/10 border-orange-500/20",
    rose: "bg-rose-500/10 border-rose-500/20",
    indigo: "bg-indigo-500/10 border-indigo-500/20",
    teal: "bg-teal-500/10 border-teal-500/20",
  };
  const textMap = {
    yellow: "text-[#D4AF37]",
    violet: "text-violet-300",
    blue: "text-blue-300",
    cyan: "text-cyan-200",
    emerald: "text-emerald-300",
    orange: "text-orange-300",
    rose: "text-rose-300",
    indigo: "text-indigo-300",
    teal: "text-teal-300",
  };

  return (
    <div className={`${bgMap[color] || bgMap.yellow} border rounded-xl p-5 my-2`}>
      <p className={`text-center text-lg font-serif italic ${textMap[color] || textMap.yellow}`}>
        {children}
      </p>
    </div>
  );
};

const OrigineAppelPage = () => {
  const [expandedChapter, setExpandedChapter] = useState(null);

  return (
    <div className="min-h-screen bg-[#0F1419] text-white">
      <SEO
        title="L'Origine de l'Appel — 5ᵉ Manikongo"
        description="Témoignage complet du 5ᵉ Manikongo sur l'origine de son appel spirituel, les visions fondatrices, les initiations ancestrales et la naissance de la Prorascience."
      />

      {/* HERO */}
      <section className="relative py-28 md:py-40 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F1419] via-[#192734]/60 to-[#0F1419]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#D4AF37]/5 rounded-full blur-[250px]" />
        <div className="absolute top-20 right-20 w-[300px] h-[300px] bg-violet-500/5 rounded-full blur-[150px]" />

        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] text-xs font-bold uppercase tracking-widest border border-[#D4AF37]/20">
            <Crown className="w-4 h-4" /> Témoignage du Fondateur
          </span>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-white leading-tight">
            L'Origine de<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-yellow-400 to-[#D4AF37]">
              l'Appel
            </span>
          </h1>

          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Le chemin spirituel du <span className="text-[#D4AF37] font-semibold">5ᵉ Manikongo</span>, des premières visions fondatrices à la naissance de la Prorascience et de l'école Ngowazulu.
          </p>

          <div className="w-32 h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent mx-auto" />

          <ChevronDown className="w-6 h-6 text-[#D4AF37]/50 mx-auto animate-bounce" />
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 md:px-6 pb-20 space-y-8">

        {/* INTRODUCTION */}
        <section className="text-center space-y-4 mb-8">
          <p className="text-gray-300 text-lg leading-relaxed">
            Je suis connu sous le nom de <span className="text-white font-semibold">5ᵉ Manikongo</span>, fondateur de la <span className="text-[#D4AF37] font-semibold">Prorascience</span> et de l'école initiatique <span className="text-[#D4AF37] font-semibold">Ngowazulu</span>.
          </p>
        </section>

        {/* LES PREMIERS SIGNES — 2008 */}
        <ChapterSection title="Les Premiers Signes — La Visite des Deux Inconnus" icon={Users} color="blue">
          <p>
            Je continuais toujours à prêcher l'évangile des impies et j'étais zélé à parler des mystères, alors je fus visité par <span className="text-white font-semibold">deux inconnus</span>.
          </p>
          <p>
            Ils vinrent à moi dans un songe et me dirent :
          </p>
          <VisionQuote color="blue">
            « On vient de loin et nous venons à toi de la part du Père. Il nous a chargé de te dire que tu l'attristes, car ton temps de ministère n'est pas arrivé. Tu dois garder secret ces paroles que tu as reçues. »
          </VisionQuote>
          <p>
            Puis les deux êtres repartirent d'où ils étaient venus. Cela se déroula en <span className="text-white font-semibold">2008</span>.
          </p>
        </ChapterSection>

        {/* LA RÉVÉLATION DES DOUZE PORTES */}
        <ChapterSection title="La Révélation des Douze Portes" icon={Eye} color="violet">
          <p>
            Je me questionnais au sujet de mon ministère — pourquoi ils vinrent me dire que mon temps n'est pas arrivé et que je ne dois pas prêcher. Alors la nuit j'eus un songe où on me dit :
          </p>
          <VisionQuote color="violet">
            « Tu enseigneras le mystère des douze portes de la nouvelle Yerusalem. »
          </VisionQuote>
          <p>
            Puis on me montra le temple et la structure de la ville sainte. Puis on me dit : <span className="text-violet-300 font-semibold">« Tu expliqueras l'Apocalypse 12. »</span>
          </p>
        </ChapterSection>

        {/* LA SOLITUDE ET LE REJET */}
        <ChapterSection title="La Solitude et le Rejet" icon={Heart} color="rose">
          <p>
            Après cette expérience, je devenais un tourment pour l'église où je priais. Je commençais à tout contredire, mais <span className="text-white font-semibold">personne ne me comprenait</span>. Je me retrouvais toujours seul, insulté et rejeté.
          </p>
          <p>
            D'autres disaient que j'étais fou. Alors je partis dans une rivière et là-bas j'invoquais ceux qui m'avaient visité et celui qui est à l'origine de mes visions afin qu'ils puissent me dire pourquoi je ne suis pas reçu, et pourquoi je suis seul, sans amis.
          </p>
          <p>
            Je finis ma prière et je repartis à la maison.
          </p>
        </ChapterSection>

        {/* LA RENCONTRE AVEC LES WAYAH */}
        <ChapterSection title="La Rencontre avec les Wayah" icon={Sparkles} color="cyan">
          <p>
            La nuit, je m'endormis et j'eus une vision où je marchais dans un village. Je vis <span className="text-white font-semibold">deux êtres habillés au style des hébreux anciens</span> : ils avaient des foulards, une longue robe et un pantalon, et tout était en marron. L'un était une femme et l'autre un homme. Tous deux étaient debout à côté de la route où passaient plusieurs personnes, mais personne ne faisait attention à eux.
          </p>
          <p>
            Quand je vins où les deux étaient, je sus que ces deux étaient des <span className="text-cyan-300 font-bold">wayah</span>. Je me prosternai alors et ils me relevèrent. En les voyant je sentis un grand soulagement et une paix intérieure, je sentis <span className="text-white font-semibold">une présence de la famille</span>.
          </p>
          <p>
            Je me dis : comment personne n'a pu discerner que ces deux-là ne sont pas de la terre. Ensuite les deux m'amenèrent dans une cabane. Là-bas, la maison n'était pas luxueuse, mais je me sentais si bien par leur présence.
          </p>
          <p>
            Puis ils se mirent à m'instruire. À la fin de notre entretien, ils me dirent :
          </p>
          <VisionQuote color="cyan">
            « Tu n'es pas seul. Nous sommes venus te saluer de la part de tes frères qui sont là-bas là-haut. Ils t'assistent et te soutiennent. Tout ton courage ! »
          </VisionQuote>
          <p>
            Et ils repartirent au ciel. Ainsi finit la vision.
          </p>
        </ChapterSection>

        {/* CHAPITRE 6 — JUGEMENT DE CHÉO */}
        <ChapterSection number="6" title="Jugement de Chéo" icon={Shield} color="orange">
          <p>
            Jusque-là, je ne connaissais pas la voix qui me parlait, ni ne voyais son apparence. Un jour, quand je commençai le ministère sans que l'on me l'ordonne, j'eus une révélation : <span className="text-white font-semibold">j'étais mort</span> et alors je fus ravi dans une boule d'étoile rayonnante.
          </p>
          <p>
            Ainsi, je suis arrivé à la frontière entre la terre et le céleste. Là-bas, les chaises furent dressées au-dessus des nuages en sorte qu'on pouvait marcher sur les nuages comme on marche sur terre. Parmi ceux qui étaient là, <span className="text-orange-300 font-bold">j'étais le seul qui était couronné</span>.
          </p>
          <p>
            Alors je vis qu'il y avait beaucoup d'âmes qui voulaient entrer dans le pays des bénis, mais avant, il fallait d'abord passer au jugement par un céleste. Il disait qu'il ne connaît ni Jésus, ni Branham, ni Dieu, et il jugeait les péchés comme à l'école — c'est-à-dire chaque épreuve de la vie était comme une matière :
          </p>
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-5 my-2">
            <ul className="space-y-1 text-sm text-orange-200">
              <li>• Une note sur 20 pour la <span className="text-white font-semibold">justice</span></li>
              <li>• Une note sur 20 pour l'<span className="text-white font-semibold">amour</span></li>
              <li>• Une note sur 20 pour la <span className="text-white font-semibold">sainteté</span></li>
              <li>• Une note sur 20 pour la <span className="text-white font-semibold">foi</span></li>
              <li>• Une note pour la <span className="text-white font-semibold">fidélité</span></li>
              <li>• Une note pour la <span className="text-white font-semibold">libéralité</span></li>
              <li>• Une note pour le <span className="text-white font-semibold">respect des arbres, des animaux, des hommes, des oiseaux</span></li>
            </ul>
            <p className="text-sm text-orange-300 mt-3 italic">
              Puis l'ensemble des notes était divisé par le nombre des épreuves pour avoir la moyenne.
            </p>
          </div>
          <p>
            Ainsi plusieurs échouèrent, car les notes retenues furent les dernières recueillies au cours de la dernière réincarnation. Les autres étaient oubliées, à cause de la grâce. Donc <span className="text-white font-semibold">la dernière vie fut comme un examen de rattrapage</span>. Je ne vis personne entrer.
          </p>
          <p>
            Lorsque vint mon tour, le céleste me reprocha, puis me dit :
          </p>
          <VisionQuote color="orange">
            « Vous, Bedelayèm, vous devriez normalement rentrer sans complication, mais seulement vous avez commis des crimes de dernière minute. Toi aussi tu as un crime du sang. »
          </VisionQuote>
          <p>
            Alors lui et moi, ce fut un grand débat au sujet de ma justice, car je lui ai récité ma vie et toutes mes œuvres. En effet, les âmes avaient le droit de se défendre. Je lui ai dit de m'amener la preuve de mes crimes. <span className="text-white font-semibold">Il partit en chercher et n'en trouva pas</span>, et il fut étonné.
          </p>
          <p>
            Alors il me montra la route et me dit de rentrer si je le peux, car en effet la porte de ce globe était une atmosphère que seul un pur peut traverser. Pour un impur, cela devait le repousser — car le portail d'air deviendra un champ magnétique comme la couche d'ozone empêche les débris célestes de pénétrer la terre.
          </p>
          <p>
            Personne ne peut y rentrer par corruption ou par identité familiale, car seule la <span className="text-[#D4AF37] font-semibold">justice personnelle</span> pouvait te faire rentrer. On ne rentre pas en groupe, là-bas personne ne parlera pour personne — c'est un événement personnel.
          </p>
          <p>
            Ainsi, lorsque je suis arrivé devant le portail, je mis ma main, elle se retrouva de l'autre côté. Je mis ma tête, elle se retrouva de l'autre côté. Puis je mis mon corps et je me retrouvai de l'autre côté. <span className="text-orange-300 font-bold">Le gardien des portails était étonné que je sois rentré et que le portail m'ait obéi.</span>
          </p>
        </ChapterSection>

        {/* CHAPITRE 7 — DÉCOUVERTE DE L'AUTRE PLANÈTE */}
        <ChapterSection number="7" title="Découverte de l'Autre Planète" icon={Globe} color="emerald">
          <p>
            De l'autre côté je vis <span className="text-white font-semibold">une autre terre, un autre soleil</span>. Les femmes étaient belles et justes. J'entendais les sons des tambours qu'elles jouaient sur l'eau.
          </p>
          <p>
            Il n'y avait aucun désir sexuel, tout le monde était juste. L'herbe et la pelouse étaient brillantes comme du diamant. Son soleil était beau comme le coucher sur terre, marron, et les rayons du soleil ne brûlaient pas. À les voir, c'est comme si la couleur était filtrée — les rayons avaient la <span className="text-emerald-300 font-semibold">brillance de l'or</span>. Le sol était en pavé, très propre.
          </p>
          <p>
            Mais je ne suis pas arrivé à la ville où j'entendais les femmes chanter et l'ambiance, car on me dit qu'il fallait encore rester là pour être instruit.
          </p>
          <p>
            Alors j'ai vu un long bâtiment : c'était <span className="text-white font-semibold">une école</span>. Là-bas on instruisait ceux qui venaient de rentrer dans cette planète. Je suis rentré dans la classe et on me dit qu'il y avait quelqu'un qui m'attendait.
          </p>
          <p>
            Je suis parti dans la salle où il était et j'ai vu un homme élancé avec un boubou blanc. À ma surprise, j'ai vu que c'était <span className="text-[#D4AF37] font-bold">le Père</span>, lui-même en personne qui était venu m'accueillir à l'arrivée, et c'était aussi lui-même le roi de ce beau monde. Alors j'ai couru vers lui et l'embrassai.
          </p>
          <p>
            De l'autre côté, je pouvais voir les gens être jugés : les églises, les pasteurs, les chrétiens, les musulmans. Personne ne pouvait entrer avec sa confession, car là-bas on disait qu'on ne les connaissait pas.
          </p>
          <p>
            Alors je vis un enfant de l'autre côté qui attendait son jugement, âgé de 10 ans. Il était inquiet, car en voyant la multitude être rejetée, il craignait que lui aussi soit rejeté. C'est après le jugement que le gardien te donne le mandat de rentrer avec une forme de clé qui te permet d'ouvrir l'atmosphère — et <span className="text-emerald-300 font-bold">je fus le seul qui suis entré sans le mandat</span>.
          </p>
          <p>
            Alors je voyais l'enfant qui s'inquiétait et je lui ai dit :
          </p>
          <VisionQuote color="emerald">
            « Petit garçon, entre ! — Mais j'ai pas le mandat ! — Entre je te dis, car il n'y a pas de jugement pour les enfants de 10 ans, et toi tu n'as pas encore 11 ans ! »
          </VisionQuote>
          <p>
            Alors je traversai la couche d'ozone puis le pris et le fis entrer sous les yeux du wayah gardien des portails.
          </p>
        </ChapterSection>

        {/* CHAPITRE 8 — RENCONTRE AVEC PAPA SIMON KIMBANGU */}
        <ChapterSection number="8" title="Rencontre avec Papa Simon Kimbangu" icon={Crown} color="yellow">
          <p>
            Lorsque je sortis de cette vision, je me questionnais : pourquoi le gardien des portails n'avait-il pas vu mon péché — et pourtant il en était bien sûr que je sois aussi pécheur — et pourquoi le Père, roi d'ATOUME, était venu lui-même m'accueillir, puis pourquoi j'étais couronné.
          </p>
          <p>
            Alors je m'endormis avec ces questions. En ce temps-là, je venais d'être perturbé dans une histoire d'amour. Alors je rentrai en jeûne pour me repentir.
          </p>
          <p>
            C'est à cet instant que j'eus la vision d'un homme noir — <span className="text-[#D4AF37] font-bold">Kimbangu</span> — qui vint à moi et me fit une délivrance, et la voix du tonnerre me dit :
          </p>
          <VisionQuote color="yellow">
            « Tes péchés sont pardonnés ! »
          </VisionQuote>
          <p>
            Voici que moi, <span className="text-white font-semibold">Ché'o</span>, ce fut la première fois que je croisai un céleste qui m'a dit son nom et ce fut <span className="text-[#D4AF37] font-bold">Papa Simon Kimbangu</span>.
          </p>
          <p>
            Au sortir de là, je me demandais pourquoi ce n'est pas Jésus qui est venu pour me délivrer, et pourquoi c'est un nom inconnu qui vient pardonner mes fautes. Je voyais celui qui a exercé sur moi la délivrance contre le péché qui vit dans mon ventre, avec l'allure d'un roi, et d'une puissance qui gouverne la forêt, car c'est au milieu des gros arbres qu'il vivait. Et au-dessus du ciel une grande lumière et une voix sortait des nuages — et cette voix était celle du Père.
          </p>
          <p>
            Après que Kimbangu eut à me délivrer, je compris la vision d'ATOUME. Je compris pourquoi le gardien des portails ne pouvait trouver le livre de mes fautes.
          </p>
          <p>
            En <span className="text-white font-semibold">2012</span>, on me dit que j'étais héritier du cadavre de Kimbangu, car il venait de mourir et son corps était conduit par les frères vers moi. Alors je m'irritai en disant : <span className="text-gray-400 italic">« Donc tu vivais mais tu ne faisais rien pendant tout ce temps-là ! »</span> — je ne reçus aucune réponse.
          </p>
          <p>
            Jusqu'au jour, toujours dans l'année 2012, où j'ai vu un être entre la mer, le fleuve et la forêt, dans un croisement. J'ai croisé un homme qui unissait ces trois mondes. Et je le confondis et je vis que c'était <span className="text-[#D4AF37] font-bold">Kimbangu</span>.
          </p>
          <p>
            Alors ce mystère m'attira à lui par lévitation jusqu'à ce qu'il me fît passer un <span className="text-white font-semibold">rituel de consécration</span> au bord d'une rivière.
          </p>
          <p>
            Puis en partant il me dit :
          </p>
          <VisionQuote color="yellow">
            « Mpa'lo, Mpu'lu, Mpo'lu, Polo ! »
          </VisionQuote>
          <p>
            À partir de ce jour, je commençais à changer de religions et à invoquer le génie des ancêtres, par le nom de Kimbangu et Mpa'lo.
          </p>
        </ChapterSection>

        {/* SECTION : LES INITIATIONS ASTRALES */}
        <ChapterSection title="Les Initiations et la Naissance de la Prorascience" icon={Star} color="indigo">
          <p>
            Après cela, je vécus une suite d'initiations dans plusieurs <span className="text-white font-semibold">écoles spirituelles</span>, vécues dans le monde astral. Ce qui ne dura que peu de temps dans le monde physique me parut être une éternité dans le monde spirituel.
          </p>
          <p>
            Au cours de ces initiations, les ancêtres me donnèrent un titre et me dirent :
          </p>
          <VisionQuote color="indigo">
            « Tu es le prophète de ce siècle. Donne-leur les yeux pour voir et les oreilles aux reins comme ceinture de vérité. Sois fier du titre que tu as reçu : celui du 5ᵉ Manikongo. »
          </VisionQuote>
          <p>
            C'est après ces initiations que commencèrent de nombreuses visions sur <span className="text-white font-semibold">l'origine de l'univers</span>, la structure de la réalité et les lois invisibles qui gouvernent la vie.
          </p>
          <p>
            Au fil du temps, j'ai pris soin de modéliser et d'organiser ces révélations sous la forme d'un système métaphysique que j'ai appelé la <span className="text-indigo-300 font-bold">Prorascience</span>. La Prorascience cherche à relier <span className="text-white font-semibold">prophétie, raison et science</span> afin d'explorer les forces qui structurent l'univers, la conscience et le destin humain.
          </p>
        </ChapterSection>

        {/* AUJOURD'HUI */}
        <section className="bg-gradient-to-br from-[#192734] to-[#0f1216] rounded-3xl p-8 md:p-12 border border-[#D4AF37]/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#D4AF37]/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
          <div className="relative space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Sun className="w-8 h-8 text-[#D4AF37]" />
              <h2 className="text-2xl md:text-3xl font-serif font-bold text-white">Aujourd'hui</h2>
            </div>
            <p className="text-gray-300 text-base leading-relaxed">
              Aujourd'hui, à travers l'école <span className="text-[#D4AF37] font-semibold">Ngowazulu</span>, je transmets cet enseignement sous la forme d'un parcours structuré autour des <span className="text-white font-semibold">21 sciences de la Prorascience</span>, destiné à ceux qui souhaitent comprendre les lois invisibles de la réalité et développer leur conscience.
            </p>
            <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-xl p-6 text-center">
              <p className="text-xl font-serif font-bold text-white leading-relaxed">
                Mon objectif est d'aider chacun à <span className="text-[#D4AF37]">ouvrir les yeux</span>, <span className="text-[#D4AF37]">écouter profondément</span> et <span className="text-[#D4AF37]">devenir responsable de son propre destin</span>.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center space-y-6">
          <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent mx-auto" />
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/a-propos/fondateur">
              <Button className="bg-[#D4AF37] text-black hover:bg-yellow-500 gap-2 h-12 px-8 text-base font-bold">
                <Crown className="w-5 h-5" /> Profil du Fondateur
              </Button>
            </Link>
            <Link to="/ecoles">
              <Button variant="outline" className="border-white/20 hover:bg-white/5 text-white h-12 px-8 text-base">
                <BookOpen className="w-5 h-5 mr-2" /> Les 21 Sciences
              </Button>
            </Link>
          </div>
        </section>

        {/* FOOTER */}
        <div className="text-center py-4 border-t border-white/5">
          <p className="text-sm text-gray-600">
            © ISNA Prorascience — Témoignage du 5ᵉ Manikongo — École Ngowazulu
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrigineAppelPage;
