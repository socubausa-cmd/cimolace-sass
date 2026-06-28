/**
 * gdpr-export.ts — Worker async d'export RGPD (Article 20 — portabilité).
 *
 * Traite les demandes `med_gdpr_exports` au statut `pending` créées par
 * l'API (`POST /med/gdpr/exports`, GdprService.requestExport — qui ne fait
 * QUE poser la ligne, génération déléguée ici).
 *
 * Pour chaque demande :
 *   1. Lock optimiste : pending → processing (UPDATE conditionnel sur status
 *      pour idempotence — deux instances worker ne traitent pas la même ligne,
 *      un export déjà `ready`/`failed` n'est jamais retraité).
 *   2. Rassemble TOUTES les données du patient (scope full), STRICTEMENT
 *      tenant-scopé + patient-scopé (chaque requête filtre tenant_id +
 *      patient_id). Leçon C1 : en service-role la RLS est bypassée, donc le
 *      filtrage applicatif est la SEULE barrière — il est obligatoire.
 *   3. Produit un export JSON complet (structuré par section) + un PDF
 *      récapitulatif (pdfkit est présent dans le repo).
 *   4. Upload dans le bucket privé Supabase Storage `medos`, prefix
 *      `gdpr-exports/{tenant_id}/{patient_id}/{export_id}.{ext}`.
 *   5. file_url + file_size_bytes + file_sha256 + status='ready' +
 *      processed_at + expires_at (URL signée 7 jours).
 *   En cas d'exception : status='failed' + error_message (best-effort,
 *   ne crash JAMAIS le worker — l'erreur est isolée par demande).
 *
 * PII : aucun nom/email loggé — uniquement des IDs (export_id, tenant_id,
 * patient_id, counts).
 *
 * Secrets requis : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

// Bucket privé MEDOS déjà provisionné (attachments + twin lab docs).
const STORAGE_BUCKET = 'medos';
// Prefix dédié RGPD : gdpr-exports/{tenant_id}/{patient_id}/{export_id}.{ext}
const STORAGE_PREFIX = 'gdpr-exports';
// URL signée valable 7 jours (le patient doit avoir le temps de télécharger).
const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7;
// Nombre de demandes traitées par tick (évite de monopoliser le worker).
const BATCH_LIMIT = 3;

// Le client est manipulé en `any` (mêmes conventions souples que les autres
// pollers .js : les tables med_* ne sont pas dans les types générés).
type Db = any;
type Row = Record<string, any>;

/**
 * Assemble le payload RGPD complet d'un patient — miroir fidèle de
 * GdprService.exportPatient (apps/api/src/medos/gdpr/gdpr.service.ts), mais
 * côté worker. Toutes les requêtes filtrent tenant_id + patient_id.
 *
 * scope: full | medical_only | administrative_only | custom
 *   - 'custom' est traité comme 'full' (le worker ne sait pas restreindre un
 *     scope arbitraire ; on exporte tout, c'est le surensemble sûr).
 */
