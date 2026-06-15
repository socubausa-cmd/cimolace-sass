import DOMPurify from 'dompurify';

/**
 * Rend du HTML potentiellement non fiable après assainissement DOMPurify.
 *
 * À utiliser PARTOUT où l'on injecte du contenu dynamique (descriptions produit,
 * contenu de leçon/slide, etc.) via `dangerouslySetInnerHTML`. Empêche le XSS
 * stocké en supprimant scripts, gestionnaires d'événements et URLs dangereuses
 * tout en conservant le HTML de mise en forme légitime.
 *
 * NB : réservé au CONTENU. Ne pas l'utiliser pour injecter du CSS via `<style>`
 * (DOMPurify retirerait les règles) — les balises `<style>` à constante statique
 * restent en `dangerouslySetInnerHTML` brut.
 *
 * @param {object} props
 * @param {string} props.html   - HTML brut à assainir puis rendre.
 * @param {string} [props.className]
 * @param {React.ElementType} [props.as] - Élément/conteneur de rendu (défaut: 'div').
 */
export function SafeHtml({ html, className, as: Tag = 'div', ...rest }) {
  const clean = DOMPurify.sanitize(String(html || ''), { USE_PROFILES: { html: true } });
  return <Tag className={className} {...rest} dangerouslySetInnerHTML={{ __html: clean }} />;
}

export default SafeHtml;
