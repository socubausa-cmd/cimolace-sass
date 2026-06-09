-- ════════════════════════════════════════════════════════════════════════
-- MEDOS v2 - BIO DIGITAL TWIN AI - Extension Biomarqueurs (Chantier 2)
-- ════════════════════════════════════════════════════════════════════════
-- Migration additive et idempotente. Aucune table existante modifiee.
--
-- Objectif: passer de ~40 a ~150 biomarqueurs pour couvrir un bilan
-- biologique francais standard (NFS complete, ionogramme, fonction
-- renale etendue, lipides etendus, hormones, cardio, foie etendu,
-- vitamines/mineraux complets, digestif, methylation, stress oxydatif).
--
-- IMPORTANT - Chaines 100% ASCII (sans accents) pour resister au collage
-- et garantir une portabilite entre environnements. Idempotence assuree
-- via ON CONFLICT (code) DO UPDATE sur med_biomarker_refs et
-- ON CONFLICT DO NOTHING sur med_bio_nodes/med_bio_edges.
--
-- Statut: A VALIDER CLINIQUEMENT. Plages indicatives (HAS, Vidal,
-- Cerba/Biomnis, plages fonctionnelles de medecine fonctionnelle).
-- ════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- BIOMARQUEURS ETENDUS (~110 nouveaux codes)
-- Categories: hematology, electrolyte, kidney, lipid, liver, thyroid,
-- hormone, adrenal, cardiovascular, metabolic, vitamin, mineral,
-- digestive_marker, inflammation, oxidative_stress, methylation
-- ─────────────────────────────────────────────────────────────────────────

-- ── NFS - Lignee rouge ──────────────────────────────────────────────────
INSERT INTO med_biomarker_refs (code,name_fr,category,dimension,unit,optimal_low,optimal_high,lab_low,lab_high,organs,higher_is_worse,function_fr,associated_symptoms) VALUES
  ('ERYTHROCYTES','Globules rouges','hematology','cellular_energy','M/uL',4.5,5.5,4.2,5.9,'{immune}',false,'Erythrocytes circulants','{fatigue,paleur}'),
  ('HEMATOCRIT','Hematocrite','hematology','cellular_energy','%',40,48,38,52,'{immune}',false,'Volume des globules rouges','{fatigue,paleur}'),
  ('MCV','VGM - Volume globulaire moyen','hematology','cellular_energy','fL',85,95,80,100,'{immune,liver}',true,'Taille des globules rouges','{fatigue}'),
  ('MCH','TCMH - Teneur corpusculaire moyenne en Hb','hematology','cellular_energy','pg',28,32,27,33,'{immune}',true,'Hemoglobine moyenne par globule rouge','{fatigue}'),
  ('MCHC','CCMH - Concentration corpusculaire moyenne en Hb','hematology','cellular_energy','g/dL',32,36,31,37,'{immune}',true,'Concentration en hemoglobine','{fatigue}'),
  ('RDW','IDR - Index de distribution des erythrocytes','hematology','cellular_energy','%',11.5,13.5,11,15,'{immune}',true,'Variabilite de taille des globules rouges','{fatigue}'),
  ('RETICULOCYTES','Reticulocytes','hematology','cellular_energy','%',0.5,2,0.2,2.5,'{immune}',false,'Production medullaire de globules rouges','{fatigue}')
ON CONFLICT (code) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  category = EXCLUDED.category,
  dimension = EXCLUDED.dimension,
  unit = EXCLUDED.unit,
  optimal_low = EXCLUDED.optimal_low,
  optimal_high = EXCLUDED.optimal_high,
  lab_low = EXCLUDED.lab_low,
  lab_high = EXCLUDED.lab_high,
  organs = EXCLUDED.organs,
  higher_is_worse = EXCLUDED.higher_is_worse,
  function_fr = EXCLUDED.function_fr,
  associated_symptoms = EXCLUDED.associated_symptoms;

-- ── NFS - Plaquettes ────────────────────────────────────────────────────
INSERT INTO med_biomarker_refs (code,name_fr,category,dimension,unit,optimal_low,optimal_high,lab_low,lab_high,organs,higher_is_worse,function_fr,associated_symptoms) VALUES
  ('PLATELETS','Plaquettes','hematology','inflammation','K/uL',200,300,150,400,'{immune,liver}',true,'Coagulation et hemostase','{}'),
  ('MPV','VPM - Volume plaquettaire moyen','hematology','inflammation','fL',7.5,10.5,7,12,'{immune}',true,'Activation plaquettaire','{}')
ON CONFLICT (code) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  category = EXCLUDED.category,
  dimension = EXCLUDED.dimension,
  unit = EXCLUDED.unit,
  optimal_low = EXCLUDED.optimal_low,
  optimal_high = EXCLUDED.optimal_high,
  lab_low = EXCLUDED.lab_low,
  lab_high = EXCLUDED.lab_high,
  organs = EXCLUDED.organs,
  higher_is_worse = EXCLUDED.higher_is_worse,
  function_fr = EXCLUDED.function_fr,
  associated_symptoms = EXCLUDED.associated_symptoms;

-- ── NFS - Lignee blanche ────────────────────────────────────────────────
INSERT INTO med_biomarker_refs (code,name_fr,category,dimension,unit,optimal_low,optimal_high,lab_low,lab_high,organs,higher_is_worse,function_fr,associated_symptoms) VALUES
  ('WBC','Leucocytes totaux','hematology','inflammation','K/uL',5,7,4,10,'{immune}',true,'Defense immunitaire globale','{infections,fatigue}'),
  ('NEUTROPHILS_ABS','Neutrophiles absolus','hematology','inflammation','K/uL',2,5,1.5,7,'{immune}',true,'Defense bacterienne','{infections}'),
  ('LYMPHOCYTES_ABS','Lymphocytes absolus','hematology','inflammation','K/uL',1.5,3,1,4,'{immune}',false,'Defense virale et immunite adaptative','{infections,fatigue}'),
  ('MONOCYTES_ABS','Monocytes absolus','hematology','inflammation','K/uL',0.2,0.6,0.1,1,'{immune}',true,'Inflammation chronique','{fatigue}'),
  ('EOSINOPHILS_ABS','Eosinophiles absolus','hematology','inflammation','K/uL',0,0.3,0,0.5,'{immune,gut}',true,'Allergie ou parasitose','{}'),
  ('BASOPHILS_ABS','Basophiles absolus','hematology','inflammation','K/uL',0,0.1,0,0.2,'{immune}',true,'Hypersensibilite immediate','{}'),
  ('NLR_RATIO','Ratio neutrophiles/lymphocytes','hematology','inflammation','ratio',1,2,0.5,3,'{immune}',true,'Marqueur d inflammation systemique','{fatigue}')
