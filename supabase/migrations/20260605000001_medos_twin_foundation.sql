-- ════════════════════════════════════════════════════════════════════════
-- MEDOS v2 — BIO DIGITAL TWIN AI · Fondation (Phase 2 — Base de données)
-- ════════════════════════════════════════════════════════════════════════
-- Évolution additive de MEDOS. Aucune table existante modifiée.
--
-- Référentiels GLOBAUX (tenant_id NULL, lecture seule pour tous) :
--   med_organs, med_biomarker_refs, med_bio_nodes, med_bio_edges
-- Données PATIENT (par tenant, RLS staff + service_role) :
--   med_lab_documents, med_patient_biomarkers, med_organ_scores,
--   med_transformation_wheel, med_health_events, med_alerts,
--   med_ai_analyses, med_ai_agent_runs, med_hypotheses
--
-- Le contenu clinique seedé (organes, biomarqueurs, plages, graphe) repose
-- sur des plages fonctionnelles de référence. Statut : À VALIDER CLINIQUEMENT.
-- Le système ne produit jamais de diagnostic ; uniquement hypothèses + scores
-- + corrélations avec niveau de confiance.
-- ════════════════════════════════════════════════════════════════════════

-- ── RÉFÉRENTIEL : ORGANES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS med_organs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,                 -- 'liver', 'gut', ...
  name_fr TEXT NOT NULL,
  system TEXT NOT NULL,                      -- 'digestive','endocrine','nervous',...
  mesh_name TEXT,                            -- nom du mesh dans le modèle 3D
  position JSONB NOT NULL DEFAULT '{}',      -- {x,y,z} pour le rendu 3D fallback
  description_fr TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RÉFÉRENTIEL : BIOMARQUEURS (bibliothèque — Module 18/24) ─────────────
CREATE TABLE IF NOT EXISTS med_biomarker_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,                 -- 'CRP','TSH','HOMA_IR', ...
  name_fr TEXT NOT NULL,
  category TEXT NOT NULL,                    -- 'inflammation','metabolic','hormone','liver','kidney','thyroid','hematology','vitamin','lipid','adrenal'
  dimension TEXT NOT NULL DEFAULT 'metabolism', -- 'inflammation','oxidative_stress','metabolism','hormones','toxicity','cellular_energy'
  unit TEXT NOT NULL,
  optimal_low NUMERIC,                       -- plage fonctionnelle optimale
  optimal_high NUMERIC,
  lab_low NUMERIC,                           -- plage labo "normale" (plus large)
  lab_high NUMERIC,
  organs TEXT[] NOT NULL DEFAULT '{}',       -- codes d'organes impactés
  higher_is_worse BOOLEAN NOT NULL DEFAULT true,
  function_fr TEXT,
  associated_symptoms TEXT[] NOT NULL DEFAULT '{}',
  graph_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RÉFÉRENTIEL : KNOWLEDGE GRAPH BIOLOGIQUE (Modules 4/9/16/17/22) ──────
CREATE TABLE IF NOT EXISTS med_bio_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type TEXT NOT NULL,                   -- 'organ','biomarker','symptom','hormone','system','condition'
  ref_code TEXT NOT NULL,                    -- code stable (clé naturelle de liaison)
  label_fr TEXT NOT NULL,
  graph_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (node_type, ref_code, graph_version)
);

CREATE TABLE IF NOT EXISTS med_bio_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_code TEXT NOT NULL,                   -- ref_code source
  to_code TEXT NOT NULL,                     -- ref_code cible
  relation TEXT NOT NULL,                    -- 'causes','modulates','inflames','depletes','correlates','regulates'
  weight NUMERIC NOT NULL DEFAULT 0.5,       -- 0..1 force de la relation
  direction TEXT NOT NULL DEFAULT 'forward', -- 'forward'|'bidirectional'
  evidence_level TEXT NOT NULL DEFAULT 'expert', -- 'A'|'B'|'C'|'expert'
  sources JSONB NOT NULL DEFAULT '[]',       -- [{type:'pmid',id:'...'}]
  label_fr TEXT,
  graph_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── PATIENT : DOCUMENTS LABO IMPORTÉS (Module 3) ────────────────────────
