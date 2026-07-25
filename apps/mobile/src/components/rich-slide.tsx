import React, { useMemo, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../lib/theme';
import type { LiriPalette } from '../constants/liri-theme';

/**
 * Corps d'une diapo de cours en NATIF.
 *
 * Les supports produits par le moteur pédagogique contiennent des tableaux
 * (glossaire, récapitulatif), des encadrés de définition et des SCHÉMAS SVG :
 * les aplatir en texte brut ferait perdre l'essentiel. On rend donc le HTML dans
 * une WebView aux styles du portail — même lecture que sur le web, sans réseau
 * (contenu injecté en `source.html`, navigation externe bloquée).
 *
 * Le texte simple reste rendu nativement (sélectionnable, plus léger).
 */

const RICH = /<(p|ul|ol|li|table|svg|h[3-5]|blockquote|strong|em|figure)\b/i;

const htmlToText = (html?: string) =>
  String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const PAGE = (body: string, C: LiriPalette) => `<!doctype html><html><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; padding:0; background:transparent; color:${C.muted};
         font: 15.5px/1.68 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  p { margin:0 0 13px; }
  strong, b { color:${C.ink}; font-weight:650; }
  h3,h4,h5 { color:${C.coral}; font-size:15px; font-weight:700; margin:18px 0 8px; }
  ul,ol { margin:0 0 14px; padding-left:20px; }
  li { margin:0 0 7px; }
  ul li::marker { color:${C.coral}; }
  blockquote { margin:14px 0; padding:13px 16px; border-radius:13px;
               background:${C.coralTint}; border:1px solid ${C.coral}55; color:${C.ink}; }
  blockquote p { margin:0; }
  table { width:100%; border-collapse:separate; border-spacing:0; margin:16px 0; font-size:14px;
          border:1px solid ${C.line}; border-radius:13px; overflow:hidden; }
  th { background:${C.coralTint}; color:${C.coral}; font-weight:700; text-align:left; padding:10px 12px; font-size:12.5px; }
  td { padding:10px 12px; border-top:1px solid ${C.line}; vertical-align:top; }
  figure { margin:18px 0; text-align:center; }
  svg { max-width:100%; height:auto; }
  figcaption { margin-top:8px; font-size:12.5px; color:${C.faint}; font-style:italic; }
  code { background:${C.panelTint}; padding:1px 6px; border-radius:6px; }
</style></head>
<body><div id="c">${body}</div>
<script>
  // Hauteur réelle du contenu → la WebView ne défile pas, c'est la page qui grandit.
  function post() {
    var h = document.getElementById('c').getBoundingClientRect().height;
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(String(Math.ceil(h)));
  }
  window.addEventListener('load', post); setTimeout(post, 60); setTimeout(post, 400);
</script></body></html>`;

export function RichSlide({ content }: { content?: string }) {
  const { colors: C } = useTheme();
  const isRich = useMemo(() => RICH.test(String(content ?? '')), [content]);
  const [height, setHeight] = useState(120);
  const html = useMemo(() => PAGE(String(content ?? ''), C), [content, C]);

  if (!isRich) {
    return (
      <Text selectable style={{ color: C.muted, fontSize: 15, lineHeight: 22 }}>
        {htmlToText(content) || '—'}
      </Text>
    );
  }
  return (
    <WebView
      originWhitelist={['about:blank']}
      source={{ html }}
      style={[styles.web, { height }]}
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
      javaScriptEnabled
      onMessage={(e) => {
        const h = Number(e.nativeEvent.data);
        if (Number.isFinite(h) && h > 0) setHeight(Math.min(h + 8, 4000));
      }}
      // Aucune navigation : le contenu est local et ne doit pas ouvrir de page.
      onShouldStartLoadWithRequest={(req) => req.url === 'about:blank' || req.url.startsWith('data:')}
    />
  );
}

const styles = StyleSheet.create({
  web: { width: '100%', backgroundColor: 'transparent', opacity: 0.99 },
});

export default RichSlide;