async function assemblePayload(
  db: Db,
  tenantId: string,
  patientId: string,
  scope: string,
): Promise<{ payload: Record<string, unknown>; counts: Record<string, number> }> {
  const sb: any = db;

  // ─── Identité (toujours incluse, validée tenant + patient) ──────────────
  const { data: patient, error: patientErr } = await sb
    .from('med_patients')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', patientId)
    .maybeSingle();
  if (patientErr) throw new Error(`patient lookup: ${patientErr.message}`);
  if (!patient) throw new Error('patient introuvable pour ce tenant');

  const includeMedical = scope === 'full' || scope === 'medical_only' || scope === 'custom';
  const includeAdmin =
    scope === 'full' || scope === 'administrative_only' || scope === 'custom';

  // ─── Médical (notes, prescriptions, programmes, RDV, formulaires) ───────
  const medical: Record<string, Row[]> = {
    notes: [],
    prescriptions: [],
    programs: [],
    appointments: [],
    form_responses: [],
    attachments: [],
  };
  if (includeMedical) {
    const [notes, prescriptions, programs, appts, formResponses, attachments] =
      await Promise.all([
        sb
          .from('med_notes')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false }),
        sb
          .from('med_prescriptions')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false }),
        sb
          .from('med_programs')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false }),
        sb
          .from('med_appointments')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('patient_id', patientId)
          .order('scheduled_at', { ascending: false }),
        sb
          .from('med_form_responses')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('patient_id', patientId)
          .order('submitted_at', { ascending: false }),
        sb
          .from('med_attachments')
          .select(
            'id, file_name, mime_type, file_size_bytes, kind, created_at, uploaded_by',
          )
          .eq('tenant_id', tenantId)
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false }),
      ]);
    medical.notes = notes.data ?? [];
    medical.prescriptions = prescriptions.data ?? [];
    medical.programs = programs.data ?? [];
    medical.appointments = appts.data ?? [];
    medical.form_responses = formResponses.data ?? [];
    medical.attachments = attachments.data ?? [];
  }

  // ─── Administratif (consentements, audit log filtré au patient) ─────────
  const administrative: Record<string, Row[]> = { consents: [], audit_log: [] };
  if (includeAdmin) {
    const [consents, audit] = await Promise.all([
      sb
        .from('med_consent_records')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('patient_id', patientId)
        .order('granted_at', { ascending: false }),
      sb
        .from('med_audit_log')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('resource_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1000),
    ]);
    administrative.consents = consents.data ?? [];
    administrative.audit_log = audit.data ?? [];
  }

  // ─── Bio Digital Twin (bloc dédié, présent si médical inclus) ───────────
  const twin: Record<string, any> = {
    biomarkers: [],
    organ_scores: [],
    transformation_wheel: [],
    health_events: [],
    alerts: [],
    hypotheses: [],
    ai_analyses: [],
    ai_runs: [],
    lab_documents: [],
  };
  if (includeMedical) {
    const [
      biomarkers,
      organScores,
      wheel,
      events,
      alerts,
      hypotheses,
      aiAnalyses,
      aiRuns,
      labDocs,
    ] = await Promise.all([
      sb
        .from('med_patient_biomarkers')
        .select(
          'id, biomarker_code, value, unit_raw, value_canonical, flag, measured_at, confidence, source, lab_document_id, created_at',
        )
        .eq('tenant_id', tenantId)
        .eq('patient_id', patientId)
        .order('measured_at', { ascending: false }),
      sb
        .from('med_organ_scores')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('patient_id', patientId)
        .order('computed_at', { ascending: false }),
      sb
        .from('med_transformation_wheel')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('patient_id', patientId)
        .order('measured_at', { ascending: false }),
      sb
        .from('med_health_events')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('patient_id', patientId)
        .order('occurred_at', { ascending: false }),
      sb
        .from('med_alerts')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('patient_id', patientId)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false }),
      sb
        .from('med_hypotheses')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false }),
      sb
        .from('med_ai_analyses')
        .select(
          'id, kind, status, output, confidence, models, created_at, created_by',
        )
        .eq('tenant_id', tenantId)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false }),
      sb
        .from('med_ai_agent_runs')
        .select(
          'id, analysis_id, agent, prompt_version, model, tokens, latency_ms, error, created_at',
        )
        .eq('tenant_id', tenantId)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false }),
      sb
        .from('med_lab_documents')
        .select(
          'id, source_type, lab_name, status, mime_type, file_size_bytes, original_filename, page_count, extraction_model, extraction_confidence, extraction_path, created_at, storage_path',
        )
        .eq('tenant_id', tenantId)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false }),
    ]);

    twin.biomarkers = biomarkers.data ?? [];
    twin.organ_scores = organScores.data ?? [];
    twin.transformation_wheel = wheel.data ?? [];
    twin.health_events = events.data ?? [];
    twin.alerts = alerts.data ?? [];
    twin.hypotheses = hypotheses.data ?? [];
    twin.ai_analyses = aiAnalyses.data ?? [];

    // ai_runs : on MASQUE input_hash (pseudonymisation des prompts LLM —
    // ne doit pas révéler le contenu original). prompt_version = métadonnée.
    twin.ai_runs = (aiRuns.data ?? []).map((r: Row) => ({
      id: r.id,
      analysis_id: r.analysis_id,
      agent: r.agent,
      prompt_version: r.prompt_version,
      model: r.model,
      tokens: r.tokens,
      latency_ms: r.latency_ms,
      error: r.error,
      created_at: r.created_at,
    }));

    // lab_documents : on N'EXPOSE JAMAIS storage_path (chemin interne). On
    // expose juste has_file. Pas d'URL signée ici (l'export est lui-même un
    // fichier signé ; les pièces sont accessibles via l'app).
    twin.lab_documents = (labDocs.data ?? []).map((d: Row) => ({
      id: d.id,
      source_type: d.source_type,
      lab_name: d.lab_name,
      status: d.status,
      mime_type: d.mime_type,
      file_size_bytes: d.file_size_bytes,
      original_filename: d.original_filename,
      page_count: d.page_count,
      extraction_model: d.extraction_model,
      extraction_confidence: d.extraction_confidence,
      extraction_path: d.extraction_path,
      created_at: d.created_at,
      has_file: !!d.storage_path,
    }));
  }

  const payload: Record<string, unknown> = {
    meta: {
      tenant_id: tenantId,
      patient_id: patientId,
      scope,
      generated_at: new Date().toISOString(),
      article: 'RGPD Art. 20 — Droit à la portabilité',
      generator: 'cimolace-worker/gdpr-export',
      twin_included: includeMedical,
      notes: [
        "Les analyses IA sont anonymisées côté prompt (input_hash masqué).",
        "Les chemins de stockage internes (storage_path) ne sont jamais exposés.",
      ],
    },
    patient,
    medical,
    administrative,
    twin: includeMedical ? twin : null,
  };

  const counts: Record<string, number> = {
    notes: medical.notes.length,
    prescriptions: medical.prescriptions.length,
    programs: medical.programs.length,
    appointments: medical.appointments.length,
    form_responses: medical.form_responses.length,
    attachments: medical.attachments.length,
    consents: administrative.consents.length,
    audit_log: administrative.audit_log.length,
    biomarkers: twin.biomarkers.length,
    organ_scores: twin.organ_scores.length,
    transformation_wheel: twin.transformation_wheel.length,
    health_events: twin.health_events.length,
    alerts: twin.alerts.length,
    hypotheses: twin.hypotheses.length,
    ai_analyses: twin.ai_analyses.length,
    ai_runs: twin.ai_runs.length,
    lab_documents: twin.lab_documents.length,
  };

  return { payload, counts };
}

