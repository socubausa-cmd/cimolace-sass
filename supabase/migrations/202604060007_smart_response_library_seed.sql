-- Smart Response Library seed (Prorascence)

update public.auto_reply_rules
set is_active = false,
    updated_at = now()
where intent in ('information', 'pricing', 'cursus', 'module', 'coaching', 'booking', 'support', 'complex')
  and is_active = true;

insert into public.auto_reply_rules (
  intent,
  trigger_keywords,
  reply_text,
  next_step,
  cta_primary_label,
  cta_primary_url,
  cta_secondary_label,
  cta_secondary_url,
  is_active
)
values
  (
    'information',
    array['bonjour', 'salut', 'hello', 'coucou', 'debuter'],
    'Bienvenue sur Prorascence Academy. Souhaitez-vous: 1) Comprendre les bases 2) Apprendre une pratique 3) Devenir praticien 4) Poser une question ?',
    'welcome_menu',
    'Voir les offres',
    '/formations/catalogue',
    'Parler a un humain',
    '/appointment/request',
    true
  ),
  (
    'cursus',
    array['comprendre', 'bases', 'cursus', 'fondamental'],
    'Le meilleur point de depart est le Cursus Fondamental. Il vous permet de comprendre les lois invisibles, la logique des rituels et la structure energetique. Voulez-vous voir le programme ou parler a un conseiller ?',
    'offer_cursus',
    'Voir le programme',
    '/formations/catalogue',
    'Parler a un conseiller',
    '/appointment/request',
    true
  ),
  (
    'module',
    array['apprendre', 'technique', 'module', 'libation', 'protection', 'talisman'],
    'Dans ce cas, un Module Technique est plus adapte. Vous pouvez apprendre directement libation, protection, talisman ou une autre pratique specifique. Quelle pratique vous interesse ?',
    'offer_module',
    'Voir les modules',
    '/formations/catalogue',
    'Prendre rendez-vous',
    '/appointment/request',
    true
  ),
  (
    'coaching',
    array['pratiquer professionnellement', 'devenir praticien', 'metier', 'coaching'],
    'Le Coaching Professionnel est concu pour ceux qui veulent exercer. Vous apprendrez a accompagner, diagnostiquer et pratiquer avec maitrise. Souhaitez-vous en savoir plus ou programmer un entretien ?',
    'offer_coaching',
    'Voir coaching',
    '/accompagnement/coaching',
    'Programmer un entretien',
    '/appointment/request',
    true
  ),
  (
    'information',
    array['plus loin', 'avance', 'special', 'secrets', 'cas complexes'],
    'Nous proposons aussi des Formations Speciales: techniques avancees, secrets spirituels, cas complexes. Voulez-vous voir les formations disponibles ?',
    'offer_advanced',
    'Voir formations speciales',
    '/formations/catalogue',
    'Parler a un conseiller',
    '/appointment/request',
    true
  ),
  (
    'pricing',
    array['prix', 'combien', 'tarif', 'cout', 'payer'],
    'Nos formations sont adaptees selon votre objectif: Modules a l unite, Cursus en abonnement, Coaching en parcours professionnel. Je peux vous orienter vers la meilleure option si vous me dites votre objectif.',
    'pricing_orientation',
    'Voir forfaits',
    '/forfaits',
    'Parler a un conseiller',
    '/appointment/request',
    true
  ),
  (
    'information',
    array['hesite', 'doute', 'pas sur', 'peur'],
    'C est normal d hesiter. La vraie question est: voulez-vous continuer a pratiquer sans comprendre, ou enfin maitriser ce que vous faites ? Je peux vous guider selon votre niveau.',
    'doubt_reassurance',
    'Etre guide',
    '/formations/catalogue',
    'Parler a un conseiller',
    '/appointment/request',
    true
  ),
  (
    'complex',
    array['personnel', 'complexe', 'sensible', 'cas personnel'],
    'Pour ce type de situation, il est preferable d echanger directement avec un conseiller. Je peux vous proposer un rendez-vous personnalise.',
    'escalate_human',
    'Prendre rendez-vous',
    '/appointment/request',
    'Ouvrir chat immersif',
    '/messages',
    true
  ),
  (
    'booking',
    array['rendez-vous', 'entretien', 'rdv', 'creneau'],
    'Parfait. Choisissez un creneau disponible et nous pourrons vous accompagner directement.',
    'booking',
    'Prendre rendez-vous',
    '/appointment/request',
    'Parler a un humain',
    '/messages',
    true
  ),
  (
    'pricing',
    array['pret', 'acheter', 'commencer maintenant', 'inscription'],
    'Tres bon choix. Je vous recommande de commencer des maintenant.',
    'conversion_hot',
    'Acceder a la formation',
    '/formations/catalogue',
    'Parler a un conseiller',
    '/appointment/request',
    true
  ),
  (
    'information',
    array['libation'],
    'Vous pouvez apprendre la libation de deux facons: Module pour apprendre a faire, Cursus pour comprendre pourquoi. Que souhaitez-vous ?',
    'libation_split',
    'Voir module',
    '/formations/catalogue',
    'Voir cursus',
    '/formations/catalogue',
    true
  ),
  (
    'information',
    array['talisman'],
    'Le talisman peut etre appris en pratique. Mais sans comprehension, son efficacite reste limitee. Voulez-vous apprendre a le faire ou a le comprendre ?',
    'talisman_split',
    'Apprendre a faire',
    '/formations/catalogue',
    'Apprendre a comprendre',
    '/formations/catalogue',
    true
  ),
  (
    'information',
    array['question', 'aide', 'je veux savoir'],
    'Je peux vous aider. Que souhaitez-vous exactement: comprendre, pratiquer, ou devenir praticien ?',
    'generic_qualification',
    'Voir offres',
    '/formations/catalogue',
    'Parler a un humain',
    '/appointment/request',
    true
  ),
  (
    'support',
    array['cloture', 'fin', 'merci'],
    'Prorascence n est pas une simple formation. C est une transformation.',
    'close',
    'Commencer maintenant',
    '/formations/catalogue',
    'Prendre rendez-vous',
    '/appointment/request',
    true
  );
