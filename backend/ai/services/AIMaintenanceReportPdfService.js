'use strict';

/**
 * HiFix Enterprise Maintenance Report PDF Service
 * -----------------------------------------------
 * Generates a consultancy-grade, multi-page technical property diagnostic &
 * maintenance report PDF from validated report data using PDFKit.
 *
 * Design Language:
 *   - Restrained corporate engineering palette (Deep Navy #0F172A, Slate #1E293B,
 *     Muted Grey #475569, Corporate Blue #1D4ED8, Hairline Rule #CBD5E1)
 *   - Running header & paginated footer ("Page X of Y") on every page
 *   - Structured Document Control table, Executive Assessment, embedded
 *     Submitted Visual Evidence figure, Technical Observations vs. Hypotheses,
 *     Inspection & Remediation Protocol, Commercial Cost Schedule (INR),
 *     Safety Precautions, and Engineering Disclaimers.
 */

const PDFDocument = require('pdfkit');

const PAGE_WIDTH = 595.28;   // A4 width in points
const PAGE_HEIGHT = 841.89;  // A4 height in points
const MARGIN_LEFT = 42;
const MARGIN_RIGHT = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT; // ~511.28 pt
const TOP_CONTENT_Y = 74;
const BOTTOM_LIMIT_Y = PAGE_HEIGHT - 58;

const PALETTE = {
  navy:        '#0F172A',
  slate:       '#1E293B',
  body:        '#334155',
  muted:       '#64748B',
  accent:      '#1D4ED8',
  border:      '#CBD5E1',
  lightBorder: '#E2E8F0',
  surface:     '#F8FAFC',
  surfaceAlt:  '#F1F5F9',
  dangerBg:    '#FEF2F2',
  dangerBorder:'#FCA5A5',
  dangerText:  '#991B1B',
  warnBg:      '#FFFBEB',
  warnBorder:  '#FDE68A',
  warnText:    '#92400E',
  successText: '#065F46',
};

/**
 * Format INR currency safely for standard PDF Helvetica font (uses "INR " / "Rs. "
 * alongside numeric formatting because standard PDF Type1 Helvetica does not include U+20B9).
 */
function pdfCurrency(strOrNum) {
  if (typeof strOrNum === 'number') {
    return `INR ${strOrNum.toLocaleString('en-IN')}`;
  }
  const s = String(strOrNum || '').trim();
  return s.replace(/₹\s*/g, 'INR ').replace(/–/g, '-');
}

function sanitizePdfText(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/₹\s*/g, 'INR ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/–/g, '-')
    .replace(/—/g, ' - ')
    .replace(/•/g, '-')
    .trim();
}

