import React, { useState } from 'react';
import SEO from '@/components/SEO';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ngowazuluMentoratOffers } from '@/config/ngowazuluMentoratOffers';
import NgowazuluMentoratDetailDialog from '@/components/ngowazulu/NgowazuluMentoratDetailDialog';
import NgowazuluConfigFeesModal from '@/components/ngowazulu/NgowazuluConfigFeesModal';
import {
  ShieldCheck, Zap, Heart, Shield, Star,
  ArrowRight, MessageCircle, FileText, Eye,
  Activity, Target, Lock, BookOpen, Clock, Info
} from 'lucide-react';
import { WEB_MENTORAT } from '@/data/prorascienceVitrineFromWebContent';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const SubSection = ({ letter, title, children }) => (
  <div className="mb-10">
    <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10 text-red-400 text-sm font-bold border border-red-500/20">
        {letter}
      </span>
      {title}
    </h4>
    {children}
  </div>
);

const BulletItem = ({ children }) => (
  <li className="flex items-start gap-2.5 text-base text-gray-300 leading-relaxed">
    <span className="text-red-400 mt-0.5 shrink-0">▸</span>
    <span>{children}</span>
  </li>
);

const NumberedStep = ({ number, title, description }) => (
  <div className="flex gap-4 items-start">
    <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
      <span className="text-sm font-bold text-red-400">{number}</span>
    </div>
    <div>
      <p className="text-base font-semibold text-white">{title}</p>
      {description && <p className="text-sm text-gray-400 mt-0.5 leading-relaxed">{description}</p>}
    </div>
  </div>
);

