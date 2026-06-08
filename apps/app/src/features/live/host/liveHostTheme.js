export const GLOBAL_CSS = `
@keyframes lhPulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes lhFadeUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
@keyframes lhMIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
@keyframes lhFloatUp{0%{opacity:1;transform:translateY(0) scale(1)}70%{opacity:.9;transform:translateY(-80px) scale(1.3)}100%{opacity:0;transform:translateY(-140px) scale(.8)}}
.lh-reaction{position:absolute;bottom:20%;pointer-events:none;font-size:30px;animation:lhFloatUp 2.2s ease-out forwards;will-change:transform,opacity}
.lh-sy{overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent}
.lh-sy::-webkit-scrollbar{width:3px}.lh-sy::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12)}
.lh-sx{overflow-x:auto;scrollbar-width:none}.lh-sx::-webkit-scrollbar{display:none}
.lh-ov{position:fixed;inset:0;background:rgba(8,9,14,.82);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:500;display:flex;align-items:center;justify-content:center;animation:lhFadeUp .18s ease;padding:16px}
.lh-mbox{background:linear-gradient(165deg,rgba(20,19,28,.97) 0%,rgba(15,17,23,.99) 100%);border:1px solid rgba(255,255,255,.1);border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.04) inset;animation:lhMIn .2s ease;max-height:min(90vh,920px);overflow:hidden;display:flex;flex-direction:column}
.lh-tbtn{padding:6px 12px;font-size:11px;font-weight:600;letter-spacing:.04em;border:none;background:transparent;color:rgba(255,255,255,.38);border-bottom:2px solid transparent;cursor:pointer;transition:all .12s}
.lh-tbtn.on{color:rgba(253,230,138,.95);border-bottom-color:rgba(245,158,11,.55)}
.liri-live-shell--host,.liri-live-shell--guest{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.lh-right-rail-scroll{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.12) transparent}
.lh-right-rail-scroll::-webkit-scrollbar{width:3px}
.lh-right-rail-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:3px}
.lh-live-micro{font-size:8px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.38)}
.lh-sp-dim{transition:filter .3s ease,opacity .3s ease;will-change:filter}
body.lh-sp-on .lh-sp-dim{filter:brightness(.3) saturate(.35);opacity:.8}
body.lh-sp-on .lh-sp-dim:hover{filter:brightness(1) saturate(1) !important;opacity:1 !important;z-index:20;position:relative}
body.lh-sp-on .lh-sp-keep{filter:none !important;opacity:1 !important;position:relative;z-index:10}
body.lh-sp-on .lh-sp-glow{box-shadow:0 0 0 1px rgba(200,150,12,.22),0 0 28px rgba(200,150,12,.07)}
.lh-premium-card{transition:transform .16s ease,box-shadow .2s ease,border-color .2s ease}
.lh-premium-card:hover{transform:translateY(-1px);box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 16px 36px rgba(0,0,0,.34)}
.lh-premium-btn{transition:background .16s ease,border-color .16s ease,color .16s ease,transform .16s ease,box-shadow .16s ease}
.lh-premium-btn:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(0,0,0,.22)}
.lh-scene-btn{
  transition:
    transform 320ms cubic-bezier(.34,1.56,.64,1),
    box-shadow 260ms cubic-bezier(.25,.46,.45,.94),
    border-color 200ms ease,
    background 200ms ease,
    color 200ms ease;
  will-change:transform;
  -webkit-font-smoothing:antialiased;
  border:1px solid transparent;
  background:transparent;
  color:rgba(167,139,250,.45);
}
.lh-scene-btn[data-active="true"]{
  border-color:rgba(139,92,246,.55);
  background:rgba(109,40,217,.28);
  color:#c4b5fd;
}
.lh-scene-btn:hover{
  transform:translateY(-3px) scale(1.14);
  box-shadow:
    0 2px 6px rgba(0,0,0,.22),
    0 8px 24px rgba(109,40,217,.32),
    0 18px 40px rgba(109,40,217,.14),
    0 0 0 1.5px rgba(139,92,246,.48),
    inset 0 1px 0 rgba(255,255,255,.14);
  border-color:rgba(139,92,246,.65);
  background:linear-gradient(160deg,rgba(139,92,246,.22),rgba(109,40,217,.34));
  color:#ddd6fe;
}
.lh-scene-btn:active{
  transform:scale(.92);
  transition:transform 90ms cubic-bezier(.25,.46,.45,.94),box-shadow 90ms ease;
  box-shadow:0 1px 4px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.07);
}
.lh-side-head{position:sticky;top:0;z-index:18;border-radius:14px;border:1px solid rgba(255,255,255,.08);background:#12111a;padding:10px 12px;box-shadow:inset 0 1px 0 rgba(255,255,255,.04);backdrop-filter:blur(8px)}
.lh-side-head-kicker{font-size:8px;font-weight:600;letter-spacing:.12em;color:rgba(255,255,255,.38);text-transform:uppercase;line-height:1.3}
.liri-live-shell--guest .lh-side-head-kicker{color:rgba(253,230,138,.42)}
.liri-live-shell--host .lh-side-head-title,.liri-live-shell--guest .lh-side-head-title{margin-top:2px;font-size:13px;font-weight:600;letter-spacing:.06em;color:rgba(253,230,138,.95);line-height:1.35;font-family:Georgia,'Times New Roman',ui-serif,serif}
.lh-side-head-sub{margin-top:4px;font-size:9px;line-height:1.45;color:rgba(255,255,255,.38)}
`;