/**
 * Génère un PDF récapitulatif (table des matières + compteurs par section).
 * pdfkit est résolu depuis le repo (hoisté). Import dynamique pour ne pas
 * pénaliser le démarrage du worker si la lib n'est pas utilisée.
 * Retourne null si la lib est indisponible (dégrade en JSON-only).
 */
async function buildSummaryPdf(
  meta: Record<string, any>,
  counts: Record<string, number>,
): Promise<Buffer | null> {
  let PDFDocument: any;
  try {
    PDFDocument = (await import('pdfkit')).default;
  } catch {
    return null; // pas de lib PDF → JSON-only
  }
  return await new Promise<Buffer | null>((resolve) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', () => resolve(null));

      doc.fontSize(20).text('Export RGPD — Récapitulatif', { align: 'left' });
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#555');
      doc.text('RGPD Art. 20 — Droit à la portabilité des données');
      doc.text(`Généré le : ${meta.generated_at}`);
      doc.text(`Identifiant patient : ${meta.patient_id}`);
      doc.text(`Périmètre : ${meta.scope}`);
      doc.moveDown(0.8);
      doc.fillColor('#000').fontSize(13).text('Contenu de l’export', { underline: true });
      doc.moveDown(0.4);

      const labels: Record<string, string> = {
        notes: 'Notes de consultation',
        prescriptions: 'Ordonnances',
        programs: 'Programmes',
        appointments: 'Rendez-vous',
        form_responses: 'Réponses aux formulaires',
        attachments: 'Pièces jointes (métadonnées)',
        consents: 'Consentements',
        audit_log: 'Journal d’audit',
        biomarkers: 'Biomarqueurs',
        organ_scores: 'Scores d’organes',
        transformation_wheel: 'Roue de transformation',
        health_events: 'Événements santé',
        alerts: 'Alertes',
        hypotheses: 'Hypothèses cliniques',
        ai_analyses: 'Analyses IA',
        ai_runs: 'Exécutions IA',
        lab_documents: 'Documents de laboratoire',
      };
      doc.fontSize(11).fillColor('#000');
      for (const key of Object.keys(labels)) {
        const n = counts[key] ?? 0;
        doc.text(`• ${labels[key]} : ${n}`);
      }
      doc.moveDown(1);
      doc.fontSize(9).fillColor('#777');
      doc.text(
        'Le fichier JSON joint contient l’intégralité des données structurées. ' +
          'Les analyses IA sont anonymisées côté prompt ; les chemins de stockage ' +
          'internes ne sont jamais exposés.',
        { align: 'left' },
      );
      doc.end();
    } catch {
      resolve(null);
    }
  });
}

/**
 * Marque une demande échouée (best-effort). N'émet aucune exception.
 */
