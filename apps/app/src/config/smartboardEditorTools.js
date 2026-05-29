/**
 * Base de données des outils d'édition du SmartBoard — style Canva.
 * Utilisée par SmartboardEditorPanel pour l'édition manuelle des slides.
 */

// ─── Fonds (backgrounds) ─────────────────────────────────────────────────────
export const SB_BACKGROUNDS = [
  // Gradients sombres premium
  { id: 'bg_dark_gold',    label: 'Or Nuit',    category: 'gradient', css: 'linear-gradient(135deg,#0a0e1a 0%,#10162b 60%,#0d1220 100%)' },
  { id: 'bg_midnight',     label: 'Minuit',     category: 'gradient', css: 'linear-gradient(135deg,#000000 0%,#111827 100%)' },
  { id: 'bg_cosmic',       label: 'Cosmique',   category: 'gradient', css: 'linear-gradient(135deg,#0d0021 0%,#1a0540 50%,#07001a 100%)' },
  { id: 'bg_forest',       label: 'Forêt',      category: 'gradient', css: 'linear-gradient(135deg,#031a0e 0%,#052e16 60%,#0a1a0d 100%)' },
  { id: 'bg_academic',     label: 'Académique', category: 'gradient', css: 'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)' },
  { id: 'bg_ember',        label: 'Braise',     category: 'gradient', css: 'linear-gradient(135deg,#1a0800 0%,#2d1200 60%,#1a0500 100%)' },
  { id: 'bg_ocean',        label: 'Océan',      category: 'gradient', css: 'linear-gradient(135deg,#001a2e 0%,#00354d 50%,#001220 100%)' },
  { id: 'bg_slate',        label: 'Ardoise',    category: 'gradient', css: 'linear-gradient(135deg,#0d1117 0%,#161b22 100%)' },
  { id: 'bg_rose',         label: 'Rose Nuit',  category: 'gradient', css: 'linear-gradient(135deg,#1a0010 0%,#2d0021 50%,#0d0010 100%)' },
  { id: 'bg_amber_dark',   label: 'Ambre',      category: 'gradient', css: 'linear-gradient(135deg,#1a1000 0%,#2d1e00 50%,#1a1200 100%)' },
  // Gradients lumineux
  { id: 'bg_light_clean',  label: 'Blanc Pur',  category: 'light',    css: 'linear-gradient(135deg,#ffffff 0%,#f8fafc 100%)' },
  { id: 'bg_light_warm',   label: 'Crème',      category: 'light',    css: 'linear-gradient(135deg,#fffbf0 0%,#fef3c7 100%)' },
  { id: 'bg_light_blue',   label: 'Ciel',       category: 'light',    css: 'linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 100%)' },
  { id: 'bg_light_green',  label: 'Menthe',     category: 'light',    css: 'linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%)' },
  // Pleines couleurs
  { id: 'bg_solid_black',  label: 'Noir',       category: 'solid',    css: '#000000' },
  { id: 'bg_solid_navy',   label: 'Marine',     category: 'solid',    css: '#0f172a' },
  { id: 'bg_solid_indigo', label: 'Indigo',     category: 'solid',    css: '#1e1b4b' },
  { id: 'bg_solid_emerald',label: 'Émeraude',   category: 'solid',    css: '#064e3b' },
  { id: 'bg_solid_wine',   label: 'Bordeaux',   category: 'solid',    css: '#4c0519' },
];