ON CONFLICT (code) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  category = EXCLUDED.category,
  dimension = EXCLUDED.dimension,
  unit = EXCLUDED.unit,
  optimal_low = EXCLUDED.optimal_low,
  optimal_high = EXCLUDED.optimal_high,
  lab_low = EXCLUDED.lab_low,
  lab_high = EXCLUDED.lab_high,
  organs = EXCLUDED.organs,
  higher_is_worse = EXCLUDED.higher_is_worse,
  function_fr = EXCLUDED.function_fr,
  associated_symptoms = EXCLUDED.associated_symptoms;

-- ── Ionogramme ──────────────────────────────────────────────────────────
INSERT INTO med_biomarker_refs (code,name_fr,category,dimension,unit,optimal_low,optimal_high,lab_low,lab_high,organs,higher_is_worse,function_fr,associated_symptoms) VALUES
  ('SODIUM','Sodium serique','electrolyte','metabolism','mmol/L',138,142,135,145,'{kidneys,brain,heart}',true,'Balance hydro-sodee','{oedemes,confusion}'),
  ('POTASSIUM','Potassium serique','electrolyte','metabolism','mmol/L',4,4.5,3.5,5.1,'{heart,kidneys}',true,'Excitabilite musculaire et cardiaque','{crampes,palpitations}'),
  ('CHLORIDE','Chlorure serique','electrolyte','metabolism','mmol/L',99,106,98,107,'{kidneys}',true,'Equilibre acido-basique','{fatigue}'),
  ('BICARBONATE','Bicarbonates (CO2)','electrolyte','metabolism','mmol/L',24,28,22,30,'{kidneys,lungs}',false,'Equilibre acido-basique','{fatigue}'),
  ('CALCIUM','Calcium total','electrolyte','metabolism','mg/dL',9.2,10,8.5,10.5,'{kidneys,heart,brain}',true,'Mineralisation et signalisation','{crampes,fatigue}'),
  ('CALCIUM_IONIZED','Calcium ionise','electrolyte','metabolism','mmol/L',1.15,1.3,1.1,1.35,'{kidneys,heart,brain}',true,'Calcium biodisponible','{crampes,fourmillements}'),
  ('PHOSPHORUS','Phosphore serique','electrolyte','metabolism','mg/dL',3,4.5,2.5,4.5,'{kidneys}',true,'Mineralisation osseuse','{fatigue}'),
  ('OSMOLALITY','Osmolalite serique','electrolyte','metabolism','mOsm/kg',280,295,275,300,'{kidneys,brain}',true,'Equilibre hydrique','{confusion}')
ON CONFLICT (code) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  category = EXCLUDED.category,
  dimension = EXCLUDED.dimension,
  unit = EXCLUDED.unit,
  optimal_low = EXCLUDED.optimal_low,
  optimal_high = EXCLUDED.optimal_high,
  lab_low = EXCLUDED.lab_low,
  lab_high = EXCLUDED.lab_high,
  organs = EXCLUDED.organs,
  higher_is_worse = EXCLUDED.higher_is_worse,
  function_fr = EXCLUDED.function_fr,
  associated_symptoms = EXCLUDED.associated_symptoms;

-- ── Fonction renale etendue ─────────────────────────────────────────────
INSERT INTO med_biomarker_refs (code,name_fr,category,dimension,unit,optimal_low,optimal_high,lab_low,lab_high,organs,higher_is_worse,function_fr,associated_symptoms) VALUES
  ('CYSTATIN_C','Cystatine C','kidney','toxicity','mg/L',0.5,0.85,0.5,1.1,'{kidneys}',true,'Estimation precise de la fonction renale','{fatigue}'),
  ('MICROALBUMINURIA','Microalbuminurie','kidney','toxicity','mg/L',0,20,0,30,'{kidneys}',true,'Atteinte glomerulaire precoce','{}'),
  ('ALB_CREAT_RATIO','Ratio albumine/creatinine urinaire','kidney','toxicity','mg/g',0,20,0,30,'{kidneys}',true,'Atteinte renale precoce','{}'),
  ('PROTEINURIA_24H','Proteinurie 24h','kidney','toxicity','mg/24h',0,100,0,150,'{kidneys}',true,'Filtration renale','{oedemes}'),
  ('BUN','Azote ureique sanguin (BUN)','kidney','toxicity','mg/dL',8,18,7,25,'{kidneys}',true,'Catabolisme proteique','{fatigue}'),
  ('BUN_CREAT_RATIO','Ratio BUN/creatinine','kidney','toxicity','ratio',10,15,10,20,'{kidneys}',true,'Hydratation et fonction renale','{fatigue}')
ON CONFLICT (code) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  category = EXCLUDED.category,
  dimension = EXCLUDED.dimension,
  unit = EXCLUDED.unit,
  optimal_low = EXCLUDED.optimal_low,
  optimal_high = EXCLUDED.optimal_high,
  lab_low = EXCLUDED.lab_low,
  lab_high = EXCLUDED.lab_high,
  organs = EXCLUDED.organs,
  higher_is_worse = EXCLUDED.higher_is_worse,
  function_fr = EXCLUDED.function_fr,
  associated_symptoms = EXCLUDED.associated_symptoms;

-- ── Lipides etendus ─────────────────────────────────────────────────────
INSERT INTO med_biomarker_refs (code,name_fr,category,dimension,unit,optimal_low,optimal_high,lab_low,lab_high,organs,higher_is_worse,function_fr,associated_symptoms) VALUES
  ('CHOLESTEROL_TOTAL','Cholesterol total','lipid','metabolism','mg/dL',150,200,0,200,'{heart,liver}',true,'Cholesterol circulant total','{}'),
  ('NON_HDL_CHOL','Cholesterol non-HDL','lipid','metabolism','mg/dL',80,130,0,130,'{heart}',true,'Cholesterol atherogene global','{}'),
  ('LDL_PARTICLES','LDL-P (nombre de particules LDL)','lipid','metabolism','nmol/L',700,1000,0,1138,'{heart}',true,'Nombre de particules atherogenes','{}'),
  ('SDLDL','LDL petites et denses','lipid','metabolism','mg/dL',0,20,0,30,'{heart}',true,'Particules les plus atherogenes','{}'),
  ('APOA1','Apolipoproteine A1','lipid','metabolism','mg/dL',140,200,115,220,'{heart}',false,'Composante HDL protectrice','{}'),
  ('APOB_APOA1_RATIO','Ratio ApoB/ApoA1','lipid','metabolism','ratio',0.3,0.7,0.3,0.9,'{heart}',true,'Risque cardiovasculaire global','{}'),
  ('LP_A','Lipoproteine (a)','lipid','metabolism','mg/dL',0,30,0,50,'{heart}',true,'Risque cardiovasculaire genetique','{}'),
  ('OXLDL','LDL oxydees','lipid','oxidative_stress','U/L',0,60,0,100,'{heart}',true,'LDL endommagees pro-atherogenes','{}'),
  ('PCSK9','PCSK9','lipid','metabolism','ng/mL',100,300,0,500,'{liver,heart}',true,'Regulation des recepteurs LDL','{}')
