import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import CimolaceMarketingNav from '@/components/cimolace/CimolaceMarketingNav';
import { OS_LIST } from '@/data/cimolaceOsData';
import { cimolacePlatformConfig } from '@/tenants/cimolace/cimolacePlatform.config';
import '@/styles/cimolaceOs.css';

const HOME_PATH = cimolacePlatformConfig.routes.home;

const CAPABILITY_CARDS = [
  {
    emoji: '🎥',
    title: 'Live immersif',
    body: 'Diffusez des sessions niveau broadcast avec captation HD, scénographie multi-caméras, traduction temps réel.',
  },
  {
    emoji: '🛒',
    title: 'Vente en ligne',
    body: 'Catalogue produits, services, abonnements et formations. Paiements Stripe, relances automatiques, factures.',
  },
  {
    emoji: '📚',
    title: 'Cours et formations',
    body: 'Modules, parcours scolaires, suivi élève, quiz, flashcards. La pédagogie complète, structurée, mesurée.',
  },
  {
    emoji: '📋',
    title: 'CRM intégré',
    body: 'Une seule fiche par client : achats, RDV, programmes, messages. La vue 360° sans effort.',
  },
  {
    emoji: '📈',
    title: 'Marketing automatique',
    body: 'Pubs IA multi-plateformes, emails segmentés, relances intelligentes. L\'acquisition pilotée par la donnée.',
  },
  {
    emoji: '⚡',
    title: 'Automatisation',
    body: 'Workflows entre vos modules : un achat déclenche un email, un RDV crée une tâche. Vous configurez, ça tourne.',
  },
];

const CHAOS_CARDS = [
  { name: 'Zoom', role: 'Live & visio' },
  { name: 'Shopify', role: 'E-commerce' },
  { name: 'Kajabi', role: 'Cours en ligne' },
  { name: 'Notion', role: 'Documents' },
  { name: 'Stripe', role: 'Paiements' },
  { name: 'Calendly', role: 'Rendez-vous' },
  { name: 'Mailchimp', role: 'Email' },
  { name: '+ ?', role: '…et plus encore' },
];

