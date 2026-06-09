-- ════════════════════════════════════════════════════════════════════════
-- MEDOS v2 - BIO DIGITAL TWIN AI - Multi-Omics Metabolomique (P3 C2)
-- ════════════════════════════════════════════════════════════════════════
-- Migration additive et idempotente. Aucune table existante modifiee.
--
-- Objectif: ajouter une dimension metabolomique au Twin (acides organiques
-- urinaires, acides amines, neurotransmetteurs, acides gras, marqueurs
-- mitochondriaux). Les valeurs sont rattachees a des voies biochimiques
-- (methylation, neurotransmission, cycle de Krebs, mitochondrie, axe
-- omega) qui permettent une lecture systemique du metabolisme patient.
--
-- Tables creees:
--   med_metabolite_refs        - referentiel metabolites (lecture globale)
--   med_patient_metabolites    - mesures patient (tenant-scoped, RLS staff)
--
-- IMPORTANT: 100% ASCII (accents translitteres). Idempotent via
-- IF NOT EXISTS et ON CONFLICT DO UPDATE / DO NOTHING.
--
-- Statut: A VALIDER CLINIQUEMENT. Plages issues de la litterature de
-- medecine fonctionnelle (Genova/Doctor's Data/Mosaic ranges) +
-- recommandations classiques. Le systeme ne pose JAMAIS de diagnostic.
-- ════════════════════════════════════════════════════════════════════════

-- ── REFERENTIEL : metabolites (universel, lecture globale) ──────────────
CREATE TABLE IF NOT EXISTS med_metabolite_refs (
  metabolite_code TEXT PRIMARY KEY,           -- ex: 'METHYLMALONIC_ACID_U'
  name_fr TEXT NOT NULL,
  name_en TEXT,
  category TEXT NOT NULL
    CHECK (category IN (
      'organic_acid','amino_acid','neurotransmitter',
      'fatty_acid','mitochondrial'
    )),
  unit TEXT,                                  -- ex: 'umol/g creat', 'umol/L'
  optimal_low NUMERIC,                        -- borne basse cible fonctionnelle
  optimal_high NUMERIC,                       -- borne haute cible fonctionnelle
  lab_low NUMERIC,                            -- borne basse labo (large)
  lab_high NUMERIC,                           -- borne haute labo (large)
  pathway_fr TEXT,                            -- voie biochimique (FR)
  deficiency_impact_fr TEXT,                  -- impact si trop bas
  excess_impact_fr TEXT,                      -- impact si trop haut
  organs TEXT[] NOT NULL DEFAULT '{}',        -- organes concernes (codes)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── PATIENT : mesures (tenant-scoped, RLS staff) ────────────────────────
CREATE TABLE IF NOT EXISTS med_patient_metabolites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  metabolite_code TEXT NOT NULL,              -- FK logique vers med_metabolite_refs
  value NUMERIC NOT NULL,
  unit TEXT,
  sample_date DATE NOT NULL DEFAULT CURRENT_DATE,
  lab_name TEXT,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','lab','import')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── INDEX ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_med_patient_metabolites_patient
  ON med_patient_metabolites(patient_id, sample_date DESC);
CREATE INDEX IF NOT EXISTS idx_med_patient_metabolites_code
  ON med_patient_metabolites(patient_id, metabolite_code);
CREATE INDEX IF NOT EXISTS idx_med_metabolite_refs_category
  ON med_metabolite_refs(category);

-- ── RLS ─────────────────────────────────────────────────────────────────
-- Referentiel : lecture pour tous authentifies + service_role
ALTER TABLE med_metabolite_refs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_all_med_metabolite_refs" ON med_metabolite_refs;
CREATE POLICY "read_all_med_metabolite_refs" ON med_metabolite_refs
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
DROP POLICY IF EXISTS "service_role_med_metabolite_refs" ON med_metabolite_refs;
CREATE POLICY "service_role_med_metabolite_refs" ON med_metabolite_refs
  TO service_role USING (true) WITH CHECK (true);

-- Patient : staff du tenant (owner/practitioner/clinic_admin) + service_role
ALTER TABLE med_patient_metabolites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_manage_med_patient_metabolites" ON med_patient_metabolites;
CREATE POLICY "staff_manage_med_patient_metabolites" ON med_patient_metabolites FOR ALL USING (
  EXISTS (
    SELECT 1 FROM tenant_memberships m
    WHERE m.tenant_id = med_patient_metabolites.tenant_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner','practitioner','clinic_admin')
      AND m.status = 'active'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM tenant_memberships m
    WHERE m.tenant_id = med_patient_metabolites.tenant_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner','practitioner','clinic_admin')
      AND m.status = 'active'
  )
);
DROP POLICY IF EXISTS "service_role_med_patient_metabolites" ON med_patient_metabolites;
CREATE POLICY "service_role_med_patient_metabolites" ON med_patient_metabolites
  TO service_role USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════════════
-- SEED med_metabolite_refs - ~40 metabolites essentiels
-- ════════════════════════════════════════════════════════════════════════
INSERT INTO med_metabolite_refs (metabolite_code, name_fr, name_en, category, unit, optimal_low, optimal_high, lab_low, lab_high, pathway_fr, deficiency_impact_fr, excess_impact_fr, organs) VALUES

-- ── ACIDES ORGANIQUES URINAIRES (Krebs, methylation, neuro) ────────────
('METHYLMALONIC_ACID_U','Acide methylmalonique urinaire','Methylmalonic Acid','organic_acid','mmol/mol creat',0.4,2.4,0,3.6,
  'Methylation - marqueur fonctionnel B12',NULL,
  'Indique deficit B12 fonctionnel - fatigue, troubles neuro, anemie macrocytaire',
  ARRAY['brain','blood','digestive']),

('XANTHURENATE','Xanthurenate urinaire','Xanthurenate','organic_acid','mmol/mol creat',0.05,0.6,0,1.2,
  'Voie kynurenine - marqueur fonctionnel B6 (P5P)',NULL,
  'Indique deficit B6 - troubles neurotransmetteurs, irritabilite, retention eau',
  ARRAY['brain','liver']),

('KYNURENATE','Kynurenate urinaire','Kynurenate','organic_acid','mmol/mol creat',0.1,1.5,0,3,
  'Voie kynurenine - metabolite tryptophane neuroprotecteur',
  'Si bas: tryptophane derive vers quinolinate (neurotoxique)',
  'Eleve peut traduire inflammation chronique (IDO active)',
  ARRAY['brain']),

('QUINOLINATE','Quinolinate urinaire','Quinolinate','organic_acid','mmol/mol creat',0.5,3,0,6,
  'Voie kynurenine - neurotoxique (agoniste NMDA)',NULL,
  'Eleve = neuroinflammation, depression, deficit cognitif. Soutenir B6, anti-inflammatoires',
  ARRAY['brain']),

('PYROGLUTAMATE','Pyroglutamate urinaire','Pyroglutamate','organic_acid','mmol/mol creat',15,40,0,70,
  'Cycle gamma-glutamyl - marqueur deperdition glutathion',NULL,
  'Eleve = glutathion eleve consomme - charge oxydative/toxique. Soutenir NAC, glycine, cysteine',
  ARRAY['liver','brain']),

('2_HYDROXYBUTYRATE','Acide 2-hydroxybutyrique','2-Hydroxybutyrate','organic_acid','mmol/mol creat',0,1,0,3,
  'Stress oxydatif - reflete consommation glutathion',NULL,
  'Eleve = resistance insuline, stress oxydatif, deplition glutathion',
  ARRAY['liver','pancreas']),

('3_HYDROXYBUTYRATE','Beta-hydroxybutyrate (cetone)','3-Hydroxybutyrate','organic_acid','mmol/L',0,0.3,0,3,
  'Cetogenese - oxydation acides gras hepatiques',
  'Tres bas chronique = dependance glucose exclusive',
  'Eleve = cetose nutritionnelle (jeune/keto) ou acidocetose (urgence diabete)',
  ARRAY['liver','pancreas','brain']),

('LACTATE','Lactate sanguin','Lactate','organic_acid','mmol/L',0.5,1.5,0,2.2,
  'Glycolyse anaerobie - marqueur fonction mitochondriale',NULL,
  'Eleve persistant = dysfonction mitochondriale, hypoxie tissulaire, deficit B1',
  ARRAY['heart','brain','liver']),

('PYRUVATE','Pyruvate sanguin','Pyruvate','organic_acid','mmol/L',0.03,0.1,0,0.15,
  'Glycolyse - entree dans le cycle de Krebs',NULL,
  'Eleve avec lactate eleve = blocage entree mitochondrie (B1, lipoate)',
  ARRAY['heart','brain']),

('CITRATE','Citrate urinaire','Citrate','organic_acid','mmol/mol creat',150,500,50,900,
  'Cycle de Krebs - premier intermediaire',
  'Bas = acidose, risque calculs renaux',
  'Eleve = bonne alimentation alcaline',
  ARRAY['kidneys','heart']),

('AKG','Alpha-cetoglutarate urinaire','Alpha-Ketoglutarate','organic_acid','mmol/mol creat',1,8,0,15,
  'Cycle de Krebs - precurseur glutamate',
  'Bas = dysfonction mitochondriale, deficit B-vitamines',
  'Eleve = surcharge proteique ou deficit cofacteurs',
  ARRAY['heart','liver']),

('SUCCINATE','Succinate urinaire','Succinate','organic_acid','mmol/mol creat',1,7,0,15,
  'Cycle de Krebs - intermediaire energetique',NULL,
  'Eleve = dysfonction complexe II mitochondrial, hypoxie',
  ARRAY['heart','liver']),

('FUMARATE','Fumarate urinaire','Fumarate','organic_acid','mmol/mol creat',0.2,1.5,0,3,
  'Cycle de Krebs - precurseur malate',NULL,
  'Eleve = blocage en aval (fumarase), stress oxydatif',
  ARRAY['heart','liver']),

('MALATE','Malate urinaire','Malate','organic_acid','mmol/mol creat',1,4,0,8,
  'Cycle de Krebs - regeneration oxaloacetate',
  'Bas = epuisement intermediaires Krebs',
  'Eleve possible avec supplementation',
  ARRAY['heart','liver']),

('HVA','Acide homovanillique (HVA) urinaire','Homovanillic Acid','organic_acid','mmol/mol creat',1,7,0,12,
  'Catabolisme dopamine - marqueur turnover dopaminergique',
  'Bas = synthese dopamine reduite (tyrosine, B6, fer)',
  'Eleve = stress, surstimulation, parfois COMT lent',
  ARRAY['brain']),

('VMA','Acide vanillylmandelique (VMA) urinaire','Vanillylmandelic Acid','organic_acid','mmol/mol creat',1,5,0,10,
  'Catabolisme noradrenaline/adrenaline',
  'Bas = synthese catecholamines insuffisante',
  'Eleve = stress adrenergique chronique, parfois pheochromocytome (rare)',
  ARRAY['brain','adrenals']),

('5_HIAA','5-HIAA urinaire (serotonine)','5-Hydroxyindoleacetic Acid','organic_acid','mmol/mol creat',1,8,0,15,
  'Catabolisme serotonine',
  'Bas = synthese serotonine reduite (tryptophane, B6)',
  'Eleve = synthese serotonine elevee, parfois carcinoides (rare)',
  ARRAY['brain','digestive']),

-- ── ACIDES AMINES PLASMATIQUES ──────────────────────────────────────────
('GLUTAMATE','Glutamate plasmatique','Glutamate','amino_acid','umol/L',20,90,10,160,
  'Neurotransmetteur excitateur principal - synthese GABA/glutathion',
  'Bas = baisse glutathion, GABA, vigilance',
  'Eleve = excitotoxicite, anxiete, migraine',
  ARRAY['brain']),

('GLUTAMINE','Glutamine plasmatique','Glutamine','amino_acid','umol/L',450,750,300,950,
  'Substrat enterocytes, immunite, ammoniaque',
  'Bas = atrophie intestinale, immunite faible, catabolisme',
  'Eleve possible si surcharge proteique ou foie surcharge',
  ARRAY['digestive','brain','liver']),

('GABA','GABA plasmatique','GABA','amino_acid','umol/L',0.1,1,0,2,
  'Neurotransmetteur inhibiteur principal',
  'Bas = anxiete, insomnie, hyperexcitabilite',
  'Eleve rare (supplementation, dysbiose)',
  ARRAY['brain']),

('TAURINE','Taurine plasmatique','Taurine','amino_acid','umol/L',50,250,30,400,
  'Conjugaison biliaire, stabilisation membrane, GABAergique',
  'Bas = lithiase biliaire, irritabilite cardio, deficit B6',
  'Eleve possible avec supplementation (sans risque connu)',
  ARRAY['liver','heart','brain']),

('TRYPTOPHAN','Tryptophane plasmatique','Tryptophan','amino_acid','umol/L',45,85,30,110,
  'Precurseur serotonine, melatonine, niacine',
  'Bas = depression, insomnie, deficit niacine',
  'Eleve possible si supplementation ou IDO inhibe',
  ARRAY['brain','digestive']),

('TYROSINE','Tyrosine plasmatique','Tyrosine','amino_acid','umol/L',50,90,40,130,
  'Precurseur dopamine, noradrenaline, hormones thyroidiennes',
  'Bas = fatigue, hypothyroidie fonctionnelle, baisse motivation',
  'Eleve = surcharge ou deficit hepatique (rare)',
  ARRAY['brain','thyroid','adrenals']),

('PHENYLALANINE','Phenylalanine plasmatique','Phenylalanine','amino_acid','umol/L',45,80,30,110,
  'Precurseur tyrosine via PAH',
  'Bas = carence proteique',
  'Eleve = deficit PAH (phenylcetonurie), surveiller chez PCU',
  ARRAY['brain','liver']),

('METHIONINE','Methionine plasmatique','Methionine','amino_acid','umol/L',20,40,10,55,
  'Methylation - precurseur SAMe et cysteine',
  'Bas = hypomethylation, fatigue, deficit glutathion',
  'Eleve = surcharge proteique ou CBS lent',
  ARRAY['liver','brain']),

('CYSTEINE','Cysteine plasmatique','Cysteine','amino_acid','umol/L',180,290,140,400,
  'Synthese glutathion, soufre, taurine',
  'Bas = glutathion bas, defenses antioxydantes faibles',
  'Eleve = excretion soufre alteree, parfois neurotoxique',
  ARRAY['liver','brain']),

('GLYCINE','Glycine plasmatique','Glycine','amino_acid','umol/L',200,330,150,450,
  'Synthese glutathion, conjugaison phase II, neurotransmetteur',
  'Bas = detox phase II faible, sommeil perturbe',
  'Eleve possible avec supplementation',
  ARRAY['liver','brain']),

('PROLINE','Proline plasmatique','Proline','amino_acid','umol/L',150,300,100,400,
  'Synthese collagene, integrite tissulaire',
  'Bas = collagene faible, peau/articulations',
  'Eleve possible regimes hyperproteiques',
  ARRAY['skin','joints']),

('ARGININE','Arginine plasmatique','Arginine','amino_acid','umol/L',60,130,40,180,
  'Precurseur NO (vasculaire), cycle uree',
  'Bas = NO bas (vasoconstriction), uree perturbee',
  'Eleve possible avec supplementation',
  ARRAY['heart','liver']),

('ORNITHINE','Ornithine plasmatique','Ornithine','amino_acid','umol/L',40,100,20,150,
  'Cycle uree - detoxification ammoniaque',
  'Bas = cycle uree faible, hyperammoniemie',
  'Eleve possible deficit OAT (rare)',
  ARRAY['liver']),

('CITRULLINE','Citrulline plasmatique','Citrulline','amino_acid','umol/L',20,50,15,80,
  'Cycle uree, marqueur masse enterocytaire',
  'Bas = atrophie intestinale (coeliaque, IBD), cycle uree faible',
  'Eleve = insuffisance renale, deficit OTC',
  ARRAY['digestive','liver']),

('BCAA_SUM','BCAA total (Leu+Ile+Val)','Branched Chain Amino Acids','amino_acid','umol/L',350,600,250,800,
  'Synthese musculaire, energie mitochondriale',
  'Bas = catabolisme musculaire, deficit proteique',
  'Eleve = insulinoresistance, surcharge proteique',
  ARRAY['muscles','liver']),

-- ── NEUROTRANSMETTEURS (mesures specialisees) ──────────────────────────
('SEROTONIN_PLATELET','Serotonine plaquettaire','Platelet Serotonin','neurotransmitter','ng/10^9 plaquettes',125,500,80,800,
  'Stock serotoninergique peripherique - reflet partiel central',
  'Bas = symptomes depressifs, troubles digestifs',
  'Eleve = supplementation 5-HTP, parfois carcinoide',
  ARRAY['brain','digestive']),

('DOPAMINE_URINE','Dopamine urinaire','Urine Dopamine','neurotransmitter','ug/g creat',100,400,50,700,
  'Catecholamine motivation, plaisir, mouvement',
  'Bas = anhedonie, fatigue mentale, deficit tyrosine/B6',
  'Eleve = stress, parfois pathologie surrenalienne',
  ARRAY['brain','adrenals']),

('NOREPINEPHRINE_URINE','Noradrenaline urinaire','Urine Norepinephrine','neurotransmitter','ug/g creat',15,60,10,100,
  'Catecholamine vigilance, stress, focus',
  'Bas = fatigue, hypotension, manque vigilance',
  'Eleve = stress chronique, anxiete, HTA',
  ARRAY['brain','adrenals','heart']),

('ACETYLCHOLINE_RBC','Acetylcholine erythrocytaire','RBC Acetylcholine','neurotransmitter','nmol/mL',10,30,5,50,
  'Neurotransmetteur memoire, parasympathique',
  'Bas = troubles memoire, fatigue cognitive (soutenir choline, PEMT)',
  'Eleve rare',
  ARRAY['brain']),

-- ── ACIDES GRAS (membrane, inflammation) ───────────────────────────────
('OMEGA3_INDEX','Index Omega-3 (EPA+DHA % membrane RBC)','Omega-3 Index','fatty_acid','%',8,12,2,16,
  'Statut omega-3 long terme - membrane erythrocytaire',
  'Bas (<4%) = risque cardio eleve, inflammation, depression',
  'Eleve >12% sans risque demontre',
  ARRAY['heart','brain']),

('ARACHIDONIC_ACID','Acide arachidonique (AA) membrane','Arachidonic Acid','fatty_acid','%',8,12,5,18,
  'Omega-6 long - precurseur eicosanoides pro-inflammatoires',
  'Bas = membrane fragile (rare)',
  'Eleve = inflammation chronique, douleur, reduire omega-6 industriel',
  ARRAY['heart','joints','brain']),

('EPA','Acide eicosapentaenoique (EPA) membrane','EPA','fatty_acid','%',1,4,0.2,8,
  'Omega-3 long - resolution inflammation, cardio',
  'Bas = inflammation peu resolue, mood, cardio',
  'Eleve possible avec supplementation forte (sans risque)',
  ARRAY['heart','joints','brain']),

('DHA','Acide docosahexaenoique (DHA) membrane','DHA','fatty_acid','%',4,8,2,12,
  'Omega-3 long - cerveau, retine, membrane neuronale',
  'Bas = baisse cognition, troubles humeur, vision',
  'Eleve possible avec supplementation forte (sans risque)',
  ARRAY['brain','eyes','heart']),

('AA_EPA_RATIO','Ratio AA/EPA','AA/EPA Ratio','fatty_acid','ratio',1.5,3,1,15,
  'Equilibre pro/anti-inflammatoire',NULL,
  'Eleve >5 = inflammation silencieuse, augmenter EPA, baisser omega-6',
  ARRAY['heart','joints','brain']),

-- ── MITOCHONDRIAL ──────────────────────────────────────────────────────
('COQ10_RBC','Coenzyme Q10 erythrocytaire','RBC CoQ10','mitochondrial','ug/mL',0.8,1.6,0.4,2.5,
  'Chaine respiratoire mitochondriale (complexes I-III), antioxydant',
  'Bas = fatigue, faiblesse cardiaque, statines (deplition)',
  'Eleve possible avec supplementation (sans risque)',
  ARRAY['heart','muscles','brain']),

('ACETYL_L_CARNITINE','Acetyl-L-carnitine plasmatique','Acetyl-L-Carnitine','mitochondrial','umol/L',5,12,2,20,
  'Transport acides gras dans mitochondrie - energie',
  'Bas = fatigue, oxydation graisses faible, cognition',
  'Eleve possible avec supplementation',
  ARRAY['heart','muscles','brain'])

ON CONFLICT (metabolite_code) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  name_en = EXCLUDED.name_en,
  category = EXCLUDED.category,
  unit = EXCLUDED.unit,
  optimal_low = EXCLUDED.optimal_low,
  optimal_high = EXCLUDED.optimal_high,
  lab_low = EXCLUDED.lab_low,
  lab_high = EXCLUDED.lab_high,
  pathway_fr = EXCLUDED.pathway_fr,
  deficiency_impact_fr = EXCLUDED.deficiency_impact_fr,
  excess_impact_fr = EXCLUDED.excess_impact_fr,
  organs = EXCLUDED.organs;
