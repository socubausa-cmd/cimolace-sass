-- ════════════════════════════════════════════════════════════════════════
-- MEDOS v2 - BIO DIGITAL TWIN AI - Multi-Omics Genomique (Chantier 2)
-- ════════════════════════════════════════════════════════════════════════
-- Migration additive et idempotente. Aucune table existante modifiee.
--
-- Objectif: ajouter une dimension genomique au Twin via les variants SNP
-- les plus actionnables en medecine fonctionnelle (methylation, detox,
-- neurotransmetteurs, lipides, vitamine D, cardio, glycemie, histamine,
-- alimentation, microbiote, intolerances).
--
-- Tables creees:
--   med_snp_refs        - referentiel SNP global (lecture pour tous)
--   med_patient_snps    - genotypes patient (tenant-scoped, RLS staff)
--
-- IMPORTANT: 100% ASCII (accents translitteres). Idempotent via
-- IF NOT EXISTS et ON CONFLICT DO UPDATE / DO NOTHING.
--
-- Statut: A VALIDER CLINIQUEMENT. Interpretations indicatives basees
-- sur la litterature de medecine fonctionnelle (MTHFR/COMT/APOE/VDR
-- en tete). Le systeme ne pose JAMAIS de diagnostic genetique.
-- ════════════════════════════════════════════════════════════════════════