async function markFailed(db: Db, id: string, message: string): Promise<void> {
  try {
    await (db as any)
      .from('med_gdpr_exports')
      .update({
        status: 'failed',
        error_message: message.slice(0, 500),
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  } catch {
    /* noop — on ne casse pas le worker pour une erreur de marquage */
  }
}

/**
 * Traite une demande d'export individuelle (déjà lockée en `processing`).
 */
async function processExport(db: Db, exp: Row): Promise<void> {
  const exportId: string = exp.id;
  const tenantId: string = exp.tenant_id;
  const patientId: string = exp.patient_id;
  const scope: string = exp.scope || 'full';

  // 1) Rassembler les données (tenant + patient scopé).
  const { payload, counts } = await assemblePayload(db, tenantId, patientId, scope);

  // 2) Sérialiser le JSON complet.
  const jsonBuf = Buffer.from(JSON.stringify(payload, null, 2), 'utf8');
  const jsonPath = `${STORAGE_PREFIX}/${tenantId}/${patientId}/${exportId}.json`;

  // 3) Upload JSON dans le bucket privé (service-role → bypass RLS).
  const sb: any = db;
  const { error: upErr } = await sb.storage
    .from(STORAGE_BUCKET)
    .upload(jsonPath, jsonBuf, {
      contentType: 'application/json',
      upsert: true,
    });
  if (upErr) throw new Error(`upload json: ${upErr.message}`);

  // 3bis) PDF récapitulatif (best-effort — n'échoue pas l'export si absent).
  let pdfPath: string | null = null;
  let pdfBytes = 0;
  try {
    const pdfBuf = await buildSummaryPdf((payload as any).meta, counts);
    if (pdfBuf && pdfBuf.length > 0) {
      pdfPath = `${STORAGE_PREFIX}/${tenantId}/${patientId}/${exportId}.pdf`;
      const { error: pdfUpErr } = await sb.storage
        .from(STORAGE_BUCKET)
        .upload(pdfPath, pdfBuf, {
          contentType: 'application/pdf',
          upsert: true,
        });
      if (pdfUpErr) {
        pdfPath = null; // PDF facultatif : on continue en JSON-only
      } else {
        pdfBytes = pdfBuf.length;
      }
    }
  } catch {
    pdfPath = null;
  }

  // 4) URL signée 7 jours sur le JSON (la pièce maîtresse de l'export).
  const { data: signed, error: signErr } = await sb.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(jsonPath, SIGNED_URL_TTL_SEC);
  if (signErr || !signed?.signedUrl) {
    throw new Error(`sign url: ${signErr?.message || 'signedUrl manquant'}`);
  }

  const sha256 = createHash('sha256').update(jsonBuf).digest('hex');
  const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SEC * 1000).toISOString();

  // 5) Finaliser la ligne : ready + métadonnées fichier.
  const { error: doneErr } = await sb
    .from('med_gdpr_exports')
    .update({
      status: 'ready',
      file_url: signed.signedUrl,
      file_size_bytes: jsonBuf.length,
      file_sha256: sha256,
      expires_at: expiresAt,
      error_message: null,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', exportId)
    .eq('tenant_id', tenantId);
  if (doneErr) throw new Error(`finalize: ${doneErr.message}`);

  // Log : IDs + compteurs uniquement (zéro PII).
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(
    `[gdpr-export] ready export=${exportId} tenant=${tenantId} patient=${patientId} ` +
      `records=${total} json_bytes=${jsonBuf.length} pdf=${pdfPath ? pdfBytes : 'none'}`,
  );
}

/**
 * Poller : récupère les demandes `pending`, les lock une à une (pending →
 * processing, conditionnel = idempotent), puis les traite. Retourne le
 * nombre d'exports menés à `ready`.
 */
export async function pollGdprExports(): Promise<number> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return 0; // secrets absents → no-op silencieux
  }

  const { data: pending, error } = await supabase
    .from('med_gdpr_exports')
    .select('id, tenant_id, patient_id, scope, status')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
    .limit(BATCH_LIMIT);
  if (error) {
    console.error('[gdpr-export] list pending error:', error.message);
    return 0;
  }
  if (!pending?.length) return 0;

  let done = 0;
  for (const exp of pending as Row[]) {
    // Lock optimiste : seul le worker qui réussit ce passage pending→processing
    // traite la ligne (idempotence + anti-double-traitement multi-instances).
    const { data: locked, error: lockErr } = await (supabase as any)
      .from('med_gdpr_exports')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', exp.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (lockErr) {
      console.error(`[gdpr-export] lock error export=${exp.id}:`, lockErr.message);
      continue;
    }
    if (!locked) continue; // déjà pris par une autre instance / déjà traité

    try {
      await processExport(supabase, exp);
      done++;
    } catch (e: unknown) {
      const msg = (e as Error)?.message || String(e);
      // Log sans PII (id seulement) + persistance de l'échec.
      console.error(`[gdpr-export] failed export=${exp.id}:`, msg);
      await markFailed(supabase, exp.id, msg);
    }
  }
  return done;
}
