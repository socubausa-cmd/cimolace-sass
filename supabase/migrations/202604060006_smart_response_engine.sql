-- Smart Response Engine (visitor chatbot + secretary escalation)

create table if not exists public.conversation_threads (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid,
  visitor_name text,
  visitor_email text,
  visitor_country text,
  visitor_timezone text,
  status text not null default 'open' check (status in ('open', 'qualified', 'escalated', 'closed')),
  assigned_to uuid,
  assigned_at timestamptz,
  source text not null default 'chatbot',
  last_intent text,
  last_temperature text check (last_temperature in ('cold', 'warm', 'hot')),
  recommended_offer text,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.conversation_threads(id) on delete cascade,
  sender_type text not null check (sender_type in ('visitor', 'bot', 'secretary', 'system')),
  message text not null,
  intent_detected text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_profiles (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid,
  thread_id uuid references public.conversation_threads(id) on delete set null,
  interest_type text,
  temperature text not null default 'cold' check (temperature in ('cold', 'warm', 'hot')),
  recommended_offer text,
  next_action text,
  confidence_score int not null default 0,
  qualification_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.auto_reply_rules (
  id uuid primary key default gen_random_uuid(),
  intent text not null,
  trigger_keywords text[] not null default '{}'::text[],
  reply_text text not null,
  next_step text,
  cta_primary_label text,
  cta_primary_url text,
  cta_secondary_label text,
  cta_secondary_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.escalation_events (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.conversation_threads(id) on delete cascade,
  reason text not null,
  assigned_to uuid,
  handled boolean not null default false,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_conversation_threads_status on public.conversation_threads(status, updated_at desc);
create index if not exists idx_conversation_threads_assigned on public.conversation_threads(assigned_to, updated_at desc);
create index if not exists idx_conversation_messages_thread on public.conversation_messages(thread_id, created_at asc);
create index if not exists idx_lead_profiles_thread on public.lead_profiles(thread_id, updated_at desc);
create unique index if not exists idx_lead_profiles_thread_unique on public.lead_profiles(thread_id) where thread_id is not null;
create index if not exists idx_auto_reply_rules_intent on public.auto_reply_rules(intent, is_active);
create index if not exists idx_escalation_events_thread on public.escalation_events(thread_id, created_at desc);

insert into public.auto_reply_rules (intent, trigger_keywords, reply_text, next_step, cta_primary_label, cta_primary_url, cta_secondary_label, cta_secondary_url)
values
  (
    'information',
    array['cursus','difference','programme','formation'],
    'Le Cursus Fondamental est ideal pour comprendre les bases invisibles et la logique des pratiques. Souhaitez-vous voir le programme detaille ou parler a un conseiller ?',
    'offer_cursus',
    'Voir le cursus',
    '/formations/catalogue',
    'Parler a un humain',
    '/appointment/request'
  ),
  (
    'module',
    array['module','libation','talisman','protection','guerison'],
    'Pour un besoin precis, un module a la carte est le plus adapte. Je peux vous orienter vers le module correspondant.',
    'offer_module',
    'Voir les modules',
    '/formations/catalogue',
    'Prendre rendez-vous',
    '/appointment/request'
  ),
  (
    'coaching',
    array['coaching','metier','praticien','professionnel'],
    'Le coaching professionnel est adapte si vous voulez exercer comme praticien. Souhaitez-vous decouvrir le parcours ou programmer un entretien ?',
    'offer_coaching',
    'Decouvrir coaching',
    '/accompagnement/coaching',
    'Programmer un entretien',
    '/appointment/request'
  ),
  (
    'booking',
    array['rendez-vous','entretien','parler','conseiller'],
    'Je peux vous proposer un entretien avec le secretariat pour avancer rapidement sur votre besoin.',
    'escalate_booking',
    'Prendre rendez-vous',
    '/appointment/request',
    'Chat immersif',
    '/messages'
  ),
  (
    'payment',
    array['payer','paiement','prix','checkout','facture'],
    'Je peux vous orienter vers le bon parcours de paiement. Si votre cas est specifique, je transfere au secretariat.',
    'support_payment',
    'Voir les forfaits',
    '/forfaits',
    'Support humain',
    '/support'
  )
on conflict do nothing;
