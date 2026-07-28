# Réinitialisation de mot de passe — configuration Supabase

Deux réglages sont à faire dans le tableau de bord Supabase (projet
`fwfupxvmwtxbtbjdeqvu`). Ils ne vivent pas dans le dépôt : GoTrue les stocke
côté service, pas en base.

## 1. Autoriser l'URL de retour (bloquant)

Le lien reçu par e-mail ne ramenait pas au formulaire : il aboutissait sur la
vitrine `prorascience.org`. Cause : quand l'URL demandée n'est pas dans la liste
blanche, Supabase l'ignore et renvoie vers le **Site URL** du projet — qui est
justement la vitrine.

**Authentication → URL Configuration → Redirect URLs**, ajouter :

```
https://app.prorascience.org/**
```

Le suffixe `/**` est indispensable : `https://app.prorascience.org` seul ne
couvre pas le chemin `/update-password`.

Pour vérifier ensuite : demander un lien depuis l'app, l'ouvrir, et confirmer
qu'on arrive sur le formulaire du portail et non sur la vitrine.

## 2. Marquer l'e-mail (qualité)

Le message part aujourd'hui du gabarit par défaut de Supabase : titre « Reset
Your Password », expéditeur `noreply@mail.app.supabase.io`, texte en anglais,
aucune trace de LIRI ni du tenant. Pour une école qui envoie ça à ses élèves,
c'est un défaut visible.

### Le minimum — traduire et marquer le gabarit

**Authentication → Email Templates → Reset Password**. Sujet :

```
Réinitialiser votre mot de passe LIRI
```

Corps :

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#262624;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <tr><td align="center">
    <table width="100%" style="max-width:480px;background:#2e2e2b;border:1px solid rgba(245,241,233,.08);border-radius:18px;padding:32px">
      <tr><td>
        <p style="margin:0 0 4px;color:#f5f1e9;font-size:20px;font-weight:600">LIRI</p>
        <p style="margin:0 0 24px;color:#b0ada3;font-size:13px">Espace de formation</p>

        <h1 style="margin:0 0 12px;color:#f5f1e9;font-size:22px;font-weight:600">Réinitialiser votre mot de passe</h1>
        <p style="margin:0 0 24px;color:#b0ada3;font-size:15px;line-height:1.6">
          Vous avez demandé un nouveau mot de passe. Ce lien est valable une heure
          et ne peut servir qu'une fois.
        </p>

        <a href="{{ .ConfirmationURL }}"
           style="display:inline-block;background:#d97757;color:#fff;text-decoration:none;padding:13px 26px;border-radius:12px;font-size:15px;font-weight:600">
          Choisir un nouveau mot de passe
        </a>

        <p style="margin:24px 0 0;color:#82807a;font-size:12.5px;line-height:1.6">
          Si vous n'êtes pas à l'origine de cette demande, ignorez ce message :
          votre mot de passe actuel reste valable.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

L'expéditeur reste celui de Supabase avec cette méthode.

### L'expéditeur — SMTP maison

**Project Settings → Authentication → SMTP Settings**, avec les identifiants
Resend déjà utilisés par la plateforme (`RESEND_API_KEY`, hôte
`smtp.resend.com`, port 465, utilisateur `resend`). L'expéditeur devient alors
une adresse du domaine, et les quotas de l'envoi partagé Supabase disparaissent.

### La version multi-tenant

Un gabarit unique dans Supabase ne peut pas porter la marque de CHAQUE tenant :
un élève de zahirwellness recevrait un e-mail LIRI. La plateforme sait pourtant
déjà envoyer des e-mails marqués par tenant (`apps/worker/src/jobs/email.js`,
clé Resend par tenant). Le jour où plusieurs tenants ont des élèves, il faudra
router la demande par l'API : générer le lien côté serveur avec
`auth.admin.generateLink({ type: 'recovery' })`, puis l'envoyer via la clé
Resend du tenant et son gabarit. L'app mobile appellerait cet endpoint au lieu
de `resetPasswordForEmail`.