const MentoringPage = () => {
  const m = WEB_MENTORAT;
  const [mentoratDetailOffer, setMentoratDetailOffer] = useState(null);
  const [configFeesModalOpen, setConfigFeesModalOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-20 pb-20">
      <SEO
        title="Mentorat Spirituel"
        description={`Service d'assistance spirituelle active et personnelle par le 5ᵉ Manikongo. Le Moniteur spirituel intervient pour vous — ${isnaTenantConfig.branding.fullName}.`}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: `Mentorat spirituel — ${isnaTenantConfig.branding.name}`,
          provider: {
            '@type': 'EducationalOrganization',
            name: isnaTenantConfig.branding.fullName,
            url: isnaTenantConfig.branding.publicSiteOrigin,
          },
          description: 'Service d\'assistance spirituelle active et personnelle.',
          url: `${isnaTenantConfig.branding.publicSiteOrigin}/accompagnement/mentorat`,
        }}
      />

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F1419] via-[#192734]/50 to-[#0F1419]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-[150px]" />

        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 text-red-400 text-xs font-bold uppercase tracking-widest border border-red-500/20">
            <ShieldCheck className="w-4 h-4" /> {m.hero.kicker}
          </span>
          <h1 className="text-4xl md:text-6xl font-serif font-bold text-white leading-tight">
            {m.hero.title.split(' ').length >= 2 ? (
              <>
                {m.hero.title.replace(/\s*Spirituel\s*$/i, '')}
                <br />
                <span className="text-red-400">Spirituel</span>
              </>
            ) : (
              m.hero.title
            )}
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Aussi appele <span className="text-red-300 font-semibold">Guardianship</span> ou{' '}
            <span className="text-red-300 font-semibold">Mandat de Veille</span> — {m.hero.lead}
          </p>
          <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent mx-auto" />
          <p className="text-sm text-gray-600 uppercase tracking-widest">{m.hero.line}</p>
        </div>
      </section>

      {/* ═══════════ DISTINCTION ═══════════ */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 space-y-16">
        
        <section className="bg-red-500/[0.03] border border-red-500/10 rounded-2xl p-8 md:p-10">
          <p className="text-center text-gray-300 text-lg leading-relaxed">
            {m.distinction}
          </p>
        </section>

        <div className="space-y-12 bg-[#141c27] rounded-3xl border border-red-500/10 p-6 md:p-10">

          {/* A. DEFINITION */}
          <SubSection letter="A" title="Definition du Montorat">
            <p className="text-sm text-gray-400 mb-4">{m.defineIntro}</p>
            <ul className="space-y-2.5">
              {m.defineBullets.map((t) => (
                <BulletItem key={t}>{t}</BulletItem>
              ))}
            </ul>
          </SubSection>

          {/* B. QUAND */}
          <SubSection letter="B" title={m.whenTitle}>
            <p className="text-sm text-gray-400 mb-4">{m.whenIntro}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {m.whenCases.map((item) => (
                <div key={item} className="flex items-start gap-2.5 text-sm text-gray-300 bg-red-500/[0.03] border border-red-500/10 rounded-lg p-3">
                  <Zap className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </SubSection>

          {/* C. CE QUE FAIT LE MONITEUR */}
          <SubSection letter="C" title={m.whatMonitorDoes.title}>
            <p className="text-sm text-gray-400 mb-5">{m.whatMonitorDoes.intro}</p>
            <ul className="space-y-2.5">
              {m.whatMonitorDoes.bullets.map((t) => (
                <BulletItem key={t}>{t}</BulletItem>
              ))}
            </ul>
          </SubSection>

          {/* D. TYPES DE MONTORAT */}
          <SubSection letter="D" title="Types de Montorat disponibles">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {m.typesMentorat.map((t, i) => {
                const style = [
                  { icon: Shield, borderColor: 'border-blue-500/15', bgColor: 'bg-blue-500/[0.04]', iconColor: 'text-blue-400' },
                  { icon: Heart, borderColor: 'border-emerald-500/15', bgColor: 'bg-emerald-500/[0.04]', iconColor: 'text-emerald-400' },
                  { icon: Star, borderColor: 'border-purple-500/15', bgColor: 'bg-purple-500/[0.04]', iconColor: 'text-purple-400' },
                ][i];
                const ItemIcon = style.icon;
                return (
                <div key={t.title} className={`${style.bgColor} border ${style.borderColor} rounded-xl p-5 text-center`}>
                  <ItemIcon className={`w-8 h-8 ${style.iconColor} mx-auto mb-3`} />
                  <h5 className="text-sm font-bold text-white mb-2">{t.title}</h5>
                  <p className="text-sm text-gray-400 leading-relaxed">{t.desc}</p>
                </div>
                );
              })}
            </div>
          </SubSection>

          {/* E. CONTRAT DE MONTORAT */}
          <SubSection letter="E" title="Le Contrat de Montorat">
            <p className="text-sm text-gray-400 mb-5">Tout Montorat est formalise par un Contrat Sacre comprenant :</p>
            <div className="space-y-4 bg-white/[0.02] rounded-xl border border-white/5 p-5">
              {m.contractSteps.map((step, i) => (
                <NumberedStep
                  key={step.title}
                  number={String(i + 1)}
                  title={step.title}
                  description={step.description}
                />
              ))}
            </div>
          </SubSection>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            CONTRAT DE MENTORAT ET D'INTERCESSION SPIRITUELLE
        ═══════════════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-center opacity-30 py-4">
          <div className="h-px bg-white w-full max-w-xs" />
          <span className="px-6 text-3xl text-red-400">⚜</span>
          <div className="h-px bg-white w-full max-w-xs" />
        </div>

        <div className="text-center mb-8">
          <span className="inline-block px-4 py-1.5 rounded-full bg-red-500/10 text-red-400 text-xs font-bold uppercase tracking-widest border border-red-500/20 mb-4">
            {m.contractHeader.kicker}
          </span>
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-white">
            {m.contractHeader.title}
          </h2>
          <p className="text-gray-500 mt-2 text-sm uppercase tracking-wider">
            {m.contractHeader.subtitle}
          </p>
        </div>

        <div className="space-y-12 bg-[#141c27] rounded-3xl border border-red-500/10 p-6 md:p-10">

          {/* 1. PREAMBULE */}
          <SubSection letter="1" title="Preambule et Distinction Fondamentale des Services">
            <p className="text-sm text-gray-300 leading-relaxed mb-5">
              L'efficacite d'une oeuvre metaphysique repose sur une architecture contractuelle rigoureuse, definissant avec precision le perimetre d'influence et la nature de l'engagement. Cette clarte garantit l'etancheite spirituelle necessaire a la reussite du deploiement des protocoles.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-yellow-500/[0.04] border border-yellow-500/15 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-5 h-5 text-yellow-400" />
                  <h5 className="text-sm font-bold text-yellow-300 uppercase tracking-wider">Coaching Spirituel</h5>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed mb-3">
                  <span className="text-yellow-300 font-semibold">Transmission de Savoir-Faire.</span> Volet strictement dedie a la formation des futurs praticiens.
                </p>
                <ul className="space-y-1.5">
                  <li className="text-sm text-gray-400 flex items-start gap-1.5"><span className="text-yellow-400 mt-0.5">▸</span>Transfert de technologie spirituelle</li>
                  <li className="text-sm text-gray-400 flex items-start gap-1.5"><span className="text-yellow-400 mt-0.5">▸</span>Apprentissage theorique et pratique</li>
                  <li className="text-sm text-gray-400 flex items-start gap-1.5"><span className="text-yellow-400 mt-0.5">▸</span>Ingenierie de diagnostic</li>
                  <li className="text-sm text-gray-400 flex items-start gap-1.5"><span className="text-yellow-400 mt-0.5">▸</span>Enseigne comment dresser l'autel et manipuler les reliques</li>
                </ul>
              </div>
              <div className="bg-red-500/[0.04] border border-red-500/15 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-5 h-5 text-red-400" />
                  <h5 className="text-sm font-bold text-red-300 uppercase tracking-wider">Mentorat</h5>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed mb-3">
                  <span className="text-red-300 font-semibold">Assistance, Protection et Intercession.</span> Solution d'ingenierie d'accompagnement direct.
                </p>
                <ul className="space-y-1.5">
                  <li className="text-sm text-gray-400 flex items-start gap-1.5"><span className="text-red-400 mt-0.5">▸</span>Client place sous bouclier actif</li>
                  <li className="text-sm text-gray-400 flex items-start gap-1.5"><span className="text-red-400 mt-0.5">▸</span>Defense, soutien et action rituelle immediate</li>
                  <li className="text-sm text-gray-400 flex items-start gap-1.5"><span className="text-red-400 mt-0.5">▸</span>Exploitation des outils par le Maitre d'Autel</li>
                  <li className="text-sm text-gray-400 flex items-start gap-1.5"><span className="text-red-400 mt-0.5">▸</span>Protection spirituelle active au benefice du protege</li>
                </ul>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <Target className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-white mb-1">Objectif du Mentorat</p>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {m.preambleObjective}
                  </p>
                </div>
              </div>
            </div>
          </SubSection>

          {/* 2. MISSIONS ET FONCTIONS */}
          <SubSection letter="2" title="Missions et Fonctions de l'Architecte d'Intercession Dedie">
            <p className="text-sm text-gray-300 leading-relaxed mb-5">
              Le Maitre d'Autel intervient en tant que garant de l'equilibre structurel du protege. Sa responsabilite est d'assurer une regulation constante des flux energetiques environnants, agissant comme un regulateur de haute precision.
            </p>

            <div className="space-y-4">
              <div className="bg-red-500/[0.03] border border-red-500/10 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="w-5 h-5 text-red-400" />
                  <h5 className="text-sm font-bold text-red-300">Le Role de l'Oeil Spirituel</h5>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Le Maitre d'Autel assure une vigilance metaphysique permanente. Cette fonction de "veilleur" permet d'identifier en temps reel les pressions et les oppressions avant qu'elles ne s'expriment dans la realite materielle. Il agit comme un garde-fou protocolaire contre toute intrusion malveillante dans le champ du client.
                </p>
              </div>

              <div className="bg-red-500/[0.03] border border-red-500/10 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-5 h-5 text-red-400" />
                  <h5 className="text-sm font-bold text-red-300">Intercession et Action Rituelle</h5>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Lorsque le client est sature par les epreuves ou manque de bande passante spirituelle pour maintenir ses propres frequences, l'Architecte d'Intercession Dedie prend le relais operationnel. Il execute les rites de defense et les prieres de haute intensite au nom du client, assurant une protection sans faille la ou les forces individuelles atteignent leurs limites de resistance.
                </p>
              </div>

              <div className="bg-red-500/[0.03] border border-red-500/10 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-5 h-5 text-red-400" />
                  <h5 className="text-sm font-bold text-red-300">La Fonction d'Intendant Majeur d'Autel</h5>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Au-dela du simple soutien, cette fonction de proximite valorise le role du Maitre d'Autel en tant qu'expert dedie a la fluidification du parcours de vie. Ce partenariat strategique permet de deleguer la gestion des risques spirituels a un expert, garantissant une presence constante et une reactivite rituelle immediate face aux aleas de l'existence.
                </p>
              </div>
            </div>
          </SubSection>

          {/* 3. DOMAINES D'INTERVENTION */}
          <SubSection letter="3" title="Domaines d'Intervention et Accompagnement lors d'Evenements Majeurs">
            <p className="text-sm text-gray-300 leading-relaxed mb-5">
              Les periodes de mutation ou de crise generent des vulnerabilites systemiques qui necessitent une couverture spirituelle renforcee pour prevenir toute rupture de l'integrite du destin.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                <h5 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-400" /> Soutien aux Epreuves de Vie
                </h5>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Securiser le socle ontologique d'une union lors d'un mariage, optimiser la clarte mentale pour des examens, stabiliser les dynamiques atmospheriques lors d'un deuil — l'encadrement par un mentor est un imperatif de securite.
                </p>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                <h5 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-red-400" /> Gestion des Situations de Crise
                </h5>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Le protocole de mentorat est active en urgence lorsque les vecteurs de destabilisation sont juges « au-dela des forces » du client. L'intervention du Maitre d'Autel permet de restaurer l'integrite structurelle de la destinee du beneficiaire.
                </p>
              </div>
            </div>

            {/* Tableau de synthese */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-red-500/20">
                    <th className="text-left py-3 px-4 text-red-300 font-bold text-xs uppercase tracking-wider">Evenement</th>
                    <th className="text-left py-3 px-4 text-red-300 font-bold text-xs uppercase tracking-wider">Objectif</th>
                    <th className="text-left py-3 px-4 text-red-300 font-bold text-xs uppercase tracking-wider">Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[
                    ['Examens / Concours', 'Neutralisation des interferences psychiques', 'Optimisation cognitive et succes probatoire'],
                    ['Mariage / Union', 'Securisation du socle ontologique du foyer', 'Perennite structurelle et harmonie conjugale'],
                    ['Periode de deuil', 'Stabilisation de la temperature atmospherique', 'Preservation de l\'integrite des vivants'],
                    ['Crise / Oppression', 'Ingenierie d\'exorcisme et defense active', 'Liberation de la trajectoire de vie'],
                  ].map(([event, obj, impact], i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 text-white font-semibold text-xs">{event}</td>
                      <td className="py-3 px-4 text-gray-400 text-xs">{obj}</td>
                      <td className="py-3 px-4 text-gray-400 text-xs">{impact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SubSection>

          {/* 4. ANALYTICS METAPHYSIQUES */}
          <SubSection letter="4" title="Analytics Metaphysiques et Pilotage du Suivi">
            <p className="text-sm text-gray-300 leading-relaxed mb-5">
              Une protection sur-mesure exige une analyse technique de haute precision. Si la transmission de ces outils appartient au Coaching, leur usage comme indicateurs de performance (KPIs) est au centre du Mentorat.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {[
                { icon: Eye, title: 'Etat de l\'aura', desc: 'Monitoring de l\'enveloppe energetique pour detecter d\'eventuelles fissures structurelles.' },
                { icon: Activity, title: 'Temperature atmospherique', desc: 'Mesure de la pression des energies environnantes et de leur qualite vibratoire.' },
                { icon: Target, title: 'Trajectoire du destin', desc: 'Analyse predictive des risques et des opportunites bases sur le flux actuel.' },
              ].map((item, i) => (
                <div key={i} className="bg-red-500/[0.03] border border-red-500/10 rounded-xl p-4 text-center">
                  <item.icon className="w-6 h-6 text-red-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-white mb-1">{item.title}</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 mb-4">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-white mb-1">Le Cahier de Charge Operationnel</p>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Chaque contrat integre le suivi d'un cahier de charge metaphysique incluant le theme astral, le poids karmique et le nuage de probabilites. Ces elements ne sont pas des objets d'etude pour le client, mais des outils de pilotage pour l'expert, permettant d'ajuster les rites de defense en fonction du passif metaphysique de l'individu.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-white mb-1">Infrastructure et Logistique Rituelle</p>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    La mise en oeuvre du contrat repose sur le deploiement d'une logistique specifique : activation de l'autel dedie au patient, utilisation de recipients consacres et de reliques. Cette rigueur garantit la tracabilite des actes et la securite globale de l'intervention, creant un environnement de protection hermetique.
                  </p>
                </div>
              </div>
            </div>
          </SubSection>

          {/* 5. MODALITES DE MISE EN OEUVRE */}
          <SubSection letter="5" title="Modalites de Mise en Oeuvre et Conditions d'Engagement">
            <p className="text-sm text-gray-300 leading-relaxed mb-5">
              Le mentorat est une structure d'assistance hybride, concue pour operer une transition vers la pleine autonomie du beneficiaire.
            </p>

            <div className="space-y-4">
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-white mb-1">Temporalite et Phase de Transfert</p>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      L'assistance est fournie pour une duree determinee. Le mentorat n'est pas une dependance, mais un processus de <span className="text-red-300 font-semibold">transfert de souverainete spirituelle</span>. A travers une "pratique observee", le mentor suit l'apprentissage du client, s'assurant que ce dernier integre les reflexes de protection necessaires avant le terme du contrat.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <Heart className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-white mb-1">Responsabilites Mutuelles</p>
                    <p className="text-sm text-gray-400 leading-relaxed mb-3">
                      L'Architecte d'Intercession s'engage a une obligation de moyens incluant la veille constante, l'action rituelle et l'intercession defensive. En contrepartie, le client s'engage a une <span className="text-red-300 font-semibold">transparence absolue</span> sur ses epreuves et son etat vibratoire, condition sine qua non pour l'ajustement chirurgical des protocoles.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-gradient-to-r from-red-500/[0.06] to-transparent border border-red-500/15 rounded-xl p-5">
              <p className="text-sm text-gray-300 leading-relaxed italic">
                « Ce contrat de mentorat constitue l'engagement solennel du Maitre d'Autel envers la restauration de la puissance et de l'integrite du beneficiaire, transformant les vulnerabilites passageres en un socle de protection inebranlable. »
              </p>
            </div>
          </SubSection>
        </div>

        {/* ═══════════ NGOWAZULU — tableau contrats (aligné page Services spirituels) ═══════════ */}
        <section className="rounded-3xl border border-red-500/15 bg-[#141c27] p-6 md:p-10">
          <h2 className="text-2xl font-serif font-bold text-white mb-2">Contrats NGOWAZULU (Temple)</h2>
          <p className="text-sm text-gray-400 mb-4 max-w-3xl">
            Même logique que sur la page Services spirituels : <span className="text-white">un mois</span> par contrat, vous choisissez la{' '}
            <span className="text-red-300">fréquence des rencontres</span>. Au <span className="text-white">premier achat</span>, des frais de configuration (100 EUR, uniques) sont ajoutés automatiquement — voir la modale d&apos;explication.
          </p>
          <div className="mb-6">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
              onClick={() => setConfigFeesModalOpen(true)}
            >
              <Info className="w-4 h-4 mr-2" />
              Frais de configuration au 1er achat
            </Button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm text-left min-w-[640px]">
              <thead>
                <tr className="border-b border-white/10 text-gray-500 uppercase text-[10px] tracking-wider">
                  <th className="px-4 py-3">Contrat commercial</th>
                  <th className="px-4 py-3">Fréquence</th>
                  <th className="px-4 py-3">Tarif / mois</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ngowazuluMentoratOffers.map((offer) => (
                  <tr key={offer.slug} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <span className="text-[#D4AF37] font-semibold">Mentorat {offer.commercialName}</span>
                      <div className="text-gray-500 text-xs">{offer.subtitle}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{offer.frequencyShort}</td>
                    <td className="px-4 py-3 text-white font-medium">{offer.priceLabel}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-gray-300 hover:text-white"
                        onClick={() => setMentoratDetailOffer(offer)}
                      >
                        <Info className="w-4 h-4 mr-1" /> Détails
                      </Button>
                      <a href={`/paiements/payer?plan=${encodeURIComponent(offer.slug)}&interval=monthly`} className="inline-block ml-2">
                        <Button size="sm" className="bg-red-600 text-white hover:bg-red-700">Payer</Button>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link to="/services-spirituels#ngowazulu" className="text-red-300 hover:text-red-200 underline">
              Page complète NGOWAZULU
            </Link>
          </div>
        </section>

        <NgowazuluConfigFeesModal open={configFeesModalOpen} onOpenChange={setConfigFeesModalOpen} />

        <NgowazuluMentoratDetailDialog
          offer={mentoratDetailOffer}
          open={Boolean(mentoratDetailOffer)}
          onOpenChange={(v) => {
            if (!v) setMentoratDetailOffer(null);
          }}
          onExplainConfigFees={() => setConfigFeesModalOpen(true)}
        />

        {/* ═══════════ CTA ═══════════ */}
        <section className="bg-gradient-to-br from-[#192734] to-[#0f1216] rounded-3xl p-10 md:p-16 text-center border border-white/10 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 max-w-2xl mx-auto space-y-8">
            <h2 className="text-3xl font-bold font-serif text-white">Beneficier d'un Montorat ?</h2>
            <p className="text-gray-300 text-lg">
              Le Montorat Spirituel est inclus dans le <span className="text-red-400 font-semibold">Cycle Privilegie (Mentorat)</span>. 
              Un Maitre d'Autel vous prend en charge et intervient activement pour votre protection et votre elevation.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/appointment/request">
                <Button className="bg-red-600 text-white hover:bg-red-700 gap-2 h-12 px-8 text-lg font-bold">
                  <MessageCircle className="w-5 h-5" /> Prendre rendez-vous
                </Button>
              </a>
              <Link to="/formations">
                <Button variant="outline" className="border-white/20 hover:bg-white/5 text-white h-12 px-8 text-lg">
                  Voir les forfaits <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center py-4 border-t border-white/5">
          <p className="text-sm text-gray-600">
            {`© ${isnaTenantConfig.branding.name} — Document de référence officiel du système MK5 / NGOWAZULU`}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MentoringPage;