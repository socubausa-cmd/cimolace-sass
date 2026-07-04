/**
 * DocumentStudioLauncher — Studio Documentaire Intelligent
 * Cahier de charge 2026-04-07
 *
 * 4 modes : Template · Canvas Intelligent · Assistant guidé · Libre
 * 8 templates A4 avec objets Konva complets
 */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronLeft, Sparkles, FileText, Layout, Bot, Zap,
  CheckCircle2, ChevronRight, ArrowRight, Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  TEMPLATES, DOMAINS, DOMAIN_META,
  searchTemplates, getTemplatesByDomain,
  templateToKonvaObjects,
} from '@/features/smartboard-konva-editor/lib/documentTemplateLibrary';

/* ─── A4 canvas constants (794×1123 @96dpi) ─────────────────── */
const ML = 52;   // left margin
const MT = 72;   // top margin
const CW = 690;  // content width (794 - 104)
const AH = 1123; // A4 height
const MB = 70;   // bottom margin

/* ─── Object factories ───────────────────────────────────────── */
function gid() {
  return `d_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const BASE_TEXT_STYLE = {
  fontFamily: 'Georgia, serif',
  fontSize: 12,
  fontWeight: 400,
  fill: '#2b2520',
  lineHeight: 1.65,
  letterSpacing: 0,
  align: 'left',
};

function mkText(x, y, w, h, text, style = {}) {
  return {
    id: gid(), type: 'text',
    x, y, width: w, height: h,
    rotation: 0, layer: 1, visible: true, locked: false, step: 0, visibleFor: 'both',
    content: { text },
    style: { ...BASE_TEXT_STYLE, ...style },
    opacity: 1,
  };
}

function mkLine(x, y, w, style = {}) {
  return {
    id: gid(), type: 'line',
    x, y, width: Math.max(14, w), height: 2,
    rotation: 0, layer: 1, visible: true, locked: false, step: 0, visibleFor: 'both',
    content: { points: [0, 0, w, 0] },
    style: { stroke: '#cbd5e1', strokeWidth: 0.75, ...style },
    opacity: 1,
  };
}

function mkRect(x, y, w, h, style = {}) {
  return {
    id: gid(), type: 'rect',
    x, y, width: w, height: h,
    rotation: 0, layer: 1, visible: true, locked: false, step: 0, visibleFor: 'both',
    style: { fill: 'transparent', stroke: '#e2e8f0', strokeWidth: 1, cornerRadius: 3, ...style },
    opacity: 1,
  };
}

/* ═════════════════════════════════════════════════════════════════
   TEMPLATES — 8 modèles administratifs complets
═════════════════════════════════════════════════════════════════ */

function tLettre() {
  return [
    mkRect(ML, MT, 170, 52, { fill: 'rgba(203,213,225,0.12)', stroke: '#cbd5e1', cornerRadius: 4 }),
    mkText(ML + 8, MT + 14, 154, 20, 'LOGO / EN-TÊTE', { fontSize: 9, fontWeight: 700, fill: '#94a3b8', align: 'center', letterSpacing: 1.5, lineHeight: 1 }),

    mkText(ML, MT + 62, 300, 56,
      '[Nom Prénom]\n[Adresse]\n[Ville — Code Postal]\n[Tél — Email]',
      { fontSize: 10.5, lineHeight: 1.55 }),

    mkText(ML + 360, MT + 62, 330, 20,
      '[Ville], le [Date]',
      { fontSize: 10.5, align: 'right' }),
    mkText(ML + 360, MT + 88, 330, 72,
      'À [Titre Nom Prénom]\n[Organisation / Service]\n[Adresse]\n[Ville — Code Postal]',
      { fontSize: 10.5, lineHeight: 1.55 }),

    mkText(ML, MT + 178, CW, 20,
      'Objet : [Objet de la lettre]',
      { fontSize: 12, fontWeight: 700 }),
    mkLine(ML, MT + 208, CW),

    mkText(ML, MT + 224, CW, 20, 'Madame, Monsieur,'),
    mkText(ML, MT + 256, CW, 96,
      "Je me permets de vous contacter concernant [objet de la démarche]. En effet, [développez votre argument principal et le contexte de votre demande].\n\nC'est pourquoi je me tourne vers vous afin de [précisez votre demande].",
      { align: 'justify' }),
    mkText(ML, MT + 364, CW, 44,
      "Je reste à votre entière disposition pour tout renseignement complémentaire ou document que vous jugeriez nécessaire à l'instruction de ce dossier.",
      { align: 'justify' }),
    mkText(ML, MT + 420, CW, 44,
      "Dans l'attente d'une réponse favorable, veuillez agréer, Madame, Monsieur, l'expression de mes salutations les plus distinguées.",
      { align: 'justify' }),
    mkText(ML + 380, MT + 488, 310, 54,
      '[Prénom NOM]\n[Titre / Fonction]',
      { fontWeight: 600, lineHeight: 1.5 }),
    mkLine(ML, AH - MB - 28, CW),
    mkText(ML, AH - MB - 18, CW, 14,
      '[Organisation] · [Adresse] · [Tél] · [Email]',
      { fontSize: 8.5, fill: '#64748b', align: 'center', lineHeight: 1.3 }),
  ];
}

function tAttestation() {
  return [
    mkText(ML, MT, CW, 20, "[NOM DE L'ORGANISATION]",
      { fontSize: 15, fontWeight: 700, align: 'center', letterSpacing: 0.5 }),
    mkText(ML, MT + 24, CW, 16, '[Adresse · Tél · Email]',
      { fontSize: 10, fill: '#64748b', align: 'center' }),
    mkLine(ML, MT + 48, CW),

    mkText(ML, MT + 72, CW, 32, 'ATTESTATION',
      { fontSize: 22, fontWeight: 800, align: 'center', letterSpacing: 3 }),
    mkText(ML, MT + 108, CW, 20,
      "de [Nature — ex : présence / travail / scolarité]",
      { fontSize: 12, fill: '#475569', align: 'center' }),
    mkLine(ML, MT + 136, CW, { stroke: '#94a3b8' }),

    mkText(ML, MT + 160, CW, 96,
      "Je soussigné(e), [Nom Prénom], [Titre / Fonction] au sein de [Organisation], atteste par la présente que :\n\n[Nom Prénom du bénéficiaire], [né(e) le Date], demeurant [Adresse],\n\n[fait attesté — ex : est régulièrement inscrit(e) / a effectivement travaillé / a participé à…].",
      { lineHeight: 1.7, align: 'justify' }),

    mkRect(ML, MT + 268, CW, 58, { fill: 'rgba(241,245,249,0.5)', cornerRadius: 6, stroke: '#e2e8f0' }),
    mkText(ML + 16, MT + 282, CW - 32, 30,
      'Période : du [Date début] au [Date fin]\nPoste / Formation : [Précisions éventuelles]',
      { fontSize: 11, lineHeight: 1.55 }),

    mkText(ML, MT + 340, CW, 44,
      "La présente attestation est délivrée à l'intéressé(e) pour valoir ce que de droit et lui être remise sur sa demande.",
      { align: 'justify', fill: '#475569' }),

    mkText(ML, MT + 400, CW, 20, '[Ville], le [Date]', { align: 'right' }),
    mkRect(ML + 380, MT + 428, 310, 80, { fill: 'rgba(203,213,225,0.08)', cornerRadius: 4 }),
    mkText(ML + 396, MT + 444, 278, 30,
      'Signature + cachet\n[Nom Prénom — Fonction]',
      { fontSize: 10.5, fill: '#94a3b8', lineHeight: 1.4 }),

    mkLine(ML, AH - MB - 28, CW),
    mkText(ML, AH - MB - 18, CW, 14,
      "[Organisation] · [Adresse] · SIRET [N°] · [Email]",
      { fontSize: 8.5, fill: '#64748b', align: 'center' }),
  ];
}

function tContrat() {
  return [
    mkText(ML, MT, CW, 28, 'CONTRAT [TYPE DE CONTRAT]',
      { fontSize: 17, fontWeight: 800, align: 'center', letterSpacing: 1 }),
    mkText(ML, MT + 32, CW, 16, 'Réf. [CONT-2024-001] · [Date de rédaction]',
      { fontSize: 10, fill: '#64748b', align: 'center' }),
    mkLine(ML, MT + 56, CW, { stroke: '#1e3a5f', strokeWidth: 1.5 }),

    mkText(ML, MT + 74, CW, 20, 'ENTRE LES PARTIES',
      { fontSize: 11, fontWeight: 700, letterSpacing: 1, fill: '#475569' }),
    mkText(ML, MT + 98, CW, 48,
      "D'une part : [Dénomination / Nom], [Adresse], représenté(e) par [Nom], en qualité de [Fonction], ci-après désigné(e) « LA PARTIE A ».",
      { fontSize: 11, lineHeight: 1.6, align: 'justify' }),
    mkText(ML, MT + 154, CW, 48,
      "D'autre part : [Dénomination / Nom], [Adresse], représenté(e) par [Nom], en qualité de [Fonction], ci-après désigné(e) « LA PARTIE B ».",
      { fontSize: 11, lineHeight: 1.6, align: 'justify' }),
    mkLine(ML, MT + 210, CW, { stroke: '#e2e8f0' }),

    mkText(ML, MT + 226, CW, 20, "ARTICLE 1 — OBJET DU CONTRAT",
      { fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }),
    mkText(ML, MT + 250, CW, 44,
      "Le présent contrat a pour objet [description précise des prestations et obligations de chaque partie].",
      { fontSize: 11, lineHeight: 1.6, align: 'justify' }),

    mkText(ML, MT + 302, CW, 20, "ARTICLE 2 — DURÉE",
      { fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }),
    mkText(ML, MT + 326, CW, 44,
      "Le présent contrat prend effet le [Date début] pour une durée de [durée], soit jusqu'au [Date fin], [renouvelable / non renouvelable] par accord mutuel.",
      { fontSize: 11, lineHeight: 1.6, align: 'justify' }),

    mkText(ML, MT + 378, CW, 20, "ARTICLE 3 — RÉMUNÉRATION",
      { fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }),
    mkText(ML, MT + 402, CW, 44,
      "En contrepartie des prestations définies à l'article 1, la PARTIE A versera à la PARTIE B la somme de [Montant] €, selon les modalités suivantes : [modalités de paiement].",
      { fontSize: 11, lineHeight: 1.6, align: 'justify' }),

    mkText(ML, MT + 454, CW, 20, "ARTICLE 4 — RÉSILIATION",
      { fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }),
    mkText(ML, MT + 478, CW, 44,
      "Chacune des parties pourra résilier le présent contrat par lettre recommandée AR, sous réserve d'un préavis de [délai] jours.",
      { fontSize: 11, lineHeight: 1.6, align: 'justify' }),

    mkLine(ML, MT + 532, CW, { stroke: '#e2e8f0' }),
    mkText(ML, MT + 548, CW, 16,
      'Fait à [Ville], en deux exemplaires originaux, le [Date]',
      { align: 'center', fill: '#475569', fontSize: 11 }),
    mkText(ML, MT + 576, 300, 54,
      'Signature PARTIE A :\n\n[Nom — Cachet]',
      { fontSize: 10.5, lineHeight: 1.6 }),
    mkText(ML + 390, MT + 576, 300, 54,
      'Signature PARTIE B :\n\n[Nom — Cachet]',
      { fontSize: 10.5, lineHeight: 1.6 }),

    mkLine(ML, AH - MB - 28, CW),
    mkText(ML, AH - MB - 18, CW, 14, 'Document confidentiel — usage interne',
      { fontSize: 8.5, fill: '#94a3b8', align: 'center' }),
  ];
}

function tFacture() {
  const rows = 4;
  return [
    mkText(ML, MT, 320, 60,
      "[NOM DE L'ENTREPRISE]\n[Adresse complète]\n[SIRET : 000 000 000 00000]",
      { fontSize: 11, lineHeight: 1.55 }),
    mkText(ML + 380, MT, 310, 30, 'FACTURE',
      { fontSize: 22, fontWeight: 800, align: 'right', letterSpacing: 2, fill: '#1e3a5f' }),
    mkText(ML + 380, MT + 34, 310, 18, 'N° [FACT-2024-001]',
      { fontSize: 11, fontWeight: 600, align: 'right', fill: '#475569' }),
    mkText(ML + 380, MT + 54, 310, 16, 'Date : [JJ/MM/AAAA] · Échéance : [JJ/MM/AAAA]',
      { fontSize: 10, align: 'right', fill: '#64748b' }),

    mkRect(ML, MT + 80, 310, 68, { fill: 'rgba(241,245,249,0.5)', cornerRadius: 5, stroke: '#e2e8f0' }),
    mkText(ML + 10, MT + 90, 290, 54,
      'FACTURER À :\n[Nom Client / Organisation]\n[Adresse]\n[Ville — Code Postal]',
      { fontSize: 10.5, lineHeight: 1.55 }),

    // Table header
    mkRect(ML, MT + 162, CW, 24, { fill: '#1e3a5f', cornerRadius: 2, stroke: 'transparent' }),
    mkText(ML + 8, MT + 171, 340, 13, 'DÉSIGNATION',
      { fontSize: 9, fontWeight: 700, fill: '#ffffff', letterSpacing: 1, lineHeight: 1 }),
    mkText(ML + 356, MT + 171, 54, 13, 'QTÉ',
      { fontSize: 9, fontWeight: 700, fill: '#ffffff', align: 'center', lineHeight: 1 }),
    mkText(ML + 416, MT + 171, 84, 13, 'P.U. HT (€)',
      { fontSize: 9, fontWeight: 700, fill: '#ffffff', align: 'right', lineHeight: 1 }),
    mkText(ML + 508, MT + 171, 96, 13, 'TOTAL HT (€)',
      { fontSize: 9, fontWeight: 700, fill: '#ffffff', align: 'right', lineHeight: 1 }),

    // Rows
    ...[...Array(rows)].flatMap((_, i) => [
      mkRect(ML, MT + 186 + i * 26, CW, 26,
        { fill: i % 2 === 0 ? 'rgba(241,245,249,0.25)' : 'transparent', stroke: '#f1f5f9', cornerRadius: 0, strokeWidth: 0.5 }),
      mkText(ML + 8,   MT + 194 + i * 26, 340, 13, `[Prestation / Produit ${i + 1}]`, { fontSize: 11, lineHeight: 1 }),
      mkText(ML + 356, MT + 194 + i * 26,  54, 13, '1',          { fontSize: 11, align: 'center', lineHeight: 1 }),
      mkText(ML + 416, MT + 194 + i * 26,  84, 13, '[0,00]',     { fontSize: 11, align: 'right',  lineHeight: 1 }),
      mkText(ML + 508, MT + 194 + i * 26,  96, 13, '[0,00]',     { fontSize: 11, align: 'right',  lineHeight: 1 }),
    ]),

    // Totals
    mkLine(ML, MT + 290, CW, { stroke: '#e2e8f0' }),
    mkText(ML + 400, MT + 300, 100, 14, 'Sous-total HT',  { fontSize: 10, fill: '#475569', lineHeight: 1 }),
    mkText(ML + 508, MT + 300,  96, 14, '[0,00 €]',       { fontSize: 10, align: 'right', lineHeight: 1 }),
    mkText(ML + 400, MT + 320, 100, 14, 'TVA (20%)',      { fontSize: 10, fill: '#475569', lineHeight: 1 }),
    mkText(ML + 508, MT + 320,  96, 14, '[0,00 €]',       { fontSize: 10, align: 'right', lineHeight: 1 }),
    mkRect(ML + 380, MT + 340, 234, 28, { fill: '#1e3a5f', cornerRadius: 3, stroke: 'transparent' }),
    mkText(ML + 390, MT + 349, 100, 13, 'TOTAL TTC',
      { fontSize: 11, fontWeight: 700, fill: '#ffffff', lineHeight: 1 }),
    mkText(ML + 500, MT + 349, 104, 13, '[0,00 €]',
      { fontSize: 12, fontWeight: 800, fill: '#ffffff', align: 'right', lineHeight: 1 }),

    mkText(ML, MT + 376, 360, 48,
      "Règlement : [Virement / Chèque] à réception.\nIBAN : [FR00 0000 0000 0000 0000 0000 000]\nMerci de votre confiance.",
      { fontSize: 10, fill: '#64748b', lineHeight: 1.55 }),

    mkLine(ML, AH - MB - 28, CW),
    mkText(ML, AH - MB - 18, CW, 14,
      "[Entreprise] — SIRET [000 000 000 00000] — TVA Intra. [FR00000000000]",
      { fontSize: 8.5, fill: '#94a3b8', align: 'center' }),
  ];
}

function tNoteService() {
  return [
    mkText(ML, MT, CW, 20, "[NOM DE L'ORGANISATION / DÉPARTEMENT]",
      { fontSize: 12, fontWeight: 700, align: 'center', letterSpacing: 0.5 }),
    mkRect(ML, MT + 30, CW, 68, { fill: 'rgba(241,245,249,0.5)', cornerRadius: 5, stroke: '#e2e8f0' }),
    mkText(ML + 14, MT + 42, CW - 28, 52,
      'NOTE DE SERVICE N° [NS-2024-001]\nDate : [JJ/MM/AAAA]\nDe : [Nom Prénom — Fonction / Direction]\nÀ : [Tous les collaborateurs / Service concerné]',
      { fontSize: 11, lineHeight: 1.55 }),
    mkText(ML, MT + 110, CW, 20, 'Objet : [Objet de la note]',
      { fontSize: 12, fontWeight: 700 }),
    mkLine(ML, MT + 140, CW),
    mkText(ML, MT + 158, CW, 80,
      "Par la présente, il est porté à votre connaissance que [présentation du sujet]. [Développez le contexte et les raisons qui motivent cette communication interne].",
      { lineHeight: 1.7, align: 'justify' }),
    mkText(ML, MT + 250, CW, 20, 'DISPOSITIONS',
      { fontSize: 11, fontWeight: 700, letterSpacing: 0.5, fill: '#475569' }),
    mkText(ML, MT + 274, CW, 80,
      "[Énumérez les mesures ou règles à respecter. Par exemple :\n— Toute demande devra être soumise avant le [Date]\n— Les formulaires sont disponibles auprès de [Service]\n— [Autre disposition pertinente]]",
      { fontSize: 11, lineHeight: 1.65, align: 'justify' }),
    mkText(ML, MT + 366, CW, 44,
      "Pour toute question, vous pouvez contacter [Nom Prénom] au [Coordonnées] ou par email : [email@organisation.fr].",
      { fontSize: 11, lineHeight: 1.6, fill: '#475569', align: 'justify' }),
    mkText(ML + 380, MT + 428, 310, 40,
      'Signature :\n[Nom Prénom — Titre]',
      { fontSize: 11, lineHeight: 1.5 }),
    mkLine(ML, AH - MB - 28, CW),
    mkText(ML, AH - MB - 18, CW, 14, 'Document interne — diffusion restreinte',
      { fontSize: 8.5, fill: '#94a3b8', align: 'center' }),
  ];
}

function tRapport() {
  return [
    mkRect(ML - 52, MT - 72, 794, 148,
      { fill: 'rgba(30,58,95,0.06)', stroke: 'transparent', cornerRadius: 0 }),
    mkText(ML, MT, CW, 36, '[TITRE DU RAPPORT]',
      { fontSize: 20, fontWeight: 800, lineHeight: 1.3, fill: '#1e3a5f' }),
    mkText(ML, MT + 42, CW, 20, '[Sous-titre ou Nature du rapport]',
      { fontSize: 13, fontWeight: 400, fill: '#475569' }),
    mkText(ML, MT + 66, CW, 14,
      'Rédigé par [Nom Prénom] · [Service] · Date : [JJ/MM/AAAA]',
      { fontSize: 9.5, fill: '#64748b' }),
    mkLine(ML, MT + 84, CW, { stroke: '#1e3a5f', strokeWidth: 2 }),

    mkRect(ML, MT + 98, CW, 66,
      { fill: 'rgba(241,245,249,0.5)', cornerRadius: 5, stroke: '#e2e8f0' }),
    mkText(ML + 12, MT + 108, CW - 24, 12, 'RÉSUMÉ EXÉCUTIF',
      { fontSize: 9, fontWeight: 700, letterSpacing: 1.5, fill: '#475569', lineHeight: 1 }),
    mkText(ML + 12, MT + 124, CW - 24, 36,
      "[Synthèse en 2-3 phrases des points clés. Ce résumé permet à un lecteur pressé de comprendre l'essentiel du rapport.]",
      { fontSize: 11, lineHeight: 1.55 }),

    mkText(ML, MT + 178, CW, 20, '1. CONTEXTE ET OBJECTIFS',
      { fontSize: 12, fontWeight: 700, fill: '#1e3a5f' }),
    mkLine(ML, MT + 200, CW, { stroke: '#e2e8f0' }),
    mkText(ML, MT + 212, CW, 64,
      "[Décrivez le contexte, les raisons de ce rapport, les objectifs visés et la méthodologie employée. Précisez le périmètre d'analyse.]",
      { fontSize: 11, lineHeight: 1.65, align: 'justify' }),

    mkText(ML, MT + 288, CW, 20, '2. ANALYSE ET OBSERVATIONS',
      { fontSize: 12, fontWeight: 700, fill: '#1e3a5f' }),
    mkLine(ML, MT + 310, CW, { stroke: '#e2e8f0' }),
    mkText(ML, MT + 322, CW, 80,
      "[Présentez vos observations, données et analyses. Structurez par points clés. Vous pouvez inclure tableaux et graphiques. Appuyez chaque point sur des données factuelles.]",
      { fontSize: 11, lineHeight: 1.65, align: 'justify' }),

    mkText(ML, MT + 414, CW, 20, '3. CONCLUSIONS ET RECOMMANDATIONS',
      { fontSize: 12, fontWeight: 700, fill: '#1e3a5f' }),
    mkLine(ML, MT + 436, CW, { stroke: '#e2e8f0' }),
    mkText(ML, MT + 448, CW, 64,
      "[Conclusions principales et recommandations concrètes avec calendrier et ressources. Proposez des indicateurs de suivi pour évaluer la mise en œuvre.]",
      { fontSize: 11, lineHeight: 1.65, align: 'justify' }),

    mkLine(ML, AH - MB - 28, CW),
    mkText(ML, AH - MB - 18, CW, 14, 'Rapport confidentiel — [Organisation] · Page 1',
      { fontSize: 8.5, fill: '#94a3b8', align: 'center' }),
  ];
}

function tCompteRendu() {
  return [
    mkText(ML, MT, CW, 20, 'COMPTE-RENDU DE RÉUNION',
      { fontSize: 16, fontWeight: 800, align: 'center', letterSpacing: 1 }),
    mkRect(ML, MT + 30, CW, 54, { fill: 'rgba(241,245,249,0.5)', cornerRadius: 5, stroke: '#e2e8f0' }),
    mkText(ML + 14, MT + 40, CW - 28, 40,
      'Réunion du : [JJ/MM/AAAA à HH:MM]\nLieu : [Salle / En visio]\nParticipants : [Nom 1, Nom 2, Nom 3…] · Rédacteur : [Nom]',
      { fontSize: 11, lineHeight: 1.55 }),
    mkLine(ML, MT + 94, CW),

    mkText(ML, MT + 110, CW, 18, "ORDRE DU JOUR",
      { fontSize: 11, fontWeight: 700, letterSpacing: 0.5, fill: '#475569' }),
    mkText(ML + 16, MT + 132, CW - 16, 48,
      '1. [Point 1 à l\'ordre du jour]\n2. [Point 2 à l\'ordre du jour]\n3. [Point 3 à l\'ordre du jour]\n4. Questions diverses',
      { fontSize: 11, lineHeight: 1.6 }),

    mkLine(ML, MT + 190, CW, { stroke: '#e2e8f0' }),
    mkText(ML, MT + 206, CW, 18, "DÉROULEMENT DE LA RÉUNION",
      { fontSize: 11, fontWeight: 700, letterSpacing: 0.5, fill: '#475569' }),

    mkText(ML, MT + 228, CW, 18, '1. [Titre du point 1]',
      { fontSize: 11, fontWeight: 600, fill: '#1e3a5f' }),
    mkText(ML + 16, MT + 250, CW - 16, 44,
      "[Résumé des échanges sur ce point. Décisions prises, accord ou désaccord des participants, points à clarifier ultérieurement.]",
      { fontSize: 11, lineHeight: 1.6, align: 'justify' }),

    mkText(ML, MT + 302, CW, 18, '2. [Titre du point 2]',
      { fontSize: 11, fontWeight: 600, fill: '#1e3a5f' }),
    mkText(ML + 16, MT + 324, CW - 16, 44,
      "[Résumé des échanges sur ce point. Indiquez les positions de chacun, les décisions, les votes si applicable.]",
      { fontSize: 11, lineHeight: 1.6, align: 'justify' }),

    mkLine(ML, MT + 378, CW, { stroke: '#e2e8f0' }),
    mkText(ML, MT + 394, CW, 18, "DÉCISIONS ET ACTIONS",
      { fontSize: 11, fontWeight: 700, letterSpacing: 0.5, fill: '#475569' }),
    mkRect(ML, MT + 416, CW, 72, { fill: 'rgba(241,245,249,0.4)', cornerRadius: 5, stroke: '#e2e8f0' }),
    mkText(ML + 14, MT + 426, CW - 28, 54,
      '→ [Action 1] — Responsable : [Nom] — Échéance : [Date]\n→ [Action 2] — Responsable : [Nom] — Échéance : [Date]\n→ [Action 3] — Responsable : [Nom] — Échéance : [Date]',
      { fontSize: 11, lineHeight: 1.6 }),

    mkText(ML, MT + 500, CW, 20,
      'Prochaine réunion : [Date et lieu]',
      { fontSize: 11, fill: '#475569', align: 'center' }),
    mkText(ML + 380, MT + 534, 310, 36,
      'Approuvé par : [Nom Prénom]\n[Titre — Date]',
      { fontSize: 11, lineHeight: 1.5 }),

    mkLine(ML, AH - MB - 28, CW),
    mkText(ML, AH - MB - 18, CW, 14, 'Document interne — [Organisation]',
      { fontSize: 8.5, fill: '#94a3b8', align: 'center' }),
  ];
}

function tCvPro() {
  return [
    // Header bandeau
    mkRect(ML - 52, MT - 72, 794, 110,
      { fill: 'rgba(30,41,59,0.06)', stroke: 'transparent', cornerRadius: 0 }),
    mkText(ML, MT, 460, 30, '[PRÉNOM NOM]',
      { fontSize: 24, fontWeight: 800, fill: '#0f172a', letterSpacing: 0.5, lineHeight: 1 }),
    mkText(ML, MT + 36, 460, 18, '[Titre / Poste souhaité]',
      { fontSize: 14, fontWeight: 400, fill: '#475569', lineHeight: 1 }),
    mkText(ML, MT + 60, 460, 16,
      '[Email] · [Tél] · [Ville] · [LinkedIn / Portfolio]',
      { fontSize: 10, fill: '#64748b', lineHeight: 1 }),
    // Photo placeholder
    mkRect(ML + 510, MT, 130, 130,
      { fill: 'rgba(203,213,225,0.15)', stroke: '#cbd5e1', cornerRadius: 8 }),
    mkText(ML + 554, MT + 52, 42, 20, 'Photo',
      { fontSize: 10, fill: '#94a3b8', align: 'center', lineHeight: 1 }),
    mkLine(ML, MT + 84, CW, { stroke: '#0f172a', strokeWidth: 1.5 }),

    // Col gauche (large)
    mkText(ML, MT + 100, 420, 18, 'EXPÉRIENCES PROFESSIONNELLES',
      { fontSize: 11, fontWeight: 700, fill: '#0f172a', letterSpacing: 1 }),
    mkLine(ML, MT + 120, 420, { stroke: '#e2e8f0' }),
    mkText(ML, MT + 130, 420, 14, '[Poste occupé] — [Entreprise]',
      { fontSize: 11, fontWeight: 700, fill: '#2b2520', lineHeight: 1 }),
    mkText(ML, MT + 148, 420, 12, '[Mois AAAA] → [Mois AAAA] · [Ville]',
      { fontSize: 10, fill: '#64748b', lineHeight: 1 }),
    mkText(ML + 12, MT + 164, 408, 48,
      '· [Responsabilité ou réalisation principale]\n· [Résultat chiffré ou impact mesurable]\n· [Compétence clé utilisée ou développée]',
      { fontSize: 11, lineHeight: 1.6 }),
    mkText(ML, MT + 220, 420, 14, '[Poste occupé] — [Entreprise]',
      { fontSize: 11, fontWeight: 700, fill: '#2b2520', lineHeight: 1 }),
    mkText(ML, MT + 238, 420, 12, '[Mois AAAA] → [Mois AAAA] · [Ville]',
      { fontSize: 10, fill: '#64748b', lineHeight: 1 }),
    mkText(ML + 12, MT + 254, 408, 48,
      '· [Responsabilité ou réalisation principale]\n· [Résultat chiffré ou impact mesurable]\n· [Compétence clé utilisée ou développée]',
      { fontSize: 11, lineHeight: 1.6 }),

    mkText(ML, MT + 316, 420, 18, 'FORMATIONS',
      { fontSize: 11, fontWeight: 700, fill: '#0f172a', letterSpacing: 1 }),
    mkLine(ML, MT + 336, 420, { stroke: '#e2e8f0' }),
    mkText(ML, MT + 346, 420, 14, '[Diplôme] — [École / Université]',
      { fontSize: 11, fontWeight: 700, fill: '#2b2520', lineHeight: 1 }),
    mkText(ML, MT + 364, 420, 12, '[AAAA] · [Spécialisation]',
      { fontSize: 10, fill: '#64748b', lineHeight: 1 }),
    mkText(ML, MT + 386, 420, 14, '[Diplôme] — [École / Université]',
      { fontSize: 11, fontWeight: 700, fill: '#2b2520', lineHeight: 1 }),
    mkText(ML, MT + 404, 420, 12, '[AAAA] · [Spécialisation]',
      { fontSize: 10, fill: '#64748b', lineHeight: 1 }),

    // Col droite
    mkRect(ML + 446, MT + 96, 244, 340,
      { fill: 'rgba(241,245,249,0.3)', cornerRadius: 6, stroke: '#f1f5f9' }),
    mkText(ML + 460, MT + 110, 216, 16, 'COMPÉTENCES',
      { fontSize: 10, fontWeight: 700, fill: '#0f172a', letterSpacing: 1, lineHeight: 1 }),
    mkText(ML + 460, MT + 130, 216, 80,
      '· [Compétence technique 1]\n· [Compétence technique 2]\n· [Outil / Logiciel]\n· [Autre compétence]\n· [Framework / Méthode]',
      { fontSize: 10.5, lineHeight: 1.65 }),
    mkText(ML + 460, MT + 220, 216, 16, 'LANGUES',
      { fontSize: 10, fontWeight: 700, fill: '#0f172a', letterSpacing: 1, lineHeight: 1 }),
    mkText(ML + 460, MT + 240, 216, 48,
      'Français · Natif\n[Anglais · B2 / C1]\n[Autre langue · Niveau]',
      { fontSize: 10.5, lineHeight: 1.6 }),
    mkText(ML + 460, MT + 298, 216, 16, 'INTÉRÊTS',
      { fontSize: 10, fontWeight: 700, fill: '#0f172a', letterSpacing: 1, lineHeight: 1 }),
    mkText(ML + 460, MT + 316, 216, 44,
      '[Centre d\'intérêt 1]\n[Centre d\'intérêt 2]\n[Bénévolat / Association]',
      { fontSize: 10.5, lineHeight: 1.6 }),

    mkLine(ML, AH - MB - 28, CW),
    mkText(ML, AH - MB - 18, CW, 14, '[Prénom NOM] · CV — [Poste]',
      { fontSize: 8.5, fill: '#94a3b8', align: 'center' }),
  ];
}

/* ── Canvas Intelligent — zones structurées ──────────────────── */
function smartCanvasBlocks() {
  const zoneStyle = (color) => ({
    fill: `${color}08`,
    stroke: `${color}55`,
    strokeWidth: 1,
    cornerRadius: 6,
  });
  const labelStyle = (color) => ({
    fontSize: 10, fontWeight: 700, fill: `${color}99`,
    align: 'center', letterSpacing: 2, lineHeight: 1,
    fontFamily: 'Inter, system-ui, sans-serif',
  });

  return [
    mkRect(ML, MT,         CW, 60, zoneStyle('#e3aa6b')),
    mkText(ML, MT + 22,    CW, 16, 'ZONE EN-TÊTE',       labelStyle('#e3aa6b')),
    mkRect(ML, MT + 70,    CW, 34, zoneStyle('#e0926a')),
    mkText(ML, MT + 81,    CW, 14, 'ZONE TITRE / OBJET', labelStyle('#e0926a')),
    mkRect(ML, MT + 114,   CW, 490, zoneStyle('#e0976a')),
    mkText(ML, MT + 350,   CW, 16, 'ZONE CORPS DU DOCUMENT', labelStyle('#e0976a')),
    mkRect(ML, MT + 614,   CW, 80, zoneStyle('#fbbf24')),
    mkText(ML, MT + 648,   CW, 16, 'ZONE SIGNATURE',     labelStyle('#fbbf24')),
    mkRect(ML, AH - MB - 34, CW, 26, zoneStyle('#f472b6')),
    mkText(ML, AH - MB - 24, CW, 12, 'ZONE PIED DE PAGE', labelStyle('#f472b6')),
  ];
}

/* ═════════════════════════════════════════════════════════════════
   TEMPLATE REGISTRY
═════════════════════════════════════════════════════════════════ */
export const DOC_TEMPLATES = [
  {
    id: 'lettre',
    label: 'Lettre formelle',
    icon: '✉',
    color: '#e3aa6b',
    category: 'Courrier',
    desc: 'Structure officielle complète avec en-tête, objet, corps et formule de politesse',
    getBlocks: tLettre,
  },
  {
    id: 'attestation',
    label: 'Attestation',
    icon: '🏅',
    color: '#e0926a',
    category: 'Officiel',
    desc: 'Attestation de présence, de travail, de scolarité ou autre',
    getBlocks: tAttestation,
  },
  {
    id: 'contrat',
    label: 'Contrat simple',
    icon: '📜',
    color: '#f59e0b',
    category: 'Juridique',
    desc: 'Contrat entre deux parties avec articles, conditions et signatures',
    getBlocks: tContrat,
  },
  {
    id: 'facture',
    label: 'Facture',
    icon: '🧾',
    color: '#f97316',
    category: 'Finance',
    desc: 'Facture professionnelle avec tableau de prestations et totaux HT/TTC',
    getBlocks: tFacture,
  },
  {
    id: 'cv',
    label: 'CV professionnel',
    icon: '👤',
    color: '#e0976a',
    category: 'RH',
    desc: 'Curriculum Vitae moderne en deux colonnes — expériences et compétences',
    getBlocks: tCvPro,
  },
  {
    id: 'rapport',
    label: 'Rapport',
    icon: '📊',
    color: '#cf7a52',
    category: 'Rapport',
    desc: "Rapport d'activité ou d'analyse avec résumé exécutif et recommandations",
    getBlocks: tRapport,
  },
  {
    id: 'note-service',
    label: 'Note de service',
    icon: '📋',
    color: '#d99a4e',
    category: 'Interne',
    desc: 'Communication interne officielle avec dispositions et signature',
    getBlocks: tNoteService,
  },
  {
    id: 'compte-rendu',
    label: 'Compte-rendu',
    icon: '📝',
    color: '#ec4899',
    category: 'Réunion',
    desc: 'Procès-verbal de réunion avec ordre du jour, décisions et actions',
    getBlocks: tCompteRendu,
  },
];

/* ── Assistant questions ─────────────────────────────────────── */
const ASSISTANT_QUESTIONS = [
  {
    id: 'type',
    question: 'Quel type de document souhaitez-vous créer ?',
    type: 'choice',
    choices: [
      { value: 'lettre',     label: 'Lettre',          icon: '✉'  },
      { value: 'rapport',    label: 'Rapport',          icon: '📊' },
      { value: 'contrat',    label: 'Contrat',          icon: '📜' },
      { value: 'attestation',label: 'Attestation',      icon: '🏅' },
      { value: 'cv',         label: 'CV',               icon: '👤' },
      { value: 'facture',    label: 'Facture',          icon: '🧾' },
      { value: 'note',       label: 'Note interne',     icon: '📋' },
      { value: 'autre',      label: 'Autre document',   icon: '📄' },
    ],
  },
  {
    id: 'destinataire',
    question: 'À qui est destiné ce document ?',
    type: 'text',
    placeholder: 'ex. : Directeur RH, Client entreprise, Mairie de Paris…',
  },
  {
    id: 'objet',
    question: 'Quel est l\'objet ou le sujet principal ?',
    type: 'text',
    placeholder: 'ex. : Demande de congé, Rapport mensuel, Facture prestation…',
  },
  {
    id: 'ton',
    question: 'Quel ton souhaitez-vous adopter ?',
    type: 'choice',
    choices: [
      { value: 'formel',        label: 'Formel',         icon: '🎩' },
      { value: 'professionnel', label: 'Professionnel',  icon: '💼' },
      { value: 'neutre',        label: 'Neutre',         icon: '⚖️'  },
      { value: 'amical',        label: 'Amical',         icon: '🤝' },
    ],
  },
  {
    id: 'longueur',
    question: 'Quelle longueur souhaitez-vous ?',
    type: 'choice',
    choices: [
      { value: 'courte',   label: 'Courte',   icon: '⚡', sub: '½ page' },
      { value: 'moyenne',  label: 'Moyenne',  icon: '📄', sub: '1 page' },
      { value: 'detaillee',label: 'Détaillée',icon: '📚', sub: '2+ pages' },
    ],
  },
  {
    id: 'signature',
    question: 'Inclure un bloc de signature ?',
    type: 'choice',
    choices: [
      { value: 'oui',  label: 'Oui — bloc de signature', icon: '✍️' },
      { value: 'non',  label: 'Non merci',                icon: '✗' },
    ],
  },
];

/* ═════════════════════════════════════════════════════════════════
   COMPONENT — DocumentStudioLauncher
═════════════════════════════════════════════════════════════════ */
export default function DocumentStudioLauncher({ onClose, onLaunch }) {
  const [step,         setStep]         = useState('mode');
  const [assistQ,      setAssistQ]      = useState(0);
  const [answers,      setAnswers]      = useState({});
  const [textInput,    setTextInput]    = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [searchQuery,  setSearchQuery]  = useState('');

  /* ── Templates filtrés (100 modèles) ────────────────────── */
  const filteredTemplates = useMemo(() => {
    let list = searchQuery.trim().length >= 2
      ? searchTemplates(searchQuery)
      : domainFilter === 'all' ? TEMPLATES : getTemplatesByDomain(domainFilter);
    return list;
  }, [domainFilter, searchQuery]);

  /* ── Answer assistant question ───────────────────────────── */
  const answerQ = (value) => {
    const q = ASSISTANT_QUESTIONS[assistQ];
    const newAnswers = { ...answers, [q.id]: value };
    setAnswers(newAnswers);
    if (assistQ < ASSISTANT_QUESTIONS.length - 1) {
      setAssistQ(assistQ + 1);
      setTextInput('');
    } else {
      // Cherche d'abord dans les 100 templates, sinon fallback legacy
      const typeMap = {
        lettre: 'letters', rapport: 'reports', contrat: 'contracts',
        attestation: 'attestations_certificates', cv: 'cv_profiles',
        facture: 'business', note: 'hr',
      };
      const dom = typeMap[newAnswers.type] ?? 'letters';
      const libMatch = getTemplatesByDomain(dom)[0];
      if (libMatch) {
        onLaunch('assistant', libMatch.id, templateToKonvaObjects(libMatch), '#ffffff', newAnswers);
      } else {
        const legacy = DOC_TEMPLATES.find(t => t.id === newAnswers.type) ?? DOC_TEMPLATES[0];
        onLaunch('assistant', legacy.id, legacy.getBlocks(), '#ffffff', newAnswers);
      }
    }
  };

  /* ── Launch template (100 modèles) ──────────────────────── */
  const launchJsonTemplate = (tpl) => {
    onLaunch('template', tpl.id, templateToKonvaObjects(tpl), '#ffffff', {});
  };

  /* ── Launch legacy template (8 modèles codés en dur) ──── */
  const launchTemplate = (tpl) => {
    if (tpl.getBlocks) {
      onLaunch('template', tpl.id, tpl.getBlocks(), '#ffffff', {});
    } else {
      launchJsonTemplate(tpl);
    }
  };

  const launchCanvas = () => {
    onLaunch('canvas', 'smart', smartCanvasBlocks(), '#ffffff', {});
  };

  const launchLibre = () => {
    onLaunch('libre', null, [], '#ffffff', {});
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col overflow-hidden" style={{ background: 'rgba(9,10,15,0.97)' }}>
      {/* Background grid */}
      <div className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)',
          backgroundSize: '44px 44px',
        }} />

      {/* Close button */}
      <button type="button" onClick={onClose}
        className="absolute right-4 top-4 z-50 flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/35 transition-colors hover:text-white/70">
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-start overflow-y-auto px-6 py-10">

        {/* ── STEP: MODE SELECTION ─────────────────────────────── */}
        <AnimatePresence mode="wait">
          {step === 'mode' && (
            <motion.div key="mode"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.2 }}
              className="w-full max-w-[620px]">

              {/* Header */}
              <div className="mb-8 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/30 to-violet-500/30">
                  <FileText className="h-5 w-5 text-white/80" />
                </div>
                <h2 className="text-[20px] font-bold text-white/88">Studio Documentaire</h2>
                <p className="mt-1 text-[12px] text-white/35">Comment souhaitez-vous créer votre document ?</p>
              </div>

              {/* 4 mode cards */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    icon: FileText, color: '#e3aa6b',
                    label: 'Template', sub: 'Prêt à l\'emploi',
                    desc: '100 modèles officiels — lettres, contrats, CV, rapports, RH, juridique…',
                    action: () => setStep('templates'),
                    badge: '100 modèles',
                  },
                  {
                    icon: Layout, color: '#e0926a',
                    label: 'Canvas Intelligent', sub: 'Préstructuré',
                    desc: 'Canvas A4 avec zones guidées — en-tête, corps, signature, pied de page',
                    action: launchCanvas,
                    badge: 'Zones guidées',
                  },
                  {
                    icon: Bot, color: '#f59e0b',
                    label: 'Assistant', sub: 'Guidé par questions',
                    desc: 'LONGIA pose 5 questions et génère automatiquement votre document',
                    action: () => { setStep('assistant'); setAssistQ(0); setAnswers({}); },
                    badge: '5 questions',
                  },
                  {
                    icon: Zap, color: '#e0976a',
                    label: 'Mode Libre', sub: 'Avancé',
                    desc: 'Canvas A4 vierge — liberté totale de composition et de design',
                    action: launchLibre,
                    badge: 'Page blanche',
                  },
                ].map(card => {
                  const Icon = card.icon;
                  return (
                    <button key={card.label} type="button" onClick={card.action}
                      className="group flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 text-left transition-all duration-200 hover:scale-[1.02] hover:border-white/15 hover:bg-white/[0.05]">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08]"
                          style={{ background: `${card.color}18` }}>
                          <Icon className="h-5 w-5" style={{ color: card.color }} />
                        </span>
                        <span className="rounded-lg border px-2 py-0.5 text-[9px] font-bold tracking-wide"
                          style={{ color: card.color, borderColor: `${card.color}40`, background: `${card.color}12` }}>
                          {card.badge}
                        </span>
                      </div>
                      <div>
                        <p className="text-[14px] font-bold text-white/85">{card.label}</p>
                        <p className="text-[11px]" style={{ color: card.color }}>{card.sub}</p>
                      </div>
                      <p className="text-[11px] leading-relaxed text-white/38">{card.desc}</p>
                      <div className="flex items-center gap-1 text-[10px] text-white/25 group-hover:text-white/50 transition-colors">
                        Démarrer <ArrowRight className="h-3 w-3" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── STEP: TEMPLATE LIBRARY — 100 modèles ────────────── */}
          {step === 'templates' && (
            <motion.div key="templates"
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }}
              className="w-full max-w-[860px]">

              {/* Header + retour */}
              <div className="mb-5 flex items-center gap-3">
                <button type="button" onClick={() => setStep('mode')}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.08] text-white/35 transition-colors hover:text-white/70">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex-1">
                  <h2 className="text-[18px] font-bold text-white/85">
                    Bibliothèque de modèles
                    <span className="ml-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-white/40">
                      {filteredTemplates.length} / 100
                    </span>
                  </h2>
                  <p className="text-[11px] text-white/30">Choisissez un modèle prêt à l'emploi · A4 · export PDF</p>
                </div>
              </div>

              {/* Barre de recherche */}
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.03] px-3 py-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-white/25" />
                <input
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setDomainFilter('all'); }}
                  placeholder="Rechercher un modèle (ex : attestation, CV, facture…)"
                  className="flex-1 bg-transparent text-[11px] text-white/80 placeholder:text-white/20 outline-none"
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')}
                    className="text-white/25 hover:text-white/55 transition-colors text-[10px]">✕</button>
                )}
              </div>

              {/* Filtres par domaine */}
              {!searchQuery && (
                <div className="mb-5 flex flex-wrap gap-1.5">
                  <button type="button"
                    onClick={() => setDomainFilter('all')}
                    className={cn(
                      'rounded-xl border px-3 py-1.5 text-[10px] font-semibold transition-all',
                      domainFilter === 'all'
                        ? 'border-white/20 bg-white/[0.09] text-white/85'
                        : 'border-white/[0.07] bg-white/[0.02] text-white/35 hover:bg-white/[0.05]',
                    )}>
                    Tous (100)
                  </button>
                  {DOMAINS.map(d => {
                    const meta = DOMAIN_META[d.id] ?? {};
                    const isActive = domainFilter === d.id;
                    return (
                      <button key={d.id} type="button"
                        onClick={() => setDomainFilter(d.id)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10px] font-semibold transition-all',
                          isActive
                            ? 'border-white/20 bg-white/[0.09] text-white/85'
                            : 'border-white/[0.07] bg-white/[0.02] text-white/35 hover:bg-white/[0.05]',
                        )}
                        style={isActive ? { borderColor: `${meta.color}50`, color: meta.color, background: `${meta.color}12` } : {}}>
                        <span className="text-[11px]">{meta.icon}</span>
                        {meta.label} ({d.count})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Grille des templates */}
              {filteredTemplates.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-[12px] text-white/25">
                  Aucun modèle trouvé pour « {searchQuery} »
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {filteredTemplates.map(tpl => {
                    const domMeta = DOMAIN_META[tpl.domain] ?? {};
                    return (
                      <button key={tpl.id} type="button"
                        onClick={() => launchJsonTemplate(tpl)}
                        className="group flex flex-col gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5 text-left transition-all hover:scale-[1.02] hover:border-white/14 hover:bg-white/[0.05]">

                        {/* Aperçu icône domaine */}
                        <div
                          className="flex h-14 w-full items-center justify-center rounded-xl border text-2xl"
                          style={{ borderColor: `${domMeta.color}30`, background: `${domMeta.color}10` }}>
                          {domMeta.icon ?? '📄'}
                        </div>

                        <div className="min-h-0 flex-1">
                          {/* Badge domaine */}
                          <span className="rounded-md px-1.5 py-0.5 text-[7.5px] font-bold tracking-wide uppercase"
                            style={{ color: domMeta.color, background: `${domMeta.color}18` }}>
                            {domMeta.label}
                          </span>
                          {/* Nom */}
                          <p className="mt-1 text-[11px] font-semibold leading-tight text-white/82">
                            {tpl.name}
                          </p>
                          {/* Style variants badge */}
                          <p className="mt-0.5 text-[8.5px] text-white/30">
                            {tpl.style_variants?.length ?? 1} style{tpl.style_variants?.length > 1 ? 's' : ''} · {tpl.export?.formats?.join(' / ') ?? 'PDF'}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 text-[9.5px] text-white/20 group-hover:text-white/55 transition-colors">
                          Utiliser <ChevronRight className="h-3 w-3" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ── STEP: ASSISTANT ──────────────────────────────────── */}
          {step === 'assistant' && (
            <motion.div key="assistant"
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }}
              className="w-full max-w-[520px]">

              {/* Back + progress */}
              <div className="mb-6 flex items-center gap-3">
                <button type="button"
                  onClick={() => assistQ > 0 ? setAssistQ(assistQ - 1) : setStep('mode')}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.08] text-white/35 transition-colors hover:text-white/70">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between text-[10px] text-white/30">
                    <span>Question {assistQ + 1} sur {ASSISTANT_QUESTIONS.length}</span>
                    <span>{Math.round(((assistQ) / ASSISTANT_QUESTIONS.length) * 100)}%</span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-white/[0.06]">
                    <div
                      className="h-1 rounded-full bg-amber-400 transition-all duration-300"
                      style={{ width: `${(assistQ / ASSISTANT_QUESTIONS.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* LONGIA avatar */}
              <div className="mb-6 flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/30 to-violet-500/30">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                </div>
                <div className="rounded-2xl rounded-tl-sm border border-white/[0.07] bg-white/[0.04] px-4 py-3">
                  <p className="text-[13px] font-medium text-white/85">
                    {ASSISTANT_QUESTIONS[assistQ].question}
                  </p>
                </div>
              </div>

              {/* Answer options */}
              {ASSISTANT_QUESTIONS[assistQ].type === 'choice' && (
                <div className="grid grid-cols-2 gap-2.5">
                  {ASSISTANT_QUESTIONS[assistQ].choices.map(ch => (
                    <button key={ch.value} type="button" onClick={() => answerQ(ch.value)}
                      className="group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-left transition-all hover:border-amber-500/30 hover:bg-amber-500/[0.06]">
                      <span className="text-xl shrink-0">{ch.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium text-white/75">{ch.label}</p>
                        {ch.sub && <p className="text-[10px] text-white/30">{ch.sub}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {ASSISTANT_QUESTIONS[assistQ].type === 'text' && (
                <div className="flex flex-col gap-2.5">
                  <input
                    autoFocus
                    value={textInput}
                    onChange={e => setTextInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && textInput.trim()) answerQ(textInput.trim()); }}
                    placeholder={ASSISTANT_QUESTIONS[assistQ].placeholder}
                    className="w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-[13px] text-white/80 placeholder:text-white/25 focus:border-amber-500/40 focus:outline-none"
                  />
                  <button type="button"
                    onClick={() => textInput.trim() && answerQ(textInput.trim())}
                    disabled={!textInput.trim()}
                    className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/15 py-2.5 text-[12px] font-semibold text-amber-300 transition-all hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40">
                    Suivant <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Already answered */}
              {Object.keys(answers).length > 0 && (
                <div className="mt-6 flex flex-wrap gap-1.5">
                  {Object.entries(answers).map(([k, v]) => (
                    <span key={k}
                      className="flex items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/[0.08] px-2 py-1 text-[10px] text-amber-300">
                      <CheckCircle2 className="h-3 w-3" />
                      {v}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