ON CONFLICT (code) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  category = EXCLUDED.category,
  dimension = EXCLUDED.dimension,
  unit = EXCLUDED.unit,
  optimal_low = EXCLUDED.optimal_low,
  optimal_high = EXCLUDED.optimal_high,
  lab_low = EXCLUDED.lab_low,
  lab_high = EXCLUDED.lab_high,
  organs = EXCLUDED.organs,
  higher_is_worse = EXCLUDED.higher_is_worse,
  function_fr = EXCLUDED.function_fr,
  associated_symptoms = EXCLUDED.associated_symptoms;

-- ── Foie etendu ─────────────────────────────────────────────────────────
INSERT INTO med_biomarker_refs (code,name_fr,category,dimension,unit,optimal_low,optimal_high,lab_low,lab_high,organs,higher_is_worse,function_fr,associated_symptoms) VALUES
  ('AFP','Alpha-foetoproteine','liver','toxicity','ng/mL',0,8,0,10,'{liver}',true,'Marqueur hepatique tumoral','{}'),
  ('TOTAL_PROTEIN','Proteines totales','liver','cellular_energy','g/dL',6.5,8,6,8.3,'{liver}',false,'Synthese hepatique globale','{fatigue}'),
  ('GLOBULIN','Globulines','liver','inflammation','g/dL',2,3,1.5,3.5,'{liver,immune}',true,'Reponse immunitaire et inflammation','{fatigue}'),
  ('ALB_GLOB_RATIO','Ratio albumine/globulines','liver','cellular_energy','ratio',1.5,2.2,1.1,2.5,'{liver,immune}',false,'Balance synthese / inflammation','{fatigue}'),
  ('BILIRUBIN_DIRECT','Bilirubine directe (conjuguee)','liver','toxicity','mg/dL',0,0.2,0,0.3,'{liver}',true,'Bilirubine conjuguee hepatique','{}'),
  ('BILIRUBIN_INDIRECT','Bilirubine indirecte (libre)','liver','toxicity','mg/dL',0.1,0.7,0,1,'{liver}',true,'Bilirubine non conjuguee','{}'),
  ('BILE_ACIDS','Acides biliaires totaux','liver','toxicity','umol/L',0,8,0,10,'{liver}',true,'Cholestase ou stress hepatique','{fatigue}'),
  ('FIB4_SCORE','Score FIB-4 (fibrose hepatique)','liver','toxicity','index',0,1.3,0,1.45,'{liver}',true,'Estimation de la fibrose hepatique','{fatigue}'),
  ('NAFLD_SCORE','Score NAFLD (steatose)','liver','metabolism','index',-2,0,-1.455,0.676,'{liver}',true,'Estimation de la steatose hepatique','{fatigue}'),
  ('CHOLINESTERASE','Cholinesterase serique','liver','toxicity','U/L',5000,12000,4500,13000,'{liver}',false,'Synthese hepatique et exposition toxique','{fatigue}'),
  ('AMMONIA','Ammoniaque serique','liver','toxicity','umol/L',15,40,11,51,'{liver,brain}',true,'Detoxification azotee hepatique','{brouillard_mental,fatigue}')
ON CONFLICT (code) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  category = EXCLUDED.category,
  dimension = EXCLUDED.dimension,
  unit = EXCLUDED.unit,
  optimal_low = EXCLUDED.optimal_low,
  optimal_high = EXCLUDED.optimal_high,
  lab_low = EXCLUDED.lab_low,
  lab_high = EXCLUDED.lab_high,
  organs = EXCLUDED.organs,
  higher_is_worse = EXCLUDED.higher_is_worse,
  function_fr = EXCLUDED.function_fr,
  associated_symptoms = EXCLUDED.associated_symptoms;

-- ── Thyroide etendue ────────────────────────────────────────────────────
INSERT INTO med_biomarker_refs (code,name_fr,category,dimension,unit,optimal_low,optimal_high,lab_low,lab_high,organs,higher_is_worse,function_fr,associated_symptoms) VALUES
  ('TG_THYROID','Thyroglobuline','thyroid','hormones','ng/mL',2,30,2,55,'{thyroid}',true,'Production thyroidienne et suivi','{fatigue}'),
  ('ANTI_TG','Anticorps anti-thyroglobuline','thyroid','inflammation','UI/mL',0,20,0,40,'{thyroid,immune}',true,'Auto-immunite thyroidienne','{fatigue}'),
  ('REVERSE_T3','Reverse T3 (rT3)','thyroid','hormones','ng/dL',10,18,9,24,'{thyroid,liver}',true,'Hormone thyroidienne inactive (stress)','{fatigue,brouillard_mental}'),
  ('FT3_RT3_RATIO','Ratio FT3/rT3','thyroid','hormones','ratio',0.2,0.5,0.15,0.6,'{thyroid}',false,'Conversion thyroidienne periph','{fatigue,frilosite}')
ON CONFLICT (code) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  category = EXCLUDED.category,
  dimension = EXCLUDED.dimension,
  unit = EXCLUDED.unit,
  optimal_low = EXCLUDED.optimal_low,
  optimal_high = EXCLUDED.optimal_high,
  lab_low = EXCLUDED.lab_low,
  lab_high = EXCLUDED.lab_high,
  organs = EXCLUDED.organs,
  higher_is_worse = EXCLUDED.higher_is_worse,
  function_fr = EXCLUDED.function_fr,
  associated_symptoms = EXCLUDED.associated_symptoms;