-- ── REFERENTIEL : SNP (variants actionnables) ────────────────────────────
CREATE TABLE IF NOT EXISTS med_snp_refs (
  snp_code TEXT PRIMARY KEY,                 -- 'MTHFR_C677T', 'COMT_V158M', ...
  rs_id TEXT,                                -- 'rs1801133' (dbSNP)
  gene TEXT NOT NULL,                        -- 'MTHFR', 'COMT', ...
  chromosome TEXT,                           -- '1', '22', '19', ...
  function_fr TEXT,                          -- role biologique du gene
  risk_genotypes TEXT[] NOT NULL DEFAULT '{}', -- ex: {'TT','CT'} (allele a risque)
  wild_genotype TEXT,                        -- ex: 'CC' (variante sauvage)
  impact_fr TEXT,                            -- consequence biologique
  interventions_fr TEXT[] NOT NULL DEFAULT '{}', -- pistes nutrition/lifestyle
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── PATIENT : GENOTYPES (tenant-scoped) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS med_patient_snps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES med_patients(id) ON DELETE CASCADE,
  snp_code TEXT NOT NULL,                    -- FK logique vers med_snp_refs
  genotype TEXT NOT NULL,                    -- 'CC', 'CT', 'TT', etc.
  gene TEXT,                                 -- dupli pour requetes rapides
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','lab')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── INDEX ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_med_patient_snps_patient
  ON med_patient_snps(patient_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_med_patient_snps_code
  ON med_patient_snps(patient_id, snp_code);
CREATE INDEX IF NOT EXISTS idx_med_snp_refs_gene
  ON med_snp_refs(gene);

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Referentiel global: lecture pour tous authentifies, ecriture service_role
ALTER TABLE med_snp_refs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_all_med_snp_refs" ON med_snp_refs;
CREATE POLICY "read_all_med_snp_refs" ON med_snp_refs
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
DROP POLICY IF EXISTS "service_role_med_snp_refs" ON med_snp_refs;
CREATE POLICY "service_role_med_snp_refs" ON med_snp_refs
  TO service_role USING (true) WITH CHECK (true);

-- Table patient: staff du tenant (owner/practitioner/clinic_admin) + service_role
ALTER TABLE med_patient_snps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_manage_med_patient_snps" ON med_patient_snps;
CREATE POLICY "staff_manage_med_patient_snps" ON med_patient_snps FOR ALL USING (
  EXISTS (
    SELECT 1 FROM tenant_memberships m
    WHERE m.tenant_id = med_patient_snps.tenant_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner','practitioner','clinic_admin')
      AND m.status = 'active'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM tenant_memberships m
    WHERE m.tenant_id = med_patient_snps.tenant_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner','practitioner','clinic_admin')
      AND m.status = 'active'
  )
);
DROP POLICY IF EXISTS "service_role_med_patient_snps" ON med_patient_snps;
CREATE POLICY "service_role_med_patient_snps" ON med_patient_snps
  TO service_role USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════════════
-- SEED med_snp_refs - ~25 SNPs actionnables (medecine fonctionnelle v1)
-- ════════════════════════════════════════════════════════════════════════
INSERT INTO med_snp_refs (snp_code, rs_id, gene, chromosome, function_fr, risk_genotypes, wild_genotype, impact_fr, interventions_fr) VALUES
  ('MTHFR_C677T','rs1801133','MTHFR','1',
    'Enzyme cle de la methylation - conversion folate en 5-MTHF',
    ARRAY['CT','TT'],'CC',
    'Reduction activite MTHFR (30 a 70%) - hyperhomocysteinemie possible, deficit methylation',
    ARRAY['Folate actif (5-MTHF)','B12 methylcobalamine','B6 P5P','Reduire alcool','Choline (oeufs, foie)']),

  ('MTHFR_A1298C','rs1801131','MTHFR','1',
    'Methylation - cofacteur synthese BH4 (neurotransmetteurs)',
    ARRAY['AC','CC'],'AA',
    'Reduction modeste activite MTHFR - impact neurotransmetteurs (BH4 abaisse)',
    ARRAY['Folate actif (5-MTHF)','B12 active','Magnesium','Reduire stress oxydatif']),

  ('COMT_V158M','rs4680','COMT','22',
    'Degradation des catecholamines (dopamine, adrenaline, oestrogenes)',
    ARRAY['AA'],'GG',
    'Variant Met/Met - degradation lente catecholamines - sensibilite stress accrue, anxiete possible',
    ARRAY['Magnesium','SAMe avec prudence','Reduire cafe et stimulants','Meditation','Cruciferes pour oestrogenes']),

  ('APOE_rs429358','rs429358','APOE','19',
    'Transport lipidique cerebral - determine partiellement allele E4 (Alzheimer)',
    ARRAY['CC','CT'],'TT',
    'Allele C (E4 si combine rs7412 T) - risque cardiovasculaire et neurodegeneratif accru',
    ARRAY['Regime mediterraneen','Omega-3 DHA','Activite physique reguliere','Reduire graisses saturees','Sommeil de qualite']),

  ('APOE_rs7412','rs7412','APOE','19',
    'Transport lipidique - combine avec rs429358 pour determiner haplotype APOE',
    ARRAY['CC'],'TT',
    'Allele C - haplotype E3/E4 ou E4/E4 selon rs429358 - lipides eleves',
    ARRAY['Regime mediterraneen','Omega-3','Limiter graisses saturees','Surveillance lipidique']),

  ('VDR_FokI','rs2228570','VDR','12',
    'Recepteur vitamine D - sensibilite cellulaire a la D3',
    ARRAY['TT','CT'],'CC',
    'Variant TT (f/f) - reponse reduite a la vitamine D - besoins accrus',
    ARRAY['Vitamine D3 1000-4000 UI/j','Exposition solaire','Magnesium (cofacteur)','Vitamine K2 MK-7']),

  ('VDR_BsmI','rs1544410','VDR','12',
    'Recepteur vitamine D - polymorphisme intron 8',
    ARRAY['AA','AG'],'GG',
    'Variant A (B) - densite osseuse moindre, immunite modulee',
    ARRAY['Vitamine D3','Calcium alimentaire','Vitamine K2','Activite physique en charge']),

  ('GSTM1_DEL','rs366631','GSTM1','1',
    'Glutathion-S-transferase mu 1 - detoxification phase II',
    ARRAY['DEL/DEL'],'WT/WT',
    'Deletion homozygote - capacite detox phase II reduite (xenobiotiques, oestrogenes)',
    ARRAY['Cruciferes (brocoli, chou)','NAC','Glycine','Reduire toxiques environnementaux','Sauna']),

  ('GSTT1_DEL','rs17856199','GSTT1','22',
    'Glutathion-S-transferase theta 1 - detoxification phase II',
    ARRAY['DEL/DEL'],'WT/WT',
    'Deletion homozygote - detox reduite (solvants, pesticides, fumee)',
    ARRAY['Glutathion liposomal','NAC','Vitamine C','Selenium','Eviter exposition solvants']),

  ('MAOA_R297R','rs6323','MAOA','X',
    'Monoamine oxydase A - degradation serotonine, noradrenaline, dopamine',
    ARRAY['T','TT'],'GG',
    'Activite MAOA elevee - degradation rapide serotonine - vulnerabilite humeur',
    ARRAY['Tryptophane et 5-HTP avec prudence','B2 riboflavine','Magnesium','Exposition lumiere','Activite physique']),

  ('CYP1A2_F','rs762551','CYP1A2','15',
    'Cytochrome P450 1A2 - metabolisme cafeine et oestrogenes',
    ARRAY['CC','AC'],'AA',
    'Variant C - metabolisme lent cafeine - sensibilite accrue, risque cardio si forte conso',
    ARRAY['Limiter cafeine (< 200 mg/j)','Eviter cafe apres 14h','Cruciferes pour oestrogenes']),

  ('CYP2D6_4','rs3892097','CYP2D6','22',
    'Cytochrome P450 2D6 - metabolisme de 25% des medicaments',
    ARRAY['AA','AG'],'GG',
    'Allele *4 non fonctionnel - metaboliseur lent (antidepresseurs, antalgiques)',
    ARRAY['Information prescripteur indispensable','Adaptation posologique','Eviter codeine','Suivi rapproche']),

  ('DAO_C997A','rs10156191','AOC1','7',
    'Diamine oxydase - degradation histamine alimentaire (intestin)',
    ARRAY['AA','GA'],'GG',
    'Activite DAO reduite - intolerance histamine (migraine, urticaire, troubles digestifs)',
    ARRAY['Regime pauvre en histamine','DAO en complement','Vitamine C','B6','Quercetine','Eviter alcool']),

  ('HNMT_T105I','rs11558538','HNMT','2',
    'Histamine N-methyltransferase - degradation histamine intracellulaire',
    ARRAY['TT','CT'],'CC',
    'Activite HNMT reduite - intolerance histamine systemique (bronches, SNC)',
    ARRAY['SAMe','Methylation (B12, folate)','Magnesium','Eviter aliments histaminoliberateurs']),

  ('TPH2_G703T','rs4570625','TPH2','12',
    'Tryptophane hydroxylase 2 - synthese serotonine cerebrale',
    ARRAY['TT','GT'],'GG',
    'Synthese serotonine reduite - vulnerabilite depression et anxiete',
    ARRAY['Tryptophane alimentaire','Lumiere du jour','Activite physique','Omega-3','5-HTP avec accompagnement']),

  ('BDNF_V66M','rs6265','BDNF','11',
    'Brain-Derived Neurotrophic Factor - neuroplasticite',
    ARRAY['AA','AG'],'GG',
    'Allele Met - secretion BDNF reduite - memoire et apprentissage moins flexibles',
    ARRAY['Exercice aerobie regulier','Jeune intermittent','Curcumine','Omega-3 DHA','Apprentissages nouveaux','Sommeil profond']),

  ('FUT2_W143X','rs601338','FUT2','19',
    'Fucosyltransferase 2 - secretion antigenes ABO dans muqueuses, microbiote',
    ARRAY['AA'],'GG',
    'Non-secreteur (AA) - microbiote different (Bifidobacterium reduit), absorption B12 modifiee',
    ARRAY['Probiotiques cibles (Bifidobacterium)','Surveiller B12','Prebiotiques (FOS, GOS)','Aliments fermentes']),

  ('ACE_I_D','rs4646994','ACE','17',
    'Enzyme conversion angiotensine - pression arterielle, performance',
    ARRAY['DD'],'II',
    'Allele D - activite ACE elevee - pression arterielle plus haute, profil force',
    ARRAY['Reduire sel','Activite endurance','Magnesium','Potassium (legumes)','Surveillance TA']),

  ('FTO_rs9939609','rs9939609','FTO','16',
    'Fat mass and obesity-associated - regulation appetit et masse grasse',
    ARRAY['AA','AT'],'TT',
    'Allele A - risque accru obesite, satiete moins efficace, preference aliments gras',
    ARRAY['Activite physique reguliere (compense risque)','Proteines a chaque repas','Fibres','Pleine conscience repas','Sommeil 7-9h']),

  ('TCF7L2_rs7903146','rs7903146','TCF7L2','10',
    'Transcription factor 7-like 2 - secretion insulinique',
    ARRAY['TT','CT'],'CC',
    'Allele T - risque diabete type 2 majore (secretion insuline reduite)',
    ARRAY['Index glycemique bas','Activite physique post-prandiale','Cannelle','Magnesium','Vinaigre avant repas','Surveillance HbA1c']),

  ('PEMT_rs7946','rs7946','PEMT','17',
    'Phosphatidylethanolamine N-methyltransferase - synthese choline endogene',
    ARRAY['TT','CT'],'CC',
    'Allele T - synthese choline reduite - besoins alimentaires accrus (foie, cerveau)',
    ARRAY['Oeufs (jaune)','Foie','Soja','Choline en complement','Betterave (betaine)']),

  ('CHDH_rs12676','rs12676','CHDH','3',
    'Choline dehydrogenase - conversion choline en betaine',
    ARRAY['TT','GT'],'GG',
    'Allele T - conversion choline-betaine alteree - methylation et lipides hepatiques affectes',
    ARRAY['Betaine TMG en complement','Choline alimentaire','Methionine','B12, folate actif']),

  ('NOS3_rs1799983','rs1799983','NOS3','7',
    'Nitric oxide synthase endotheliale - production NO vasculaire',
    ARRAY['TT','GT'],'GG',
    'Allele T - production NO reduite - dysfonction endotheliale, hypertension',
    ARRAY['Betterave (nitrates)','L-arginine, L-citrulline','Activite physique','Omega-3','Cacao','Polyphenols']),

  ('AGT_M268T','rs699','AGT','1',
    'Angiotensinogene - precurseur du systeme renine-angiotensine',
    ARRAY['CC','CT'],'TT',
    'Allele C (Thr235) - niveaux angiotensinogene eleves - risque hypertension sel-sensible',
    ARRAY['Reduire sel (< 5 g/j)','Potassium alimentaire','Activite physique','DASH diet','Surveillance TA']),

  ('AGTR1_rs5186','rs5186','AGTR1','3',
    'Recepteur angiotensine II type 1 - vasoconstriction',
    ARRAY['CC','AC'],'AA',
    'Allele C - sensibilite accrue angiotensine II - hypertension, hypertrophie cardiaque',
    ARRAY['Magnesium','Potassium','Reduire sel','CoQ10','Activite endurance']),

  ('HLA_DQ2','rs2187668','HLA-DQA1','6',
    'Antigene leucocytaire HLA-DQ2 - susceptibilite maladie coeliaque',
    ARRAY['AA','AG'],'GG',
    'Allele A - presence HLA-DQ2 - susceptibilite coeliaque (97% des coeliaques portent DQ2 ou DQ8)',
    ARRAY['Depistage anticorps anti-transglutaminase si symptomes','Biopsie si serologie positive','Pas de gluten en automedication sans diagnostic'])

ON CONFLICT (snp_code) DO UPDATE SET
  rs_id = EXCLUDED.rs_id,
  gene = EXCLUDED.gene,
  chromosome = EXCLUDED.chromosome,
  function_fr = EXCLUDED.function_fr,
  risk_genotypes = EXCLUDED.risk_genotypes,
  wild_genotype = EXCLUDED.wild_genotype,
  impact_fr = EXCLUDED.impact_fr,
  interventions_fr = EXCLUDED.interventions_fr;