// ─── Palettes de couleurs ─────────────────────────────────────────────────────
export const SB_COLOR_PALETTES = [
  {
    id: 'palette_gold',
    label: 'Or Premium',
    colors: ['#D4AF37', '#f1cf63', '#b5952f', '#fff8dc', '#1a1200'],
  },
  {
    id: 'palette_white',
    label: 'Blanc & Gris',
    colors: ['#ffffff', '#e2e8f0', '#94a3b8', '#475569', '#0f172a'],
  },
  {
    id: 'palette_violet',
    label: 'Cosmique',
    colors: ['#a78bfa', '#7c3aed', '#c4b5fd', '#ede9fe', '#1e1b4b'],
  },
  {
    id: 'palette_emerald',
    label: 'Forêt',
    colors: ['#4ade80', '#16a34a', '#86efac', '#dcfce7', '#052e16'],
  },
  {
    id: 'palette_amber',
    label: 'Académique',
    colors: ['#f59e0b', '#d97706', '#fcd34d', '#fef3c7', '#451a03'],
  },
  {
    id: 'palette_rose',
    label: 'Corail',
    colors: ['#f43f5e', '#be123c', '#fb7185', '#ffe4e6', '#4c0519'],
  },
  {
    id: 'palette_cyan',
    label: 'Azur',
    colors: ['#06b6d4', '#0e7490', '#67e8f9', '#cffafe', '#164e63'],
  },
  {
    id: 'palette_neutral',
    label: 'Neutre',
    colors: ['#d4d4d8', '#a1a1aa', '#71717a', '#3f3f46', '#18181b'],
  },
];