/** Shell visuel aligné sur le **portail LIRI** (Zoom × Claude) : base chaude #262624,
 *  glow coral, panneaux #30302e, lignes ivoire discrètes. (était #0F1117 bleu-Studio). */
export const LH_DESIGN = {
  pageBg: '#262624',
  pageMesh:
    'radial-gradient(ellipse 85% 55% at 50% -15%, rgba(217,119,87,0.06), transparent 58%), radial-gradient(ellipse 55% 40% at 100% 85%, rgba(226,85,63,0.05), transparent 52%), radial-gradient(ellipse 45% 32% at 0% 75%, rgba(194,104,63,0.04), transparent 48%)',
  panelBg: 'rgba(48,48,46,0.97)',
  panelBorder: '1px solid rgba(245,244,238,0.09)',
  panelRadius: 16,
  innerRadius: 12,
  gap: 12,
  stripBg: 'rgba(43,41,38,0.96)',
  stripBorder: '1px solid rgba(245,244,238,0.09)',
  canvasChromeBg: 'rgba(31,30,28,0.92)',
};

/** Invité — même shell que l'hôte (LH_DESIGN) pour cohérence visuelle ; garder un objet vide pour overrides ciblés futurs. */
export const LH_GUEST_OVERRIDES = {};

/** Cartes premium du panneau latéral droit (hôte/guest). */
export const LH_SIDEBAR_CARD = {
  border: '1px solid rgba(245,244,238,.09)',
  background: 'rgba(48,48,46,0.95)',
  borderRadius: '14px',
  padding: '12px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.04), 0 10px 28px rgba(0,0,0,.24), 0 0 0 1px rgba(255,255,255,.02) inset',
  backdropFilter: 'blur(8px)',
};

export const LH_SIDEBAR_CARD_GLOW = {
  ...LH_SIDEBAR_CARD,
  border: '1px solid rgba(217,119,87,.22)',
  background:
    'radial-gradient(120% 90% at 12% -8%, rgba(217,119,87,.10), transparent 52%), #2b2926',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,.05), 0 0 0 1px rgba(217,119,87,.10), 0 14px 36px rgba(0,0,0,.3)',
};

/** Nom produit par rôle : pilote (lancement live) vs lien d'invitation. */
export const LIRI_LIVE_UI_LABEL = {
  host: 'Liri hot',
  guest: 'Liri invit',
};