-- ── Hormones reproductives ──────────────────────────────────────────────
INSERT INTO med_biomarker_refs (code,name_fr,category,dimension,unit,optimal_low,optimal_high,lab_low,lab_high,organs,higher_is_worse,function_fr,associated_symptoms) VALUES
  ('LH','Hormone luteinisante (LH)','hormone','hormones','UI/L',2,10,1,12,'{reproductive,brain}',true,'Regulation gonadique','{libido_basse}'),
  ('FSH','Hormone folliculo-stimulante (FSH)','hormone','hormones','UI/L',2,10,1,12,'{reproductive,brain}',true,'Maturation folliculaire/spermatogenese','{libido_basse}'),
  ('SHBG','SHBG','hormone','hormones','nmol/L',20,60,10,80,'{liver,reproductive}',true,'Transporteur des hormones sexuelles','{libido_basse,fatigue}'),
  ('TESTOSTERONE_FREE','Testosterone libre','hormone','hormones','pg/mL',9,30,4.5,42,'{reproductive}',false,'Androgene biodisponible','{libido_basse,fatigue}'),
  ('DHT','Dihydrotestosterone','hormone','hormones','ng/dL',30,85,30,85,'{reproductive}',true,'Androgene puissant','{chute_cheveux}'),
  ('ANDROSTENEDIONE','Androstenedione','hormone','hormones','ng/dL',40,150,40,200,'{reproductive,adrenals}',true,'Precurseur androgenique','{}'),
  ('PROLACTIN','Prolactine','hormone','hormones','ng/mL',5,15,3,25,'{brain,reproductive}',true,'Hormone hypophysaire','{libido_basse,fatigue}'),
  ('AMH','Hormone anti-mullerienne (AMH)','hormone','hormones','ng/mL',1,4,0.5,6,'{reproductive}',false,'Reserve ovarienne','{}'),
  ('17OH_PROGESTERONE','17-OH progesterone','hormone','hormones','ng/dL',20,90,15,150,'{adrenals,reproductive}',true,'Precurseur du cortisol et des androgenes','{}'),
  ('ESTRONE','Estrone (E1)','hormone','hormones','pg/mL',15,90,15,200,'{reproductive,liver}',true,'Oestrogene principal post-menopause','{}'),
  ('ESTRIOL','Estriol (E3)','hormone','hormones','ng/mL',0.2,2,0.1,3,'{reproductive}',true,'Oestrogene faible et grossesse','{}'),
  ('E2_PROG_RATIO','Ratio Estradiol/Progesterone','hormone','hormones','ratio',5,30,5,50,'{reproductive,brain}',true,'Balance estro/progesterone','{insomnie,anxiete}')
ON CONFLICT (code) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  category = EXCLUDED.category,
  dimension = EXCLUDED.dimension,
  unit = EXCLUDED.unit,
  optimal_low = EXCLUDED.optimal_low,
  optimal_high = EXCLUDED.optimal_high,
  lab_low = EXCLUDED.lab_low,
  lab_high = EXCLUDED.lab_high,
  organs = EXCLUDED.organs,
  higher_is_worse = EXCLUDED.higher_is_worse,
  function_fr = EXCLUDED.function_fr,
  associated_symptoms = EXCLUDED.associated_symptoms;

-- ── Hormones de stress (axe surrenales) ─────────────────────────────────
INSERT INTO med_biomarker_refs (code,name_fr,category,dimension,unit,optimal_low,optimal_high,lab_low,lab_high,organs,higher_is_worse,function_fr,associated_symptoms) VALUES
  ('CORTISOL_PM','Cortisol vesperal (PM)','adrenal','hormones','ug/dL',3,8,2,12,'{adrenals,brain}',true,'Rythme circadien du cortisol','{insomnie,anxiete}'),
  ('ACTH','ACTH','adrenal','hormones','pg/mL',10,40,7,63,'{brain,adrenals}',true,'Axe hypothalamo-hypophyso-surrenalien','{fatigue}'),
  ('DHEA','DHEA','adrenal','hormones','ng/mL',2,10,1,15,'{adrenals}',false,'Precurseur des hormones sexuelles','{fatigue,libido_basse}'),
  ('ALDOSTERONE','Aldosterone','adrenal','hormones','ng/dL',5,20,3,30,'{adrenals,kidneys}',true,'Regulation hydro-sodee','{fatigue}')
ON CONFLICT (code) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  category = EXCLUDED.category,
  dimension = EXCLUDED.dimension,
  unit = EXCLUDED.unit,
  optimal_low = EXCLUDED.optimal_low,
  optimal_high = EXCLUDED.optimal_high,
  lab_low = EXCLUDED.lab_low,
  lab_high = EXCLUDED.lab_high,
  organs = EXCLUDED.organs,
  higher_is_worse = EXCLUDED.higher_is_worse,
  function_fr = EXCLUDED.function_fr,
  associated_symptoms = EXCLUDED.associated_symptoms;

-- ── Marqueurs cardiovasculaires ─────────────────────────────────────────
INSERT INTO med_biomarker_refs (code,name_fr,category,dimension,unit,optimal_low,optimal_high,lab_low,lab_high,organs,higher_is_worse,function_fr,associated_symptoms) VALUES
  ('NT_PROBNP','NT-proBNP','cardiovascular','metabolism','pg/mL',0,125,0,300,'{heart}',true,'Marqueur d insuffisance cardiaque','{essoufflement,oedemes,fatigue}'),
  ('BNP','BNP','cardiovascular','metabolism','pg/mL',0,35,0,100,'{heart}',true,'Peptide natriuretique cardiaque','{essoufflement,oedemes}'),
  ('TROPONIN_HS','Troponine ultrasensible','cardiovascular','inflammation','ng/L',0,14,0,19,'{heart}',true,'Lesion myocardique','{douleur_thoracique}'),
  ('MPO','Myeloperoxydase','cardiovascular','oxidative_stress','pmol/L',0,470,0,640,'{heart,immune}',true,'Inflammation vasculaire','{}'),
  ('LP_PLA2','Lp-PLA2','cardiovascular','inflammation','ng/mL',0,200,0,235,'{heart}',true,'Inflammation vasculaire specifique','{}'),
  ('GALECTIN_3','Galectine-3','cardiovascular','inflammation','ng/mL',0,17.8,0,22,'{heart}',true,'Fibrose cardiaque','{}'),
  ('CK','Creatine kinase totale','cardiovascular','cellular_energy','U/L',30,150,26,192,'{heart}',true,'Lesion musculaire ou myocardique','{douleurs}'),
  ('CK_MB','CK-MB','cardiovascular','cellular_energy','ng/mL',0,3.6,0,5,'{heart}',true,'Lesion myocardique specifique','{douleur_thoracique}'),
  ('LDH','Lactate deshydrogenase','cardiovascular','cellular_energy','U/L',140,220,140,280,'{heart,liver}',true,'Lyse cellulaire generale','{fatigue}'),
  ('D_DIMERS','D-dimeres','cardiovascular','inflammation','ng/mL',0,250,0,500,'{heart,lungs}',true,'Coagulation et thrombose','{essoufflement}'),
  ('ENDOTHELIN','Endotheline-1','cardiovascular','inflammation','pg/mL',0,5,0,10,'{heart}',true,'Dysfonction endotheliale','{}')