CREATE TABLE IF NOT EXISTS med_lab_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  attachment_id UUID,                        -- → med_attachments (optionnel)
  source_type TEXT NOT NULL DEFAULT 'blood'  -- 'blood','imaging','prescription','specialist','microbiome','dna','other'
    CHECK (source_type IN ('blood','imaging','prescription','specialist','microbiome','dna','other')),
  lab_name TEXT,
  sampled_at DATE,
  status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded','extracting','extracted','failed','reviewed')),
  extraction_model TEXT,
  extraction_confidence NUMERIC,
  raw_text TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── PATIENT : VALEURS BIOMARQUEURS MESURÉES ─────────────────────────────
CREATE TABLE IF NOT EXISTS med_patient_biomarkers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  lab_document_id UUID REFERENCES med_lab_documents(id) ON DELETE SET NULL,
  biomarker_code TEXT NOT NULL,
  value NUMERIC NOT NULL,
  unit_raw TEXT,
  value_canonical NUMERIC,
  flag TEXT CHECK (flag IN ('low','normal','high','critical')),
  measured_at DATE NOT NULL DEFAULT CURRENT_DATE,
  confidence NUMERIC NOT NULL DEFAULT 1.0,
  source TEXT NOT NULL DEFAULT 'manual',     -- 'manual'|'extraction'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── PATIENT : SCORES ORGANES (Modules 6/7) ──────────────────────────────
CREATE TABLE IF NOT EXISTS med_organ_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  organ_code TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  color TEXT NOT NULL CHECK (color IN ('green','yellow','orange','red')),
  dimensions JSONB NOT NULL DEFAULT '{}',    -- {inflammation,oxidative_stress,metabolism,hormones,toxicity,cellular_energy}
  contributing_biomarkers JSONB NOT NULL DEFAULT '[]', -- traçabilité du score
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  engine_version TEXT NOT NULL DEFAULT 'v1',
  graph_version TEXT NOT NULL DEFAULT 'v1',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── PATIENT : ROUE DE TRANSFORMATION (Module 2) ─────────────────────────
CREATE TABLE IF NOT EXISTS med_transformation_wheel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,                      -- 'digestion','sleep','stress','energy',...
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  measured_at DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT NOT NULL DEFAULT 'questionnaire',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── PATIENT : TIMELINE SANTÉ 360 (Module 21) ────────────────────────────
CREATE TABLE IF NOT EXISTS med_health_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,                  -- 'illness','surgery','vaccination','pregnancy','stress','diet_change','medication'
  title TEXT NOT NULL,
  occurred_at DATE NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── PATIENT : ALERTES CLINIQUES (Module 14) ─────────────────────────────
CREATE TABLE IF NOT EXISTS med_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                        -- 'metabolic_risk','chronic_inflammation','metabolic_syndrome','deficiency','drug_interaction'
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  message_fr TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','ack','dismissed')),
  graph_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── PATIENT : ANALYSES IA (Modules 10/16/18/33) ─────────────────────────
CREATE TABLE IF NOT EXISTS med_ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                        -- 'root_cause','differential','organ_assistant','consultation_synthesis','council'
  status TEXT NOT NULL DEFAULT 'generating'
    CHECK (status IN ('generating','ready','validated','rejected','failed')),
  graph_version TEXT NOT NULL DEFAULT 'v1',
  models JSONB NOT NULL DEFAULT '{}',
  output JSONB NOT NULL DEFAULT '{}',
  confidence NUMERIC,
  created_by UUID,
  validated_by UUID,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── PATIENT : RUNS D'AGENTS IA (traçabilité fine — Module 20) ────────────
CREATE TABLE IF NOT EXISTS med_ai_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES med_ai_analyses(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  agent TEXT NOT NULL,                       -- 'exams','symptoms','wheel','organs','correlations','science','hypotheses','audit','simulation','consensus','organ_assistant','extraction'
  input_hash TEXT,
  prompt_version TEXT,
  model TEXT,
  output JSONB NOT NULL DEFAULT '{}',
  tokens INTEGER,
  latency_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── PATIENT : HYPOTHÈSES CLINIQUES (Modules 16/18) ──────────────────────
CREATE TABLE IF NOT EXISTS med_hypotheses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES med_ai_analyses(id) ON DELETE SET NULL,
  label_fr TEXT NOT NULL,
  probability NUMERIC,                       -- 0..1 (présenté comme probabiliste, jamais diagnostic)
  confidence NUMERIC,
  reasoning_fr TEXT,
  args_for JSONB NOT NULL DEFAULT '[]',
  args_against JSONB NOT NULL DEFAULT '[]',
  supporting_data JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('suggested','validated','rejected')),
  graph_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── INDEX ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_med_biomarker_refs_cat ON med_biomarker_refs(category);
