-- ════════════════════════════════════════════════════════════════════════
-- MEDOS v2 - BIO DIGITAL TWIN AI - Multi-Omics Microbiome (P3 Chantier 1)
-- ════════════════════════════════════════════════════════════════════════
-- Migration additive et idempotente. Aucune table existante modifiee.
--
-- Objectif: ajouter une dimension microbiome au Twin via les taxons cles
-- (phyla, genres benefiques, neutres, pathogenes potentiels) + ratios /
-- scores synthetiques (Firmicutes/Bacteroidetes, diversite alpha,
-- producteurs de butyrate, charge LPS).
--
-- Tables creees:
--   med_microbiome_refs       - referentiel taxons + ecologie + bornes
--   med_patient_microbiome    - mesures abondance patient (tenant-scoped)
--
-- IMPORTANT: 100% ASCII (accents translitteres). Idempotent via
-- IF NOT EXISTS et ON CONFLICT DO UPDATE / DO NOTHING.
--
-- Statut: A VALIDER CLINIQUEMENT. Les bornes optimal_low/high sont
-- indicatives (litterature recente, populations adultes occidentaux).
-- Le systeme ne pose JAMAIS de diagnostic.
-- ════════════════════════════════════════════════════════════════════════

-- ── REFERENTIEL : Taxons / Ratios / Scores microbiome ────────────────────
CREATE TABLE IF NOT EXISTS med_microbiome_refs (
  taxon_code TEXT PRIMARY KEY,                 -- 'FIRMICUTES', 'AKKERMANSIA_MUCINIPHILA', ...
  taxon_name TEXT NOT NULL,                    -- nom scientifique complet
  taxon_level TEXT NOT NULL                    -- 'phylum' | 'genus' | 'species' | 'ratio' | 'score'
    CHECK (taxon_level IN ('phylum','genus','species','ratio','score')),
  ecology_fr TEXT,                             -- role ecologique / fonctionnel
  optimal_low NUMERIC,                         -- borne basse (% abondance ou valeur ratio/score)
  optimal_high NUMERIC,                        -- borne haute
  low_impact_fr TEXT,                          -- consequence si en dessous
  high_impact_fr TEXT,                         -- consequence si au dessus
  organs TEXT[] NOT NULL DEFAULT '{}',         -- organes / systemes impactes
  higher_is_worse BOOLEAN NOT NULL DEFAULT false, -- true si l'augmentation est pathologique
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── PATIENT : Mesures microbiome (tenant-scoped) ─────────────────────────
CREATE TABLE IF NOT EXISTS med_patient_microbiome (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  taxon_code TEXT NOT NULL,                    -- FK logique vers med_microbiome_refs
  relative_abundance NUMERIC NOT NULL,         -- % d'abondance relative (ou valeur ratio/score)
  sample_date DATE NOT NULL DEFAULT CURRENT_DATE,
  lab_name TEXT,                               -- nom du laboratoire (Biomesight, uBiome, GI Map...)
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','lab')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── INDEX ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_med_patient_microbiome_patient_date
  ON med_patient_microbiome(patient_id, sample_date DESC);
CREATE INDEX IF NOT EXISTS idx_med_patient_microbiome_patient_taxon
  ON med_patient_microbiome(patient_id, taxon_code);
CREATE INDEX IF NOT EXISTS idx_med_microbiome_refs_level
  ON med_microbiome_refs(taxon_level);

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Referentiel global: lecture pour tous authentifies, ecriture service_role
ALTER TABLE med_microbiome_refs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_all_med_microbiome_refs" ON med_microbiome_refs;
CREATE POLICY "read_all_med_microbiome_refs" ON med_microbiome_refs
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
DROP POLICY IF EXISTS "service_role_med_microbiome_refs" ON med_microbiome_refs;
CREATE POLICY "service_role_med_microbiome_refs" ON med_microbiome_refs
  TO service_role USING (true) WITH CHECK (true);

-- Table patient: staff du tenant (owner/practitioner/clinic_admin) + service_role
ALTER TABLE med_patient_microbiome ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_manage_med_patient_microbiome" ON med_patient_microbiome;
CREATE POLICY "staff_manage_med_patient_microbiome" ON med_patient_microbiome FOR ALL USING (
  EXISTS (
    SELECT 1 FROM tenant_memberships m
    WHERE m.tenant_id = med_patient_microbiome.tenant_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner','practitioner','clinic_admin')
      AND m.status = 'active'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM tenant_memberships m
    WHERE m.tenant_id = med_patient_microbiome.tenant_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner','practitioner','clinic_admin')
      AND m.status = 'active'
  )
);
DROP POLICY IF EXISTS "service_role_med_patient_microbiome" ON med_patient_microbiome;
CREATE POLICY "service_role_med_patient_microbiome" ON med_patient_microbiome
  TO service_role USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════════════
-- SEED med_microbiome_refs - ~30 taxons cles + ratios / scores
-- ════════════════════════════════════════════════════════════════════════
INSERT INTO med_microbiome_refs
  (taxon_code, taxon_name, taxon_level, ecology_fr, optimal_low, optimal_high,
   low_impact_fr, high_impact_fr, organs, higher_is_worse) VALUES

  -- ── PHYLA majeurs ──────────────────────────────────────────────────────
  ('FIRMICUTES','Firmicutes','phylum',
    'Phylum dominant - producteurs majeurs d acides gras a chaine courte (AGCC), fermentation des fibres',
    35, 75,
    'Reduction des AGCC, fragilite de la barriere intestinale, fatigue energetique',
    'Exces lie a profil obesogene si Bacteroidetes bas - dysbiose metabolique',
    ARRAY['gut','immune','metabolism'], false),

  ('BACTEROIDETES','Bacteroidetes','phylum',
    'Phylum dominant - degradation des polysaccharides complexes, regulation immunitaire',
    20, 50,
    'Deficit de degradation des fibres, microbiote appauvri en diversite',
    'Exces possible apres regime hyperproteine, peut accompagner inflammation chronique',
    ARRAY['gut','immune','metabolism'], false),

  ('ACTINOBACTERIA','Actinobacteria','phylum',
    'Phylum incluant Bifidobacterium - production de vitamines B, K, modulation immunitaire',
    2, 15,
    'Carence en Bifidobacterium - immunite muqueuse affaiblie, transit ralenti',
    'Rarement problematique - augmenter prebiotiques si > 20%',
    ARRAY['gut','immune'], false),

  ('PROTEOBACTERIA','Proteobacteria','phylum',
    'Phylum incluant nombreux Gram-negatifs - marqueur de dysbiose si eleve (E.coli, Klebsiella)',
    0, 5,
    'Niveau bas normal',
    'Marqueur de dysbiose - inflammation muqueuse, hyperpermeabilite intestinale, LPS eleves',
    ARRAY['gut','immune','liver'], true),

  ('VERRUCOMICROBIA','Verrucomicrobia','phylum',
    'Phylum d Akkermansia - protection de la barriere intestinale, regulation glycemique',
    1, 10,
    'Carence d Akkermansia - mucus intestinal mince, intolerance au glucose',
    'Rarement excessif',
    ARRAY['gut','metabolism','immune'], false),

  ('FUSOBACTERIA','Fusobacteria','phylum',
    'Phylum de pathogenes opportunistes (F. nucleatum) - associe a inflammation et risque colorectal',
    0, 1,
    'Niveau bas normal',
    'Augmentation suspecte - inflammation intestinale, risque colorectal majore',
    ARRAY['gut','immune'], true),

  -- ── GENRES benefiques ──────────────────────────────────────────────────
  ('LACTOBACILLUS','Lactobacillus','genus',
    'Producteurs de lactate, acidification intestinale, barriere contre pathogenes',
    1, 10,
    'Defense muqueuse reduite, sensibilite aux infections, candidose possible',
    'Rarement excessif - peut surcroitre apres antibiotiques',
    ARRAY['gut','immune','vagina'], false),

  ('BIFIDOBACTERIUM','Bifidobacterium','genus',
    'Genre cle - production AGCC, vitamines, modulation immunitaire, anti-inflammatoire',
    2, 15,
    'Immunite muqueuse affaiblie, constipation, allergies, inflammation chronique',
    'Pas de risque connu d exces',
    ARRAY['gut','immune','brain'], false),

  ('AKKERMANSIA_MUCINIPHILA','Akkermansia muciniphila','species',
    'Espece protectrice - degrade et regenere le mucus intestinal, regule glycemie et inflammation',
    1, 10,
    'Barriere intestinale fragile, intolerance glucose, inflammation bas grade, surpoids',
    'Pas de risque connu',
    ARRAY['gut','metabolism','immune'], false),

  ('FAECALIBACTERIUM_PRAUSNITZII','Faecalibacterium prausnitzii','species',
    'Producteur majeur de butyrate - anti-inflammatoire puissant, energie des colonocytes',
    5, 15,
    'Deficit de butyrate - inflammation colique, MICI, depression, fatigue',
    'Pas de risque connu',
    ARRAY['gut','immune','brain'], false),

  ('ROSEBURIA','Roseburia','genus',
    'Producteur de butyrate - protection muqueuse, regulation metabolique',
    1, 10,
    'Deficit AGCC, risque metabolique et inflammatoire majore',
    'Pas de risque connu',
    ARRAY['gut','metabolism','immune'], false),

  ('EUBACTERIUM_RECTALE','Eubacterium rectale','species',
    'Producteur de butyrate - degrade amidon resistant, anti-inflammatoire',
    2, 10,
    'Deficit AGCC, inflammation, sensibilite metabolique',
    'Pas de risque connu',
    ARRAY['gut','immune'], false),

  ('BUTYRICICOCCUS','Butyricicoccus','genus',
    'Producteur de butyrate - cible therapeutique dans les MICI',
    0.1, 3,
    'Deficit AGCC, vulnerabilite inflammatoire',
    'Pas de risque connu',
    ARRAY['gut','immune'], false),

  ('PREVOTELLA','Prevotella','genus',
    'Genre associe aux regimes riches en fibres et glucides complexes (entterotype P)',
    0, 20,
    'Possible si regime occidental pauvre en fibres',
    'Exces possible avec polyarthrite, vaginose si > 30% - contexte clinique requis',
    ARRAY['gut','joints','vagina'], false),

  ('BACTEROIDES','Bacteroides','genus',
    'Genre dominant Bacteroidetes - degradation polysaccharides, regulation immunitaire',
    10, 30,
    'Fermentation des fibres reduite, microbiote appauvri',
    'Exces lie a regime occidental, possible dysbiose',
    ARRAY['gut','immune'], false),

  ('RUMINOCOCCUS','Ruminococcus','genus',
    'Degradation amidon resistant et cellulose - precurseur de production butyrate',
    1, 10,
    'Mauvaise fermentation des fibres complexes',
    'Certaines especes (R. gnavus) augmentees dans MICI',
    ARRAY['gut','immune'], false),

  -- ── GENRES neutres / a surveiller ──────────────────────────────────────
  ('STREPTOCOCCUS','Streptococcus','genus',
    'Commensal oro-pharynge - certaines especes pathogenes opportunistes',
    0, 3,
    'Niveau normal',
    'Translocation oro-intestinale - SIBO, dysbiose, contamination grele',
    ARRAY['gut','mouth','immune'], true),

  ('ENTEROCOCCUS','Enterococcus','genus',
    'Commensal intestinal - opportuniste si dysbiose ou immunodepression',
    0, 2,
    'Niveau normal',
    'Surcroissance - inflammation, risque infectieux (E. faecium, E. faecalis)',
    ARRAY['gut','immune'], true),

  ('ESCHERICHIA_COLI','Escherichia coli','species',
    'Commensal du colon - utile a faible dose, pathogene si surcroissance ou souches virulentes',
    0, 1,
    'Niveau normal',
    'Marqueur de dysbiose, augmentation des LPS, inflammation muqueuse',
    ARRAY['gut','immune','liver'], true),

  ('KLEBSIELLA','Klebsiella','genus',
    'Pathogene opportuniste - associe a spondylarthrite, infections urinaires, respiratoires',
    0, 0.5,
    'Niveau normal',
    'Surcroissance - inflammation systemique, spondylarthrite, infections nosocomiales',
    ARRAY['gut','joints','immune','lungs'], true),

  ('CLOSTRIDIUM','Clostridium','genus',
    'Genre heterogene - certaines especes benefiques (cluster IV, XIVa), d autres pathogenes',
    0, 5,
    'Possible deficit en clusters benefiques (butyrate)',
    'Marqueur de dysbiose si especes pathogenes dominantes',
    ARRAY['gut','immune'], false),

  -- ── GENRES pathogenes potentiels ───────────────────────────────────────
  ('CLOSTRIDIUM_DIFFICILE','Clostridium difficile','species',
    'Pathogene majeur - colite pseudo-membraneuse apres antibiotherapie',
    0, 0.1,
    'Niveau normal',
    'Infection a C. difficile - diarrhee severe, urgence therapeutique',
    ARRAY['gut','immune'], true),

  ('CAMPYLOBACTER','Campylobacter','genus',
    'Pathogene zoonotique - gastro-enterite, declencheur syndrome Guillain-Barre',
    0, 0.1,
    'Niveau normal',
    'Infection active - diarrhee, fievre, risque neurologique post-infectieux',
    ARRAY['gut','immune','nerves'], true),

  ('SALMONELLA','Salmonella','genus',
    'Pathogene majeur - toxi-infection alimentaire, fievre typhoide',
    0, 0.1,
    'Niveau normal',
    'Infection active - toxi-infection, urgence digestive et systemique',
    ARRAY['gut','immune','liver'], true),

  ('HELICOBACTER_PYLORI','Helicobacter pylori','species',
    'Pathogene gastrique - ulcere, gastrite chronique, risque cancer gastrique',
    0, 0.5,
    'Niveau normal',
    'Infection chronique - gastrite, ulcere, atrophie muqueuse, risque oncologique',
    ARRAY['stomach','gut','immune'], true),

  ('CANDIDA_ALBICANS','Candida albicans','species',
    'Levure commensale - opportuniste si dysbiose ou immunodepression',
    0, 1,
    'Niveau normal',
    'Candidose digestive - inflammation muqueuse, fatigue, troubles digestifs',
    ARRAY['gut','mouth','vagina','immune'], true),

  ('BLASTOCYSTIS_HOMINIS','Blastocystis hominis','species',
    'Protozoaire intestinal - statut commensal vs pathogene debattu, parfois symptomatique',
    0, 2,
    'Niveau normal',
    'Symptomes digestifs (ballonnements, diarrhee) chez patients sensibles, dysbiose associee',
    ARRAY['gut','immune'], true),

  -- ── RATIOS / SCORES synthetiques ───────────────────────────────────────
  ('FIRMICUTES_BACTEROIDETES_RATIO','Ratio Firmicutes/Bacteroidetes','ratio',
    'Marqueur global d equilibre microbien et de profil metabolique',
    0.5, 2,
    'Inversion - profil potentiellement maigre / inflammatoire',
    'Ratio eleve - profil obesogene, resistance insuline, dysbiose metabolique',
    ARRAY['gut','metabolism'], true),

  ('ALPHA_DIVERSITY_SHANNON','Indice de diversite alpha (Shannon)','score',
    'Diversite globale du microbiote - resilience, sante metabolique et immunitaire',
    3.5, 6,
    'Microbiote appauvri - fragilite immunitaire, risque metabolique, MICI, autisme, depression',
    'Diversite tres elevee rarement pathologique',
    ARRAY['gut','immune','brain','metabolism'], false),

  ('BUTYRATE_PRODUCERS_SCORE','Score producteurs de butyrate','score',
    'Somme ponderee des producteurs cles (Faecalibacterium, Roseburia, Eubacterium, Butyricicoccus)',
    10, 30,
    'Deficit butyrate - inflammation colique, MICI, depression, fatigue, hyperpermeabilite',
    'Pas de risque connu',
    ARRAY['gut','immune','brain'], false),

  ('LPS_LOAD_SCORE','Score charge LPS (endotoxines)','score',
    'Charge estimee en lipopolysaccharides issus de Proteobacteria - marqueur d endotoxemie',
    0, 5,
    'Charge LPS basse - normal',
    'Charge LPS elevee - endotoxemie, inflammation systemique, resistance insuline, fatigue chronique',
    ARRAY['gut','immune','liver','brain','metabolism'], true)

ON CONFLICT (taxon_code) DO UPDATE SET
  taxon_name = EXCLUDED.taxon_name,
  taxon_level = EXCLUDED.taxon_level,
  ecology_fr = EXCLUDED.ecology_fr,
  optimal_low = EXCLUDED.optimal_low,
  optimal_high = EXCLUDED.optimal_high,
  low_impact_fr = EXCLUDED.low_impact_fr,
  high_impact_fr = EXCLUDED.high_impact_fr,
  organs = EXCLUDED.organs,
  higher_is_worse = EXCLUDED.higher_is_worse;
