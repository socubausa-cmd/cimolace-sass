-- Boutique numérique + accompagnement « La Femme Nouvelle ».
--
-- Trois briques, toutes publiques côté visiteur (aucun compte requis) :
--   1. digital_products / digital_orders  → vente du PDF, livraison par lien signé
--   2. accompaniment_* → programme d'accompagnement + demandes de rendez-vous
--   3. site_reviews (existante) étendue → avis clientes rattachés à un produit
--
-- RLS : tables FERMÉES (aucune policy anonyme) sauf site_reviews qui garde les
-- siennes. Tout passe par l'API (service_role) — même choix que la cagnotte :
-- le front n'écrit jamais en direct dans une table qui porte de l'argent.
--
-- ⚠️ Appliquée HORS-BANDE via psql (jamais `supabase db push` sur ce projet).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PRODUITS NUMÉRIQUES
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.digital_products (
  slug             text primary key,
  tenant_slug      text not null default 'isna',
  title            text not null,
  subtitle         text,
  author           text,
  description      text,
  -- Argumentaire éditorial : [{ "title": "...", "body": "..." }]
  highlights       jsonb not null default '[]'::jsonb,
  -- Extraits mis en avant : [{ "quote": "...", "source": "p. 130" }]
  excerpts         jsonb not null default '[]'::jsonb,
  cover_url        text,
  page_count       integer,
  format           text not null default 'pdf',
  -- Fichier source dans un bucket PRIVÉ (jamais d'URL publique).
  storage_bucket   text not null default 'digital-products',
  storage_path     text not null,
  -- Prix de référence en centimes EUR + prix affiché en zone CFA.
  price_cents      integer not null check (price_cents >= 0),
  price_xaf        integer check (price_xaf >= 0),
  currency         text not null default 'EUR',
  -- Filigrane nominatif sur chaque exemplaire vendu (anti-diffusion).
  watermark        boolean not null default true,
  max_downloads    integer not null default 5 check (max_downloads > 0),
  download_days    integer not null default 90 check (download_days > 0),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.digital_orders (
  id                  uuid primary key default gen_random_uuid(),
  product_slug        text not null references public.digital_products(slug) on delete cascade,
  provider            text not null check (provider in ('stripe','pawapay')),
  -- Normalisé en centimes EUR (comparable entre les deux fournisseurs).
  amount_cents        integer not null check (amount_cents >= 0),
  -- Montant RÉELLEMENT débité (65 596 XAF ≠ 100 €) + sa devise.
  display_amount      numeric,
  display_currency    text,
  status              text not null default 'pending'
                        check (status in ('pending','completed','failed','refunded')),
  provider_ref        text,
  buyer_email         text not null,
  buyer_name          text,
  buyer_phone         text,
  country             text,
  -- Jeton de téléchargement : opaque, à usage limité, expirant.
  download_token      text unique,
  download_expires_at timestamptz,
  download_count      integer not null default 0,
  -- Copie filigranée mise en cache (générée au 1er téléchargement).
  watermarked_path    text,
  created_at          timestamptz not null default now(),
  completed_at        timestamptz
);

create index if not exists idx_digital_orders_product_status
  on public.digital_orders(product_slug, status);
create index if not exists idx_digital_orders_email
  on public.digital_orders(lower(buyer_email));
create unique index if not exists uq_digital_orders_provider_ref
  on public.digital_orders(provider, provider_ref) where provider_ref is not null;

alter table public.digital_products enable row level security;
alter table public.digital_orders   enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ACCOMPAGNEMENT
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.accompaniment_programs (
  slug          text primary key,
  tenant_slug   text not null default 'isna',
  title         text not null,
  tagline       text,
  intro         text,
  -- Curriculum : [{ "key","title","summary","topics":[...] }]
  axes          jsonb not null default '[]'::jsonb,
  -- Ce qui est explicitement HORS périmètre (cadre déontologique affiché).
  disclaimer    text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.accompaniment_formulas (
  id             uuid primary key default gen_random_uuid(),
  program_slug   text not null references public.accompaniment_programs(slug) on delete cascade,
  key            text not null,
  title          text not null,
  summary        text,
  -- Ce que la formule contient : ["12 séances individuelles", ...]
  includes       jsonb not null default '[]'::jsonb,
  duration_label text,
  price_cents    integer check (price_cents >= 0),
  price_xaf      integer check (price_xaf >= 0),
  billing_label  text,
  is_featured    boolean not null default false,
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (program_slug, key)
);

create table if not exists public.accompaniment_requests (
  id            uuid primary key default gen_random_uuid(),
  program_slug  text not null references public.accompaniment_programs(slug) on delete cascade,
  formula_key   text,
  full_name     text not null,
  email         text not null,
  phone         text,
  country       text,
  -- Créneau SOUHAITÉ par la demandeuse ; confirmé ensuite par le secrétariat.
  preferred_at  timestamptz,
  preferred_note text,
  channel       text check (channel in ('visio','telephone','whatsapp','presentiel')),
  message       text,
  status        text not null default 'nouvelle'
                  check (status in ('nouvelle','contactee','planifiee','terminee','annulee')),
  consent       boolean not null default false,
  source        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_accompaniment_requests_status
  on public.accompaniment_requests(status, created_at desc);

alter table public.accompaniment_programs enable row level security;
alter table public.accompaniment_formulas enable row level security;
alter table public.accompaniment_requests enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. AVIS — on ÉTEND la table existante plutôt que d'en créer une seconde
-- ─────────────────────────────────────────────────────────────────────────────

-- `order_id` et NON l'e-mail : la policy anonyme de site_reviews autorise la
-- lecture de TOUTE la ligne approuvée (RLS = ligne, pas colonne). Un e-mail posé
-- ici serait donc public. L'identité de l'acheteuse reste dans digital_orders,
-- table fermée ; le lien sert uniquement au badge « achat vérifié ».
alter table public.site_reviews add column if not exists product_slug text;
alter table public.site_reviews add column if not exists order_id uuid
  references public.digital_orders(id) on delete set null;

alter table public.site_reviews drop constraint if exists site_reviews_source_check;
alter table public.site_reviews add constraint site_reviews_source_check
  check (source in ('isna','ngowazulu','femme-nouvelle'));

create index if not exists idx_site_reviews_product
  on public.site_reviews(product_slug, status, submitted_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. BUCKET PRIVÉ pour les fichiers vendus
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('digital-products', 'digital-products', false)
on conflict (id) do update set public = false;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. AMORÇAGE — le livre
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.digital_products (
  slug, title, subtitle, author, description,
  page_count, storage_path, price_cents, price_xaf, cover_url, highlights, excerpts
)
values (
  'femme-nouvelle',
  'On t''a jugée sans t''entendre',
  'Le procès qu''on n''a jamais fait aux femmes',
  'Ngowazulu Nemayekou — 5ᵉ Manikongo · MK5',
  'Un tribunal se réunit depuis des siècles sans salle, sans robe et sans huissier. '
  || 'Il rend toujours le même verdict contre les mêmes femmes, et il ne les a jamais appelées à la barre. '
  || 'Ce livre est la révision de ce procès : on rouvre le dossier, on aligne les preuves, on entend la défense. '
  || 'À la fin, ce n''est plus un ouvrage sur les femmes que tu tiens — c''est le tien, daté et signé.',
  144,
  'femme-nouvelle/on-t-a-jugee.pdf',
  3000,
  20000,
  '/livres/femme-nouvelle-couverture.jpg',
  '[
    {"title":"Une révision, pas une plaidoirie","body":"Le livre ne demande pas pardon et ne quémande rien. Il rouvre le dossier au sens juridique : chefs d''accusation, pièces, témoins, verdict."},
    {"title":"Sept armes, chacune démontrée","body":"Le corps neuf, la rivière et le papillon, les chiffres retournés, la flèche du temps… Chaque argument est sourcé, y compris dans Nature Medicine."},
    {"title":"Une fiche de défense à garder sur soi","body":"Vingt phrases qu''on t''a jetées au visage, et la réplique exacte à chacune. À détacher, à emporter."},
    {"title":"Quatre pièces à remplir de ta main","body":"Le livre est aussi un dossier. Tu y verses ta version, et tu signes toi-même l''acte d''acquittement."},
    {"title":"Les traditions retournées contre la doctrine","body":"L''Écriture, le Coran, les reines et les ancêtres disent le contraire de ce qu''on prêche en leur nom. Chapitre et verset à l''appui."},
    {"title":"Une annexe si tu n''es pas en sécurité","body":"Parce qu''un livre qui allège ne doit jamais mettre en difficulté celle qui le lit."}
  ]'::jsonb,
  '[
    {"quote":"Un jugement rendu sans t''entendre n''est pas un verdict : c''est une rumeur en robe.","source":"Les douze vérités à emporter"},
    {"quote":"Une morale qui n''offre aucune rédemption n''est pas une morale : c''est une chaîne.","source":"Les douze vérités à emporter"},
    {"quote":"La voix qui te diminue parle leur langue, pas la tienne.","source":"Chapitre 4"},
    {"quote":"Une faute a un nom, une date et une victime. Ce qui n''en a pas n''est pas une faute : c''est une étiquette.","source":"Les douze vérités à emporter"},
    {"quote":"Tu es la rivière, pas l''eau d''hier : on ne te juge pas sur ce qui s''est écoulé.","source":"Arme 2 — La rivière et le papillon"},
    {"quote":"Tu n''as pas à débattre de ta valeur. On ne se défend pas en se justifiant : on tient.","source":"Chapitre 29 — Tenir ta position"}
  ]'::jsonb
)
on conflict (slug) do update set
  title       = excluded.title,
  subtitle    = excluded.subtitle,
  author      = excluded.author,
  description = excluded.description,
  page_count  = excluded.page_count,
  highlights  = excluded.highlights,
  excerpts    = excluded.excerpts,
  updated_at  = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. AMORÇAGE — le programme d'accompagnement
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.accompaniment_programs (slug, title, tagline, intro, disclaimer, axes)
values (
  'devenir-femme-nouvelle',
  'Devenir Femme Nouvelle',
  'Le livre ouvre le dossier. Le parcours te remet debout.',
  'Lire son acquittement ne suffit pas toujours. Sept axes de travail, menés avec toi, '
  || 'pour sortir de l''accusation et reprendre ta place : le caractère, le corps, les savoirs '
  || 'qu''on ne transmet plus, l''homme et la maison, la maternité, et la défense au quotidien.',
  'Cet accompagnement est un travail de caractère, de posture et de savoir-faire. '
  || 'Ce n''est ni un soin médical, ni une psychothérapie, ni un conseil juridique. '
  || 'Si tu es en danger, ou si tu traverses une souffrance qui demande un soignant, '
  || 'nous te le disons et nous t''orientons — c''est une règle du cadre, pas un refus.',
  '[
    {
      "key":"socle",
      "title":"Axe 1 — Sortir de l''accusation",
      "summary":"Le socle, tiré du livre : on démonte ce qu''on t''a fait porter avant de construire quoi que ce soit.",
      "topics":[
        "Nommer le tribunal invisible et ses chefs d''accusation",
        "Désarmer la honte — la séparer de la culpabilité réelle",
        "Et si j''ai vraiment fait du mal ? La réparation sans l''écrasement",
        "Reprendre le récit de sa propre histoire",
        "Prononcer son verdict et le dater"
      ]
    },
    {
      "key":"caractere",
      "title":"Axe 2 — Le caractère",
      "summary":"Assumer son passé, sa féminité, et affronter la suite sans se justifier.",
      "topics":[
        "Assumer son passé sans avoir à le raconter",
        "Tenir sa position quand on te pousse à te défendre",
        "L''estime qui ne se négocie pas",
        "Dire non, poser une limite, la tenir dans la durée",
        "Gérer la colère, la peur et la jalousie",
        "La solitude choisie contre la solitude subie",
        "Décider vite et bien : la fermeté sans la dureté"
      ]
    },
    {
      "key":"corps",
      "title":"Axe 3 — Le corps et la présence",
      "summary":"L''apparence n''est pas de la coquetterie : c''est le premier langage qu''on lit sur toi.",
      "topics":[
        "Le corps réhabité : posture, port de tête, ancrage",
        "La démarche — marcher comme une femme qui sait où elle va",
        "S''habiller : silhouette, couleurs, le vêtement qui parle avant toi",
        "Le visage : peau, coiffure, maquillage juste",
        "La voix : timbre, débit, et la puissance du silence",
        "Le regard et la poignée de main",
        "Entrer dans une pièce, en sortir, occuper l''espace",
        "Le soin comme discipline, pas comme performance"
      ]
    },
    {
      "key":"savoirs",
      "title":"Axe 4 — Les savoirs de la femme",
      "summary":"Ce que les anciennes savaient et qu''on a cessé de transmettre.",
      "topics":[
        "Les secrets mystiques de la femme — la part qu''on ne montre pas",
        "Le pouvoir de la séduction : désir, mystère, retenue",
        "Le pouvoir du lit : l''intimité comme lieu d''alliance, pas de monnaie",
        "Le pouvoir de la cuisine : nourrir, recevoir, tenir une maison",
        "Les soins traditionnels du corps et leur usage juste",
        "Le rythme féminin : cycle, énergie, fertilité",
        "Le parfum, la parure et ce qu''ils signalent",
        "La discrétion : ce qui se dit, ce qui se garde"
      ]
    },
    {
      "key":"homme",
      "title":"Axe 5 — L''homme, le couple, la maison",
      "summary":"Choisir, construire, et traverser les crises sans se perdre.",
      "topics":[
        "Les critères de choix : lire un homme avant de s''attacher",
        "Les signaux d''alerte — manipulation, emprise, violence, dépendance",
        "La gestion de l''homme : influence, respect, autorité partagée",
        "Le dialogue : dire sans blesser, entendre sans plier",
        "La gestion des crises : disputes, silences, infidélité, belle-famille",
        "Le mariage : ce qui se négocie AVANT, jamais après",
        "L''argent dans le couple — comptes, apports, indépendance",
        "Rompre quand il le faut : partir proprement et en sécurité"
      ]
    },
    {
      "key":"maternite",
      "title":"Axe 6 — Grossesse, maternité, transmission",
      "summary":"Le passage le plus exposé — et celui où la chaîne se rompt ou se répète.",
      "topics":[
        "Les secrets de la grossesse : préparation, corps, entourage",
        "Se protéger des jugements et des conseils non sollicités",
        "Après l''accouchement : le corps, le moral, le couple",
        "Élever sans reproduire — rompre la chaîne mère → fille",
        "Transmettre à sa fille ce qu''on ne t''a pas transmis",
        "Parler à son fils du respect des femmes"
      ]
    },
    {
      "key":"defense",
      "title":"Axe 7 — Défense et position sociale",
      "summary":"Les armes du quotidien, quand l''accusation revient par la porte ou par l''écran.",
      "topics":[
        "Repérer et désamorcer la manipulation",
        "Quand il dit… tu réponds — la fiche de défense du livre, travaillée à voix haute",
        "Tenir face à la famille, à l''église, au quartier",
        "Au travail : se faire respecter, négocier, ne pas s''excuser d''exister",
        "Le numérique : réputation, photos, harcèlement, revenge porn",
        "Reconnaître le danger et savoir où aller",
        "Bâtir son cercle : les femmes sur qui compter"
      ]
    }
  ]'::jsonb
)
on conflict (slug) do update set
  title      = excluded.title,
  tagline    = excluded.tagline,
  intro      = excluded.intro,
  disclaimer = excluded.disclaimer,
  axes       = excluded.axes,
  updated_at = now();

-- Formules — PRIX À CONFIRMER PAR LE FONDATEUR (valeurs de départ, éditables ici).
insert into public.accompaniment_formulas
  (program_slug, key, title, summary, includes, duration_label, price_cents, price_xaf, billing_label, is_featured, sort_order)
values
  ('devenir-femme-nouvelle','decouverte','Séance découverte',
   'Un premier rendez-vous pour dire ce qui pèse et savoir par où commencer.',
   '["1 séance de 60 minutes","Visio, téléphone ou WhatsApp","Un point de départ écrit, à garder","Sans engagement"]'::jsonb,
   '1 h', 3900, 25000, 'Séance unique', false, 1),
  ('devenir-femme-nouvelle','parcours','Parcours Femme Nouvelle',
   'Les sept axes travaillés dans l''ordre, sur trois mois. Le cœur du programme.',
   '["12 séances individuelles d''1 h","Les 7 axes complets","Exercices entre les séances","Messagerie directe entre les rendez-vous","La fiche de défense travaillée à voix haute","Le livre en PDF offert"]'::jsonb,
   '12 semaines', 44500, 290000, 'Paiement en 1 ou 3 fois', true, 2),
  ('devenir-femme-nouvelle','intensif','Accompagnement intensif',
   'Six mois de suivi rapproché, pour une reconstruction en profondeur ou une sortie de crise.',
   '["24 séances individuelles","Suivi WhatsApp entre les séances","Séances de couple ou de famille si besoin","Coaching apparence et présence en atelier","Accès au Cercle inclus","Le livre en PDF offert"]'::jsonb,
   '6 mois', 105000, 690000, 'Paiement échelonné possible', false, 3),
  ('devenir-femme-nouvelle','cercle','Le Cercle des Femmes Nouvelles',
   'Un groupe qui se retrouve deux fois par mois. On avance moins vite, mais on n''avance pas seule.',
   '["2 rencontres de groupe par mois","Un axe travaillé par mois","Le groupe de parole entre les séances","Sans engagement de durée"]'::jsonb,
   'Mensuel', 2300, 15000, 'Par mois, résiliable', false, 4)
on conflict (program_slug, key) do update set
  title          = excluded.title,
  summary        = excluded.summary,
  includes       = excluded.includes,
  duration_label = excluded.duration_label,
  price_cents    = excluded.price_cents,
  price_xaf      = excluded.price_xaf,
  billing_label  = excluded.billing_label,
  is_featured    = excluded.is_featured,
  sort_order     = excluded.sort_order,
  updated_at     = now();