CREATE INDEX IF NOT EXISTS idx_med_bio_edges_from ON med_bio_edges(from_code, graph_version);
CREATE INDEX IF NOT EXISTS idx_med_bio_edges_to ON med_bio_edges(to_code, graph_version);
CREATE INDEX IF NOT EXISTS idx_med_lab_documents_patient ON med_lab_documents(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_med_patient_biomarkers_patient ON med_patient_biomarkers(patient_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_med_patient_biomarkers_code ON med_patient_biomarkers(patient_id, biomarker_code, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_med_organ_scores_patient ON med_organ_scores(patient_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_med_organ_scores_latest ON med_organ_scores(patient_id, organ_code, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_med_wheel_patient ON med_transformation_wheel(patient_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_med_health_events_patient ON med_health_events(patient_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_med_alerts_patient ON med_alerts(patient_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_med_ai_analyses_patient ON med_ai_analyses(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_med_ai_agent_runs_analysis ON med_ai_agent_runs(analysis_id);
CREATE INDEX IF NOT EXISTS idx_med_hypotheses_patient ON med_hypotheses(patient_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Référentiels globaux : lecture pour tout authentifié, écriture service_role.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['med_organs','med_biomarker_refs','med_bio_nodes','med_bio_edges'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "read_all_%1$s" ON %1$s', t);
    EXECUTE format('CREATE POLICY "read_all_%1$s" ON %1$s FOR SELECT USING (auth.role() = ''authenticated'' OR auth.role() = ''service_role'')', t);
    EXECUTE format('DROP POLICY IF EXISTS "service_role_%1$s" ON %1$s', t);
    EXECUTE format('CREATE POLICY "service_role_%1$s" ON %1$s TO service_role USING (true) WITH CHECK (true)', t);
  END LOOP;

  -- Tables patient : staff du tenant (ALL) + service_role.
  FOREACH t IN ARRAY ARRAY[
    'med_lab_documents','med_patient_biomarkers','med_organ_scores',
    'med_transformation_wheel','med_health_events','med_alerts',
    'med_ai_analyses','med_ai_agent_runs','med_hypotheses'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "staff_manage_%1$s" ON %1$s', t);
    EXECUTE format($p$CREATE POLICY "staff_manage_%1$s" ON %1$s FOR ALL USING (
      EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.tenant_id = %1$s.tenant_id
        AND m.user_id = auth.uid() AND m.role IN ('owner','practitioner','clinic_admin') AND m.status = 'active')
    ) WITH CHECK (
      EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.tenant_id = %1$s.tenant_id
        AND m.user_id = auth.uid() AND m.role IN ('owner','practitioner','clinic_admin') AND m.status = 'active')
    )$p$, t);
    EXECUTE format('DROP POLICY IF EXISTS "service_role_%1$s" ON %1$s', t);
    EXECUTE format('CREATE POLICY "service_role_%1$s" ON %1$s TO service_role USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- ── TRIGGERS updated_at ──────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['med_lab_documents','med_ai_analyses','med_hypotheses'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %1$s_updated_at ON %1$s', t);
    EXECUTE format('CREATE TRIGGER %1$s_updated_at BEFORE UPDATE ON %1$s FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t);
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════════
-- SEEDS — Contenu clinique v1 (À VALIDER CLINIQUEMENT)
-- ════════════════════════════════════════════════════════════════════════

-- ── 12 organes (position 3D normalisée, repère anatomique de face) ──────
INSERT INTO med_organs (code, name_fr, system, mesh_name, position, sort_order) VALUES
  ('brain',       'Cerveau',                'nervous',        'brain',       '{"x":0,"y":3.2,"z":0}', 1),
  ('thyroid',     'Thyroïde',               'endocrine',      'thyroid',     '{"x":0,"y":2.4,"z":0.1}', 2),
  ('heart',       'Cœur',                   'cardiovascular', 'heart',       '{"x":-0.25,"y":1.5,"z":0.1}', 3),
  ('lungs',       'Poumons',                'respiratory',    'lungs',       '{"x":0,"y":1.6,"z":0}', 4),
  ('liver',       'Foie',                   'digestive',      'liver',       '{"x":0.45,"y":0.7,"z":0.1}', 5),
  ('stomach',     'Estomac',                'digestive',      'stomach',     '{"x":-0.3,"y":0.7,"z":0.1}', 6),
  ('pancreas',    'Pancréas',               'endocrine',      'pancreas',    '{"x":0,"y":0.5,"z":0}', 7),
  ('gut',         'Intestin',               'digestive',      'gut',         '{"x":0,"y":0,"z":0.1}', 8),
  ('kidneys',     'Reins',                  'urinary',        'kidneys',     '{"x":0,"y":0.3,"z":-0.3}', 9),
  ('adrenals',    'Surrénales',             'endocrine',      'adrenals',    '{"x":0,"y":0.6,"z":-0.3}', 10),
  ('reproductive','Organes reproducteurs',  'reproductive',   'reproductive','{"x":0,"y":-0.8,"z":0.1}', 11),
  ('immune',      'Système immunitaire',    'immune',         'immune',      '{"x":-0.5,"y":-0.2,"z":0}', 12)
ON CONFLICT (code) DO NOTHING;

-- ── ~40 biomarqueurs (plages fonctionnelles indicatives, unités usuelles) ─
INSERT INTO med_biomarker_refs (code,name_fr,category,dimension,unit,optimal_low,optimal_high,lab_low,lab_high,organs,higher_is_worse,function_fr,associated_symptoms) VALUES
  ('CRP_HS','CRP ultrasensible','inflammation','inflammation','mg/L',0,1,0,5,'{immune,heart,gut}',true,'Marqueur d''inflammation systémique','{fatigue,douleurs}'),
  ('ESR','Vitesse de sédimentation','inflammation','inflammation','mm/h',0,15,0,20,'{immune}',true,'Inflammation chronique','{fatigue}'),
  ('FIBRINOGEN','Fibrinogène','inflammation','inflammation','g/L',2,3.5,2,4,'{heart,immune}',true,'Inflammation et coagulation','{}'),
  ('HOMOCYSTEINE','Homocystéine','inflammation','oxidative_stress','µmol/L',5,7,5,15,'{heart,brain}',true,'Risque cardiovasculaire et cognitif','{fatigue,brouillard_mental}'),
  ('GLUCOSE','Glycémie à jeun','metabolic','metabolism','mg/dL',75,86,70,100,'{pancreas,liver}',true,'Régulation glycémique','{fatigue,fringales}'),
  ('HBA1C','Hémoglobine glyquée','metabolic','metabolism','%',4.8,5.3,4,5.7,'{pancreas}',true,'Glycémie moyenne 3 mois','{soif,fatigue}'),
  ('INSULIN','Insuline à jeun','metabolic','hormones','µUI/mL',2,5,2,25,'{pancreas,liver}',true,'Sécrétion insulinique','{prise_de_poids,fringales}'),
  ('HOMA_IR','HOMA-IR','metabolic','metabolism','index',0.5,1.5,0,2.5,'{pancreas,liver}',true,'Résistance à l''insuline','{prise_de_poids,fatigue}'),
  ('TRIGLYCERIDES','Triglycérides','lipid','metabolism','mg/dL',40,90,0,150,'{liver,heart}',true,'Lipides circulants','{}'),
  ('HDL','HDL cholestérol','lipid','metabolism','mg/dL',60,90,40,200,'{heart,liver}',false,'Bon cholestérol','{}'),
  ('LDL','LDL cholestérol','lipid','metabolism','mg/dL',60,100,0,130,'{heart,liver}',true,'Cholestérol LDL','{}'),
  ('TG_HDL','Ratio TG/HDL','lipid','metabolism','ratio',0,2,0,3,'{heart,liver}',true,'Marqueur de résistance insulinique','{}'),
  ('APOB','ApoB','lipid','metabolism','mg/dL',40,80,0,100,'{heart}',true,'Particules athérogènes','{}'),
  ('ALT','ALAT (SGPT)','liver','toxicity','U/L',10,25,7,56,'{liver}',true,'Enzyme hépatique','{fatigue}'),
  ('AST','ASAT (SGOT)','liver','toxicity','U/L',10,25,8,48,'{liver,heart}',true,'Enzyme hépatique/musculaire','{}'),
  ('GGT','Gamma-GT','liver','toxicity','U/L',10,25,8,61,'{liver}',true,'Stress hépatique/oxydatif','{fatigue}'),
  ('ALP','Phosphatases alcalines','liver','toxicity','U/L',45,90,40,130,'{liver}',true,'Voies biliaires/os','{}'),
  ('BILIRUBIN','Bilirubine totale','liver','toxicity','mg/dL',0.3,1,0.2,1.2,'{liver}',true,'Métabolisme hépatique','{}'),
  ('ALBUMIN','Albumine','liver','cellular_energy','g/dL',4.2,5,3.5,5,'{liver}',false,'Synthèse hépatique/nutrition','{fatigue}'),
  ('CREATININE','Créatinine','kidney','toxicity','mg/dL',0.7,1,0.6,1.3,'{kidneys}',true,'Fonction rénale','{}'),
  ('UREA','Urée','kidney','toxicity','mg/dL',15,35,10,50,'{kidneys}',true,'Fonction rénale','{}'),
  ('EGFR','DFG estimé','kidney','cellular_energy','mL/min',90,120,60,120,'{kidneys}',false,'Filtration glomérulaire','{}'),
  ('URIC_ACID','Acide urique','kidney','inflammation','mg/dL',3,5.5,2.4,7,'{kidneys,heart}',true,'Stress oxydatif/goutte','{douleurs_articulaires}'),
  ('TSH','TSH','thyroid','hormones','mUI/L',1,2,0.4,4,'{thyroid,brain}',true,'Régulation thyroïdienne','{fatigue,frilosite,prise_de_poids}'),
  ('FT4','T4 libre','thyroid','hormones','pmol/L',15,19,12,22,'{thyroid}',false,'Hormone thyroïdienne T4','{fatigue}'),
  ('FT3','T3 libre','thyroid','hormones','pmol/L',4.5,6,3.1,6.8,'{thyroid}',false,'Hormone thyroïdienne active','{fatigue,frilosite}'),
  ('ANTI_TPO','Anticorps anti-TPO','thyroid','inflammation','UI/mL',0,15,0,34,'{thyroid,immune}',true,'Auto-immunité thyroïdienne','{fatigue}'),
  ('CORTISOL_AM','Cortisol matinal','adrenal','hormones','µg/dL',12,18,6,23,'{adrenals,brain}',true,'Réponse au stress','{fatigue,insomnie}'),
  ('DHEAS','DHEA-S','adrenal','hormones','µg/dL',150,300,35,430,'{adrenals}',false,'Réserve surrénalienne','{fatigue,libido_basse}'),
  ('HEMOGLOBIN','Hémoglobine','hematology','cellular_energy','g/dL',13,15,12,17,'{immune}',false,'Transport oxygène','{fatigue,paleur}'),
  ('FERRITIN','Ferritine','hematology','inflammation','ng/mL',50,120,30,300,'{liver,immune}',true,'Réserves de fer / inflammation','{fatigue,chute_cheveux}'),
  ('IRON','Fer sérique','hematology','cellular_energy','µg/dL',70,130,50,170,'{immune}',false,'Fer circulant','{fatigue}'),
  ('TRANSFERRIN_SAT','Saturation transferrine','hematology','cellular_energy','%',25,40,20,50,'{liver}',false,'Disponibilité du fer','{fatigue}'),
  ('B12','Vitamine B12','vitamin','cellular_energy','pg/mL',500,900,200,900,'{brain,immune}',false,'Énergie/neurologie','{fatigue,brouillard_mental,fourmillements}'),
  ('FOLATE','Folates','vitamin','cellular_energy','ng/mL',10,20,3,20,'{brain}',false,'Méthylation/neurologie','{fatigue}'),
  ('VIT_D','Vitamine D (25-OH)','vitamin','cellular_energy','ng/mL',40,60,30,100,'{immune,brain}',false,'Immunité/humeur/os','{fatigue,deprime,infections}'),
  ('MAGNESIUM','Magnésium érythrocytaire','vitamin','cellular_energy','mg/dL',2,2.6,1.6,2.6,'{brain,heart}',false,'Énergie/relaxation','{crampes,insomnie,anxiete}'),
  ('ZINC','Zinc','vitamin','cellular_energy','µg/dL',90,120,70,120,'{immune}',false,'Immunité/cicatrisation','{infections}'),
  ('TESTOSTERONE','Testostérone totale','hormone','hormones','ng/dL',500,800,250,900,'{reproductive}',false,'Hormone androgénique','{fatigue,libido_basse}'),
  ('ESTRADIOL','Estradiol','hormone','hormones','pg/mL',30,150,20,400,'{reproductive,brain}',true,'Hormone œstrogénique','{}'),
  ('PROGESTERONE','Progestérone','hormone','hormones','ng/mL',5,20,1,25,'{reproductive}',false,'Hormone de la phase lutéale','{insomnie,anxiete}')
ON CONFLICT (code) DO NOTHING;

-- ── Knowledge graph : nœuds (organes, biomarqueurs clés, symptômes) ──────
INSERT INTO med_bio_nodes (node_type, ref_code, label_fr) VALUES
  ('organ','liver','Foie'),('organ','gut','Intestin'),('organ','thyroid','Thyroïde'),
  ('organ','adrenals','Surrénales'),('organ','pancreas','Pancréas'),('organ','brain','Cerveau'),
  ('symptom','fatigue','Fatigue'),('symptom','insomnie','Insomnie'),('symptom','brouillard_mental','Brouillard mental'),
  ('symptom','prise_de_poids','Prise de poids'),('condition','stress_chronique','Stress chronique'),
  ('condition','dysbiose','Dysbiose intestinale'),('condition','insulino_resistance','Résistance insulinique'),
  ('condition','inflammation','Inflammation chronique'),('hormone','cortisol','Cortisol'),('hormone','insulin','Insuline')
ON CONFLICT (node_type, ref_code, graph_version) DO NOTHING;

-- ── Knowledge graph : arêtes (chaînes causales — le savoir clinique) ─────
INSERT INTO med_bio_edges (from_code,to_code,relation,weight,direction,evidence_level,label_fr) VALUES
  ('stress_chronique','adrenals','modulates',0.8,'forward','B','Le stress sollicite les surrénales'),
  ('adrenals','cortisol','regulates',0.9,'forward','A','Sécrétion de cortisol'),
  ('cortisol','insomnie','causes',0.7,'forward','B','Cortisol élevé perturbe le sommeil'),
  ('cortisol','insulino_resistance','modulates',0.6,'forward','B','Cortisol favorise la résistance insulinique'),
  ('insulino_resistance','pancreas','inflames',0.6,'forward','B','Surcharge du pancréas'),
  ('insulino_resistance','liver','modulates',0.7,'forward','B','Stéatose et dysmétabolisme hépatique'),
  ('liver','inflammation','correlates',0.6,'bidirectional','C','Foie et inflammation systémique'),
  ('dysbiose','gut','inflames',0.8,'forward','B','La dysbiose enflamme la muqueuse'),
  ('gut','inflammation','causes',0.7,'forward','B','Hyperperméabilité → inflammation'),
  ('inflammation','brain','modulates',0.6,'forward','C','Neuro-inflammation'),
  ('inflammation','fatigue','causes',0.7,'forward','B','Cytokines et fatigue'),
  ('dysbiose','brouillard_mental','correlates',0.5,'forward','C','Axe intestin-cerveau'),
  ('thyroid','fatigue','causes',0.7,'forward','A','Hypothyroïdie et fatigue'),
  ('thyroid','prise_de_poids','causes',0.6,'forward','A','Ralentissement métabolique'),
  ('insulino_resistance','prise_de_poids','causes',0.7,'forward','B','Stockage adipeux')
ON CONFLICT DO NOTHING;
