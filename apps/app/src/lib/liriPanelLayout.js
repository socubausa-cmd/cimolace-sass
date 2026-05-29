/**
 * LIRI — sémantique des panneaux vidéo dans LiveRoomShell.
 *
 * - **PanelActif** : vidéo à priorité entrante (`mainVideoRef` côté technique).
 *   - Invité : flux hôte / présentateur.
 *   - Hôte : flux invité ou participant promu « à l'antenne ».
 *
 * - **PanelPassif** : prévisualisation du flux local sortant (`miniVideoRef`).
 *   - Toujours la self-cam en petit format (zone 3 en tête).
 *
 * Les autres participants (multi) restent en vignettes bandeau ; le grand cadre
 * ne change que si l'hôte promeut explicitement ou via la modal.
 */

export const LIRI_PANEL_ACTIF = 'PanelActif';
export const LIRI_PANEL_PASSIF = 'PanelPassif';