ON CONFLICT (code) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  category = EXCLUDED.category,
  dimension = EXCLUDED.dimension,
  unit = EXCLUDED.unit,
  optimal_low = EXCLUDED.optimal_low,
  optimal_high = EXCLUDED.optimal_high,
  lab_low = EXCLUDED.lab_low,
  lab_high = EXCLUDED.lab_high,
  organs = EXCLUDED.organs,
  higher_is_worse = EXCLUDED.higher_is_worse,
  function_fr = EXCLUDED.function_fr,
  associated_symptoms = EXCLUDED.associated_symptoms;

-- ── Metabolisme et regulation glycemique ────────────────────────────────
INSERT INTO med_biomarker_refs (code,name_fr,category,dimension,unit,optimal_low,optimal_high,lab_low,lab_high,organs,higher_is_worse,function_fr,associated_symptoms) VALUES
  ('LEPTIN','Leptine','metabolic','hormones','ng/mL',3,15,2,30,'{pancreas,brain}',true,'Regulation de la satiete','{prise_de_poids,fringales}'),
  ('ADIPONECTIN','Adiponectine','metabolic','hormones','ug/mL',8,25,4,30,'{pancreas,liver}',false,'Sensibilite insulinique adipose','{prise_de_poids}'),
  ('FRUCTOSAMINE','Fructosamine','metabolic','metabolism','umol/L',200,260,200,285,'{pancreas}',true,'Glycemie moyenne 2-3 semaines','{fatigue}'),
  ('C_PEPTIDE','Peptide C','metabolic','hormones','ng/mL',0.8,2.5,0.5,3.5,'{pancreas}',true,'Production endogene d insuline','{prise_de_poids,fatigue}')
ON CONFLICT (code) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  category = EXCLUDED.category,
  dimension = EXCLUDED.dimension,
  unit = EXCLUDED.unit,
  optimal_low = EXCLUDED.optimal_low,
  optimal_high = EXCLUDED.optimal_high,
  lab_low = EXCLUDED.lab_low,
  lab_high = EXCLUDED.lab_high,
  organs = EXCLUDED.organs,
  higher_is_worse = EXCLUDED.higher_is_worse,
  function_fr = EXCLUDED.function_fr,
  associated_symptoms = EXCLUDED.associated_symptoms;

-- ── Vitamines liposolubles et autres ────────────────────────────────────
INSERT INTO med_biomarker_refs (code,name_fr,category,dimension,unit,optimal_low,optimal_high,lab_low,lab_high,organs,higher_is_worse,function_fr,associated_symptoms) VALUES
  ('VIT_A','Vitamine A (retinol)','vitamin','cellular_energy','ug/dL',40,80,30,95,'{liver,immune}',false,'Vision, peau, immunite','{infections,fatigue}'),
  ('VIT_E','Vitamine E (alpha-tocopherol)','vitamin','oxidative_stress','mg/L',8,18,5,20,'{heart,brain}',false,'Antioxydant majeur lipidique','{fatigue}'),
  ('VIT_K','Vitamine K1','vitamin','cellular_energy','ng/mL',0.2,1,0.1,3,'{liver,heart}',false,'Coagulation et os','{}'),
  ('VIT_K2','Vitamine K2 (menaquinone)','vitamin','cellular_energy','ng/mL',0.5,3,0.3,5,'{heart}',false,'Calcification arterielle inverse','{}'),
  ('VIT_C','Vitamine C (ascorbate)','vitamin','oxidative_stress','mg/dL',0.6,2,0.4,2,'{immune,brain}',false,'Antioxydant et collagene','{fatigue,infections}'),
  ('VIT_B1','Vitamine B1 (thiamine)','vitamin','cellular_energy','nmol/L',74,222,70,250,'{brain}',false,'Metabolisme energetique cerebral','{fatigue,brouillard_mental}'),
  ('VIT_B2','Vitamine B2 (riboflavine)','vitamin','cellular_energy','nmol/L',70,250,50,400,'{brain}',false,'Coenzyme respiratoire','{fatigue}'),
  ('VIT_B3','Vitamine B3 (niacine)','vitamin','cellular_energy','umol/L',8,52,5,52,'{brain,liver}',false,'NAD/NADPH','{fatigue}'),
  ('VIT_B5','Vitamine B5 (acide pantothenique)','vitamin','cellular_energy','ug/mL',0.2,1.8,0.1,2,'{adrenals}',false,'Synthese du CoA et hormones surrenaliennes','{fatigue}'),
  ('VIT_B6','Vitamine B6 (PLP)','vitamin','cellular_energy','nmol/L',30,80,20,125,'{brain}',false,'Neurotransmetteurs et methylation','{fatigue,anxiete}'),
  ('VIT_B7','Vitamine B7 (biotine)','vitamin','cellular_energy','ng/L',221,3000,200,3000,'{liver}',false,'Metabolisme glucides/lipides','{chute_cheveux}'),
  ('VIT_B9_FOLATE','Folates erythrocytaires (B9 RBC)','vitamin','cellular_energy','ng/mL',400,1000,280,1500,'{brain}',false,'Methylation et synthese ADN','{fatigue,brouillard_mental}')
ON CONFLICT (code) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  category = EXCLUDED.category,
  dimension = EXCLUDED.dimension,
  unit = EXCLUDED.unit,
  optimal_low = EXCLUDED.optimal_low,
  optimal_high = EXCLUDED.optimal_high,
  lab_low = EXCLUDED.lab_low,
  lab_high = EXCLUDED.lab_high,
  organs = EXCLUDED.organs,
  higher_is_worse = EXCLUDED.higher_is_worse,
  function_fr = EXCLUDED.function_fr,
  associated_symptoms = EXCLUDED.associated_symptoms;

