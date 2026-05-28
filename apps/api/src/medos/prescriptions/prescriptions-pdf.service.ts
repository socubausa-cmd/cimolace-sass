import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { TenantContext } from '../../tenant/tenant.types';
import { PrescriptionsService } from './prescriptions.service';

/**
 * Renders a prescription as a print-ready HTML document.
 *
 * Why HTML and not a real PDF: shipping puppeteer (Chromium) in Cloud Run
 * triples our cold start and image size, and pdfkit requires a separate
 * layout engine. The browser's "Save as PDF" produces a perfectly valid
 * PDF from this HTML — same legal value, zero infra cost. The page
 * auto-triggers window.print() on load.
 */
@Injectable()
export class PrescriptionsPdfService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly prescriptions: PrescriptionsService,
  ) {}

  async renderHtml(
    tenant: TenantContext,
    actorId: string,
    prescriptionId: string,
  ): Promise<string> {
    const prescription = await this.prescriptions.get(
      tenant,
      actorId,
      prescriptionId,
    );

    if (prescription.status !== 'signed') {
      throw new NotFoundException(
        'Cette ordonnance n\'est pas signée — pas de PDF disponible.',
      );
    }

    // Load patient + practitioner + tenant info for the header
    const [{ data: patient }, { data: practitioner }, { data: tenantRow }] =
      await Promise.all([
        this.supabase.client
          .from('patient_records')
          .select('first_name, last_name, date_of_birth, email, phone')
          .eq('id', prescription.patient_id)
          .maybeSingle(),
        this.supabase.client
          .from('auth.users' as any)
          .select('email, raw_user_meta_data')
          .eq('id', prescription.practitioner_id)
          .maybeSingle(),
        this.supabase.client
          .from('tenants')
          .select('name, slug, branding_metadata')
          .eq('id', tenant.id)
          .maybeSingle(),
      ]);

    return this.buildHtml({
      prescription,
      patient: (patient as any) || null,
      practitioner: (practitioner as any) || null,
      tenant: (tenantRow as any) || null,
    });
  }

  private buildHtml(input: {
    prescription: any;
    patient: any | null;
    practitioner: any | null;
    tenant: any | null;
  }): string {
    const { prescription, patient, practitioner, tenant } = input;

    const tenantName: string =
      tenant?.name || tenant?.slug || 'Cabinet médical';
    const practitionerName: string =
      practitioner?.raw_user_meta_data?.full_name ||
      practitioner?.email ||
      'Praticien';
    const patientName: string = patient
      ? [patient.first_name, patient.last_name].filter(Boolean).join(' ') ||
        'Patient'
      : 'Patient';
    const patientDob = patient?.date_of_birth
      ? new Date(patient.date_of_birth).toLocaleDateString('fr')
      : null;

    const issuedDate = new Date(
      prescription.signed_at || prescription.issued_at || prescription.created_at,
    ).toLocaleDateString('fr', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const validity = prescription.validity_days || 90;
    const items = prescription.items || [];

    const itemsHtml = items
      .map(
        (it: any, i: number) => `
        <tr>
          <td class="num">${i + 1}.</td>
          <td>
            <div class="drug">${escape(it.drug_name)}</div>
            ${it.notes ? `<div class="notes">${escape(it.notes)}</div>` : ''}
            ${it.is_substitutable === false ? '<div class="ns">⚠ NON SUBSTITUABLE</div>' : ''}
          </td>
          <td>${escape(it.dosage)}</td>
          <td>${escape(it.frequency)}</td>
          <td>${escape(it.duration)}</td>
          <td>${escape(it.quantity || '—')}</td>
        </tr>`,
      )
      .join('');

    const hashFingerprint =
      prescription.signature_hash?.slice(0, 16) || '—';

    return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Ordonnance #${escape(prescription.prescription_number || prescription.id.slice(0, 8))}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 40px;
      background: #fff;
      font-size: 13px;
      line-height: 1.5;
    }
    .wrapper {
      max-width: 800px;
      margin: 0 auto;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 16px;
      border-bottom: 2px solid #0f172a;
      margin-bottom: 24px;
    }
    header h1 {
      margin: 0;
      font-size: 22px;
      letter-spacing: 0.5px;
    }
    header .tagline {
      font-size: 11px;
      color: #64748b;
      margin-top: 4px;
    }
    header .right {
      text-align: right;
      font-size: 11px;
      color: #475569;
    }
    .meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 24px;
    }
    .meta .block {
      padding: 12px 16px;
      background: #f8fafc;
      border-radius: 6px;
    }
    .meta .label {
      font-size: 10px;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 1px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .meta .value {
      font-size: 14px;
      font-weight: 600;
    }
    h2 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #475569;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
      margin: 24px 0 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-bottom: 16px;
    }
    th {
      text-align: left;
      padding: 8px 6px;
      background: #f1f5f9;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #475569;
    }
    td {
      padding: 10px 6px;
      border-top: 1px solid #f1f5f9;
      vertical-align: top;
    }
    td.num { width: 24px; color: #94a3b8; }
    .drug { font-weight: 600; font-size: 13px; }
    .notes { font-size: 11px; color: #64748b; margin-top: 4px; }
    .ns { font-size: 10px; color: #991b1b; font-weight: 700; margin-top: 4px; }
    .instructions {
      background: #fffbeb;
      border-left: 3px solid #f59e0b;
      padding: 12px 16px;
      margin: 16px 0;
      font-size: 12px;
      color: #78350f;
    }
    .signature {
      margin-top: 40px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
    }
    .signature .practitioner-name {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .signature .stamp {
      text-align: right;
      font-size: 10px;
      color: #475569;
      font-family: 'Courier New', monospace;
    }
    .footer {
      margin-top: 32px;
      font-size: 9px;
      color: #94a3b8;
      text-align: center;
      line-height: 1.6;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
    .print-bar {
      position: fixed;
      top: 16px;
      right: 16px;
      background: #0f172a;
      color: #fff;
      padding: 10px 16px;
      border-radius: 6px;
      font-size: 13px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    .print-bar button {
      background: #fff;
      color: #0f172a;
      border: none;
      padding: 6px 14px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      margin-left: 12px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="print-bar no-print">
    Aperçu d'impression
    <button onclick="window.print()">📄 Imprimer / Enregistrer en PDF</button>
  </div>
  <div class="wrapper">
    <header>
      <div>
        <h1>${escape(tenantName)}</h1>
        <div class="tagline">${escape(practitionerName)}</div>
      </div>
      <div class="right">
        <div><strong>Ordonnance</strong></div>
        <div>${escape(prescription.prescription_number || '—')}</div>
        <div>Émise le ${issuedDate}</div>
        <div>Validité : ${validity} jours</div>
      </div>
    </header>

    <div class="meta">
      <div class="block">
        <div class="label">Patient</div>
        <div class="value">${escape(patientName)}</div>
        ${patientDob ? `<div style="font-size:11px;color:#64748b;margin-top:4px;">Né(e) le ${patientDob}</div>` : ''}
      </div>
      <div class="block">
        <div class="label">Praticien</div>
        <div class="value">${escape(practitionerName)}</div>
      </div>
    </div>

    <h2>Prescription</h2>
    ${
      items.length === 0
        ? '<p style="color:#94a3b8;font-style:italic;">Aucun médicament prescrit.</p>'
        : `
    <table>
      <thead>
        <tr>
          <th></th>
          <th>Médicament</th>
          <th>Dosage</th>
          <th>Fréquence</th>
          <th>Durée</th>
          <th>Quantité</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>`
    }

    ${
      prescription.patient_instructions
        ? `<div class="instructions"><strong>Conseils au patient :</strong> ${escape(prescription.patient_instructions)}</div>`
        : ''
    }

    <div class="signature">
      <div>
        <div class="practitioner-name">${escape(practitionerName)}</div>
        <div style="font-size:11px;color:#64748b;">Praticien — ${escape(tenantName)}</div>
      </div>
      <div class="stamp">
        Signature électronique<br/>
        ${escape(hashFingerprint)}<br/>
        ${new Date(prescription.signed_at).toLocaleString('fr')}
      </div>
    </div>

    <div class="footer">
      Ce document est généré numériquement par MEDOS — Cimolace Platform.<br/>
      Hash de signature : ${escape(prescription.signature_hash || '—')}
    </div>
  </div>
  <script>
    // Auto-print on load (give browser 200ms to render)
    setTimeout(() => { try { window.print(); } catch(e) {} }, 250);
  </script>
</body>
</html>`;
  }
}

function escape(s: unknown): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