export default function CimolaceLandingCatalog() {
  const [scrolled, setScrolled] = useState(false);
  const { routes, marketingSiteDisplay, contactEmail } = cimolacePlatformConfig;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) e.target.classList.add('visible');
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <>
      <Helmet>
        <title>CIMOLACE OS — Activez la plateforme adaptée à votre activité</title>
        <meta
          name="description"
          content="CIMOLACE déploie des plateformes complètes : Temple, École, Commerce, Créateur, Business, Media. Une seule infrastructure. Tous vos besoins."
        />
        <meta name="theme-color" content="#ffffff" />
      </Helmet>

      <div
        className="cimolace-catalog-root"
        style={{ fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", Arial, sans-serif', background: '#fff', color: '#0a0a0f', overflowX: 'hidden' }}
      >
        <CimolaceMarketingNav scrolled={scrolled} homePath={HOME_PATH} />

        <div
          className="catalog-switcher"
          style={{
            marginTop: 60,
            padding: '10px 24px',
            textAlign: 'center',
            fontSize: 13,
            background: 'var(--bg-soft, #fafafa)',
            borderBottom: '1px solid var(--line, #e5e5ea)',
            color: 'var(--ink-soft, #424245)',
          }}
        >
          Site officiel (vitrine HTML) —{' '}
          <Link to={routes.landingImmersive} style={{ color: 'var(--accent, #5b3df5)', fontWeight: 600 }}>
            Voir aussi la vitrine immersive
          </Link>
        </div>

        <section className="hero" id="home">
          <div className="hero-eyebrow">
            <span className="dot" />
            Plateforme · Multi-tenant · Multi-OS
          </div>
          <h1 className="hero-title">
            CIMOLACE <span className="gradient">OS</span>
          </h1>
          <p className="hero-tagline">
            Activez la plateforme digitale adaptée à votre activité. Une seule infrastructure pour vos cours, vos lives, vos ventes, vos
            communautés.
          </p>
          <div className="hero-cta">
            <Link className="btn btn-primary" to={routes.installer}>
              <span>Créer ma plateforme</span>
              <span>→</span>
            </Link>
            <a className="btn btn-ghost" href={`${HOME_PATH}#os`}>
              Voir les solutions
            </a>
          </div>
          <div className="hero-visual">
            <div className="hero-visual-row">
              {['Zoom', 'Shopify', 'Kajabi', 'Notion', 'Stripe', 'Calendly', 'Mailchimp', 'Anki'].map(name => (
                <span key={name} className="logo-chip">
                  {name}
                </span>
              ))}
            </div>
            <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginTop: 18 }}>
              ↓ Aujourd&apos;hui c&apos;est ça. Et demain ?
            </p>
          </div>
        </section>

        <section className="problem-section reveal">
          <div className="container">
            <span className="section-eyebrow">Le constat</span>
            <h2 className="section-title">Aujourd&apos;hui, créer une plateforme demande trop d&apos;outils.</h2>
            <p className="section-lead">
              Zoom, Shopify, Kajabi, Notion, Stripe, Calendly, Mailchimp… Tout est séparé. Vous payez 8 abonnements, vous administrez 8
              interfaces, et vos données ne se parlent pas.
            </p>
            <div className="chaos-grid">
              {CHAOS_CARDS.map(c => (
                <div key={c.name} className="chaos-card">
                  <div className="chaos-name">{c.name}</div>
                  <div className="chaos-role">{c.role}</div>
                </div>
              ))}
            </div>
            <div className="problem-points">
              <div className="problem-point">
                <div className="problem-point-num">8h</div>
                <div className="problem-point-label">de votre semaine perdues à jongler entre les outils.</div>
              </div>
              <div className="problem-point">
                <div className="problem-point-num">450€</div>
                <div className="problem-point-label">d&apos;abonnements mensuels cumulés en moyenne.</div>
              </div>
              <div className="problem-point">
                <div className="problem-point-num">0%</div>
                <div className="problem-point-label">de vos données réellement consolidées.</div>
              </div>
              <div className="problem-point">
                <div className="problem-point-num">∞</div>
                <div className="problem-point-label">de complexité technique à gérer pour vous.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="solution-section reveal">
          <div className="container">
            <span className="section-eyebrow">La solution</span>
            <h2 className="section-title">Une seule infrastructure. Tous vos besoins.</h2>
            <p className="section-lead">
              CIMOLACE assemble automatiquement les bons moteurs pour créer votre plateforme. Vous décrivez votre métier, CIMOLACE déploie
              l&apos;OS qui correspond.
            </p>
            <div className="infra-diagram">
              <div className="infra-stack">
                <div className="infra-layer os">
                  <div>
                    <div className="infra-layer-title">Votre OS CIMOLACE</div>
                    <div className="infra-layer-meta">Temple · School · Commerce · Creator · Business · Media…</div>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--accent-2)' }}>↑ vous voyez ça</div>
                </div>
                <div className="infra-arrow">↑</div>
                <div className="infra-layer">
                  <div>
                    <div className="infra-layer-title">6 moteurs spécialisés</div>
                    <div className="infra-layer-meta">Live · School · Commerce · Marketing · Studio · Admin</div>
                  </div>
                  <div className="infra-layer-meta">CIMOLACE assemble</div>
                </div>
                <div className="infra-arrow">↑</div>
                <div className="infra-layer">
                  <div>
                    <div className="infra-layer-title">Infrastructure technique</div>
                    <div className="infra-layer-meta">Supabase · LiveKit · Vercel · OpenAI · Stripe</div>
                  </div>
                  <div className="infra-layer-meta">on s&apos;en occupe</div>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: 32 }}>
                <Link
                  className="btn btn-ghost"
                  to={routes.architecture}
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'white', borderColor: 'rgba(255,255,255,0.15)' }}
                >
                  Voir l&apos;architecture détaillée →
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="reveal" id="os">
          <div className="container">
            <span className="section-eyebrow">Catalogue OS</span>
            <h2 className="section-title">Sept plateformes prêtes à l&apos;emploi. Une seule à choisir.</h2>
            <p className="section-lead">
              Chaque OS est une plateforme complète, pré-configurée pour un usage. Vous activez celui qui vous correspond. Vous démarrez en
              24h.
            </p>
            <div className="os-grid">
              {OS_LIST.map(os => (
                <Link key={os.id} className="os-card" style={{ '--c': os.colorHex }} to={`/cimolace/os/${os.id}`}>
                  <div className="os-icon">{os.icon}</div>
                  <div className="os-name">{os.name}</div>
                  <div className="os-tagline">{os.tagline}</div>
                  <ul className="os-uses">
                    {os.uses.map(u => (
                      <li key={u}>{u}</li>
                    ))}
                  </ul>
                  <div className="os-cta">Voir détails →</div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="config-section reveal" id="configurator">
          <div className="container-narrow">
            <span className="section-eyebrow">Vous hésitez ?</span>
            <h2 className="section-title">Laissez CIMOLACE choisir pour vous.</h2>
            <p className="section-lead">Trois questions. Une recommandation. Un déploiement.</p>
            <div className="config-mockup">
              <div className="config-step">
                <span className="config-step-num">QUESTION 1</span>
                <div className="config-step-q">Quel est votre métier principal ?</div>
                <div className="config-options">
                  <div className="config-opt">Enseignant</div>
                  <div className="config-opt">Coach / consultant</div>
                  <div className="config-opt active">Créateur de contenu</div>
                  <div className="config-opt">Communauté spirituelle</div>
                  <div className="config-opt">Vendeur en ligne</div>
                  <div className="config-opt">Média</div>
                </div>
              </div>
              <div className="config-step">
                <span className="config-step-num">QUESTION 2</span>
                <div className="config-step-q">Combien de personnes touchez-vous chaque mois ?</div>
                <div className="config-options">
                  <div className="config-opt">&lt; 100</div>
                  <div className="config-opt active">100 – 1 000</div>
                  <div className="config-opt">1 000 – 10 000</div>
                  <div className="config-opt">10 000+</div>
                </div>
              </div>
              <div className="config-step">
                <span className="config-step-num">QUESTION 3</span>
                <div className="config-step-q">Que voulez-vous activer en priorité ?</div>
                <div className="config-options">
                  <div className="config-opt active">Production de contenu</div>
                  <div className="config-opt active">Vente en ligne</div>
                  <div className="config-opt">Live</div>
                  <div className="config-opt">Coaching 1-on-1</div>
                  <div className="config-opt">Communauté</div>
                </div>
              </div>
              <div className="config-result">
                <div>
                  <div className="config-result-label">Votre OS recommandé</div>
                  <div className="config-result-name">Creator OS</div>
                </div>
                <Link className="btn btn-primary" to="/cimolace/os/creator" style={{ background: 'var(--os-creator)' }}>
                  Activer →
                </Link>
              </div>
            </div>
            <Link className="btn btn-primary" to={routes.configurateur} style={{ background: 'var(--accent)', marginTop: 30 }}>
              Lancer le configurateur →
            </Link>
          </div>
        </section>

        <section className="reveal" id="how">
          <div className="container">
            <span className="section-eyebrow">Capacités</span>
            <h2 className="section-title">Ce que CIMOLACE permet, sans une ligne de code.</h2>
            <p className="section-lead">
              Six capacités fondamentales activables selon votre OS. Aucune installation. Aucun développement.
            </p>
            <div className="features-grid">
              {CAPABILITY_CARDS.map(f => (
                <div key={f.title} className="feature-card">
                  <div className="feature-emoji">{f.emoji}</div>
                  <div className="feature-title">{f.title}</div>
                  <div className="feature-body">{f.body}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pricing-section reveal" id="pricing">
          <div className="container">
            <span className="section-eyebrow">Tarification</span>
            <h2 className="section-title">Trois plans. Aucun outil caché.</h2>
            <p className="section-lead">
              Vous payez votre OS, pas une dizaine d&apos;abonnements éparpillés. Setup unique de 500€ pour le déploiement initial sur
              mesure.
            </p>
            <div className="pricing-grid">
              <div className="price-card">
                <div className="price-name">Starter</div>
                <div className="price-amount">
                  <span className="currency">€</span>150<span className="per">/mois</span>
                </div>
                <div className="price-tagline">Pour démarrer un OS, sans complexité.</div>
                <ul className="price-features">
                  <li>1 OS au choix</li>
                  <li>Jusqu&apos;à 100 utilisateurs/mois</li>
                  <li>Hébergement CIMOLACE</li>
                  <li>Support email</li>
                  <li>Mises à jour incluses</li>
                </ul>
                <Link className="price-cta" to={`${routes.contact}?intent=starter`}>
                  Démarrer en Starter
                </Link>
              </div>
              <div className="price-card featured">
                <div className="price-name">Pro</div>
                <div className="price-amount">
                  <span className="currency">€</span>200<span className="per">/mois</span>
                </div>
                <div className="price-tagline">Le plan recommandé pour la majorité des activités.</div>
                <ul className="price-features">
                  <li>1 OS au choix</li>
                  <li>Jusqu&apos;à 1 000 utilisateurs/mois</li>
                  <li>Hébergement CIMOLACE</li>
                  <li>Support prioritaire</li>
                  <li>Personnalisation marque</li>
                  <li>Connexion à 2 services tiers</li>
                </ul>
                <Link className="price-cta" to={`${routes.contact}?intent=pro`}>
                  Activer le plan Pro
                </Link>
              </div>
              <div className="price-card">
                <div className="price-name">Elite</div>
                <div className="price-amount">
                  <span className="currency">€</span>300<span className="per">/mois</span>
                </div>
                <div className="price-tagline">Volume, équipes, multi-OS, white-label.</div>
                <ul className="price-features">
                  <li>OS multiples</li>
                  <li>Utilisateurs illimités</li>
                  <li>Hébergement dédié + SLA</li>
                  <li>Support 24/7 + account manager</li>
                  <li>White-label complet</li>
                  <li>SSO + sécurité avancée</li>
                </ul>
                <Link className="price-cta" to={`${routes.contact}?intent=elite`}>
                  Parler à un conseiller
                </Link>
              </div>
            </div>
            <div className="setup-fee">
              Frais de déploiement initial : <strong>500€</strong> · facturé une seule fois · inclut configuration de votre OS, import de
              votre contenu existant, formation utilisateur.
            </div>
          </div>
        </section>

        <section className="reveal" id="hosting">
          <div className="container">
            <span className="section-eyebrow">Hébergement</span>
            <h2 className="section-title">Deux modes. Vous choisissez.</h2>
            <p className="section-lead">
              CIMOLACE peut être hébergé chez nous (zéro souci) ou installé sur votre infrastructure (souveraineté totale). Même produit,
              deux modes opératoires.
            </p>
            <div className="hosting-grid">
              <div className="host-card recommended">
                <span className="host-badge">⚡ HÉBERGÉ CIMOLACE · RECOMMANDÉ</span>
                <div className="host-name">Hébergé CIMOLACE</div>
                <div className="host-tagline">
                  Vous connectez votre domaine, on s&apos;occupe de tout. Mises à jour, sauvegardes, scalabilité, monitoring.
                </div>
                <ul className="host-points">
                  <li>Mise en route en 24h</li>
                  <li>Mises à jour automatiques</li>
                  <li>Sauvegardes quotidiennes</li>
                  <li>Scalabilité automatique selon le trafic</li>
                  <li>Conformité RGPD garantie</li>
                  <li>Support technique inclus</li>
                </ul>
              </div>
              <div className="host-card private">
                <span className="host-badge">🔒 INSTALLATION PRIVÉE</span>
                <div className="host-name">Installation privée</div>
                <div className="host-tagline">
                  CIMOLACE est déployé sur votre infrastructure (votre cloud, votre serveur). Souveraineté complète sur vos données.
                </div>
                <ul className="host-points">
                  <li>Déployable sur AWS, GCP, Azure ou serveur dédié</li>
                  <li>Vos données restent chez vous</li>
                  <li>Code source protégé (license commerciale)</li>
                  <li>Support installation et maintenance</li>
                  <li>Adapté aux institutions, écoles, ONG</li>
                  <li>Tarification sur devis</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="final-cta" id="contact">
          <div className="container-narrow">
            <span className="section-eyebrow">Passez à l&apos;action</span>
            <h2 className="section-title">Votre plateforme. Demain.</h2>
            <p className="section-lead">Deux options pour démarrer. Engagement nul tant que vous n&apos;avez pas validé.</p>
            <div className="hero-cta">
              <Link className="btn btn-primary" to={routes.installer}>
                <span>Créer ma plateforme</span>
                <span>→</span>
              </Link>
              <Link className="btn btn-ghost" to={`${routes.contact}?intent=demo`}>
                Demander une démo
              </Link>
            </div>
            <div className="keyphrase">
              <div className="keyphrase-text">
                CIMOLACE ne vend pas <span className="strike">des outils</span>.
                <br />
                CIMOLACE déploie <span className="accent">des plateformes complètes</span>.
              </div>
            </div>
          </div>
        </section>

        <footer className="footer">
          <div className="footer-inner">
            <div className="footer-grid">
              <div className="footer-brand-block">
                <div className="brand">
                  CIMOLACE<span className="brand-dot">.</span>
                </div>
                <div className="footer-tagline">
                  Une seule infrastructure. Tous vos besoins. CIMOLACE déploie des plateformes complètes.
                </div>
                <p style={{ marginTop: 16, fontSize: 12, opacity: 0.85, lineHeight: 1.5 }}>
                  Autre présentation :{' '}
                  <Link to={routes.landingImmersive} style={{ color: 'rgba(255,255,255,0.95)', textDecoration: 'underline' }}>
                    vitrine immersive (sombre)
                  </Link>
                </p>
              </div>
              <div className="footer-col">
                <div className="footer-col-title">Solutions</div>
                {OS_LIST.map(os => (
                  <Link key={os.id} to={`/cimolace/os/${os.id}`}>
                    {os.name}
                  </Link>
                ))}
              </div>
              <div className="footer-col">
                <div className="footer-col-title">Plateforme</div>
                <Link to={`${HOME_PATH}#how`}>Capacités</Link>
                <Link to={routes.architecture}>Architecture technique</Link>
                <Link to={`${HOME_PATH}#pricing`}>Tarifs</Link>
                <Link to={routes.hosting}>Hébergement</Link>
                <Link to={`${HOME_PATH}#configurator`}>Configurateur</Link>
              </div>
              <div className="footer-col">
                <div className="footer-col-title">Société</div>
                <Link to={`${routes.contact}?intent=demo`}>Demander une démo</Link>
                <Link to={routes.contact}>Contact</Link>
                <Link to={routes.resourcesDocs}>Documentation</Link>
              </div>
            </div>
            <div className="footer-bottom">
              <div>{cimolacePlatformConfig.copyrightLine}</div>
              <div>{marketingSiteDisplay}</div>
              <a href={`mailto:${contactEmail}`} style={{ color: 'inherit' }}>
                {contactEmail}
              </a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