-- ── Mineraux et oligo-elements ──────────────────────────────────────────
INSERT INTO med_biomarker_refs (code,name_fr,category,dimension,unit,optimal_low,optimal_high,lab_low,lab_high,organs,higher_is_worse,function_fr,associated_symptoms) VALUES
  ('COPPER','Cuivre serique','vitamin','cellular_energy','ug/dL',80,120,70,140,'{liver}',true,'Cofacteur enzymatique','{fatigue}'),
  ('SELENIUM','Selenium serique','vitamin','oxidative_stress','ug/L',100,140,70,150,'{thyroid,immune}',false,'Antioxydant et conversion T4-T3','{fatigue,infections}'),
  ('IRON_SERUM','Fer serique total','hematology','cellular_energy','ug/dL',70,130,50,170,'{immune}',false,'Fer circulant','{fatigue}'),
  ('TRANSFERRIN','Transferrine','hematology','cellular_energy','mg/dL',215,365,200,400,'{liver}',true,'Transporteur du fer','{fatigue}'),
  ('TIBC','Capacite totale de fixation du fer (CTFF)','hematology','cellular_energy','ug/dL',250,400,240,450,'{liver}',true,'Capacite de transport du fer','{fatigue}'),
  ('IODINE_URINE','Iode urinaire','vitamin','cellular_energy','ug/L',100,200,100,300,'{thyroid}',false,'Substrat thyroidien','{fatigue,frilosite}'),
  ('CU_ZN_RATIO','Ratio cuivre/zinc','vitamin','inflammation','ratio',0.7,1.2,0.7,1.5,'{immune,liver}',true,'Balance inflammation/immunite','{fatigue,infections}'),
  ('MANGANESE','Manganese','vitamin','cellular_energy','ug/L',4,15,4,15,'{brain,liver}',true,'Cofacteur enzymatique antioxydant','{}'),
  ('CHROMIUM','Chrome','vitamin','metabolism','ug/L',0.1,2,0.1,2.8,'{pancreas}',false,'Potentialise l action de l insuline','{fringales}'),
  ('COQ10','Coenzyme Q10','vitamin','cellular_energy','ug/mL',0.7,1.5,0.4,1.9,'{heart,brain}',false,'Energie mitochondriale','{fatigue}')
ON CONFLICT (code) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  category = EXCLUDED.category,
  dimension = EXCLUDED.dimension,
  unit = EXCLUDED.unit,
  optimal_low = EXCLUDED.optimal_low,
  optimal_high = EXCLUDED.optimal_high,
  lab_low = EXCLUDED.lab_low,
  lab_high = EXCLUDED.lab_high,
  organs = EXCLUDED.organs,
  higher_is_worse = EXCLUDED.higher_is_worse,
  function_fr = EXCLUDED.function_fr,
  associated_symptoms = EXCLUDED.associated_symptoms;

-- ── Marqueurs digestifs ─────────────────────────────────────────────────
INSERT INTO med_biomarker_refs (code,name_fr,category,dimension,unit,optimal_low,optimal_high,lab_low,lab_high,organs,higher_is_worse,function_fr,associated_symptoms) VALUES
  ('CALPROTECTIN','Calprotectine fecale','digestive_marker','inflammation','ug/g',0,50,0,100,'{gut,immune}',true,'Inflammation intestinale','{douleurs,fatigue}'),
  ('ZONULIN','Zonuline serique','digestive_marker','inflammation','ng/mL',0,30,0,48,'{gut}',true,'Permeabilite intestinale','{brouillard_mental,fatigue}'),
  ('FECAL_ELASTASE','Elastase pancreatique fecale','digestive_marker','metabolism','ug/g',300,1000,200,1000,'{pancreas,gut}',false,'Fonction pancreatique exocrine','{fatigue}'),
  ('LACTOFERRIN','Lactoferrine fecale','digestive_marker','inflammation','ug/g',0,7.25,0,7.25,'{gut,immune}',true,'Inflammation intestinale','{}'),
  ('SECRETORY_IGA','IgA secretoire fecale','digestive_marker','inflammation','mg/dL',50,200,30,300,'{gut,immune}',false,'Immunite mucosale intestinale','{infections}'),
  ('LIPASE','Lipase serique','digestive_marker','metabolism','U/L',13,60,13,60,'{pancreas}',true,'Enzyme pancreatique','{douleurs}'),
  ('AMYLASE','Amylase serique','digestive_marker','metabolism','U/L',30,110,30,110,'{pancreas}',true,'Enzyme pancreatique','{douleurs}'),
  ('GASTRIN','Gastrine serique','digestive_marker','hormones','pg/mL',13,115,0,180,'{stomach}',true,'Regulation de la secretion gastrique','{}'),
  ('H_PYLORI_AG','Antigene H. pylori fecal','digestive_marker','inflammation','index',0,0.9,0,0.9,'{stomach,gut}',true,'Infection a Helicobacter pylori','{douleurs}'),
  ('ANTI_TTG','Anticorps anti-transglutaminase (tTG IgA)','digestive_marker','inflammation','U/mL',0,4,0,10,'{gut,immune}',true,'Maladie coeliaque','{fatigue,brouillard_mental}'),
  ('SCFA_TOTAL','Acides gras a chaine courte (SCFA) fecaux','digestive_marker','metabolism','umol/g',60,150,40,200,'{gut}',false,'Sante du microbiote','{}'),
  ('BETA_GLUCURONIDASE','Beta-glucuronidase fecale','digestive_marker','toxicity','U/g',0,2200,0,3500,'{gut,liver}',true,'Activite microbienne deconjugante','{}')
ON CONFLICT (code) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  category = EXCLUDED.category,
  dimension = EXCLUDED.dimension,
  unit = EXCLUDED.unit,
  optimal_low = EXCLUDED.optimal_low,
  optimal_high = EXCLUDED.optimal_high,
  lab_low = EXCLUDED.lab_low,
  lab_high = EXCLUDED.lab_high,
  organs = EXCLUDED.organs,
  higher_is_worse = EXCLUDED.higher_is_worse,
  function_fr = EXCLUDED.function_fr,
  associated_symptoms = EXCLUDED.associated_symptoms;

-- ── Methylation ─────────────────────────────────────────────────────────
INSERT INTO med_biomarker_refs (code,name_fr,category,dimension,unit,optimal_low,optimal_high,lab_low,lab_high,organs,higher_is_worse,function_fr,associated_symptoms) VALUES
  ('MMA','Acide methylmalonique (MMA)','methylation','oxidative_stress','nmol/L',73,270,73,376,'{brain}',true,'Marqueur fonctionnel de carence en B12','{fatigue,fourmillements,brouillard_mental}'),
  ('HOLOTC','Holotranscobalamine (B12 active)','methylation','cellular_energy','pmol/L',50,150,35,210,'{brain,immune}',false,'B12 biodisponible','{fatigue,brouillard_mental}'),
  ('SAM_SAH_RATIO','Ratio SAM/SAH','methylation','oxidative_stress','ratio',2.5,8,2,10,'{brain,liver}',false,'Capacite de methylation cellulaire','{brouillard_mental,fatigue}'),
  ('GSH','Glutathion reduit (GSH)','methylation','oxidative_stress','umol/L',850,1400,600,1700,'{liver,brain}',false,'Antioxydant cellulaire majeur','{fatigue}'),
  ('GSH_GSSG_RATIO','Ratio GSH/GSSG','methylation','oxidative_stress','ratio',50,200,30,300,'{liver,brain}',false,'Etat redox du glutathion','{fatigue}'),
  ('CYSTEINE','Cysteine totale','methylation','oxidative_stress','umol/L',200,300,180,320,'{liver}',true,'Precurseur du glutathion','{fatigue}'),
  ('METHIONINE','Methionine','methylation','oxidative_stress','umol/L',15,40,10,45,'{liver}',false,'Donneur de methyle precurseur de SAM','{fatigue}'),
  ('BETAINE','Betaine','methylation','oxidative_stress','umol/L',30,75,20,80,'{liver}',false,'Donneur de methyle','{fatigue}'),
  ('CHOLINE','Choline','methylation','cellular_energy','umol/L',8,15,7,20,'{liver,brain}',false,'Phospholipides et acetylcholine','{brouillard_mental}'),
  ('TMG_RATIO','Trimethylglycine (TMG)','methylation','oxidative_stress','umol/L',20,50,15,60,'{liver,brain}',false,'Re-methylation de l homocysteine','{brouillard_mental,fatigue}')
