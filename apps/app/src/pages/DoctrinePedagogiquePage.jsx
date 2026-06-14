import React from 'react';
import SEO from '@/components/SEO';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  BookOpen, Eye, Zap, Flame, Shield, Crown, Star,
  ArrowRight, MessageCircle, ChevronDown, GraduationCap,
  Monitor, Library, Brain, Heart, Users, Sparkles,
  Quote, CheckCircle2
} from 'lucide-react';
import { activeTenantConfig as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';

const SITE_NAME = `${isnaTenantConfig.branding.name} · LIRI`;

const axioms = [
  { number: 1, title: "Loi d'imprégnation", text: "L'esprit se configure par exposition prolongée à une source vivante." },
  { number: 2, title: "Principe de présence", text: "La transmission génère un champ d'intégration que l'information seule ne peut produire." },
  { number: 3, title: "Double canal pédagogique", text: "La maîtrise requiert l'union du canal d'imprégnation (direct) et du canal de maturation (étude)." },
  { number: 4, title: "Loi d'intégration progressive", text: "L'apprentissage (Esprit) précède la compréhension (Âme). La compréhension précède la Maîtrise." },
  { number: 5, title: "Principe de résonance", text: "La qualité de l'intégration dépend de la synchronisation vibratoire entre l'instructeur et l'apprenant." },
  { number: 6, title: "Complémentarité des supports", text: "La classe virtuelle intègre l'élève au champ ; la salle numérique consolide son architecture intérieure." },
  { number: 7, title: "Loi de maturation", text: "Tout savoir initiatique exige un temps d'incubation pour se transmuer en compétence réelle." },
];

const vectors = [
  { icon: Eye, title: "L'Exposition", description: "La confrontation prolongée à une source experte dont l'influence finit par imprégner la structure mentale de l'apprenant." },
  { icon: Flame, title: "La Présence", description: "L'impact d'une immersion dans une atmosphère où le savoir est incarné, créant une densité de réalité que les mots seuls ne peuvent véhiculer." },
  { icon: Zap, title: "La Résonance", description: "Un phénomène de synchronisation intersubjective où l'esprit de l'élève s'aligne sur la fréquence et la cohérence de l'enseignement reçu." },
];

const DoctrinePedagogiquePage = () => {
  return (
    <div className="min-h-screen bg-[#0F1419] text-white">
      <SEO
        title="Doctrine Pédagogique — L'Art de la Transmission par Présence"
        description={`La doctrine pédagogique de ${SITE_NAME} : l'Art de la Transmission par Présence. Axiomes, méthodes et vision éducative du 5ᵉ Manikongo.`}
      />

      {/* HERO */}
      <section className="relative py-28 md:py-40 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F1419] via-[#192734]/60 to-[#0F1419]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] rounded-full blur-[250px]" />
        <div className="absolute top-20 left-20 w-[300px] h-[300px] bg-violet-500/5 rounded-full blur-[150px]" />

        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[var(--school-accent)] text-xs font-bold uppercase tracking-widest border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]">
            <BookOpen className="w-4 h-4" /> Doctrine officielle
          </span>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-white leading-tight">
            L'Art de la Transmission<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--school-accent)] via-yellow-400 to-[var(--school-accent)]">
              par Présence
            </span>
          </h1>

          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Doctrine Pédagogique de l'ISNA — Comment l\'école Ngowazulu transmet le savoir initiatique à travers la connexion vivante.
          </p>

          <div className="w-32 h-0.5 bg-gradient-to-r from-transparent via-[var(--school-accent)] to-transparent mx-auto" />

          <ChevronDown className="w-6 h-6 text-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] mx-auto animate-bounce" />
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 md:px-6 pb-20 space-y-16">

        {/* I. LE PRIMAT DE LA TRANSMISSION */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
              <span className="text-sm font-bold text-violet-400">I</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-white">
              Le Primat de la Transmission sur l'Information
            </h2>
          </div>
          <p className="text-sm text-violet-400 font-medium uppercase tracking-wider">Un Impératif Stratégique</p>

          <div className="space-y-4 text-gray-300 text-base leading-relaxed">
            <p>
              Dans une ère saturée de données, nous faisons face à un paradoxe civilisationnel : <span className="text-white font-semibold">l'information abonde, mais la transmission s\'étiole</span>. L\'accumulation frénétique de savoirs ne produit que des érudits de surface, incapables de transmuter le concept en compétence.
            </p>
            <p>
              À l'ISNA, nous affirmons que <span className="text-[var(--school-accent)] font-semibold">l\'étude seule ne mène pas à la compréhension</span>. Cette architecture pédagogique transcende la simple instruction pour ériger un sanctuaire de transformation intérieure.
            </p>
            <div className="bg-[#192734] border-l-4 border-[var(--school-accent)] rounded-r-xl p-5">
              <p className="text-gray-300 italic">
                La pièce maîtresse manquante dans l'éducation moderne est la <span className="text-white font-semibold">connexion vivante</span>. Sans ce lien organique, le savoir reste une entité étrangère. Pour franchir ce fossé, il faut restaurer la primauté de l\'imprégnation sur la simple mémorisation.
              </p>
            </div>
          </div>
        </section>

        {/* II. L'ESPRIT COMME ORGANE */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
              <span className="text-sm font-bold text-blue-400">II</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-white">
              L'Esprit comme Organe d\'Imprégnation
            </h2>
          </div>
          <p className="text-sm text-blue-400 font-medium uppercase tracking-wider">La Phénoménologie du Devenir</p>

          <div className="space-y-4 text-gray-300 text-base leading-relaxed">
            <p>
              La doctrine ISNA repose sur une vérité métaphysique fondamentale : l'esprit humain n\'est pas qu\'un outil analytique froid ; il est un <span className="text-white font-semibold">organe d\'imitation dynamique</span> et une <span className="text-white font-semibold">photocopie vivante</span>.
            </p>
            <p>
              Selon ce principe, <span className="text-[var(--school-accent)] font-semibold">l'homme devient ce qu\'il contemple</span>. L\'apprentissage n\'est pas un acte de volonté isolée, mais une configuration de l\'esprit par ce qu\'il reçoit par immersion.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {vectors.map((v, i) => (
              <div key={i} className="bg-[#192734] border border-white/5 rounded-2xl p-6 hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-all">
                <div className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] flex items-center justify-center mb-4">
                  <v.icon className="w-5 h-5 text-[var(--school-accent)]" />
                </div>
                <h3 className="text-lg font-serif font-bold text-white mb-2">{v.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{v.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* III. PÉDAGOGIE ANCESTRALE */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
              <span className="text-sm font-bold text-orange-400">III</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-white">
              La Pédagogie Ancestrale
            </h2>
          </div>
          <p className="text-sm text-orange-400 font-medium uppercase tracking-wider">Du Feu Sacré à la Connectivité Moderne</p>

          <div className="space-y-4 text-gray-300 text-base leading-relaxed">
            <p>
              Historiquement, la transmission des hauts savoirs n'a jamais été l\'apanage des parchemins, mais du <span className="text-white font-semibold">« moment vivant »</span>. Autour du feu ancestral, le Grand-père initiateur ne se contentait pas de réciter : il projetait une présence, un regard et une voix qui ouvraient des visions. Il s\'agissait d\'une <span className="text-[var(--school-accent)] font-semibold">contamination vibratoire</span>.
            </p>
            <p>
              L'ISNA réinvente ce principe à travers la technologie. La classe virtuelle devient le <span className="text-white font-semibold">« feu ancestral moderne »</span>, un espace où le direct génère un champ de connaissance actif.
            </p>
          </div>

          <div className="bg-gradient-to-br from-orange-500/10 to-[#192734] border border-orange-500/20 rounded-2xl p-6 md:p-8">
            <Flame className="w-8 h-8 text-orange-400 mb-4" />
            <p className="text-gray-300 leading-relaxed">
              Ce champ n'est pas mystique, mais phénoménologique : il crée une <span className="text-white font-semibold">empreinte invisible</span> qui circule entre l\'instructeur et l\'apprenant. Voir et entendre l\'instructeur en temps réel permet d\'entrer en relation avec la source vivante, activant une intégration que le support figé est incapable de susciter.
            </p>
          </div>
        </section>

        {/* IV. ANALOGIE DU SEUIL */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <span className="text-sm font-bold text-emerald-400">IV</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-white">
              L'Analogie du Seuil
            </h2>
          </div>
          <p className="text-sm text-emerald-400 font-medium uppercase tracking-wider">La Reconnaissance par le Champ</p>

          <p className="text-gray-300 text-base leading-relaxed">
            Pourquoi tant d'étudiants stagnent-ils malgré l\'accumulation de méthodes ? Parce qu\'ils tentent de forcer l\'entrée d\'un domaine dont ils restent des étrangers.
          </p>

          <div className="bg-[#192734] border border-emerald-500/20 rounded-2xl p-6 md:p-8 space-y-4">
            <h3 className="text-xl font-serif font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" /> L'Analogie du Chien Gardien
            </h3>
            <p className="text-gray-300 leading-relaxed">
              Imaginez une demeure protégée par un chien de garde. Si un étranger tente d'entrer seul, il est repoussé car il n\'est pas identifié par le lieu. En revanche, s\'il pénètre dans la maison <span className="text-white font-semibold">accompagné du Maître</span>, le chien l\'observe, l\'enregistre et le reconnaît.
            </p>
            <p className="text-gray-300 leading-relaxed">
              Dès lors, le champ de la maison a intégré son identité. L'étudiant peut désormais revenir seul : il est <span className="text-[var(--school-accent)] font-semibold">"enregistré" dans le domaine de la connaissance</span>.
            </p>
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4 mt-4">
              <p className="text-sm text-gray-400 italic">
                Le Maître, par sa présence en direct, sert de catalyseur : il "enregistre" l'élève dans le champ de l\'enseignement. Sans cette reconnaissance initiale, les livres et les vidéos ne sont que des clés inutilisables devant une porte close.
              </p>
            </div>
          </div>
        </section>

        {/* V. ARCHITECTURE BIPOLAIRE */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <span className="text-sm font-bold text-cyan-400">V</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-white">
              L'Architecture Bipolaire
            </h2>
          </div>
          <p className="text-sm text-cyan-400 font-medium uppercase tracking-wider">L'Équilibre entre Esprit et Âme</p>

          <p className="text-gray-300 text-base leading-relaxed">
            Pour garantir la maîtrise totale, l'ISNA déploie une structure opérationnelle en deux temps, distinguant la capture du savoir de son incubation profonde.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-gradient-to-br from-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] to-[#192734] border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] flex items-center justify-center">
                  <Monitor className="w-6 h-6 text-[var(--school-accent)]" />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-bold text-white">Le Direct</h3>
                  <p className="text-xs text-[var(--school-accent)]">Classe Virtuelle</p>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Brain className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="text-gray-400">Fonction : <span className="text-white">Imprégnation & Reconnaissance</span></span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Sparkles className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="text-gray-400">Cible : <span className="text-white">L'Esprit</span></span>
                </div>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed bg-white/[0.03] border border-white/5 rounded-xl p-3">
                Connexion au champ vivant de la connaissance à travers la présence directe de l'instructeur.
              </p>
            </div>

            <div className="bg-gradient-to-br from-violet-500/10 to-[#192734] border border-violet-500/20 rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <Library className="w-6 h-6 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-bold text-white">L'Étude</h3>
                  <p className="text-xs text-violet-400">Salle Numérique</p>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Brain className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="text-gray-400">Fonction : <span className="text-white">Assimilation & Cristallisation</span></span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Heart className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="text-gray-400">Cible : <span className="text-white">L'Âme</span></span>
                </div>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed bg-white/[0.03] border border-white/5 rounded-xl p-3">
                Habiter la connaissance en profondeur par la digestion et la cristallisation du savoir.
              </p>
            </div>
          </div>

          <div className="bg-[#192734] border-l-4 border-cyan-400 rounded-r-xl p-5">
            <p className="text-gray-300 leading-relaxed">
              <span className="text-white font-semibold">La Loi de Maturation est ici inflexible :</span> le direct ouvre la porte et sature l'Esprit par imprégnation, tandis que la salle numérique permet à l\'Âme de digérer et de cristalliser le savoir. Le replay <span className="text-cyan-400">réactive</span> le champ de connaissance pour la maturation, mais il ne peut en aucun cas le <span className="text-cyan-400">créer</span>.
            </p>
            <p className="text-[var(--school-accent)] font-semibold mt-3">
              Sans le direct, vous restez extérieur ; sans l'étude, vous restez immature.
            </p>
          </div>
        </section>

        {/* VI. LES 7 AXIOMES */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] flex items-center justify-center">
              <span className="text-sm font-bold text-[var(--school-accent)]">VI</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-white">
              Les Axiomes de la Réussite
            </h2>
          </div>
          <p className="text-sm text-[var(--school-accent)] font-medium uppercase tracking-wider">Manifeste de la Maîtrise Initiatique</p>

          <p className="text-gray-300 text-base leading-relaxed">
            La progression de l'apprenant à l\'ISNA, du statut d\'observateur à celui de participant reconnu, est régie par <span className="text-white font-semibold">sept axiomes doctrinaux</span> :
          </p>

          <div className="space-y-3">
            {axioms.map((a) => (
              <div key={a.number} className="bg-[#192734] border border-white/5 rounded-xl p-5 hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-all group">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-lg bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] flex items-center justify-center shrink-0 group-hover:bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] transition-all">
                    <span className="text-sm font-bold text-[var(--school-accent)]">{a.number}</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white mb-1">{a.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{a.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* VII. CONCLUSION */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
              <span className="text-sm font-bold text-rose-400">VII</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-white">
              Conclusion et Signatures Doctrinales
            </h2>
          </div>

          <p className="text-gray-300 text-base leading-relaxed">
            La transmission authentique à l'ISNA n\'est pas un transfert de fichiers, mais une <span className="text-white font-semibold">expérience de co-présence</span> qui aligne l\'attention et synchronise les états cognitifs. C\'est un <span className="text-[var(--school-accent)] font-semibold">acte de naissance dans un nouveau champ de conscience</span>.
          </p>

          <div className="space-y-4">
            <div className="bg-[#192734] border border-white/5 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-5 h-5 text-[var(--school-accent)]" />
                <h3 className="text-sm font-bold text-[var(--school-accent)] uppercase tracking-wider">Version Signature</h3>
              </div>
              <p className="text-lg text-white font-serif font-bold leading-relaxed">
                Le direct vous relie à la source. L'étude vous permet de l\'habiter.
              </p>
            </div>

            <div className="bg-[#192734] border border-white/5 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <GraduationCap className="w-5 h-5 text-violet-400" />
                <h3 className="text-sm font-bold text-violet-400 uppercase tracking-wider">Version Académique</h3>
              </div>
              <p className="text-gray-300 leading-relaxed">
                L'esprit humain apprend par présence. La classe virtuelle permet l\'intégration vivante de l\'enseignement, tandis que la salle numérique permet sa maturation et sa compréhension.
              </p>
            </div>
          </div>
        </section>

        {/* DÉCRET DU MANIKONGO */}
        <section className="bg-gradient-to-br from-[var(--school-accent)]/[0.08] to-transparent border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <Crown className="w-10 h-10 text-[var(--school-accent)] mx-auto mb-4" />
            <p className="text-xs text-[var(--school-accent)] uppercase tracking-[0.3em] font-bold mb-6">Décret du Manikongo</p>
            <blockquote className="text-2xl md:text-4xl font-serif font-bold text-white leading-tight mb-6">
              « On apprend par présence.<br />
              On comprend par maturation. »
            </blockquote>
            <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-[var(--school-accent)] to-transparent mx-auto mb-6" />
            <p className="text-gray-400 text-lg leading-relaxed max-w-xl mx-auto mb-8">
              Nous vous invitons à franchir le seuil et à rejoindre ce champ vivant. Le savoir n'attend plus d\'être observé, <span className="text-[var(--school-accent)] font-semibold">il attend d\'être vécu</span>.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/formations/catalogue">
                <Button className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 gap-2 h-12 px-8 text-lg font-bold">
                  <BookOpen className="w-5 h-5" /> Voir les formations
                </Button>
              </Link>
              <a href="/appointment/request">
                <Button variant="outline" className="border-white/20 hover:bg-white/5 text-white h-12 px-8 text-lg">
                  <MessageCircle className="w-5 h-5 mr-2" /> Prendre rendez-vous
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <div className="text-center py-4 border-t border-white/5">
          <p className="text-sm text-gray-600">
            © ISNA Prorascience — Doctrine Pédagogique Officielle — Système MK5 / NGOWAZULU
          </p>
        </div>
      </div>
    </div>
  );
};

export default DoctrinePedagogiquePage;
