import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import {
  ArrowRight,
  CheckCircle,
  ExternalLink,
  Flame,
  Shield,
  Sparkles,
  ScrollText,
  Zap,
  Bell,
  Sword,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import {
  GAMMA_URL,
  galleryItems,
  rituals,
  packCore,
  guarantees,
  conditions,
  phases,
  activationSteps,
  valueTable,
} from '@/lib/boutiqueSacreeContent';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';

const BoutiquePage = () => {
  const navigate = useNavigate();
  const BUY_URL = import.meta?.env?.VITE_BOUTIQUE_BUY_URL;
  const shouldUseNativeBoutique =
    typeof window !== 'undefined' &&
    (Capacitor.isNativePlatform() ||
      (window.matchMedia?.('(max-width: 767px)').matches ?? window.innerWidth < 768));

  useEffect(() => {
    if (!shouldUseNativeBoutique) return;
    navigate(ELEVE_MOBILE.shop, { replace: true });
  }, [navigate, shouldUseNativeBoutique]);

  if (shouldUseNativeBoutique) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#0B0B0F] text-white">
        <div className="flex flex-col items-center gap-3 text-white/60">
          <LiriWordmark size="compact" className="text-[#D4AF37]/90" />
          <p className="text-[12px]">Ouverture de la Boutique Sacrée…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-20 font-sans pb-16">
      <Helmet>
        <title>Boutique | PRORASCIENCE</title>
        <meta name="description" content="Boutique Sacrée NGOWAZULU — Temple du Feu, de la Lumière et de la Purification Ancestrale" />
      </Helmet>

      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1528722828814-77b9b83aafb2?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0F1419] via-[#0F1419]/95 to-[#0F1419]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-16 md:py-20">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300">
              <Flame className="w-4 h-4 text-[#D4AF37]" />
              🕯️ BOUTIQUE SACRÉE NGOWAZULU
            </div>

            <h1 className="mt-6 text-4xl md:text-6xl font-serif font-bold leading-tight">
              Temple du Feu, de la Lumière et de la <span className="text-[#D4AF37]">Purification Ancestrale</span>
            </h1>

            <p className="mt-6 text-lg md:text-xl text-gray-300 italic leading-relaxed">
              « Tout être doit d'abord se laver de ses ombres avant d\'espérer briller. »
            </p>
            <p className="mt-2 text-sm text-gray-500">— 5ᵉ Manikongo</p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <a href="#pack" className="inline-flex">
                <Button className="bg-[#D4AF37] text-black hover:bg-[#bfa345] font-bold h-12 px-8">
                  Découvrir le Pack Sacré
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </a>

              <a href={GAMMA_URL} target="_blank" rel="noreferrer" className="inline-flex">
                <Button variant="outline" className="border-white/20 text-white hover:bg-white/5 h-12 px-8">
                  Voir la version Gamma
                  <ExternalLink className="ml-2 w-5 h-5" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7">
            <h2 className="text-3xl md:text-4xl font-serif font-bold">⚜️ Présentation Générale</h2>
            <div className="mt-6 space-y-5 text-gray-300 leading-relaxed">
              <p>
                La Boutique Sacrée NGOWAZULU n'est pas une boutique ordinaire. Elle est un sanctuaire spirituel où chaque objet possède une âme et une mission sacrée.
              </p>
              <p>
                Chaque article ici n'est pas un simple objet, mais un instrument rituel activé, consacré par le 5ᵉ Manikongo lui-même sous le sacerdoce du Génie Kimbangu.
              </p>
              <p>
                Ces produits ne s'achètent pas pour leur matière, mais pour leur mémoire spirituelle : chacun porte un champ d\'énergie vivant, connecté au Temple, conçu pour opérer un travail complet de purification, de déblocage et de restauration spirituelle sur une durée de trois mois.
              </p>
            </div>

            <div className="mt-8 rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 p-6">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-[#D4AF37] mt-0.5" />
                <div>
                  <div className="font-bold text-white">⚠️ Important</div>
                  <p className="mt-1 text-sm text-gray-200">
                    Aucun produit ne peut être vendu séparément. Leur efficacité réside dans l'harmonie de l\'ensemble, formant une trinité d\'action : Purifier – Éveiller – Restaurer.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-[#192734] border border-white/5 rounded-2xl p-8">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#D4AF37]" />
                🌟 Découvrez Nos Instruments Sacrés
              </h3>
              <p className="text-sm text-gray-400 mt-2">Diaporama des Produits du Temple Ngowazulu</p>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {galleryItems.map((name) => (
                  <div key={name} className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200">
                    {name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#0B0E11] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <h2 className="text-3xl md:text-4xl font-serif font-bold">🔥 Les Rituels Sacrés en Action</h2>
          <p className="text-gray-400 mt-3">Découvrez comment utiliser vos instruments spirituels.</p>

          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {rituals.map((r) => (
              <div key={r.title} className="bg-[#192734] border border-white/5 rounded-2xl p-8">
                <h3 className="text-lg font-bold text-white">{r.title}</h3>
                <p className="mt-3 text-sm text-gray-400 leading-relaxed">{r.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 text-sm text-gray-500">
            Chaque rituel est accompagné d'instructions détaillées lors de l\'activation du pack.
          </div>
        </div>
      </section>

      <section id="pack" className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7">
            <h2 className="text-3xl md:text-4xl font-serif font-bold">🌿 LE PACK COMPLET NGOWAZULU</h2>
            <p className="text-gray-400 mt-3">Travail Spirituel de 3 Mois</p>

            <div className="mt-6 grid gap-4">
              {packCore.map((item) => (
                <div key={item.number} className="bg-[#192734] border border-white/5 rounded-2xl p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 text-[#D4AF37] flex items-center justify-center font-bold">
                      {item.number}
                    </div>
                    <div className="flex-1">
                      <div className="text-lg font-bold text-white">{item.title}</div>
                      <div className="text-sm text-[#D4AF37]">{item.subtitle}</div>
                      <p className="mt-3 text-sm text-gray-400 leading-relaxed">{item.description}</p>
                      <div className="mt-4 text-sm text-gray-300">
                        <span className="text-gray-500">Action :</span> {item.action}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-gradient-to-br from-[#192734] to-[#0f1216] border border-white/10 rounded-3xl p-10">
              <div className="text-sm text-gray-400">Prix Unique</div>
              <div className="mt-2 text-4xl font-bold text-white">700 €</div>
              <div className="mt-2 text-sm text-gray-400">(activation incluse)</div>

              <div className="mt-8">
                <div className="text-sm font-bold text-white">✅ Ce qui est garanti :</div>
                <div className="mt-4 space-y-2">
                  {guarantees.map((g) => (
                    <div key={g} className="flex items-start gap-2 text-sm text-gray-300">
                      <CheckCircle className="w-4 h-4 text-[#D4AF37] mt-0.5" />
                      <span>{g}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-10">
                {BUY_URL ? (
                  <a href={BUY_URL} target="_blank" rel="noreferrer" className="inline-flex w-full">
                    <Button className="w-full bg-[#D4AF37] text-black hover:bg-[#bfa345] font-bold h-12">
                      Commander le Pack Complet Maintenant
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </a>
                ) : (
                  <Button className="w-full bg-[#D4AF37] text-black hover:bg-[#bfa345] font-bold h-12" disabled>
                    Commander le Pack Complet Maintenant
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                )}
                <div className="mt-4 text-sm text-gray-500">
                  🚚 Expédition rituelle sécurisée — chaque colis est préparé selon un protocole sacré.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-16">
        <h2 className="text-3xl md:text-4xl font-serif font-bold">📜 Détails des Instruments Sacrés</h2>
        <p className="text-gray-400 mt-3">
          Chaque objet possède une mémoire spirituelle et une fonction précise dans la trinité d'action.
        </p>

        <div className="mt-10 grid gap-6">
          <div className="bg-[#192734] border border-white/5 rounded-2xl p-10">
            <h3 className="text-2xl font-serif font-bold text-white">☀️ Huile BUMBALOWAH — L'Huile du Soleil Divin</h3>
            <p className="text-gray-300 mt-4 leading-relaxed">
              L'Huile BUMBALOWAH est bien plus qu\'une simple essence parfumée. Elle incarne la force du soleil divin, cette énergie primordiale qui anime toute vie et dissipe les ténèbres spirituelles.
            </p>
            <p className="text-gray-300 mt-4 leading-relaxed">
              En l'appliquant rituellement, vous réveillez votre propre soleil intérieur. Elle renforce votre rayonnement énergétique, vous rendant visible aux forces bénéfiques et invisible aux influences malveillantes.
            </p>
            <p className="text-gray-300 mt-4 leading-relaxed">
              Les fusils mystiques — ces attaques occultes qui percent l'aura — sont dissipés par sa protection solaire. La prospérité retrouve son chemin naturel vers vous.
            </p>
            <div className="mt-6 text-sm text-gray-400">
              <span className="text-gray-500">Action principale :</span> Réactivation du feu vital et protection solaire
            </div>
          </div>

          <div className="bg-[#192734] border border-white/5 rounded-2xl p-10">
            <h3 className="text-2xl font-serif font-bold text-white">🔥 Poudre MPEVELO — L'Exorcisme du Feu</h3>
            <p className="text-gray-300 mt-4 leading-relaxed">
              La poudre MPEVELO se consume dans le feu de charbon, créant une fumée purificatrice qui pénètre tous les plans d'existence.
            </p>
            <div className="mt-6 grid md:grid-cols-2 gap-6">
              <div className="bg-black/20 border border-white/10 rounded-2xl p-6">
                <div className="font-bold text-white">Dissolution des Présences</div>
                <p className="text-sm text-gray-400 mt-2">Elle brûle et dissout les présences indésirables qui s'accrochent à votre espace de vie ou à votre corps énergétique.</p>
              </div>
              <div className="bg-black/20 border border-white/10 rounded-2xl p-6">
                <div className="font-bold text-white">Déblocage Profond</div>
                <p className="text-sm text-gray-400 mt-2">Les blocages occultes et les influences négatives sont consumés dans le feu régénérateur de MPEVELO.</p>
              </div>
            </div>
            <div className="mt-6 text-sm text-gray-400 italic">
              « Le feu n'est pas destructeur, il est transformateur. Ce qui brûle dans MPEVELO ne disparaît pas : il se transmute en lumière pure. »
            </div>
            <div className="mt-6 text-sm text-gray-400">
              <span className="text-gray-500">Action principale :</span> Nettoyage des plans invisibles et dissolution des blocages énergétiques
            </div>
          </div>

          <div className="bg-[#192734] border border-white/5 rounded-2xl p-10">
            <h3 className="text-2xl font-serif font-bold text-white">⚡ Poudre du Tonnerre ZAZI — La Justice du Ciel</h3>
            <p className="text-gray-300 mt-4 leading-relaxed">
              La Poudre ZAZI porte en elle la puissance du tonnerre céleste. Elle intervient comme le marteau de la justice divine : renverse ce qui doit être renversé, neutralise les œuvres du mal dirigées, et libère votre propre tonnerre intérieur.
            </p>
            <div className="mt-6 grid md:grid-cols-2 gap-3 text-sm text-gray-300">
              {[
                'Rupture des pactes occultes et des malédictions héréditaires',
                'Neutralisation des attaques mystiques dirigées',
                "Restauration de l'autorité vibratoire personnelle",
                'Activation de la foudre protectrice intérieure',
              ].map((line) => (
                <div key={line} className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-[#D4AF37] mt-0.5" />
                  <span>{line}</span>
                </div>
              ))}
            </div>
            <p className="text-gray-300 mt-6 leading-relaxed">
              La Poudre ZAZI est conditionnée sous forme de petites boules sphériques (ovules/perles), chacune attachée avec un fil rouge, conçues pour être brûlées individuellement lors des rituels.
            </p>
            <p className="text-gray-300 mt-4 leading-relaxed">
              L'origine mystique réside dans les écailles de tonnerre : fragments énergétiques cristallisés récoltés lors de l\'impact direct de la foudre, collectés rituellement par le 5ᵉ Manikongo.
            </p>
            <div className="mt-6 text-sm text-gray-400">
              <span className="text-gray-500">Action principale :</span> Affirmation de l'autorité vibratoire et justice céleste
            </div>
          </div>

          <div className="bg-[#192734] border border-white/5 rounded-2xl p-10">
            <h3 className="text-2xl font-serif font-bold text-white">🕯️ Bougie IMBONGA — La Lampe Ancestrale</h3>
            <div className="mt-6 grid md:grid-cols-3 gap-6">
              {[
                {
                  title: 'Illumination Intérieure',
                  desc: "La flamme d'IMBONGA illumine les zones obscures de la conscience.",
                },
                {
                  title: 'Ouverture de la Clairvoyance',
                  desc: "Le voile entre les mondes s'amincit, permettant la vision claire des réalités spirituelles.",
                },
                {
                  title: 'Songes Prophétiques',
                  desc: "Allumée avant le sommeil, elle ouvre les portes des rêves prophétiques et des messages ancestraux.",
                },
              ].map((b) => (
                <div key={b.title} className="bg-black/20 border border-white/10 rounded-2xl p-6">
                  <div className="font-bold text-white">{b.title}</div>
                  <p className="text-sm text-gray-400 mt-2">{b.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-gray-300 mt-6 leading-relaxed">
              La Bougie IMBONGA est une lampe ancestrale : lors de vos prières, méditations ou rituels nocturnes, sa flamme devient un pont entre votre conscience et les plans supérieurs.
            </p>
            <div className="mt-6 text-sm text-gray-400">
              <span className="text-gray-500">Action principale :</span> Illumination spirituelle et guidance intérieure
            </div>
          </div>

          <div className="bg-[#192734] border border-white/5 rounded-2xl p-10">
            <h3 className="text-2xl font-serif font-bold text-white">🔔 Cloche Sacrée — L'Oreille des Esprits</h3>
            <p className="text-gray-300 mt-4 leading-relaxed">
              Son tintement n'est pas un simple bruit : c\'est une vibration codée. Chaque coup de cloche est une annonce, une invocation, un appel lancé vers les dimensions invisibles.
            </p>
            <div className="mt-6 grid md:grid-cols-2 gap-3 text-sm text-gray-300">
              {[
                "Ouverture de rituel — Signale le début d'une cérémonie sacrée",
                'Invocation — Appelle les présences bénéfiques à se manifester',
                'Purification sonore — Dissipe les énergies stagnantes par la vibration',
                "Clôture — Scelle l'espace sacré après un travail spirituel",
              ].map((line) => (
                <div key={line} className="flex items-start gap-2">
                  <Bell className="w-4 h-4 text-[#D4AF37] mt-0.5" />
                  <span>{line}</span>
                </div>
              ))}
            </div>
            <p className="text-gray-300 mt-6 italic leading-relaxed">
              « Le son de la cloche ne voyage pas seulement dans l'air. Il perce les plans et porte votre intention jusqu\'aux oreilles des puissances invisibles. »
            </p>
            <div className="mt-6 text-sm text-gray-400">
              <span className="text-gray-500">Action principale :</span> Activation de la communication céleste
            </div>
          </div>

          <div className="bg-[#192734] border border-white/5 rounded-2xl p-10">
            <h3 className="text-2xl font-serif font-bold text-white">🗡️ Séguelebélé — Le Tranchant de la Vérité</h3>
            <div className="mt-6 grid md:grid-cols-3 gap-6">
              {[
                { title: 'Identifier les Chaînes', desc: 'Reconnaître les liens karmiques et les pactes occultes qui entravent votre liberté spirituelle.' },
                { title: 'Trancher avec Autorité', desc: 'Coupe net ce qui doit être séparé, sans hésitation ni compromis.' },
                { title: 'Libération Totale', desc: "Une fois les chaînes brisées, l'âme retrouve sa souveraineté." },
              ].map((b) => (
                <div key={b.title} className="bg-black/20 border border-white/10 rounded-2xl p-6">
                  <div className="font-bold text-white">{b.title}</div>
                  <p className="text-sm text-gray-400 mt-2">{b.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-gray-300 mt-6 leading-relaxed">
              Chargé par le Manikongo, il coupe les chaînes occultes qui lient l'âme à des influences négatives, des pactes anciens ou des malédictions héréditaires.
            </p>
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-gray-300">
              ⚠️ Utilisation rituelle uniquement. Manipuler avec respect et intention claire. Son usage est guidé par les instructions transmises lors de l'activation du pack.
            </div>
            <div className="mt-6 text-sm text-gray-400">
              <span className="text-gray-500">Action principale :</span> Libération karmique et rupture des pactes invisibles
            </div>
          </div>

          <div className="bg-[#192734] border border-white/5 rounded-2xl p-10">
            <h3 className="text-2xl font-serif font-bold text-white">🧿 Saquet et Manadrome — Autel et Interprète des Esprits</h3>
            <div className="mt-6 grid md:grid-cols-2 gap-6">
              <div className="bg-black/20 border border-white/10 rounded-2xl p-6">
                <div className="font-bold text-white">Le Saquet : L'Instrument des Génies</div>
                <p className="text-sm text-gray-400 mt-2">
                  Instrument de percussion ancestral (calebasse, perles, manche en bois). Son son accompagne la divination et facilite la communication avec les Génies.
                </p>
              </div>
              <div className="bg-black/20 border border-white/10 rounded-2xl p-6">
                <div className="font-bold text-white">Le Manadrome : L'Ancre Spirituelle</div>
                <p className="text-sm text-gray-400 mt-2">
                  Stabilisateur énergétique : ancre les forces invoquées, crée un point focal, harmonise les vibrations et maintient l'équilibre du rite.
                </p>
              </div>
            </div>
            <div className="mt-6 grid md:grid-cols-4 gap-3 text-sm text-gray-300">
              {[
                'Question posée',
                'Consultation du Saquet',
                'Interprétation',
                'Action guidée',
              ].map((step) => (
                <div key={step} className="flex items-start gap-2 bg-black/20 border border-white/10 rounded-xl px-4 py-3">
                  <ScrollText className="w-4 h-4 text-[#D4AF37] mt-0.5" />
                  <span>{step}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 text-sm text-gray-400">
              <span className="text-gray-500">Action principale :</span> Harmonisation et ancrage des puissances spirituelles
            </div>
          </div>

          <div className="bg-[#192734] border border-white/5 rounded-2xl p-10">
            <h3 className="text-2xl font-serif font-bold text-white">💨 Poudre de Souhaits — La Langue du Pouvoir</h3>
            <p className="text-gray-300 mt-4 leading-relaxed">
              Outil de l'activation du verbe créateur. La parole devient force de manifestation : chargée, scellée et envoyée avec puissance.
            </p>
            <div className="mt-6 grid md:grid-cols-4 gap-6">
              {[
                { n: '01', t: 'Formulation Claire', d: 'Exprimez votre vœu avec précision, sans ambiguïté ni doute.' },
                { n: '02', t: 'Application de la Poudre', d: 'Une pincée sur la langue ou soufflée dans les quatre directions.' },
                { n: '03', t: 'Prononciation Sacrée', d: 'Le vœu est énoncé à voix haute, avec conviction et autorité.' },
                { n: '04', t: 'Scellement Mystique', d: 'La poudre scelle la parole et la transforme en commande spirituelle.' },
              ].map((b) => (
                <div key={b.n} className="bg-black/20 border border-white/10 rounded-2xl p-6">
                  <div className="text-xs text-[#D4AF37] font-bold">{b.n}</div>
                  <div className="font-bold text-white mt-1">{b.t}</div>
                  <p className="text-sm text-gray-400 mt-2">{b.d}</p>
                </div>
              ))}
            </div>
            <p className="text-gray-300 mt-6 italic leading-relaxed">
              « Vos mots deviennent décrets. Votre souffle devient pouvoir. Votre intention devient réalité manifestée. »
            </p>
            <div className="mt-6 text-sm text-gray-400">
              <span className="text-gray-500">Action principale :</span> Activation du verbe créateur et scellement des vœux mystiques
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#0B0E11] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <h2 className="text-3xl md:text-4xl font-serif font-bold">🔮 Un Rituel Complet d'Élévation</h2>
          <p className="text-gray-400 mt-3">
            Le pack forme une trinité d'actions énergétiques : Purifier — Éveiller — Restaurer.
          </p>

          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {[
              {
                title: '1. PURIFIER',
                description:
                  'Nettoyer le corps aurique, dissoudre les larves karmiques et éliminer les blocages énergétiques accumulés.',
              },
              {
                title: '2. ÉVEILLER',
                description:
                  'Réactiver le feu vital, rallumer le soleil intérieur et restaurer la conscience solaire de votre être.',
              },
              {
                title: '3. RESTAURER',
                description:
                  "Rétablir la chance, la prospérité et l'autorité spirituelle dans tous les domaines de votre existence.",
              },
            ].map((step) => (
              <div key={step.title} className="bg-[#192734] border border-white/5 rounded-2xl p-8">
                <div className="text-[#D4AF37] font-bold">{step.title}</div>
                <p className="mt-3 text-sm text-gray-400 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-white/10 bg-black/20 p-8">
            <div className="text-sm text-gray-300">
              🔗 Assistance Spirituelle Continue — durant ces trois mois, une assistance spirituelle silencieuse est supervisée par le 5ᵉ Manikongo lui-même.
            </div>
          </div>

          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {phases.map((p) => (
              <div key={p.title} className="bg-[#192734] border border-white/5 rounded-2xl p-8">
                <div className="text-[#D4AF37] font-bold">{p.title}</div>
                <div className="text-white font-bold mt-1">{p.subtitle}</div>
                <p className="mt-3 text-sm text-gray-400 leading-relaxed">{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7">
            <h2 className="text-3xl md:text-4xl font-serif font-bold">⚙️ Activation et Garantie</h2>
            <p className="text-gray-400 mt-3">
              L'activation n\'est pas une simple bénédiction : c\'est une imprégnation énergétique profonde.
            </p>

            <div className="mt-8 grid gap-4">
              {activationSteps.map((s) => (
                <div key={s.number} className="bg-[#192734] border border-white/5 rounded-2xl p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 text-[#D4AF37] flex items-center justify-center font-bold">
                      {s.number}
                    </div>
                    <div>
                      <div className="text-lg font-bold text-white">{s.title}</div>
                      <p className="mt-2 text-sm text-gray-400 leading-relaxed">{s.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-black/20 border border-white/10 rounded-3xl p-10">
              <div className="flex items-center gap-2 text-white font-bold">
                <Package className="w-5 h-5 text-[#D4AF37]" />
                Garanties Spirituelles
              </div>

              <div className="mt-6">
                <div className="text-sm font-bold text-white">✅ Ce qui est garanti :</div>
                <div className="mt-4 space-y-2">
                  {guarantees.map((g) => (
                    <div key={g} className="flex items-start gap-2 text-sm text-gray-300">
                      <CheckCircle className="w-4 h-4 text-[#D4AF37] mt-0.5" />
                      <span>{g}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8">
                <div className="text-sm font-bold text-white">⚠️ Conditions d'efficacité :</div>
                <div className="mt-4 space-y-2">
                  {conditions.map((c) => (
                    <div key={c} className="flex items-start gap-2 text-sm text-gray-300">
                      <Sword className="w-4 h-4 text-[#D4AF37] mt-0.5" />
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 text-sm text-gray-500">
                Important : tout achat partiel ou toute tentative de séparation annule l'équilibre du rituel et rompt le lien avec le Temple.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#0B0E11] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <h2 className="text-3xl md:text-4xl font-serif font-bold">📦 Contenu et Valeur du Pack</h2>
          <p className="text-gray-400 mt-3">
            9 instruments sacrés — 3 mois de travail — 700€ (activation et suivi inclus).
          </p>

          <div className="mt-10 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left">
              <thead className="bg-black/30">
                <tr className="text-sm text-gray-300">
                  <th className="p-4 font-bold">Élément</th>
                  <th className="p-4 font-bold">Fonction principale</th>
                  <th className="p-4 font-bold">Nature</th>
                </tr>
              </thead>
              <tbody>
                {valueTable.map((row) => (
                  <tr key={row.element} className="border-t border-white/10 text-sm text-gray-300">
                    <td className="p-4">{row.element}</td>
                    <td className="p-4 text-gray-400">{row.function}</td>
                    <td className="p-4 text-gray-400">{row.nature}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {[ 
              { title: '9', subtitle: 'Instruments Sacrés', text: "Formant une synergie spirituelle complète" },
              { title: '3', subtitle: 'Mois de Travail', text: 'Durée du processus de transformation' },
              { title: '700€', subtitle: 'Prix Unique', text: 'Activation et suivi spirituel inclus' },
            ].map((k) => (
              <div key={k.subtitle} className="bg-[#192734] border border-white/5 rounded-2xl p-8 text-center">
                <div className="text-4xl font-bold text-white">{k.title}</div>
                <div className="text-[#D4AF37] font-bold mt-2">{k.subtitle}</div>
                <div className="text-sm text-gray-400 mt-3">{k.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="bg-[#192734] border border-white/5 rounded-3xl p-10 md:p-14">
          <h2 className="text-3xl md:text-4xl font-serif font-bold">🕊️ Appel à l'Action</h2>
          <p className="text-gray-300 mt-4 italic">« Ce n'est pas un achat, c\'est une alliance. »</p>
          <p className="text-gray-400 mt-6 leading-relaxed max-w-3xl">
            Le moment est venu de franchir le seuil. Pendant trois mois, vous n'allez pas simplement utiliser des produits — vous allez traverser une initiation.
          </p>
          <div className="mt-8">
            {BUY_URL ? (
              <a href={BUY_URL} target="_blank" rel="noreferrer" className="inline-flex">
                <Button className="bg-[#D4AF37] text-black hover:bg-[#bfa345] font-bold h-12 px-8">
                  Commander le Pack Complet Maintenant
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </a>
            ) : (
              <Button className="bg-[#D4AF37] text-black hover:bg-[#bfa345] font-bold h-12 px-8" disabled>
                Commander le Pack Complet Maintenant
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            )}
          </div>
          <div className="mt-8 text-sm text-gray-500">
            « Que la lumière du Temple Ngowazulu guide vos pas. Que le feu sacré consume vos ombres. Que votre étoile brille à nouveau dans la nuit cosmique. » — Bénédiction du 5ᵉ Manikongo
          </div>
        </div>
      </section>
    </div>
  );
};

export default BoutiquePage;
