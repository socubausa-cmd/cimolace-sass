/**
 * GuestNotesPanel
 * ---------------
 * Cahier de notes personnel de l'élève pendant une session live LIRI.
 * S'installe dans le side rail gauche, à la place des scripts hôte
 * (MasterScriptBlocksPanel + ReadAloudScriptPanel) — UNIQUEMENT côté invité.
 *
 * Features :
 *   - Markdown léger via textarea + toolbar (gras/italique/listes/titres)
 *   - Horodatage automatique à chaque nouvelle entrée
 *   - Lien scène Smartboard : chaque entrée retient la scène active
 *   - Capture Smartboard : bouton 📸 qui appelle onCaptureSmartboard()
 *   - Export Markdown (download .md) et PDF (jsPDF)
 *   - Envoi explicite au prof (shared_with_teacher='once')
 *
 * Props :
 *   - sessionId (string)             — pour persistance Supabase
 *   - sessionTitle (string)          — pour l'en-tête export
 *   - currentSceneRef (object|null)  — { scene_id, scene_label, page? }
 *   - onCaptureSmartboard (fn?)      — async fn returning { url, thumb_url? }
 *                                      (uploadée par le parent, on ne connaît
 *                                      que l'URL publique finale)
 *   - onJumpToScene (fn?)            — (scene_ref) => void : ramène le
 *                                      Smartboard à cette scène quand l'élève
 *                                      clique sur le badge scène d'une entrée
 *   - capabilities (object)          — { canExportNotes, canSendNotesToTeacher }
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Bold, Italic, List, ListOrdered, Heading2, Heading3,
  Camera, Download, FileText, Send, Trash2, MapPin, Clock, Loader2,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useGuestNotes } from '@/hooks/useGuestNotes';
import { useToast } from '@/components/ui/use-toast';
import { proColors, proRadii, proSize, proType } from '@/components/liri/live-room/liveGuestProTokens';

const TOOLBAR_BTN = {
  height: 26, minWidth: 26, padding: '0 6px',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
  background: proColors.surface3,
  border: `1px solid ${proColors.border}`,
  borderRadius: proRadii.sm,
  color: proColors.textSecondary,
  cursor: 'pointer',
  fontFamily: proType.ui,
  fontSize: proType.xs,
  transition: 'background 120ms ease, color 120ms ease',
};

function wrapSelection(textarea, prefix, suffix = prefix) {
  if (!textarea) return;
  const { selectionStart: s, selectionEnd: e, value } = textarea;
  const before = value.slice(0, s);
  const mid = value.slice(s, e) || '';
  const after = value.slice(e);
  const next = `${before}${prefix}${mid}${suffix}${after}`;
  textarea.value = next;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.focus();
  textarea.selectionStart = s + prefix.length;
  textarea.selectionEnd = e + prefix.length;
}

function prefixLines(textarea, prefix) {
  if (!textarea) return;
  const { selectionStart: s, selectionEnd: e, value } = textarea;
  const before = value.slice(0, s);
  const mid = value.slice(s, e) || '';
  const after = value.slice(e);
  const patched = (mid || 'Ma note').split('\n').map((l) => (l ? `${prefix}${l}` : l)).join('\n');
  const next = `${before}${patched}${after}`;
  textarea.value = next;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.focus();
}

function downloadText(filename, content, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

function markdownToPdf(markdown, title) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const lineH = 16;
  let y = margin;

  const drawLine = (text, fontSize = 11, bold = false) => {
    if (y + lineH > pageH - margin) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    const wrapped = doc.splitTextToSize(text, pageW - margin * 2);
    wrapped.forEach((line) => {
      if (y + lineH > pageH - margin) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += lineH;
    });
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(title || 'Cahier de séance LIRI', margin, y);
  y += 28;

  markdown.split('\n').forEach((line) => {
    if (/^# /.test(line)) drawLine(line.replace(/^# /, ''), 16, true);
    else if (/^## /.test(line)) drawLine(line.replace(/^## /, ''), 14, true);
    else if (/^### /.test(line)) drawLine(line.replace(/^### /, ''), 12, true);
    else if (/^> /.test(line)) drawLine(`• ${line.replace(/^> /, '')}`, 10, false);
    else if (/^---$/.test(line)) { y += 6; drawLine('────────────────', 10); y += 6; }
    else if (line.trim() === '') y += 8;
    else drawLine(line, 11);
  });

  return doc;
}

export default function GuestNotesPanel({
  sessionId,
  sessionTitle = 'Cours LIRI',
  currentSceneRef = null,
  onCaptureSmartboard = null,
  onJumpToScene = null,
  capabilities = { canExportNotes: true, canSendNotesToTeacher: true },
}) {
  const {
    entries, loading, saving, error, isShared,
    addEntry, deleteEntry, shareWithTeacher, exportMarkdown,
  } = useGuestNotes(sessionId, { enabled: Boolean(sessionId), currentSceneRef, sessionTitle });

  const { toast } = useToast();
  const [draft, setDraft] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const draftRef = useRef(null);

  const canCapture = typeof onCaptureSmartboard === 'function';
  const canJump = typeof onJumpToScene === 'function';

  const handleAddEntry = useCallback((attachments) => {
    const text = (draft || '').trim();
    if (!text && !(attachments && attachments.length)) return;
    addEntry({ text_md: text, attachments });
    setDraft('');
  }, [draft, addEntry]);

  const handleCaptureSmartboard = useCallback(async () => {
    if (!canCapture) return;
    try {
      setCapturing(true);
      const res = await onCaptureSmartboard();
      if (res && res.url) {
        handleAddEntry([{ kind: 'smartboard_capture', url: res.url, thumb_url: res.thumb_url }]);
      } else {
        toast({
          title: 'Capture non enregistrée',
          description: 'Le serveur n\'a pas renvoyé d\'image. Réessayez ou vérifiez la connexion.',
          variant: 'destructive',
        });
      }
    } catch (e) {
      console.warn('[GuestNotesPanel] capture failed', e?.message || e);
      toast({
        title: 'Échec de la capture',
        description: e?.message || 'Impossible de capturer ou d\'envoyer l\'image.',
        variant: 'destructive',
      });
    } finally {
      setCapturing(false);
    }
  }, [canCapture, onCaptureSmartboard, handleAddEntry, toast]);

  const handleExportMarkdown = useCallback(() => {
    const md = exportMarkdown();
    const name = `notes-${(sessionTitle || 'cours').replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.md`;
    downloadText(name, md, 'text/markdown;charset=utf-8');
  }, [exportMarkdown, sessionTitle]);

  const handleExportPdf = useCallback(() => {
    const md = exportMarkdown();
    const doc = markdownToPdf(md, `Cahier de séance — ${sessionTitle || 'Cours LIRI'}`);
    const name = `notes-${(sessionTitle || 'cours').replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(name);
  }, [exportMarkdown, sessionTitle]);

  const handleShareWithTeacher = useCallback(async () => {
    if (!capabilities?.canSendNotesToTeacher) return;
    setShareBusy(true);
    try {
      await shareWithTeacher();
    } finally {
      setShareBusy(false);
    }
  }, [shareWithTeacher, capabilities]);

  const headerStatus = useMemo(() => {
    if (loading) return 'Chargement…';
    if (saving) return 'Enregistrement…';
    if (isShared) return 'Partagé avec le prof';
    if (error) return 'Erreur de sync';
    return 'Synchronisé';
  }, [loading, saving, isShared, error]);

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0,
        background: proColors.surface1,
        borderLeft: `1px solid ${proColors.border}`,
        borderRight: `1px solid ${proColors.border}`,
        color: proColors.textPrimary,
        fontFamily: proType.ui,
      }}
    >
      {/* Header */}
      <div
        style={{
          height: proSize.panelHeaderHeight,
          padding: '0 10px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: proColors.surface2,
          borderBottom: `1px solid ${proColors.border}`,
          fontSize: proType.xs,
          fontWeight: 600,
          letterSpacing: proType.tracking.label,
          textTransform: 'uppercase',
          color: proColors.textSecondary,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <FileText size={13} style={{ opacity: 0.85 }} />
          Cahier de séance
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
          {saving && <Loader2 size={11} className="animate-spin" />}
          <span style={{ color: error ? proColors.error : proColors.textMuted, fontSize: proType.xxs }}>
            {headerStatus}
          </span>
        </span>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '6px 8px',
          background: proColors.surface2,
          borderBottom: `1px solid ${proColors.border}`,
          flexWrap: 'wrap',
        }}
      >
        <button type="button" style={TOOLBAR_BTN} title="Gras (**texte**)" onClick={() => wrapSelection(draftRef.current, '**')}><Bold size={13} /></button>
        <button type="button" style={TOOLBAR_BTN} title="Italique (*texte*)" onClick={() => wrapSelection(draftRef.current, '*')}><Italic size={13} /></button>
        <span style={{ width: 1, height: 16, background: proColors.border, margin: '0 4px' }} />
        <button type="button" style={TOOLBAR_BTN} title="Titre (##)" onClick={() => prefixLines(draftRef.current, '## ')}><Heading2 size={13} /></button>
        <button type="button" style={TOOLBAR_BTN} title="Sous-titre (###)" onClick={() => prefixLines(draftRef.current, '### ')}><Heading3 size={13} /></button>
        <button type="button" style={TOOLBAR_BTN} title="Liste à puces" onClick={() => prefixLines(draftRef.current, '- ')}><List size={13} /></button>
        <button type="button" style={TOOLBAR_BTN} title="Liste numérotée" onClick={() => prefixLines(draftRef.current, '1. ')}><ListOrdered size={13} /></button>
        <span style={{ flex: 1 }} />
        {canCapture && (
          <button
            type="button"
            style={{ ...TOOLBAR_BTN, color: proColors.accent, borderColor: proColors.borderAccent, background: proColors.accentSoft }}
            title="Capturer le tableau actuel dans une note"
            onClick={handleCaptureSmartboard}
            disabled={capturing}
          >
            {capturing ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
            <span style={{ fontWeight: 600 }}>Tableau</span>
          </button>
        )}
      </div>

      {/* Zone de saisie */}
      <div style={{ padding: 10, borderBottom: `1px solid ${proColors.border}`, background: proColors.surface1 }}>
        {currentSceneRef?.scene_label && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: proType.xxs, color: proColors.textMuted, marginBottom: 6,
          }}>
            <MapPin size={10} />
            <span>Scène active : <span style={{ color: proColors.textSecondary }}>{currentSceneRef.scene_label}</span></span>
          </div>
        )}
        <textarea
          ref={draftRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Prends une note… (Markdown supporté — **gras**, *italique*, ## titre, - liste)"
          rows={4}
          style={{
            width: '100%', resize: 'vertical',
            background: proColors.surface0,
            border: `1px solid ${proColors.border}`,
            borderRadius: proRadii.sm,
            color: proColors.textPrimary,
            fontFamily: proType.ui,
            fontSize: proType.sm,
            padding: 8,
            outline: 'none',
            lineHeight: 1.5,
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <button
            type="button"
            onClick={() => handleAddEntry()}
            disabled={!draft.trim()}
            style={{
              height: proSize.tinyButtonHeight, padding: '0 12px',
              borderRadius: proRadii.sm,
              background: draft.trim() ? proColors.accent : proColors.surface3,
              color: draft.trim() ? '#000' : proColors.textMuted,
              border: 'none',
              fontSize: proType.xs, fontWeight: 600,
              cursor: draft.trim() ? 'pointer' : 'not-allowed',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            Ajouter note
          </button>
        </div>
      </div>

      {/* Liste des entrées */}
      <div
        className="pro-scroll"
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 8 }}
      >
        {loading && (
          <div style={{ color: proColors.textMuted, fontSize: proType.xs, padding: 12, textAlign: 'center' }}>
            Chargement du cahier…
          </div>
        )}
        {!loading && entries.length === 0 && (
          <div style={{ color: proColors.textMuted, fontSize: proType.xs, padding: 20, textAlign: 'center', lineHeight: 1.6 }}>
            Aucune note pour l'instant.<br />Commence à écrire ci-dessus — chaque note retient la scène Smartboard active.
          </div>
        )}
        {entries.slice().reverse().map((e) => (
          <NoteEntry
            key={e.id}
            entry={e}
            canJump={canJump}
            onJump={() => onJumpToScene?.(e.scene_ref)}
            onDelete={() => deleteEntry(e.id)}
          />
        ))}
      </div>

      {/* Footer — actions globales */}
      <div
        style={{
          display: 'flex', gap: 6, padding: 8,
          background: proColors.surface2,
          borderTop: `1px solid ${proColors.border}`,
        }}
      >
        {capabilities?.canExportNotes && (
          <>
            <button
              type="button"
              style={{ ...TOOLBAR_BTN, flex: 1 }}
              title="Télécharger en Markdown"
              onClick={handleExportMarkdown}
              disabled={entries.length === 0}
            >
              <Download size={13} />
              <span style={{ fontSize: proType.xxs }}>.md</span>
            </button>
            <button
              type="button"
              style={{ ...TOOLBAR_BTN, flex: 1 }}
              title="Télécharger en PDF"
              onClick={handleExportPdf}
              disabled={entries.length === 0}
            >
              <Download size={13} />
              <span style={{ fontSize: proType.xxs }}>.pdf</span>
            </button>
          </>
        )}
        {capabilities?.canSendNotesToTeacher && (
          <button
            type="button"
            style={{
              ...TOOLBAR_BTN,
              flex: 1.4,
              color: isShared ? proColors.ok : proColors.accent,
              borderColor: isShared ? 'rgba(94,64,34,0.35)' : proColors.borderAccent,
              background: isShared ? 'rgba(94,64,34,0.12)' : proColors.accentSoft,
            }}
            title={isShared ? 'Notes déjà partagées avec le prof' : 'Envoyer mes notes au prof en fin de cours'}
            onClick={handleShareWithTeacher}
            disabled={entries.length === 0 || shareBusy || isShared}
          >
            {shareBusy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            <span style={{ fontSize: proType.xxs, fontWeight: 600 }}>
              {isShared ? 'Partagé' : 'Envoyer au prof'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

function NoteEntry({ entry, canJump, onJump, onDelete }) {
  const dt = new Date(entry.created_at);
  const stamp = Number.isFinite(dt.getTime())
    ? dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '';
  const hasAttachments = Array.isArray(entry.attachments) && entry.attachments.length > 0;

  return (
    <div
      style={{
        background: proColors.surface2,
        border: `1px solid ${proColors.border}`,
        borderRadius: proRadii.md,
        padding: 10,
        marginBottom: 8,
        fontFamily: proType.ui,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: proColors.textMuted, fontSize: proType.xxs }}>
          <Clock size={10} />
          {stamp}
        </span>
        <div style={{ display: 'inline-flex', gap: 4 }}>
          {canJump && entry.scene_ref?.scene_label && (
            <button
              type="button"
              onClick={onJump}
              title="Revenir à cette scène Smartboard"
              style={{
                ...TOOLBAR_BTN,
                height: 20, minWidth: 0, padding: '0 6px',
                color: proColors.accent,
                borderColor: proColors.borderAccent,
                background: proColors.accentSoft,
                fontSize: proType.xxs,
              }}
            >
              <MapPin size={10} />
              <span>{entry.scene_ref.scene_label}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            title="Supprimer cette note"
            style={{
              ...TOOLBAR_BTN,
              height: 20, minWidth: 0, padding: '0 6px',
              color: proColors.textMuted,
            }}
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      {entry.text_md && (
        <div style={{
          fontSize: proType.sm,
          color: proColors.textPrimary,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: 1.55,
        }}>
          {entry.text_md}
        </div>
      )}
      {hasAttachments && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {entry.attachments.map((a, i) => (
            <a
              key={i}
              href={a.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'block',
                width: 80, height: 48,
                background: `url(${a.thumb_url || a.url}) center/cover no-repeat`,
                borderRadius: proRadii.sm,
                border: `1px solid ${proColors.border}`,
              }}
              title="Ouvrir la capture"
            />
          ))}
        </div>
      )}
    </div>
  );
}