ON CONFLICT (code) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  category = EXCLUDED.category,
  dimension = EXCLUDED.dimension,
  unit = EXCLUDED.unit,
  optimal_low = EXCLUDED.optimal_low,
  optimal_high = EXCLUDED.optimal_high,
  lab_low = EXCLUDED.lab_low,
  lab_high = EXCLUDED.lab_high,
  organs = EXCLUDED.organs,
  higher_is_worse = EXCLUDED.higher_is_worse,
  function_fr = EXCLUDED.function_fr,
  associated_symptoms = EXCLUDED.associated_symptoms;

-- ── Stress oxydatif ─────────────────────────────────────────────────────
INSERT INTO med_biomarker_refs (code,name_fr,category,dimension,unit,optimal_low,optimal_high,lab_low,lab_high,organs,higher_is_worse,function_fr,associated_symptoms) VALUES
  ('OHDG_8','8-hydroxy-2-desoxyguanosine (8-OHdG)','oxidative_stress','oxidative_stress','ng/mg',0,7.5,0,10,'{brain,immune}',true,'Dommage oxydatif de l ADN','{fatigue}'),
  ('F2_ISOPROSTANES','F2-isoprostanes urinaires','oxidative_stress','oxidative_stress','ng/mg',0,1.5,0,2.5,'{heart,brain}',true,'Peroxydation lipidique','{fatigue}'),
  ('ISOPROSTANE_8','8-isoprostane','oxidative_stress','oxidative_stress','pg/mL',0,40,0,90,'{heart,brain}',true,'Peroxydation lipidique','{fatigue}'),
  ('MDA','Malondialdehyde (MDA)','oxidative_stress','oxidative_stress','umol/L',0,1,0,1.8,'{heart,liver}',true,'Marqueur de peroxydation lipidique','{fatigue}'),
  ('GPX','Glutathion peroxydase (GPX)','oxidative_stress','oxidative_stress','U/L',5000,13500,4000,15000,'{liver,brain}',false,'Enzyme antioxydante majeure','{fatigue}'),
  ('SOD','Superoxyde dismutase (SOD)','oxidative_stress','oxidative_stress','U/mL',1100,2000,800,2500,'{liver,heart}',false,'Detoxification du radical superoxyde','{fatigue}'),
  ('CATALASE','Catalase','oxidative_stress','oxidative_stress','U/L',45000,150000,30000,180000,'{liver,immune}',false,'Detoxification du peroxyde d hydrogene','{fatigue}'),
  ('TAC','Capacite antioxydante totale (TAC)','oxidative_stress','oxidative_stress','mmol/L',1.3,1.8,1,2,'{heart,brain}',false,'Pouvoir antioxydant plasmatique global','{fatigue}'),
  ('TBARS','TBARS','oxidative_stress','oxidative_stress','umol/L',0,3,0,5,'{liver,heart}',true,'Stress oxydatif global','{fatigue}'),
  ('ROS_TOTAL','Especes reactives de l oxygene (ROS)','oxidative_stress','oxidative_stress','U/mL',0,300,0,400,'{liver,brain}',true,'Production globale de radicaux libres','{fatigue}')
ON CONFLICT (code) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  category = EXCLUDED.category,
  dimension = EXCLUDED.dimension,
  unit = EXCLUDED.unit,
  optimal_low = EXCLUDED.optimal_low,
  optimal_high = EXCLUDED.optimal_high,
  lab_low = EXCLUDED.lab_low,
  lab_high = EXCLUDED.lab_high,
  organs = EXCLUDED.organs,
  higher_is_worse = EXCLUDED.higher_is_worse,
  function_fr = EXCLUDED.function_fr,
  associated_symptoms = EXCLUDED.associated_symptoms;

-- ── Inflammation avancee (cytokines) ────────────────────────────────────
INSERT INTO med_biomarker_refs (code,name_fr,category,dimension,unit,optimal_low,optimal_high,lab_low,lab_high,organs,higher_is_worse,function_fr,associated_symptoms) VALUES
  ('IL6','Interleukine-6 (IL-6)','inflammation','inflammation','pg/mL',0,1.8,0,7,'{immune,brain}',true,'Cytokine pro-inflammatoire','{fatigue,douleurs}'),
  ('TNF_ALPHA','TNF-alpha','inflammation','inflammation','pg/mL',0,8,0,15,'{immune,gut,brain}',true,'Cytokine pro-inflammatoire majeure','{fatigue,douleurs}'),
  ('IL10','Interleukine-10 (IL-10)','inflammation','inflammation','pg/mL',1,9,0,12,'{immune}',false,'Cytokine anti-inflammatoire','{fatigue}'),
  ('IL1B','Interleukine-1 beta','inflammation','inflammation','pg/mL',0,1,0,3.9,'{immune,brain}',true,'Cytokine pro-inflammatoire','{fatigue}'),
  ('CRP_ULTRA','CRP ultrasensible (haute precision)','inflammation','inflammation','mg/L',0,0.5,0,3,'{immune,heart}',true,'Inflammation systemique a tres bas niveau','{fatigue}')
ON CONFLICT (code) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  category = EXCLUDED.category,
  dimension = EXCLUDED.dimension,
  unit = EXCLUDED.unit,
  optimal_low = EXCLUDED.optimal_low,
  optimal_high = EXCLUDED.optimal_high,
  lab_low = EXCLUDED.lab_low,
  lab_high = EXCLUDED.lab_high,
  organs = EXCLUDED.organs,
  higher_is_worse = EXCLUDED.higher_is_worse,
  function_fr = EXCLUDED.function_fr,
  associated_symptoms = EXCLUDED.associated_symptoms;

