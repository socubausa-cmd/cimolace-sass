/**
 * pollGdprExports — STUB no-op.
 *
 * Créé pour résoudre l'import ajouté dans `index.live.ts` (une session parallèle
 * a référencé ce module avant de l'implémenter → sans ce fichier, l'import casse
 * le boot du worker et stoppe TOUS les pollers, y compris l'IMAP). Retourne 0
 * (aucun export traité). À remplacer par la vraie logique d'export RGPD.
 */
export async function pollGdprExports() {
  return 0;
}

export default pollGdprExports;
