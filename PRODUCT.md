# Cimolace / LIRI — contexte produit

## Ce que c'est
Plateforme SaaS multi-tenant (Supabase + NestJS + React/Vite) : LIRI est le portail
back-office des tenants (écoles, temples, cabinets). Moteurs : École (cours, lives,
SmartBoard Designer), MEDOS (santé), mbolo (boutique), CRM, rendez-vous.
Tenant fondateur : Prorascience (prorascience.org). Utilisateurs : le fondateur et le
secrétariat — des opérateurs en tâche, pas des visiteurs.

## Registre
`register: product` — le design SERT la tâche. Surfaces authentifiées, denses,
consultées des heures par jour, souvent depuis l'Afrique centrale (connexions
moyennes : pas de dépendances lourdes, pas d'images décoratives).

## Direction artistique (existante — docs/LIRI_DIRECTIVE_ARTISTIQUE.md, à respecter)
- Palette CHAUDE uniquement : fond `#262624`, surfaces `#2b2926`/`#33322e`,
  encre `#f5f4ee`, **corail `#d97757` = actions et sélection**.
- ⛔ Bannis : navy, violet, teal, or métallique, dégradés décoratifs.
- Typo : Inter partout, échelle serrée ; libellés en français.
- Un geste = un pas d'historique ; rien ne s'annonce qui n'existe ; les états
  vides enseignent l'écran.

## Conventions de code
Tailwind + classes utilitaires, lucide-react pour les icônes, composants shadcn/ui
dans `apps/app/src/components/ui`. Pages LIRI sous `apps/app/src/pages/liri/*`,
coquille commune `LiriPortalShell`. API via `lib/api-v2` (axios).
