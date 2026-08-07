const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const pool = require('../config/database');
const { ACTIVE_CONFIG } = require('../config/blockchain');

/**
 * Format helper for Indian Rupee (INR) inside PDF
 */
function formatINR(amount) {
  const num = Number(amount) || 0;
  return 'Rs. ' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDuration(totalSeconds) {
  const sec = Number(totalSeconds) || 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const PdfService = {
  /**
   * Generate Branded PDF Certificate Stream/Buffer
   */
  async generateCertificatePdf(certificateId) {
    // 1. Fetch certificate and linked booking/invoice data
    const [rows] = await pool.query(
      `SELECT c.*,
              ir.grand_total, ir.labour_cost, ir.material_cost, ir.travel_cost, ir.emergency_cost, ir.other_cost,
              ir.hourly_rate_snapshot, ir.worked_seconds, ir.service_description, ir.created_at AS invoice_created_at,
              ir.accepted_at AS invoice_accepted_at,
              u_w.name AS worker_name,
              u_c.name AS customer_name,
              w.service_type,
              b.booking_date
       FROM work_certificates c
       INNER JOIN invoice_requests ir ON c.invoice_id  = ir.id
       INNER JOIN workers w           ON c.worker_id   = w.id
       INNER JOIN users u_w           ON w.user_id       = u_w.id
       INNER JOIN users u_c           ON c.customer_id  = u_c.id
       INNER JOIN bookings b          ON c.booking_id   = b.id
       WHERE c.id = ? OR c.certificate_number = ? OR c.booking_id = ?`,
      [certificateId, certificateId, certificateId]
    );

    if (!rows.length) {
      throw new Error('Certificate record not found');
    }

    const cert = rows[0];

    // 2. Generate Verification QR Code Buffer
    const publicBaseUrl = process.env.PUBLIC_VERIFICATION_BASE_URL || 'http://localhost:5000/api/blockchain/verify/certificate';
    const qrUrl = `${publicBaseUrl}/${cert.id}`;
    const qrBuffer = await QRCode.toBuffer(qrUrl, {
      margin: 1,
      width: 120,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    });

    // 3. Construct PDF Document using PDFKit
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const buffers = [];

        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Color Palette
        const primaryColor = '#1E3A8A';   // Dark Navy Blue
        const accentColor = '#8247E5';    // Polygon Purple
        const textColor = '#1F2937';      // Dark Slate
        const lightBgColor = '#F8FAFC';   // Off-white
        const borderColor = '#E2E8F0';   // Light Gray border

        // Border Around Page
        doc.rect(20, 20, 555, 802).lineWidth(1.5).stroke(primaryColor);
        doc.rect(24, 24, 547, 794).lineWidth(0.5).stroke(accentColor);

        // Header Section
        doc.fillColor(primaryColor).fontSize(22).font('Helvetica-Bold').text('HIFIX HOME SERVICES', 40, 50);
        doc.fontSize(10).font('Helvetica').fillColor('#64748B').text('Verified Smart Service Platform • Immutable Proof', 40, 75);

        // Header Divider
        doc.moveTo(40, 95).lineTo(555, 95).lineWidth(1).stroke(borderColor);

        // Certificate Main Title Badge
        doc.rect(40, 110, 515, 36).fill(lightBgColor).stroke(borderColor);
        doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold').text('DIGITAL WORK COMPLETION CERTIFICATE', 50, 122, { align: 'center' });

        // Status Badge Tag
        const isVerified = cert.blockchain_status === 'VERIFIED';
        const isTampered = cert.blockchain_status === 'TAMPERED';
        const statusText = isVerified ? 'BLOCKCHAIN VERIFIED' : isTampered ? 'TAMPER DETECTED' : 'BLOCKCHAIN PENDING';
        const statusBg = isVerified ? '#10B981' : isTampered ? '#EF4444' : '#F59E0B';

        doc.rect(420, 50, 135, 24).fill(statusBg);
        doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold').text(statusText, 420, 58, { width: 135, align: 'center' });

        // Key Identifiers Table
        let y = 165;
        doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text('CERTIFICATE SUMMARY', 40, y);
        y += 18;

        const leftCol = 40;
        const rightCol = 300;

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#475569');
        doc.text('Certificate Number:', leftCol, y);
        doc.font('Helvetica').fillColor(textColor).text(cert.certificate_number, leftCol + 110, y);

        doc.font('Helvetica-Bold').fillColor('#475569').text('Invoice Number:', rightCol, y);
        doc.font('Helvetica').fillColor(textColor).text(`HFX-INV-${cert.invoice_id}`, rightCol + 100, y);
        y += 16;

        doc.font('Helvetica-Bold').fillColor('#475569').text('Booking Reference:', leftCol, y);
        doc.font('Helvetica').fillColor(textColor).text(`#${cert.booking_id}`, leftCol + 110, y);

        doc.font('Helvetica-Bold').fillColor('#475569').text('Service Type:', rightCol, y);
        doc.font('Helvetica').fillColor(textColor).text((cert.service_type || 'General Service').toUpperCase(), rightCol + 100, y);
        y += 24;

        // Parties Involved Box
        doc.rect(40, y, 515, 60).fill(lightBgColor).stroke(borderColor);
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#334155').text('SERVICE PARTIES', 50, y + 10);
        
        doc.font('Helvetica-Bold').fillColor('#475569').text('Professional Worker:', 50, y + 28);
        doc.font('Helvetica').fillColor(textColor).text(cert.worker_name, 160, y + 28);

        doc.font('Helvetica-Bold').fillColor('#475569').text('Customer / Homeowner:', 50, y + 42);
        doc.font('Helvetica').fillColor(textColor).text(cert.customer_name, 160, y + 42);
        y += 75;

        // Service & Work Duration Summary
        doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text('WORK PERFORMANCE & BREAKDOWN', 40, y);
        y += 18;

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#475569').text('Service Description:', 40, y);
        doc.font('Helvetica').fillColor(textColor).text(cert.service_description || 'Standard Service Completion', 160, y);
        y += 16;

        doc.font('Helvetica-Bold').fillColor('#475569').text('Work Duration:', 40, y);
        doc.font('Helvetica').fillColor(textColor).text(formatDuration(cert.worked_seconds), 160, y);
        y += 16;

        doc.font('Helvetica-Bold').fillColor('#475569').text('Hourly Rate Snapshot:', 40, y);
        doc.font('Helvetica').fillColor(textColor).text(`${formatINR(cert.hourly_rate_snapshot || 0)} / hour`, 160, y);
        y += 25;

        // Financial Table Header
        doc.rect(40, y, 515, 20).fill(primaryColor);
        doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
        doc.text('Item Description', 50, y + 5);
        doc.text('Amount (INR)', 430, y + 5, { width: 110, align: 'right' });
        y += 24;

        // Line Items
        const items = [
          { name: 'Labour Charges', amount: cert.labour_cost || 0 },
          { name: 'Materials & Spare Parts', amount: cert.material_cost || 0 },
          { name: 'Travel & Logistics', amount: cert.travel_cost || 0 },
          { name: 'Emergency Convenience Fee', amount: cert.emergency_cost || 0 },
          { name: 'Other Charges', amount: cert.other_cost || 0 },
        ];

        items.forEach((item) => {
          if (Number(item.amount) > 0) {
            doc.fontSize(9).font('Helvetica').fillColor(textColor).text(item.name, 50, y);
            doc.text(formatINR(item.amount), 430, y, { width: 110, align: 'right' });
            y += 16;
          }
        });

        doc.moveTo(40, y).lineTo(555, y).lineWidth(0.5).stroke(borderColor);
        y += 6;

        // Grand Total Row
        doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryColor).text('GRAND TOTAL PAID', 50, y);
        doc.text(formatINR(cert.grand_total), 430, y, { width: 110, align: 'right' });
        y += 28;

        // Timestamps Section
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#475569').text('Invoice Approved At:', 40, y);
        doc.font('Helvetica').fillColor(textColor).text(cert.invoice_accepted_at ? new Date(cert.invoice_accepted_at).toLocaleString() : 'N/A', 160, y);

        doc.font('Helvetica-Bold').fillColor('#475569').text('Certificate Issued At:', 300, y);
        doc.font('Helvetica').fillColor(textColor).text(cert.issued_at ? new Date(cert.issued_at).toLocaleString() : new Date().toLocaleString(), 400, y);
        y += 30;

        // On-Chain Cryptographic Proof Box
        doc.rect(40, y, 515, 145).fill('#F1F5F9').stroke(borderColor);
        
        doc.fontSize(10).font('Helvetica-Bold').fillColor(accentColor).text('POLYGON BLOCKCHAIN IMMUTABLE PROOF', 50, y + 12);
        
        let py = y + 30;
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#334155').text('SHA-256 Hash:', 50, py);
        doc.font('Helvetica').fillColor(accentColor).text(cert.blockchain_hash || 'Pending Calculation', 140, py);
        py += 14;

        doc.font('Helvetica-Bold').fillColor('#334155').text('Transaction Hash:', 50, py);
        doc.font('Helvetica').fillColor(textColor).text(cert.blockchain_tx_hash || 'Pending Confirmation', 140, py);
        py += 14;

        doc.font('Helvetica-Bold').fillColor('#334155').text('Network Layer:', 50, py);
        doc.font('Helvetica').fillColor(textColor).text(cert.blockchain_network || ACTIVE_CONFIG.name, 140, py);

        doc.font('Helvetica-Bold').fillColor('#334155').text('Block Number:', 320, py);
        doc.font('Helvetica').fillColor(textColor).text(cert.blockchain_block_number ? String(cert.blockchain_block_number) : '—', 390, py);
        py += 14;

        doc.font('Helvetica-Bold').fillColor('#334155').text('Verified Timestamp:', 50, py);
        doc.font('Helvetica').fillColor(textColor).text(cert.blockchain_verified_at ? new Date(cert.blockchain_verified_at).toLocaleString() : 'Pending', 140, py);

        // Embed QR Code inside On-Chain Box (Right-aligned)
        doc.image(qrBuffer, 425, y + 15, { width: 110, height: 110 });

        // Footer Note
        doc.fontSize(7.5).font('Helvetica').fillColor('#64748B').text(
          'This document is digitally rendered and backed by Polygon Blockchain. Scanning the QR code verifies authenticity live on-chain.',
          40, 770, { align: 'center', width: 515 }
        );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  },
};

module.exports = PdfService;
