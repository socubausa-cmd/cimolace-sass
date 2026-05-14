# Guide de Configuration du Compte Propriétaire (OWNER)

Ce document décrit les procédures pour créer, vérifier et gérer le compte administrateur principal ("Owner") de la plateforme PRORASCIENCE.

## 1. Création Automatisée (Recommandé)

L'application dispose d'une interface dédiée pour faciliter la création du premier compte propriétaire.

1.  Accédez à la route publique : `/create-owner-account`
2.  Remplissez le formulaire avec :
    *   **Nom Complet**
    *   **Email** (ex: `owner@prorascience.com`)
    *   **Mot de passe sécurisé** (Min 8 caractères, Maj, Min, Chiffre, Spécial)
3.  Validez le formulaire.
4.  Le système va automatiquement :
    *   Créer l'utilisateur dans Supabase Auth
    *   Créer l'entrée dans la table `profiles` avec le rôle `owner`
    *   Créer l'entrée dans la table `users` avec le rôle `owner`

## 2. Création Manuelle (Via SQL / Supabase Dashboard)

Si l'interface automatisée ne fonctionne pas, vous pouvez créer le compte manuellement.

### Étape A : Créer l'utilisateur Auth
Allez dans **Authentication > Users** sur Supabase et cliquez sur "Invite User" ou "Create User". Entrez l'email et le mot de passe.
Copiez l'**User UID** généré une fois l'utilisateur créé.

### Étape B : Exécuter le Script SQL
Ouvrez l'éditeur SQL de Supabase et exécutez la requête suivante en remplaçant `[USER_UID]` par l'ID copié à l'étape A.