const AIMaintenanceReportPdfService = {
  /**
   * Generate a complete, paginated PDF Buffer from a validated report object
   * and optional base64-encoded submitted photograph.
   *
   * @param {object} params
   * @param {object} params.report       - Validated 19-section report object (or diagnosis object containing `.report`)
   * @param {string} [params.imageBase64]- Optional base64 image string of the submitted photograph
   * @param {string} [params.imageMimeType] - Optional MIME type ('image/jpeg' | 'image/png')
   * @returns {Promise<Buffer>}
   */
  async generateReportPdf({ report: inputReport, imageBase64 = null, imageMimeType = 'image/jpeg' }) {
    const r = inputReport?.report ? inputReport.report : inputReport;
    if (!r || typeof r !== 'object') {
      throw new Error('Valid report data is required to generate PDF.');
    }

    const reportTitle = sanitizePdfText(r.reportTitle || r.problem || 'Technical Property Maintenance Assessment');
    const reportRef = sanitizePdfText(r.reportReference || 'HFX-RPT-UNASSIGNED');
    const reportDateStr = sanitizePdfText(
      typeof r.reportDate === 'object' ? r.reportDate.formatted : (r.reportDate || new Date().toUTCString())
    );
    const reportStatus = sanitizePdfText(r.meta?.reportStatus || inputReport?.reportStatus || 'AI_GENERATED');
    const isPendingOrTemplate = reportStatus !== 'AI_GENERATED' || Boolean(inputReport?.isSimulated);

    const prop = r.propertyAndArea || {
      propertyType: 'Residential Property',
      affectedArea: 'General Area',
      location: 'India',
    };
    const sev = r.severityAndPriority || {
      severity: 'Moderate',
      priority: 'Scheduled',
      urgencyCode: r.urgency || 'medium',
      rationale: 'Standard technical maintenance priority.',
    };
    const cust = typeof r.customerReportedIssue === 'object'
      ? r.customerReportedIssue
      : { description: String(r.customerReportedIssue || 'None provided.'), extractedText: r.readableTextInImage || null };

    const visualObs = Array.isArray(r.visualObservations) && r.visualObservations.length > 0
      ? r.visualObservations
      : (Array.isArray(r.visibleSymptoms) ? r.visibleSymptoms : ['Visual inspection recorded.']);

    const aiAssess = r.aiAssessment || {
      technicalAnalysis: r.executiveSummary || 'Technical assessment completed.',
      evidenceBasis: 'Derived from submitted visual evidence and customer context.',
      uncertaintyNotes: 'On-site physical verification is required.',
      visualClarity: 'clear',
    };

    const causes = Array.isArray(r.possibleUnderlyingCauses)
      ? r.possibleUnderlyingCauses
      : (Array.isArray(r.possibleCauses) ? r.possibleCauses : []);

    const inspections = Array.isArray(r.recommendedInspection) ? r.recommendedInspection : [];
    const repairs = Array.isArray(r.repairRecommendations)
      ? r.repairRecommendations
      : (r.recommendedAction ? [r.recommendedAction] : []);

    const matCost = r.estimatedMaterialCosts || { min: 200, max: 600, formatted: 'INR 200 - INR 600', items: [] };
    const labCost = r.estimatedLabourCosts || {
      min: 300,
      max: 900,
      formatted: 'INR 300 - INR 900',
      estimatedHours: r.estimatedDuration || { minHours: 1, maxHours: 2 },
      scope: 'On-site inspection and standard remediation labour',
    };
    const totCost = r.estimatedTotalCostRange || r.estimatedCost || {
      min: (matCost.min || 200) + (labCost.min || 300),
      max: (matCost.max || 600) + (labCost.max || 900),
      formatted: 'INR 500 - INR 1,500',
      pricingAssumptions: 'Indicative estimate only; subject to physical inspection.',
    };

    const prof = r.recommendedServiceProfessional || {
      category: r.category || 'general',
      specialistTitle: 'Qualified Property Maintenance Specialist',
      qualificationNotes: 'Verified HiFix service professional.',
    };

    const safety = typeof r.safetyPrecautions === 'object' && !Array.isArray(r.safetyPrecautions)
      ? r.safetyPrecautions
      : {
          isSafetyRisk: Boolean(r.isSafetyRisk),
          riskLevel: r.isSafetyRisk ? 'Elevated' : 'Standard',
          primaryWarning: r.safetyWarning || 'Observe standard safety precautions.',
          precautions: Array.isArray(r.safetyPrecautions) ? r.safetyPrecautions : [],
        };

    const nextSteps = Array.isArray(r.immediateNextSteps) ? r.immediateNextSteps : [];
    const disclaimers = r.limitationsAndDisclaimer || {
      limitations: r.limitations || 'Preliminary visual assessment only.',
      costDisclaimer: 'All cost figures are indicative estimates and do not constitute a binding quotation.',
      evidenceDistinctionNotice: 'Distinguishes customer input, visual observations, AI hypotheses, and items requiring verification.',
    };

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: TOP_CONTENT_Y, bottom: 58, left: MARGIN_LEFT, right: MARGIN_RIGHT },
          bufferPages: true,
          info: {
            Title: `${reportRef} - ${reportTitle}`,
            Author: 'HiFix Property & Facilities Engineering',
            Subject: 'Technical Diagnostic & Maintenance Assessment Report',
            Keywords: 'HiFix, Property Inspection, Maintenance Report, Engineering Assessment',
          },
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        let y = TOP_CONTENT_Y;

        const ensureSpace = (neededHeight = 60) => {
          if (y + neededHeight > BOTTOM_LIMIT_Y) {
            doc.addPage();
            y = TOP_CONTENT_Y;
          }
        };

        const drawSectionHeader = (numStr, titleStr) => {
          ensureSpace(88);
          y += 6;
          doc.rect(MARGIN_LEFT, y, 24, 16).fill(PALETTE.navy);
          doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5).text(numStr, MARGIN_LEFT, y + 4, {
            width: 24,
            align: 'center',
          });
          doc.fillColor(PALETTE.navy).font('Helvetica-Bold').fontSize(10.5).text(
            titleStr.toUpperCase(),
            MARGIN_LEFT + 32,
            y + 3
          );
          y += 20;
          doc.moveTo(MARGIN_LEFT, y).lineTo(PAGE_WIDTH - MARGIN_RIGHT, y).lineWidth(0.75).strokeColor(PALETTE.border).stroke();
          y += 8;
        };

        const drawKeyValueRow = (label, value, labelWidth = 140) => {
          const cleanVal = sanitizePdfText(value || 'N/A');
          doc.font('Helvetica').fontSize(9);
          const valHeight = doc.heightOfString(cleanVal, { width: CONTENT_WIDTH - labelWidth - 10 });
          const rowH = Math.max(15, valHeight + 4);
          ensureSpace(rowH + 4);

          doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PALETTE.muted).text(
            sanitizePdfText(label),
            MARGIN_LEFT + 6,
            y
          );
          doc.font('Helvetica').fontSize(9).fillColor(PALETTE.slate).text(
            cleanVal,
            MARGIN_LEFT + labelWidth,
            y,
            { width: CONTENT_WIDTH - labelWidth - 8 }
          );
          y += rowH;
        };

        const drawBulletList = (items, bulletColor = PALETTE.accent) => {
          const list = Array.isArray(items) && items.length > 0 ? items : ['None recorded.'];
          for (let i = 0; i < list.length; i++) {
            const text = sanitizePdfText(list[i]);
            doc.font('Helvetica').fontSize(9);
            const h = doc.heightOfString(text, { width: CONTENT_WIDTH - 22 });
            ensureSpace(h + 8);
            doc.circle(MARGIN_LEFT + 9, y + 5, 2).fill(bulletColor);
            doc.fillColor(PALETTE.body).font('Helvetica').fontSize(9).text(text, MARGIN_LEFT + 18, y, {
              width: CONTENT_WIDTH - 22,
              lineGap: 1.5,
            });
            y += h + 5;
          }
        };

        // ── COVER / DOCUMENT BANNER ────────────────────────────────────────────
        doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 66).fill(PALETTE.navy);
        doc.fillColor('#93C5FD').font('Helvetica-Bold').fontSize(8).text(
          'HIFIX PROPERTY & FACILITIES ENGINEERING  |  TECHNICAL DIAGNOSTIC REPORT',
          MARGIN_LEFT + 16,
          y + 12
        );
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(14).text(
          reportTitle,
          MARGIN_LEFT + 16,
          y + 26,
          { width: CONTENT_WIDTH - 145 }
        );

        // Priority / Status Pill on Banner Right
        const prioLabel = isPendingOrTemplate
          ? 'PENDING / TEMPLATE'
          : `PRIORITY: ${String(sev.priority || 'SCHEDULED').toUpperCase()}`;
        const prioBg = isPendingOrTemplate
          ? '#475569'
          : sev.urgencyCode === 'critical' || sev.urgencyCode === 'high'
          ? '#B91C1C'
          : '#1D4ED8';
        doc.rect(PAGE_WIDTH - MARGIN_RIGHT - 126, y + 18, 112, 24).fill(prioBg);
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8).text(
          prioLabel,
          PAGE_WIDTH - MARGIN_RIGHT - 126,
          y + 26,
          { width: 112, align: 'center' }
        );
        y += 76;

        // If pending or template, render an explicit prominent authenticity notice
        if (isPendingOrTemplate) {
          doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 28).fill(PALETTE.warnBg).lineWidth(0.75).strokeColor(PALETTE.warnBorder).stroke();
          doc.fillColor(PALETTE.warnText).font('Helvetica-Bold').fontSize(8.5).text(
            'NOTICE: This document is a Pending / Template Assessment recorded while cloud AI vision analysis was unavailable. It does not represent a confirmed Gemini Vision inspection of the photograph.',
            MARGIN_LEFT + 10,
            y + 6,
            { width: CONTENT_WIDTH - 20 }
          );
          y += 36;
        }

        // ── SECTION 01: DOCUMENT CONTROL & PROPERTY METADATA ───────────────────
        drawSectionHeader('01', 'Document Control & Property Metadata');

        const metaBoxTop = y;
        doc.rect(MARGIN_LEFT, metaBoxTop, CONTENT_WIDTH, 68).fill(PALETTE.surface).lineWidth(0.5).strokeColor(PALETTE.lightBorder).stroke();

        const col1Label = MARGIN_LEFT + 10;
        const col1Val   = MARGIN_LEFT + 105;
        const col2Label = MARGIN_LEFT + 265;
        const col2Val   = MARGIN_LEFT + 365;

        let my = metaBoxTop + 9;
        doc.font('Helvetica-Bold').fontSize(8).fillColor(PALETTE.muted).text('Report Reference:', col1Label, my);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PALETTE.navy).text(reportRef, col1Val, my);
        doc.font('Helvetica-Bold').fontSize(8).fillColor(PALETTE.muted).text('Issue Date:', col2Label, my);
        doc.font('Helvetica').fontSize(8.5).fillColor(PALETTE.slate).text(reportDateStr, col2Val, my);

        my += 14;
        doc.font('Helvetica-Bold').fontSize(8).fillColor(PALETTE.muted).text('Property Type:', col1Label, my);
        doc.font('Helvetica').fontSize(8.5).fillColor(PALETTE.slate).text(sanitizePdfText(prop.propertyType), col1Val, my);
        doc.font('Helvetica-Bold').fontSize(8).fillColor(PALETTE.muted).text('Affected Area:', col2Label, my);
        doc.font('Helvetica').fontSize(8.5).fillColor(PALETTE.slate).text(sanitizePdfText(prop.affectedArea), col2Val, my);

        my += 14;
        doc.font('Helvetica-Bold').fontSize(8).fillColor(PALETTE.muted).text('Service Category:', col1Label, my);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PALETTE.accent).text(
          sanitizePdfText((r.category || prof.category || 'general').replace('_', ' ').toUpperCase()),
          col1Val,
          my
        );
        doc.font('Helvetica-Bold').fontSize(8).fillColor(PALETTE.muted).text('Severity / Priority:', col2Label, my);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PALETTE.slate).text(
          sanitizePdfText(`${sev.severity} (${sev.priority})`),
          col2Val,
          my
        );

        my += 14;
        doc.font('Helvetica-Bold').fontSize(8).fillColor(PALETTE.muted).text('Location Context:', col1Label, my);
        doc.font('Helvetica').fontSize(8.5).fillColor(PALETTE.slate).text(sanitizePdfText(prop.location), col1Val, my, { width: 150 });
        doc.font('Helvetica-Bold').fontSize(8).fillColor(PALETTE.muted).text('Assessment Mode:', col2Label, my);
        doc.font('Helvetica').fontSize(8.5).fillColor(PALETTE.slate).text(
          isPendingOrTemplate ? 'Pending / Template Record' : `AI Vision (${sanitizePdfText(r.meta?.provider || 'Gemini')})`,
          col2Val,
          my
        );

        y = metaBoxTop + 76;

        // ── SECTION 02: EXECUTIVE SUMMARY & CUSTOMER-REPORTED CONTEXT ──────────
        drawSectionHeader('02', 'Executive Summary & Submitted Evidence');

        const execText = sanitizePdfText(r.executiveSummary);
        doc.font('Helvetica').fontSize(9.5);
        const execH = doc.heightOfString(execText, { width: CONTENT_WIDTH - 20, lineGap: 2 });
        ensureSpace(execH + 22);
        doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, execH + 16).fill(PALETTE.surfaceAlt).lineWidth(0.5).strokeColor(PALETTE.border).stroke();
        doc.fillColor(PALETTE.navy).font('Helvetica').fontSize(9.5).text(execText, MARGIN_LEFT + 10, y + 8, {
          width: CONTENT_WIDTH - 20,
          lineGap: 2,
        });
        y += execH + 24;

        drawKeyValueRow('Customer-Reported Issue:', cust.description);
        if (cust.extractedText) {
          drawKeyValueRow('Extracted Text / Labels:', `${cust.extractedText} (Recorded as label metadata, not defect proof)`);
        }
        if (cust.previousObservations) {
          drawKeyValueRow('Previous Observations:', cust.previousObservations);
        }

        // Embed Submitted Photograph if available and valid JPEG/PNG
        if (imageBase64 && typeof imageBase64 === 'string') {
          try {
            const cleanB64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').trim();
            const imgBuf = Buffer.from(cleanB64, 'base64');
            // Verify JPEG (FF D8) or PNG (89 50 4E 47) magic bytes before passing to PDFKit
            const isJpeg = imgBuf.length > 4 && imgBuf[0] === 0xff && imgBuf[1] === 0xd8;
            const isPng  = imgBuf.length > 8 && imgBuf[0] === 0x89 && imgBuf[1] === 0x50 && imgBuf[2] === 0x4e && imgBuf[3] === 0x47;
            if (isJpeg || isPng) {
              const evText =
                `Visual Clarity Classification: ${String(aiAssess.visualClarity || 'Clear').toUpperCase()}\n\n` +
                sanitizePdfText(aiAssess.evidenceBasis || 'Photograph submitted by homeowner for visual diagnostic assessment.');
              const uncText = sanitizePdfText(aiAssess.uncertaintyNotes || '');

              doc.font('Helvetica').fontSize(8.5);
              const evH = doc.heightOfString(evText, { width: CONTENT_WIDTH - 240, lineGap: 1.5 });
              doc.font('Helvetica-Oblique').fontSize(8);
              const uncH = uncText ? doc.heightOfString(uncText, { width: CONTENT_WIDTH - 240, lineGap: 1.2 }) : 0;

              const figBoxHeight = Math.max(156, 36 + evH + (uncH ? uncH + 10 : 0) + 14);
              ensureSpace(figBoxHeight + 14);
              y += 4;
              doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, figBoxHeight).fill(PALETTE.surface).lineWidth(0.5).strokeColor(PALETTE.border).stroke();
              doc.image(imgBuf, MARGIN_LEFT + 12, y + 12, {
                fit: [200, Math.min(132, figBoxHeight - 24)],
                align: 'center',
                valign: 'center',
              });
              doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PALETTE.navy).text(
                'FIGURE 1.0 - SUBMITTED PHOTOGRAPHIC EVIDENCE',
                MARGIN_LEFT + 228,
                y + 14
              );
              doc.font('Helvetica').fontSize(8.5).fillColor(PALETTE.body).text(
                evText,
                MARGIN_LEFT + 228,
                y + 30,
                { width: CONTENT_WIDTH - 240, lineGap: 1.5 }
              );
              if (uncText) {
                doc.font('Helvetica-Oblique').fontSize(8).fillColor(PALETTE.muted).text(
                  uncText,
                  MARGIN_LEFT + 228,
                  y + 30 + evH + 8,
                  { width: CONTENT_WIDTH - 240, lineGap: 1.2 }
                );
              }
              y += figBoxHeight + 10;
            }
          } catch (_) {
            // Non-fatal if image format is unsupported by PDFKit
          }
        }

        // ── SECTION 03: VISUAL OBSERVATIONS & TECHNICAL AI ASSESSMENT ──────────
        drawSectionHeader('03', 'Visual Observations & Technical Assessment');

        doc.font('Helvetica-Bold').fontSize(9).fillColor(PALETTE.navy).text(
          'Direct Visual Observations (From Submitted Photograph):',
          MARGIN_LEFT + 4,
          y
        );
        y += 14;
        drawBulletList(visualObs, PALETTE.accent);
        y += 4;

        drawKeyValueRow('Technical Analysis:', aiAssess.technicalAnalysis);
        drawKeyValueRow('Evidence Basis:', aiAssess.evidenceBasis);
        drawKeyValueRow('Limitations & Uncertainty:', aiAssess.uncertaintyNotes);
        drawKeyValueRow('Severity Rationale:', sev.rationale);

        // ── SECTION 04: UNDERLYING CAUSES, INSPECTION & REPAIR PROTOCOL ────────
        drawSectionHeader('04', 'Underlying Causes, Inspection & Repair Protocol');

        ensureSpace(40);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(PALETTE.navy).text(
          'A. Possible Underlying Causes (Engineering Hypotheses Requiring Verification):',
          MARGIN_LEFT + 4,
          y
        );
        y += 14;
        drawBulletList(causes, '#D97706');
        y += 4;

        ensureSpace(40);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(PALETTE.navy).text(
          'B. Recommended On-Site Diagnostic Inspection:',
          MARGIN_LEFT + 4,
          y
        );
        y += 14;
        drawBulletList(inspections, PALETTE.accent);
        y += 4;

        ensureSpace(40);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(PALETTE.navy).text(
          'C. Professional Repair & Remediation Recommendations:',
          MARGIN_LEFT + 4,
          y
        );
        y += 14;
        drawBulletList(repairs, '#059669');

        // ── SECTION 05: COMMERCIAL ASSESSMENT & INDICATIVE COST SCHEDULE ───────
        drawSectionHeader('05', 'Commercial Assessment & Indicative Cost Schedule (INR)');

        ensureSpace(125);
        // Table Header
        doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 20).fill(PALETTE.navy);
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5);
        doc.text('COST COMPONENT', MARGIN_LEFT + 10, y + 6);
        doc.text('SCOPE / SPECIFICATION NOTES', MARGIN_LEFT + 145, y + 6);
        doc.text('ESTIMATED RANGE (INR)', PAGE_WIDTH - MARGIN_RIGHT - 135, y + 6, { width: 125, align: 'right' });
        y += 20;

        const matNotes = Array.isArray(matCost.items) && matCost.items.length > 0
          ? matCost.items.map(i => `${i.item} (${pdfCurrency(i.estimatedRange)})`).join('; ')
          : 'Standard replacement materials & consumables (if required)';

        const hoursInfo = typeof labCost.estimatedHours === 'string' && labCost.estimatedHours.trim()
          ? `${sanitizePdfText(labCost.estimatedHours.trim())}: `
          : (labCost.estimatedHours?.minHours
              ? `${labCost.estimatedHours.minHours}-${labCost.estimatedHours.maxHours} hrs: `
              : '');
        const labNotes = `${hoursInfo}${labCost.scope || 'On-site inspection & remediation labour'}`;

        const costRows = [
          {
            label: '1. Estimated Material Costs',
            notes: sanitizePdfText(matNotes),
            amount: pdfCurrency(matCost.formatted || `INR ${matCost.min} - INR ${matCost.max}`),
            bg: PALETTE.surface,
          },
          {
            label: '2. Estimated Labour Costs',
            notes: sanitizePdfText(labNotes),
            amount: pdfCurrency(labCost.formatted || `INR ${labCost.min} - INR ${labCost.max}`),
            bg: '#FFFFFF',
          },
        ];

        for (const row of costRows) {
          doc.font('Helvetica').fontSize(8.5);
          const noteH = doc.heightOfString(row.notes, { width: 220 });
          const rowH = Math.max(22, noteH + 10);
          ensureSpace(rowH + 4);
          doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, rowH).fill(row.bg).lineWidth(0.5).strokeColor(PALETTE.lightBorder).stroke();
          doc.fillColor(PALETTE.slate).font('Helvetica-Bold').fontSize(8.5).text(row.label, MARGIN_LEFT + 10, y + 6, { width: 130 });
          doc.fillColor(PALETTE.body).font('Helvetica').fontSize(8.5).text(row.notes, MARGIN_LEFT + 145, y + 6, { width: 220 });
          doc.fillColor(PALETTE.navy).font('Helvetica-Bold').fontSize(9).text(
            row.amount,
            PAGE_WIDTH - MARGIN_RIGHT - 135,
            y + 6,
            { width: 125, align: 'right' }
          );
          y += rowH;
        }

        // Total Row
        ensureSpace(30);
        doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 24).fill(PALETTE.surfaceAlt).lineWidth(0.75).strokeColor(PALETTE.border).stroke();
        doc.fillColor(PALETTE.navy).font('Helvetica-Bold').fontSize(9.5).text(
          'ESTIMATED TOTAL INDICATIVE COST RANGE',
          MARGIN_LEFT + 10,
          y + 7
        );
        doc.fillColor(PALETTE.accent).font('Helvetica-Bold').fontSize(10.5).text(
          pdfCurrency(totCost.formatted || `INR ${totCost.min} - INR ${totCost.max}`),
          PAGE_WIDTH - MARGIN_RIGHT - 155,
          y + 6,
          { width: 145, align: 'right' }
        );
        y += 30;

        doc.font('Helvetica-Oblique').fontSize(8).fillColor(PALETTE.muted).text(
          `Pricing Assumptions: ${sanitizePdfText(totCost.pricingAssumptions || disclaimers.costDisclaimer)}`,
          MARGIN_LEFT + 4,
          y,
          { width: CONTENT_WIDTH - 8 }
        );
        y += doc.heightOfString(`Pricing Assumptions: ${sanitizePdfText(totCost.pricingAssumptions || disclaimers.costDisclaimer)}`, { width: CONTENT_WIDTH - 8 }) + 8;

        // ── SECTION 06: SAFETY PRECAUTIONS, SPECIALIST & IMMEDIATE NEXT STEPS ──
        drawSectionHeader('06', 'Safety Precautions, Specialist & Immediate Actions');

        const warnText = sanitizePdfText(safety.primaryWarning);
        doc.font('Helvetica-Bold').fontSize(8.5);
        const warnH = doc.heightOfString(warnText, { width: CONTENT_WIDTH - 24 });
        ensureSpace(warnH + 24);
        const boxBg = safety.isSafetyRisk ? PALETTE.dangerBg : PALETTE.surface;
        const boxBorder = safety.isSafetyRisk ? PALETTE.dangerBorder : PALETTE.border;
        const boxColor = safety.isSafetyRisk ? PALETTE.dangerText : PALETTE.slate;

        doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, warnH + 16).fill(boxBg).lineWidth(0.75).strokeColor(boxBorder).stroke();
        doc.fillColor(boxColor).font('Helvetica-Bold').fontSize(8.5).text(
          `SAFETY CLASSIFICATION (${String(safety.riskLevel || 'STANDARD').toUpperCase()}): ${warnText}`,
          MARGIN_LEFT + 10,
          y + 8,
          { width: CONTENT_WIDTH - 20 }
        );
        y += warnH + 22;

        if (Array.isArray(safety.precautions) && safety.precautions.length > 0) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor(PALETTE.navy).text('Mandatory Safety Precautions:', MARGIN_LEFT + 4, y);
          y += 14;
          drawBulletList(safety.precautions, safety.isSafetyRisk ? '#DC2626' : PALETTE.accent);
          y += 4;
        }

        drawKeyValueRow('Recommended Professional:', `${prof.specialistTitle} (${String(prof.category || 'general').toUpperCase()})`);
        drawKeyValueRow('Qualification Scope:', prof.qualificationNotes);

        if (nextSteps.length > 0) {
          ensureSpace(36);
          doc.font('Helvetica-Bold').fontSize(9).fillColor(PALETTE.navy).text('Immediate Next Steps:', MARGIN_LEFT + 4, y);
          y += 14;
          drawBulletList(nextSteps, PALETTE.accent);
        }

        // ── SECTION 07: LIMITATIONS & NON-QUOTATION DISCLAIMER ─────────────────
        drawSectionHeader('07', 'Engineering Limitations & Disclaimer');

        const discCombined = [
          sanitizePdfText(disclaimers.limitations),
          sanitizePdfText(disclaimers.costDisclaimer),
          sanitizePdfText(disclaimers.evidenceDistinctionNotice),
        ].filter(Boolean).join(' ');

        doc.font('Helvetica').fontSize(8);
        const discH = doc.heightOfString(discCombined, { width: CONTENT_WIDTH - 20, lineGap: 1.5 });
        ensureSpace(discH + 20);
        doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, discH + 14).fill(PALETTE.surface).lineWidth(0.5).strokeColor(PALETTE.lightBorder).stroke();
        doc.fillColor(PALETTE.muted).font('Helvetica').fontSize(8).text(discCombined, MARGIN_LEFT + 10, y + 7, {
          width: CONTENT_WIDTH - 20,
          lineGap: 1.5,
        });
        y += discH + 20;

        // ── RUNNING HEADERS & FOOTERS ACROSS ALL PAGES ─────────────────────────
        const range = doc.bufferedPageRange();
        const totalPages = range.count;

        for (let i = 0; i < totalPages; i++) {
          doc.switchToPage(range.start + i);

          // Temporarily zero page margins so PDFKit never triggers an automatic page break when drawing footers
          const prevTop = doc.page.margins.top;
          const prevBottom = doc.page.margins.bottom;
          doc.page.margins.top = 0;
          doc.page.margins.bottom = 0;

          // Top Running Header
          doc.font('Helvetica-Bold').fontSize(8).fillColor(PALETTE.navy).text(
            'HIFIX PROPERTY TECHNOLOGY PLATFORM',
            MARGIN_LEFT,
            32,
            { lineBreak: false }
          );
          doc.font('Helvetica').fontSize(7.5).fillColor(PALETTE.muted).text(
            `Technical Diagnostic Report  |  Ref: ${reportRef}`,
            MARGIN_LEFT,
            32,
            { width: CONTENT_WIDTH, align: 'right', lineBreak: false }
          );
          doc.moveTo(MARGIN_LEFT, 46).lineTo(PAGE_WIDTH - MARGIN_RIGHT, 46).lineWidth(0.5).strokeColor(PALETTE.border).stroke();

          // Bottom Running Footer
          const footerLineY = PAGE_HEIGHT - 44;
          doc.moveTo(MARGIN_LEFT, footerLineY).lineTo(PAGE_WIDTH - MARGIN_RIGHT, footerLineY).lineWidth(0.5).strokeColor(PALETTE.border).stroke();
          doc.font('Helvetica').fontSize(7.5).fillColor(PALETTE.muted).text(
            'HiFix Engineering & Home Services  -  Indicative Technical Assessment (Subject to On-Site Verification)',
            MARGIN_LEFT,
            footerLineY + 8,
            { lineBreak: false }
          );
          doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PALETTE.slate).text(
            `Page ${i + 1} of ${totalPages}`,
            MARGIN_LEFT,
            footerLineY + 8,
            { width: CONTENT_WIDTH, align: 'right', lineBreak: false }
          );

          doc.page.margins.top = prevTop;
          doc.page.margins.bottom = prevBottom;
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  },
};

module.exports = AIMaintenanceReportPdfService;

