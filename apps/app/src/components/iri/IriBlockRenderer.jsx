/**
 * Renderer IRI universel — un seul composant lit `type` + `config` pour tous
 * les blocks d'une page. Aucune logique tenant ici.
 *
 * Types initiaux supportés : text, hero, button, image, video, columns, faq,
 * offer, live. Un type inconnu est rendu en placeholder discret (debug only)
 * en dev, masqué en prod.
 *
 * Convention : tous les blocks reçoivent `{ block, children }`. Les blocks
 * conteneurs (columns) reçoivent leurs enfants dans `children` (déjà ordonnés
 * par position depuis le serveur).
 */

import React, { useMemo } from 'react';

const isProd = Boolean(import.meta.env?.PROD);

function pickStr(obj, key, fallback = '') {
  const v = obj?.[key];
  return typeof v === 'string' ? v : fallback;
}

function TextBlock({ block }) {
  const text = pickStr(block.config, 'text', '');
  if (!text) return null;
  const tag = pickStr(block.config, 'as', 'p');
  const Tag = ['h1', 'h2', 'h3', 'h4', 'p', 'span', 'div'].includes(tag) ? tag : 'p';
  return <Tag className={pickStr(block.config, 'className')}>{text}</Tag>;
}

function HeroBlock({ block }) {
  const title = pickStr(block.config, 'title', '');
  const subtitle = pickStr(block.config, 'subtitle', '');
  const cta = block.config?.cta || null;
  return (
    <section className={pickStr(block.config, 'className', 'iri-hero')}>
      {title ? <h1>{title}</h1> : null}
      {subtitle ? <p>{subtitle}</p> : null}
      {cta?.label && cta?.href ? (
        <a href={String(cta.href)} className={pickStr(cta, 'className', 'iri-cta')}>
          {String(cta.label)}
        </a>
      ) : null}
    </section>
  );
}

function ButtonBlock({ block }) {
  const label = pickStr(block.config, 'label', '');
  const href = pickStr(block.config, 'href', '');
  if (!label || !href) return null;
  return (
    <a href={href} className={pickStr(block.config, 'className', 'iri-button')}>
      {label}
    </a>
  );
}

function ImageBlock({ block }) {
  const src = pickStr(block.config, 'src', '');
  if (!src) return null;
  const alt = pickStr(block.config, 'alt', '');
  return <img src={src} alt={alt} className={pickStr(block.config, 'className')} loading="lazy" />;
}

function VideoBlock({ block }) {
  const src = pickStr(block.config, 'src', '');
  if (!src) return null;
  return (
    <video
      src={src}
      controls={Boolean(block.config?.controls ?? true)}
      autoPlay={Boolean(block.config?.autoplay)}
      muted={Boolean(block.config?.muted)}
      loop={Boolean(block.config?.loop)}
      className={pickStr(block.config, 'className')}
    />
  );
}

function ColumnsBlock({ block, children }) {
  const cols = Number(block.config?.columns || 2);
  return (
    <div
      className={pickStr(block.config, 'className', 'iri-columns')}
      style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 16 }}
    >
      {children}
    </div>
  );
}

function FaqBlock({ block }) {
  const items = Array.isArray(block.config?.items) ? block.config.items : [];
  if (!items.length) return null;
  return (
    <dl className={pickStr(block.config, 'className', 'iri-faq')}>
      {items.map((it, i) => (
        <div key={i}>
          <dt>{String(it?.q || '')}</dt>
          <dd>{String(it?.a || '')}</dd>
        </div>
      ))}
    </dl>
  );
}

function OfferBlock({ block }) {
  const title = pickStr(block.config, 'title', '');
  const price = block.config?.price;
  const currency = pickStr(block.config, 'currency', 'EUR');
  const cta = block.config?.cta || null;
  return (
    <article className={pickStr(block.config, 'className', 'iri-offer')}>
      {title ? <h3>{title}</h3> : null}
      {price != null ? <strong>{`${price} ${currency}`}</strong> : null}
      {cta?.label && cta?.href ? <a href={String(cta.href)}>{String(cta.label)}</a> : null}
    </article>
  );
}

function LiveBlock({ block }) {
  // Le block « live » expose juste un slot ; la vraie intégration LiveKit
  // reste dans les pages dédiées. Ici on rend un placeholder configurable.
  const sessionId = pickStr(block.config, 'sessionId', '');
  return (
    <div className={pickStr(block.config, 'className', 'iri-live-slot')} data-iri-live={sessionId || ''}>
      {pickStr(block.config, 'placeholder', 'Live à venir')}
    </div>
  );
}

const REGISTRY = {
  text: TextBlock,
  hero: HeroBlock,
  button: ButtonBlock,
  image: ImageBlock,
  video: VideoBlock,
  columns: ColumnsBlock,
  faq: FaqBlock,
  offer: OfferBlock,
  live: LiveBlock,
};

function buildTree(blocks) {
  const list = Array.isArray(blocks) ? [...blocks] : [];
  list.sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
  const byParent = new Map();
  for (const b of list) {
    const key = b.parent_block_id || null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(b);
  }
  return byParent;
}

function renderBlock(block, byParent) {
  const type = String(block?.type || '').trim().toLowerCase();
  const Comp = REGISTRY[type];
  const childBlocks = byParent.get(block.id) || [];
  const children = childBlocks.map((c) => (
    <React.Fragment key={c.id}>{renderBlock(c, byParent)}</React.Fragment>
  ));

  if (!Comp) {
    if (isProd) return null;
    return (
      <div data-iri-unknown-type={type} style={{ outline: '1px dashed #f59e0b', padding: 8 }}>
        {`Type IRI inconnu : ${type}`}
        {children}
      </div>
    );
  }

  return <Comp block={block}>{children}</Comp>;
}

/** @param {{ blocks: Array<{id:string, parent_block_id?:string|null, type:string, position:number, config:Record<string, unknown>}> }} props */
export function IriBlockRenderer({ blocks }) {
  const byParent = useMemo(() => buildTree(blocks), [blocks]);
  const roots = byParent.get(null) || [];
  return (
    <>
      {roots.map((b) => (
        <React.Fragment key={b.id}>{renderBlock(b, byParent)}</React.Fragment>
      ))}
    </>
  );
}

export default IriBlockRenderer;