-- ─────────────────────────────────────────────────────────────────────────
-- NOEUDS KNOWLEDGE GRAPH (~30 ajouts)
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO med_bio_nodes (node_type, ref_code, label_fr) VALUES
  -- Nouveaux biomarqueurs cles
  ('biomarker','WBC','Leucocytes'),
  ('biomarker','PLATELETS','Plaquettes'),
  ('biomarker','NLR_RATIO','Ratio NLR'),
  ('biomarker','SODIUM','Sodium'),
  ('biomarker','POTASSIUM','Potassium'),
  ('biomarker','CALCIUM','Calcium total'),
  ('biomarker','CYSTATIN_C','Cystatine C'),
  ('biomarker','MICROALBUMINURIA','Microalbuminurie'),
  ('biomarker','APOA1','Apolipoproteine A1'),
  ('biomarker','LP_A','Lipoproteine a'),
  ('biomarker','NT_PROBNP','NT-proBNP'),
  ('biomarker','TROPONIN_HS','Troponine ultrasensible'),
  ('biomarker','LP_PLA2','Lp-PLA2'),
  ('biomarker','LEPTIN','Leptine'),
  ('biomarker','ADIPONECTIN','Adiponectine'),
  ('biomarker','REVERSE_T3','Reverse T3'),
  ('biomarker','LH','LH'),
  ('biomarker','FSH','FSH'),
  ('biomarker','SHBG','SHBG'),
  ('biomarker','PROLACTIN','Prolactine'),
  ('biomarker','DHEA','DHEA'),
  ('biomarker','VIT_A','Vitamine A'),
  ('biomarker','VIT_E','Vitamine E'),
  ('biomarker','VIT_K2','Vitamine K2'),
  ('biomarker','SELENIUM','Selenium'),
  ('biomarker','COQ10','CoQ10'),
  ('biomarker','CALPROTECTIN','Calprotectine fecale'),
  ('biomarker','ZONULIN','Zonuline'),
  ('biomarker','MMA','MMA'),
  ('biomarker','GSH','Glutathion'),
  ('biomarker','IL6','IL-6'),
  ('biomarker','TNF_ALPHA','TNF-alpha'),
  -- Nouvelles conditions cliniques
  ('condition','cardiac_risk','Risque cardiovasculaire'),
  ('condition','methylation_block','Blocage de methylation'),
  ('condition','oxidative_stress','Stress oxydatif chronique'),
  ('condition','gut_permeability','Permeabilite intestinale'),
  -- Nouveaux symptomes courants
  ('symptom','crampes','Crampes'),
  ('symptom','oedemes','Oedemes'),
  ('symptom','palpitations','Palpitations'),
  ('symptom','essoufflement','Essoufflement'),
  ('symptom','douleur_thoracique','Douleur thoracique'),
  ('symptom','fourmillements','Fourmillements'),
  ('symptom','douleurs','Douleurs diffuses')
ON CONFLICT (node_type, ref_code, graph_version) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- ARETES KNOWLEDGE GRAPH (~20 ajouts)
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO med_bio_edges (from_code,to_code,relation,weight,direction,evidence_level,label_fr) VALUES
  -- Cardio
  ('NT_PROBNP','heart','correlates',0.8,'forward','A','NT-proBNP eleve indique souffrance cardiaque'),
  ('TROPONIN_HS','heart','correlates',0.9,'forward','A','Troponine ultrasensible et lesion myocardique'),
  ('LP_A','cardiac_risk','causes',0.7,'forward','A','Lp(a) elevee augmente le risque cardiovasculaire'),
  ('LP_PLA2','cardiac_risk','correlates',0.6,'forward','B','Inflammation vasculaire et risque cardiovasculaire'),
  ('cardiac_risk','heart','inflames',0.7,'forward','A','Risque cardiovasculaire et atteinte cardiaque'),
  -- Renal
  ('CYSTATIN_C','kidneys','correlates',0.8,'forward','A','Cystatine C precise pour la fonction renale'),
  ('MICROALBUMINURIA','kidneys','correlates',0.8,'forward','A','Microalbuminurie et atteinte glomerulaire'),
  -- Hematologie / inflammation
  ('NLR_RATIO','inflammation','correlates',0.7,'forward','B','Ratio NLR comme marqueur inflammatoire'),
  ('IL6','inflammation','causes',0.8,'forward','A','IL-6 cytokine pro-inflammatoire majeure'),
  ('TNF_ALPHA','inflammation','causes',0.8,'forward','A','TNF-alpha cytokine pro-inflammatoire majeure'),
  ('IL6','fatigue','causes',0.6,'forward','B','IL-6 elevee et fatigue chronique'),
  -- Digestif
  ('ZONULIN','gut_permeability','causes',0.7,'forward','B','Zonuline elevee et hyperpermeabilite'),
  ('gut_permeability','inflammation','causes',0.7,'forward','B','Hyperpermeabilite intestinale et inflammation systemique'),
  ('CALPROTECTIN','gut','inflames',0.8,'forward','A','Calprotectine et inflammation muqueuse intestinale'),
  -- Methylation
  ('MMA','methylation_block','correlates',0.7,'forward','B','MMA eleve et carence fonctionnelle en B12'),
  ('methylation_block','brain','modulates',0.6,'forward','B','Methylation perturbee et fonctions cognitives'),
  ('methylation_block','HOMOCYSTEINE','causes',0.7,'forward','B','Blocage de methylation et hyperhomocysteinemie'),
  -- Stress oxydatif
  ('GSH','oxidative_stress','modulates',0.7,'bidirectional','B','Glutathion bas et stress oxydatif'),
  ('oxidative_stress','liver','inflames',0.6,'forward','C','Stress oxydatif chronique et atteinte hepatique'),
  ('oxidative_stress','brain','modulates',0.6,'forward','C','Stress oxydatif et neuro-inflammation'),
  -- Hormones reproductives
  ('SHBG','TESTOSTERONE','modulates',0.7,'forward','A','SHBG module la biodisponibilite des androgenes'),
  ('PROLACTIN','reproductive','modulates',0.6,'forward','B','Prolactine elevee et fonction gonadique'),
  -- Endocrine etendu
  ('LEPTIN','prise_de_poids','correlates',0.7,'forward','B','Resistance a la leptine et prise de poids'),
  ('REVERSE_T3','fatigue','correlates',0.6,'forward','C','Reverse T3 elevee, conversion ralentie et fatigue')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════
-- FIN MIGRATION - Total: 41 (foundation) + 144 (extension) = 185 biomarqueurs.
-- Nouveaux noeuds graph: 43, nouvelles aretes: 24.
-- ════════════════════════════════════════════════════════════════════════
