import React from 'react';
import SEO from '@/components/SEO';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Brain, CheckCircle, Compass, Eye, Globe, Layers, Scale, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WEB_ABOUT } from '@/data/prorascienceVitrineFromWebContent';
import { activeTenantConfig as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';

const PUBLIC = isnaTenantConfig.branding.publicSiteOrigin;
const SCHOOL = isnaTenantConfig.branding.name;
const FOUNDER_IMAGE = '/founder.jpg';

const aboutMotion = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.55, ease: 'easeOut' },
};

const softMotion = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.3 },
  transition: { duration: 0.45, delay, ease: 'easeOut' },
});

function SectionTitle({ eyebrow, title, lead, align = 'center' }) {
  return (
    <motion.div className={`prs-about-section-title ${align === 'left' ? 'left' : ''}`} {...aboutMotion}>
      {eyebrow && <p className="prs-about-eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      {lead && <p>{lead}</p>}
    </motion.div>
  );
}

function GlassCard({ icon: Icon, title, children, delay = 0 }) {
  return (
    <motion.article className="prs-about-card" {...softMotion(delay)}>
      {Icon && <span className="prs-about-card-icon"><Icon size={18} /></span>}
      <h3>{title}</h3>
      <div className="prs-about-card-body">{children}</div>
    </motion.article>
  );
}

function AboutProrascience() {
  const a = WEB_ABOUT;
  const stats = (a.stats || []).slice(0, 5);
  const pillars = (a.pillars || []).slice(0, 3);
  const method = (a.methodPath || ['Comprendre', 'Pratiquer', 'Exercer', 'Évoluer']).slice(0, 4);
  const domains = (a.studyDomains || []).slice(0, 8);
  const values = (a.mission?.values || []).slice(0, 4);

  return (
    <main className="prs-about-page">
      <SEO
        title="À propos de la Prorascience"
        description="Découvrez la Prorascience, sa vision, sa méthode, ses piliers, ses domaines d’étude et le mandat porté par le 5ᵉ Manikongo."
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          name: `À propos — ${SCHOOL}`,
          description: 'Vision, méthode et fondements de la Prorascience.',
          url: `${PUBLIC}/a-propos`,
        }}
      />

      <style>{`
        .prs-about-page{min-height:100vh;background:#262624;color:#f4efe6;font-family:'Inter',system-ui,sans-serif;overflow:hidden;selection-background:rgba(217,119,87,.35)}
        .prs-about-page::before{content:'';position:fixed;inset:-20%;pointer-events:none;background:radial-gradient(circle at 22% 24%,rgba(217,119,87,.16),transparent 28%),radial-gradient(circle at 76% 10%,rgba(230,204,146,.10),transparent 28%),radial-gradient(circle at 62% 72%,rgba(230,204,146,.08),transparent 30%);filter:blur(8px);opacity:.9}
        .prs-about-wrap{position:relative;z-index:1;width:min(1180px,calc(100vw - 40px));margin:0 auto}.prs-about-serif{font-family:'Fraunces','Source Serif 4',Georgia,serif}.prs-about-display{font-family:'Bricolage Grotesque',system-ui,sans-serif}.prs-about-eyebrow{margin:0 0 15px;font:850 11px/1 'Bricolage Grotesque',system-ui,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#d97757}.prs-about-section-title{text-align:center;max-width:760px;margin:0 auto 44px}.prs-about-section-title.left{text-align:left;margin-left:0}.prs-about-section-title h2{margin:0;font-family:'Fraunces','Source Serif 4',Georgia,serif;font-size:clamp(34px,4.7vw,66px);line-height:1;letter-spacing:-.045em;font-weight:650;color:#f4efe6;text-wrap:balance}.prs-about-section-title p:not(.prs-about-eyebrow){margin:18px auto 0;color:rgba(244,239,230,.62);font-size:clamp(15px,1.6vw,18px);line-height:1.7;text-wrap:balance}.prs-about-section-title.left p:not(.prs-about-eyebrow){margin-left:0}
        .prs-about-hero{position:relative;min-height:100svh;display:flex;align-items:center;padding:120px 0 72px}.prs-about-hero-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(340px,430px);gap:70px;align-items:center}.prs-about-badge{display:inline-flex;align-items:center;gap:10px;border:1px solid rgba(230,204,146,.20);background:rgba(244,239,230,.045);border-radius:999px;padding:10px 15px;color:#e6cc92;font:750 12px/1 'Bricolage Grotesque',system-ui,sans-serif;letter-spacing:.08em}.prs-about-hero h1{margin:28px 0 0;font-family:'Fraunces','Source Serif 4',Georgia,serif;font-size:clamp(58px,8.3vw,118px);line-height:.88;letter-spacing:-.065em;font-weight:680;color:#fff;text-wrap:balance}.prs-about-hero h1 span{display:block;color:#e6cc92}.prs-about-hero-lead{max-width:660px;margin:30px 0 0;color:rgba(244,239,230,.72);font-size:clamp(18px,2vw,24px);line-height:1.52;text-wrap:balance}.prs-about-searchline{margin-top:38px;display:flex;flex-wrap:wrap;gap:10px}.prs-about-chip{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(230,204,146,.18);background:rgba(18,17,15,.28);border-radius:999px;padding:10px 14px;color:rgba(244,239,230,.78);font-size:13px;text-decoration:none}.prs-about-chip svg{color:#d97757}.prs-about-hero-panel{position:relative;border-radius:38px;min-height:560px;overflow:hidden;background:#080706;box-shadow:0 40px 120px rgba(0,0,0,.42);border:1px solid rgba(230,204,146,.12)}.prs-about-hero-panel img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 23%;filter:saturate(1.05) contrast(1.05)}.prs-about-hero-panel::after{content:'';position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.78),transparent 44%),radial-gradient(circle at 50% 18%,transparent 25%,rgba(0,0,0,.42) 100%)}.prs-about-founder-label{position:absolute;left:26px;right:26px;bottom:24px;z-index:1;border-top:1px solid rgba(244,239,230,.17);padding-top:18px}.prs-about-founder-label small{display:block;color:#d97757;font:850 10px/1 'Bricolage Grotesque',system-ui,sans-serif;letter-spacing:.22em;text-transform:uppercase;margin-bottom:9px}.prs-about-founder-label b{display:block;font-family:'Fraunces','Source Serif 4',Georgia,serif;font-size:24px;color:#fff}.prs-about-founder-label span{display:block;margin-top:4px;font-size:13px;color:rgba(244,239,230,.62)}
        .prs-about-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;padding:18px;border:1px solid rgba(244,239,230,.08);background:rgba(18,17,15,.26);border-radius:30px;backdrop-filter:blur(16px);box-shadow:0 24px 90px rgba(0,0,0,.20)}.prs-about-stat{padding:18px 14px;text-align:center;border-radius:22px;background:rgba(244,239,230,.035);border:1px solid rgba(244,239,230,.07)}.prs-about-stat b{display:block;color:#fff;font-size:clamp(22px,2.3vw,34px);letter-spacing:-.03em}.prs-about-stat span{display:block;margin-top:5px;color:rgba(244,239,230,.46);font-size:10px;font-weight:800;letter-spacing:.11em;text-transform:uppercase}
        .prs-about-section{position:relative;padding:110px 0}.prs-about-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:18px}.prs-about-grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.prs-about-grid-4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.prs-about-card{position:relative;border:1px solid rgba(244,239,230,.09);background:linear-gradient(145deg,rgba(244,239,230,.062),rgba(244,239,230,.022));border-radius:28px;padding:26px;box-shadow:0 24px 84px rgba(0,0,0,.16);min-height:100%}.prs-about-card-icon{width:42px;height:42px;display:flex;align-items:center;justify-content:center;border-radius:16px;background:rgba(230,204,146,.08);border:1px solid rgba(230,204,146,.18);color:#e6cc92;margin-bottom:18px}.prs-about-card h3{margin:0 0 12px;font-family:'Fraunces','Source Serif 4',Georgia,serif;font-size:24px;line-height:1.08;color:#fff}.prs-about-card-body{font-size:14.5px;line-height:1.7;color:rgba(244,239,230,.64)}.prs-about-card-body ul{margin:0;padding:0;list-style:none;display:grid;gap:10px}.prs-about-card-body li{display:flex;gap:10px}.prs-about-card-body li::before{content:'';width:7px;height:7px;border-radius:999px;background:#d97757;box-shadow:0 0 0 5px rgba(217,119,87,.12);margin-top:.65em;flex:0 0 auto}
        .prs-about-definition{position:relative;border-radius:38px;padding:42px;border:1px solid rgba(230,204,146,.14);background:linear-gradient(145deg,rgba(230,204,146,.075),rgba(244,239,230,.025));box-shadow:0 32px 100px rgba(0,0,0,.22)}.prs-about-definition p{margin:0;font-family:'Fraunces','Source Serif 4',Georgia,serif;font-size:clamp(28px,3.7vw,54px);line-height:1.12;letter-spacing:-.04em;color:#fff;text-wrap:balance}.prs-about-definition p strong{color:#e6cc92;font-weight:700}.prs-about-method{position:relative;display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid rgba(244,239,230,.10);border-radius:34px;overflow:hidden;background:rgba(18,17,15,.25)}.prs-about-method-step{min-height:220px;padding:26px;border-right:1px solid rgba(244,239,230,.08);display:flex;flex-direction:column;justify-content:space-between}.prs-about-method-step:last-child{border-right:none}.prs-about-method-step small{color:#d97757;font:850 11px/1 'Bricolage Grotesque',system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase}.prs-about-method-step b{font-family:'Fraunces','Source Serif 4',Georgia,serif;font-size:clamp(28px,3vw,42px);font-weight:650;color:#fff;line-height:1}.prs-about-method-step span{color:rgba(244,239,230,.54);font-size:13px;line-height:1.55}.prs-about-domain{padding:20px;border-radius:22px;border:1px solid rgba(244,239,230,.08);background:rgba(244,239,230,.035)}.prs-about-domain b{display:block;color:#fff;margin-bottom:8px;font-size:15px}.prs-about-domain span{display:block;color:rgba(244,239,230,.52);font-size:12.8px;line-height:1.55}
        .prs-about-founder{display:grid;grid-template-columns:minmax(360px,480px) 1fr;gap:60px;align-items:center}.prs-about-founder-photo{position:relative;min-height:620px;border-radius:40px;overflow:hidden;background:#070605;box-shadow:0 40px 120px rgba(0,0,0,.42)}.prs-about-founder-photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 22%}.prs-about-founder-photo::after{content:'';position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.7),transparent 45%),radial-gradient(circle at 50% 20%,transparent 25%,rgba(0,0,0,.35) 100%)}.prs-about-founder-copy blockquote{position:relative;margin:28px 0;padding-left:24px;font-family:'Fraunces','Source Serif 4',Georgia,serif;font-size:clamp(26px,3.3vw,48px);line-height:1.12;color:#fff;text-wrap:balance}.prs-about-founder-copy blockquote::before{content:'';position:absolute;left:0;top:.12em;bottom:.16em;width:3px;border-radius:999px;background:linear-gradient(#e6cc92,#d97757)}.prs-about-founder-copy p{color:rgba(244,239,230,.66);line-height:1.75;font-size:16px;max-width:680px}.prs-about-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}.prs-about-actions a{text-decoration:none}
        .prs-about-cta{padding:90px 0 110px;text-align:center}.prs-about-cta-box{border-radius:42px;padding:54px 28px;border:1px solid rgba(230,204,146,.15);background:linear-gradient(145deg,rgba(217,119,87,.12),rgba(230,204,146,.06),rgba(244,239,230,.025));box-shadow:0 36px 120px rgba(0,0,0,.25)}.prs-about-cta h2{margin:0;font-family:'Fraunces','Source Serif 4',Georgia,serif;font-size:clamp(36px,5vw,72px);line-height:.98;letter-spacing:-.05em;color:#fff}.prs-about-cta p{max-width:640px;margin:20px auto 0;color:rgba(244,239,230,.66);line-height:1.7}
        @media(max-width:980px){.prs-about-hero-grid,.prs-about-founder{grid-template-columns:1fr;gap:34px}.prs-about-hero{padding-top:100px}.prs-about-hero-panel{min-height:520px;max-width:520px;margin:0 auto;width:100%}.prs-about-stats{grid-template-columns:repeat(2,1fr)}.prs-about-grid-2,.prs-about-grid-3,.prs-about-grid-4{grid-template-columns:1fr}.prs-about-method{grid-template-columns:1fr}.prs-about-method-step{min-height:150px;border-right:none;border-bottom:1px solid rgba(244,239,230,.08)}.prs-about-method-step:last-child{border-bottom:none}.prs-about-founder-photo{min-height:520px}}
        @media(max-width:560px){.prs-about-wrap{width:calc(100vw - 32px)}.prs-about-hero h1{font-size:clamp(48px,15vw,72px)}.prs-about-hero-lead{font-size:17px}.prs-about-hero-panel{min-height:430px;border-radius:30px}.prs-about-stats{grid-template-columns:1fr 1fr;border-radius:22px;padding:10px}.prs-about-section{padding:78px 0}.prs-about-definition{padding:28px;border-radius:28px}.prs-about-definition p{font-size:30px}.prs-about-card{border-radius:23px;padding:22px}.prs-about-founder-photo{min-height:430px;border-radius:30px}.prs-about-founder-copy blockquote{font-size:30px}.prs-about-actions .inline-flex{width:100%;justify-content:center}.prs-about-cta-box{border-radius:30px;padding:38px 20px}}
      `}</style>

      <section className="prs-about-hero">
        <div className="prs-about-wrap prs-about-hero-grid">
          <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, ease: 'easeOut' }}>
            <span className="prs-about-badge"><Sparkles size={15} /> À propos de Prorascience</span>
            <h1>Comprendre avant <span>de pratiquer.</span></h1>
            <p className="prs-about-hero-lead">
              La Prorascience n’est pas une vitrine statique. C’est une école de lecture, de méthode et de transformation : elle aide l’étudiant à passer du geste répété à la connaissance maîtrisée.
            </p>
            <div className="prs-about-searchline" aria-label="Accès rapides">
              <Link className="prs-about-chip" to="/"><Compass size={15} /> Demander à l’agent</Link>
              <Link className="prs-about-chip" to="/formations/catalogue"><BookOpen size={15} /> Voir les parcours</Link>
              <a className="prs-about-chip" href="#parcours-prorascience"><Users size={15} /> Comprendre le parcours</a>
            </div>
          </motion.div>

          <motion.figure className="prs-about-hero-panel" initial={{ opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .85, ease: 'easeOut', delay: .1 }}>
            <img src={FOUNDER_IMAGE} alt="Badika Jel David, 5e Manikongo, fondateur de la Prorascience" />
            <figcaption className="prs-about-founder-label">
              <small>Transmission incarnée</small>
              <b>Badika Jel David</b>
              <span>Le 5ᵉ Manikongo — Recteur de l’ISNA</span>
            </figcaption>
          </motion.figure>
        </div>
      </section>

      <div className="prs-about-wrap">
        <motion.div className="prs-about-stats" {...aboutMotion}>
          {stats.map((s) => <div key={s.label} className="prs-about-stat"><b>{s.value}</b><span>{s.label}</span></div>)}
        </motion.div>
      </div>

      <section className="prs-about-section">
        <div className="prs-about-wrap">
          <SectionTitle eyebrow="Définition" title="Ce qu’est la Prorascience" lead={a.whatIs?.lead || 'Une méthode de compréhension des réalités visibles et invisibles, structurée pour apprendre, pratiquer et évoluer.'} />
          <motion.div className="prs-about-definition" {...aboutMotion}>
            <p><strong>La Prorascience</strong> unit la rigueur de la pensée, l’étude des lois invisibles et l’héritage des savoirs africains pour rendre la pratique intelligible.</p>
          </motion.div>
        </div>
      </section>

      <section className="prs-about-section">
        <div className="prs-about-wrap">
          <SectionTitle eyebrow="Pourquoi" title="Le problème n’est pas seulement l’accès au savoir" lead="Le vrai enjeu est de comprendre ce que l’on fait, pourquoi on le fait, et comment avancer sans dogmatisme." />
          <div className="prs-about-grid-2">
            <GlassCard icon={Brain} title="On pratique, mais sans carte" delay={0.02}>
              <ul>{(a.practiceItems || []).slice(0, 5).map((x) => <li key={x}>{x}</li>)}</ul>
            </GlassCard>
            <GlassCard icon={Eye} title="La question devient plus profonde" delay={0.08}>
              <ul>{(a.rootQuestions || []).slice(0, 5).map((x) => <li key={x}>{x}</li>)}</ul>
            </GlassCard>
          </div>
        </div>
      </section>

      <section className="prs-about-section">
        <div className="prs-about-wrap">
          <SectionTitle eyebrow="Piliers" title="Trois appuis, une seule cohérence" />
          <div className="prs-about-grid-3">
            {pillars.map((p, i) => (
              <GlassCard key={p.title} icon={[Scale, Layers, Globe][i] || Layers} title={p.title} delay={i * .06}>
                <ul>{(p.points || []).slice(0, 4).map((x) => <li key={x}>{x}</li>)}</ul>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      <section className="prs-about-section" id="parcours-prorascience">
        <div className="prs-about-wrap">
          <SectionTitle eyebrow="Méthode" title="Le chemin d’apprentissage" lead="L’étudiant ne saute pas directement vers la pratique. Il traverse une progression lisible, étape par étape." />
          <motion.div className="prs-about-method" {...aboutMotion}>
            {method.map((m, i) => (
              <div key={m} className="prs-about-method-step">
                <small>{String(i + 1).padStart(2, '0')}</small>
                <b>{m}</b>
                <span>{['Donner du sens avant le geste.', 'Transformer la théorie en expérience.', 'Mettre en situation et affiner.', 'Mesurer, corriger, approfondir.'][i] || 'Avancer avec méthode.'}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="prs-about-section">
        <div className="prs-about-wrap prs-about-founder">
          <motion.figure className="prs-about-founder-photo" {...aboutMotion}>
            <img src={FOUNDER_IMAGE} alt="Badika Jel David, fondateur de Prorascience" />
          </motion.figure>
          <motion.div className="prs-about-founder-copy" {...aboutMotion}>
            <p className="prs-about-eyebrow">Le fondateur</p>
            <h2 className="prs-about-serif" style={{ fontSize: 'clamp(42px,5vw,78px)', lineHeight: .95, letterSpacing: '-.055em', margin: 0, color: '#fff' }}>Le 5ᵉ Manikongo</h2>
            <p style={{ color: '#e6cc92', fontWeight: 700, marginTop: 14 }}>Badika Jel David — Recteur de l’ISNA</p>
            <blockquote>Une école n’est pas seulement un lieu où l’on reçoit des contenus : c’est un lieu où la connaissance reprend corps.</blockquote>
            <p>
              La vision portée ici cherche à restaurer la dignité intellectuelle et spirituelle par la connaissance : unir la rigueur d’une école, la profondeur d’un temple, et la clarté d’un parcours transmissible.
            </p>
            <div className="prs-about-actions">
              <Link to="/a-propos/fondateur"><Button className="bg-[#d97757] text-[#24140f] hover:bg-[#e58a68]">Lire le parcours complet <ArrowRight size={16} /></Button></Link>
              <Link to="/"><Button variant="outline" className="border-[#e6cc92]/40 text-[#e6cc92] hover:bg-[#e6cc92]/10">Demander à l’agent</Button></Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="prs-about-section">
        <div className="prs-about-wrap">
          <SectionTitle eyebrow="Domaines" title="Ce que la Prorascience étudie" lead="Les domaines ne sont pas des vitrines séparées : ils forment une carte de navigation pour comprendre le réel, l’humain, la communauté et l’invisible." />
          <div className="prs-about-grid-4">
            {domains.map((d) => (
              <motion.div key={d.title} className="prs-about-domain" {...softMotion(0)}>
                <b>{d.title}</b>
                <span>{d.definition || d.study || d.application}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {values.length > 0 && (
        <section className="prs-about-section">
          <div className="prs-about-wrap">
            <SectionTitle eyebrow="Mission" title={a.mission?.title || 'Notre mission'} lead={a.mission?.lead} />
            <div className="prs-about-grid-4">
              {values.map((v, i) => <GlassCard key={v.title} icon={[CheckCircle, Users, Scale, Sparkles][i] || CheckCircle} title={v.title} delay={i * .05}>{v.desc}</GlassCard>)}
            </div>
          </div>
        </section>
      )}

      <section className="prs-about-cta">
        <div className="prs-about-wrap">
          <motion.div className="prs-about-cta-box" {...aboutMotion}>
            <h2>Vous n’avez pas besoin de tout parcourir seul.</h2>
            <p>Posez une question à l’agent, demandez une visite, ou choisissez directement le parcours qui correspond à votre niveau d’accompagnement.</p>
            <div className="prs-about-actions" style={{ justifyContent: 'center' }}>
              <Link to="/"><Button className="bg-[#d97757] text-[#24140f] hover:bg-[#e58a68]">Ouvrir le moteur intelligent <ArrowRight size={16} /></Button></Link>
              <Link to="/formations/catalogue"><Button variant="outline" className="border-[#e6cc92]/40 text-[#e6cc92] hover:bg-[#e6cc92]/10">Voir les formations</Button></Link>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}

export default AboutProrascience;