// ─── Préréglages typographiques ──────────────────────────────────────────────
export const SB_TYPO_PRESETS = [
  {
    id: 'typo_hero',
    label: 'Titre Héro',
    description: 'Grand titre pleine page',
    preview: 'Aa',
    previewStyle: { fontSize: '28px', fontWeight: 900, fontFamily: 'Georgia, serif', letterSpacing: '-0.02em' },
    style: { fontSize: 'clamp(2.5rem,6vw,5rem)', fontWeight: 900, fontFamily: 'Georgia, serif', letterSpacing: '-0.02em', lineHeight: 1.1 },
  },
  {
    id: 'typo_title',
    label: 'Titre Section',
    description: 'Titre de chapitre principal',
    preview: 'Aa',
    previewStyle: { fontSize: '22px', fontWeight: 700, fontFamily: 'Georgia, serif' },
    style: { fontSize: 'clamp(1.8rem,4vw,3rem)', fontWeight: 700, fontFamily: 'Georgia, serif', lineHeight: 1.2 },
  },
  {
    id: 'typo_subtitle',
    label: 'Sous-titre',
    description: 'Titre secondaire',
    preview: 'Aa',
    previewStyle: { fontSize: '16px', fontWeight: 600, fontFamily: 'system-ui, sans-serif' },
    style: { fontSize: 'clamp(1.2rem,2.5vw,2rem)', fontWeight: 600, fontFamily: 'system-ui, sans-serif', lineHeight: 1.3 },
  },
  {
    id: 'typo_body',
    label: 'Corps de texte',
    description: 'Paragraphe standard',
    preview: 'Aa',
    previewStyle: { fontSize: '14px', fontWeight: 400, fontFamily: 'system-ui, sans-serif' },
    style: { fontSize: 'clamp(1rem,1.8vw,1.35rem)', fontWeight: 400, fontFamily: 'system-ui, sans-serif', lineHeight: 1.6 },
  },
  {
    id: 'typo_bullet',
    label: 'Bullet Point',
    description: 'Point de liste élégant',
    preview: '• Item',
    previewStyle: { fontSize: '13px', fontWeight: 500, fontFamily: 'system-ui, sans-serif' },
    style: { fontSize: 'clamp(0.95rem,1.6vw,1.2rem)', fontWeight: 500, fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 },
  },
  {
    id: 'typo_quote',
    label: 'Citation',
    description: 'Mise en exergue',
    preview: '" … "',
    previewStyle: { fontSize: '15px', fontStyle: 'italic', fontWeight: 300, fontFamily: 'Georgia, serif' },
    style: { fontSize: 'clamp(1.1rem,2vw,1.6rem)', fontStyle: 'italic', fontWeight: 300, fontFamily: 'Georgia, serif', lineHeight: 1.7 },
  },
  {
    id: 'typo_tag',
    label: 'Étiquette',
    description: 'Badge chapitre / catégorie',
    preview: 'TAG',
    previewStyle: { fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: 'system-ui' },
    style: { fontSize: 'clamp(0.65rem,1vw,0.8rem)', fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', fontFamily: 'system-ui' },
  },
  {
    id: 'typo_number',
    label: 'Numéro Grand',
    description: 'Numérotation décorative',
    preview: '01',
    previewStyle: { fontSize: '26px', fontWeight: 900, fontFamily: 'Georgia, serif', opacity: 0.3 },
    style: { fontSize: 'clamp(4rem,10vw,8rem)', fontWeight: 900, fontFamily: 'Georgia, serif', opacity: 0.15, lineHeight: 1 },
  },
];

// ─── Bibliothèque d'icônes (emoji & symboles) ────────────────────────────────
export const SB_ICON_LIBRARY = {
  education: {
    label: 'Éducation',
    icon: '🎓',
    items: ['🎓','📚','📖','✏️','📝','🔬','🧪','🧫','⚗️','🔭','📐','📏','🖊️','📌','📍','🗂️','📋','📊','📈','📉'],
  },
  nature: {
    label: 'Nature',
    icon: '🌿',
    items: ['🌿','🌱','🍃','🌳','🌲','🌾','🌻','🌺','🌸','🌼','🍀','🌊','⭐','🌙','☀️','⚡','🌈','❄️','🔥','💧'],
  },
  business: {
    label: 'Business',
    icon: '💼',
    items: ['💼','📊','📈','💰','🏆','🥇','🎯','🚀','💡','🔑','🏅','🎖️','🌐','📡','⚙️','🔧','🔨','⚖️','📦','🏗️'],
  },
  spirituel: {
    label: 'Spirituel',
    icon: '✨',
    items: ['✨','🌟','⭐','💫','🌙','☀️','🕊️','🙏','💎','🔮','🧿','☯️','🌀','🕯️','📿','🌌','🌠','🪐','💠','🔯'],
  },
  symbols: {
    label: 'Symboles',
    icon: '◆',
    items: ['◆','◇','▲','▼','●','○','■','□','★','☆','→','←','↑','↓','↗','↙','⇒','⟶','❯','❮'],
  },
  math: {
    label: 'Maths & Science',
    icon: '∑',
    items: ['∑','∫','∞','√','π','Δ','∇','⊕','⊗','∈','∉','∀','∃','≈','≠','≤','≥','±','×','÷'],
  },
  arabic: {
    label: 'Calligraphie',
    icon: '☪',
    items: ['☪','✡','☦','⛎','☯','⚛','🕌','🕍','⛩','🛕','🕋','📿','🌙','⭐','✝','☬','✡','🔯','🪬','🧿'],
  },
};

// ─── Éléments décoratifs (dividers, frames, accents) ─────────────────────────
export const SB_DECORATORS = [
  // Séparateurs
  { id: 'div_line',      label: 'Ligne fine',    category: 'divider', element: '──────────────────────────' },
  { id: 'div_double',    label: 'Double ligne',  category: 'divider', element: '══════════════════════════' },
  { id: 'div_dots',      label: 'Points',        category: 'divider', element: '· · · · · · · · · · · · ·' },
  { id: 'div_diamond',   label: 'Diamants',      category: 'divider', element: '◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆' },
  { id: 'div_stars',     label: 'Étoiles',       category: 'divider', element: '★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★' },
  { id: 'div_wave',      label: 'Vague',         category: 'divider', element: '〜〜〜〜〜〜〜〜〜〜〜〜〜' },
  // Encadrements (texte)
  { id: 'frame_brackets',label: '[ Crochets ]',  category: 'frame',   element: '[ {texte} ]' },
  { id: 'frame_angle',   label: '〈 Chevrons 〉', category: 'frame',   element: '〈 {texte} 〉' },
  { id: 'frame_quote',   label: '« Citation »',  category: 'frame',   element: '« {texte} »' },
  { id: 'frame_stars',   label: '★ Étoile ★',   category: 'frame',   element: '★ {texte} ★' },
  // Puces personnalisées
  { id: 'bullet_arrow',  label: 'Flèche →',      category: 'bullet',  element: '→' },
  { id: 'bullet_diamond',label: 'Diamant ◆',     category: 'bullet',  element: '◆' },
  { id: 'bullet_circle', label: 'Cercle ●',      category: 'bullet',  element: '●' },
  { id: 'bullet_dot',    label: 'Point ·',       category: 'bullet',  element: '·' },
  { id: 'bullet_dash',   label: 'Tiret —',       category: 'bullet',  element: '—' },
  { id: 'bullet_check',  label: 'Coche ✓',       category: 'bullet',  element: '✓' },
  { id: 'bullet_sparkle',label: 'Étincelle ✦',   category: 'bullet',  element: '✦' },
  { id: 'bullet_star',   label: 'Étoile ★',      category: 'bullet',  element: '★' },
];

// ─── Templates de slides complets ─────────────────────────────────────────────
export const SB_SLIDE_TEMPLATES = [
  {
    id: 'tpl_hero_dark',
    label: 'Héro Sombre',
    description: 'Grand titre centré, fond dégradé noir-marine',
    preview: { bg: 'linear-gradient(135deg,#000,#0f172a)', accent: '#D4AF37' },
    apply: {
      bg: 'linear-gradient(135deg,#000000 0%,#0f172a 100%)',
      titleAlign: 'center',
      titleSize: 'hero',
      accentColor: '#D4AF37',
      bulletStyle: '◆',
      showNumber: true,
      layout: 'centered',
    },
  },
  {
    id: 'tpl_manifesto',
    label: 'Manifeste',
    description: 'Points espacés avec numéros en grand',
    preview: { bg: 'linear-gradient(135deg,#0a0e1a,#10162b)', accent: '#D4AF37' },
    apply: {
      bg: 'linear-gradient(135deg,#0a0e1a 0%,#10162b 100%)',
      titleAlign: 'left',
      titleSize: 'title',
      accentColor: '#D4AF37',
      bulletStyle: '01',
      showNumber: false,
      layout: 'numbered',
    },
  },
  {
    id: 'tpl_minimal_light',
    label: 'Minimal Clair',
    description: 'Fond blanc, texte sombre, épuré',
    preview: { bg: '#f8fafc', accent: '#0f172a' },
    apply: {
      bg: 'linear-gradient(135deg,#ffffff,#f1f5f9)',
      titleAlign: 'left',
      titleSize: 'title',
      accentColor: '#0f172a',
      bulletStyle: '—',
      showNumber: true,
      layout: 'left',
    },
  },
  {
    id: 'tpl_cosmic',
    label: 'Cosmique',
    description: 'Violet profond, effet spatial',
    preview: { bg: 'linear-gradient(135deg,#0d0021,#1a0540)', accent: '#a78bfa' },
    apply: {
      bg: 'linear-gradient(135deg,#0d0021 0%,#1a0540 50%,#07001a 100%)',
      titleAlign: 'center',
      titleSize: 'title',
      accentColor: '#a78bfa',
      bulletStyle: '✦',
      showNumber: false,
      layout: 'centered',
    },
  },
  {
    id: 'tpl_academic_board',
    label: 'Tableau Académique',
    description: 'Style tableau noir académique',
    preview: { bg: '#0d2219', accent: '#4ade80' },
    apply: {
      bg: 'linear-gradient(135deg,#031a0e 0%,#052e16 100%)',
      titleAlign: 'left',
      titleSize: 'title',
      accentColor: '#4ade80',
      bulletStyle: '→',
      showNumber: true,
      layout: 'left',
    },
  },
  {
    id: 'tpl_bold_amber',
    label: 'Ambre Puissant',
    description: 'Chaleureux, hiérarchie forte',
    preview: { bg: 'linear-gradient(135deg,#1a1000,#2d1e00)', accent: '#f59e0b' },
    apply: {
      bg: 'linear-gradient(135deg,#1a1000 0%,#2d1e00 100%)',
      titleAlign: 'left',
      titleSize: 'title',
      accentColor: '#f59e0b',
      bulletStyle: '★',
      showNumber: true,
      layout: 'left',
    },
  },
  {
    id: 'tpl_split',
    label: 'Split Bicolore',
    description: 'Moitié sombre / moitié accent',
    preview: { bg: 'linear-gradient(90deg,#0a0e1a 50%,#1a1200 50%)', accent: '#D4AF37' },
    apply: {
      bg: 'linear-gradient(100deg,#0a0e1a 50%,#1a1200 50%)',
      titleAlign: 'left',
      titleSize: 'title',
      accentColor: '#D4AF37',
      bulletStyle: '●',
      showNumber: true,
      layout: 'left',
    },
  },
  {
    id: 'tpl_title_only',
    label: 'Titre Seul',
    description: 'Slide de transition pure',
    preview: { bg: '#000000', accent: '#ffffff' },
    apply: {
      bg: '#000000',
      titleAlign: 'center',
      titleSize: 'hero',
      accentColor: '#ffffff',
      bulletStyle: '',
      showNumber: false,
      layout: 'centered_title',
    },
  },
  // ── Modèles pédagogiques LIRI (canevas type 1037×750) ──
  {
    id: 'tpl_liri_atelier',
    label: 'LIRI — Atelier d\'ouverture',
    description: 'Deux camps + question déclencheur',
    preview: {
      bg: 'linear-gradient(90deg,rgba(26,122,74,0.45) 0%,rgba(26,122,74,0.45) 50%,rgba(26,95,168,0.45) 50%,rgba(26,95,168,0.45) 100%)',
      accent: '#D4AF37',
    },
    apply: {
      bg: 'linear-gradient(135deg,#0a0e1a 0%,#10162b 100%)',
      titleAlign: 'center',
      titleSize: 'title',
      accentColor: '#D4AF37',
      bulletStyle: '◇',
      showNumber: true,
      layout: 'centered',
    },
    applyContent: {
      title: "Atelier d'ouverture",
      points: [
        'Camp A — votre position (côté vert)',
        'Camp B — votre position opposée (côté bleu)',
        "❓ Si tout était identique dans l'univers, que se passerait-il ?",
      ],
    },
  },
  {
    id: 'tpl_liri_definition',
    label: 'LIRI — Définition du concept',
    description: 'Bloc central + trois composantes + formule',
    preview: { bg: 'rgba(200,150,12,0.2)', accent: '#D4AF37' },
    apply: {
      bg: 'linear-gradient(135deg,#0a0e1a 0%,#10162b 100%)',
      titleAlign: 'center',
      titleSize: 'title',
      accentColor: '#D4AF37',
      bulletStyle: '①',
      showNumber: false,
      layout: 'numbered',
    },
    applyContent: {
      title: 'Définition du concept',
      points: [
        '« Définition formelle ici… »',
        '① Composante 1',
        '② Composante 2',
        '③ Composante 3',
        'D + A = C',
      ],
    },
  },
  {
    id: 'tpl_liri_conclusion',
    label: 'LIRI — Conclusion doctrinale',
    description: 'Synthèse + citation + référence doctrine',
    preview: { bg: 'linear-gradient(135deg,#1a1200,#2d1e00)', accent: '#f59e0b' },
    apply: {
      bg: 'linear-gradient(135deg,#1a1000 0%,#2d1e00 50%,#1a1200 100%)',
      titleAlign: 'center',
      titleSize: 'title',
      accentColor: '#f59e0b',
      bulletStyle: '★',
      showNumber: false,
      layout: 'centered',
    },
    applyContent: {
      title: 'Conclusion doctrinale',
      points: [
        '« Là où la différence est accordée, l\'univers lui-même se met à parler. »',
        'Prorascience · Loi de la Différence Accordée',
      ],
    },
  },
  {
    id: 'tpl_liri_debat',
    label: 'LIRI — Débat / confrontation',
    description: 'Pour · Contre · VS',
    preview: {
      bg: 'linear-gradient(90deg,rgba(26,122,74,0.4) 33%,rgba(0,0,0,0.2) 33%,rgba(0,0,0,0.2) 66%,rgba(192,57,43,0.25) 66%)',
      accent: '#D4AF37',
    },
    apply: {
      bg: 'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)',
      titleAlign: 'center',
      titleSize: 'title',
      accentColor: '#D4AF37',
      bulletStyle: '⚖',
      showNumber: false,
      layout: 'centered',
    },
    applyContent: {
      title: 'Débat',
      points: ['POUR — arguments à construire', 'CONTRE — contre-arguments', 'Question / motion au centre'],
    },
  },
  {
    id: 'tpl_liri_citation',
    label: 'LIRI — Citation / adage',
    description: 'Exergue + source',
    preview: { bg: 'linear-gradient(135deg,#0a0e1a,#10162b)', accent: '#D4AF37' },
    apply: {
      bg: 'linear-gradient(135deg,#0a0e1a 0%,#10162b 100%)',
      titleAlign: 'center',
      titleSize: 'hero',
      accentColor: '#D4AF37',
      bulletStyle: '❝',
      showNumber: false,
      layout: 'centered',
    },
    applyContent: {
      title: 'Citation',
      points: ['Citation ou adage ici…', '— Source / Doctrine Prorascience'],
    },
  },
  {
    id: 'tpl_liri_comparaison',
    label: 'LIRI — Comparaison',
    description: 'Avant / Après / avec loi',
    preview: {
      bg: 'linear-gradient(90deg,rgba(26,122,74,0.4) 50%,rgba(26,95,168,0.4) 50%)',
      accent: '#D4AF37',
    },
    apply: {
      bg: 'linear-gradient(100deg,#0a0e1a 50%,#10162b 50%)',
      titleAlign: 'center',
      titleSize: 'title',
      accentColor: '#D4AF37',
      bulletStyle: '↔',
      showNumber: true,
      layout: 'two_cols',
    },
    applyContent: {
      title: 'Comparaison',
      points: ['Avant / sans loi', 'Après / avec loi'],
    },
  },
];

// ─── Préréglages de mise en page ──────────────────────────────────────────────
export const SB_LAYOUT_PRESETS = [
  { id: 'layout_left',         label: 'Gauche',        icon: '◧', description: 'Titre + bullets alignés à gauche' },
  { id: 'layout_centered',     label: 'Centré',        icon: '◈', description: 'Tout centré, idéal pour les titres' },
  { id: 'layout_numbered',     label: 'Numéroté',      icon: '①', description: 'Grands numéros devant chaque point' },
  { id: 'layout_two_cols',     label: '2 Colonnes',    icon: '⊞', description: 'Points répartis en deux colonnes' },
  { id: 'layout_centered_title',label: 'Titre pur',    icon: '⊟', description: 'Titre seul centré — slide de transition' },
];

// ─── Catégories de l'éditeur (onglets) ────────────────────────────────────────
export const SB_EDITOR_TABS = [
  { id: 'templates', label: 'Templates', icon: '🎨' },
  { id: 'backgrounds', label: 'Fonds',    icon: '🖼️' },
  { id: 'typography', label: 'Texte',     icon: 'Aa'  },
  { id: 'icons',      label: 'Icônes',    icon: '✨' },
  { id: 'colors',     label: 'Couleurs',  icon: '🎨' },
  { id: 'elements',   label: 'Éléments',  icon: '◆'  },
  { id: 'immersive',  label: 'Immersif',  icon: '〰️' },
  { id: 'layout',     label: 'Mise en page', icon: '⊞' },
];
