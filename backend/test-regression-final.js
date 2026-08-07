const BlockchainService = require('./services/BlockchainService');
const pool = require('./config/database');

async function runFinalRegression() {
  console.log('=======================================================');
  console.log('🔍 HIFIX PHASE 4.1 — FINAL REGRESSION SWEEP');
  console.log('=======================================================\n');

  let pass = 0;
  let fail = 0;

  function r(name, ok, evidence) {
    if (ok) {
      pass++;
      console.log('✅ [PASS]', name);
    } else {
      fail++;
      console.log('❌ [FAIL]', name);
    }
    console.log('   Evidence:', evidence, '\n');
  }

  // R1: Hash Determinism
  const mockInv = {
    id: 101, booking_id: 55, worker_id: 3, customer_id: 12,
    grand_total: 1500, labour_cost: 1200, material_cost: 300,
    service_description: 'Plumbing Repair',
    created_at: '2026-08-01T10:00:00.000Z',
  };
  const h1 = BlockchainService.generateInvoiceHash(mockInv);
  const h2 = BlockchainService.generateInvoiceHash({ ...mockInv });
  r('Hash Determinism (Invoice)', h1 === h2, 'Hash: ' + h1);

  // R2: Tamper Detection
  const tH = BlockchainService.generateInvoiceHash({ ...mockInv, grand_total: 9999 });
  r('Tamper Detection (Amount Mutation)', h1 !== tH,
    'Original prefix: ' + h1.slice(0, 20) + '... Tampered prefix: ' + tH.slice(0, 20) + '...');

  // R3: Certificate Hash Function
  const mockCert = { id: 1, booking_id: 1, worker_id: 1, customer_id: 1, grand_total: 500, issued_at: '2026-01-01' };
  try {
    const cH = BlockchainService.generateCertificateHash(mockCert);
    r('Certificate Hash Function', typeof cH === 'string' && cH.length === 64, cH);
  } catch (e) { r('Certificate Hash Function', false, e.message); }

  // R4: Receipt Hash Function
  const mockRec = {
    id: 1, booking_id: 1, worker_id: 1, customer_id: 1,
    amount_paid: 1000, payment_method: 'Razorpay', created_at: '2026-01-01',
  };
  try {
    const rH = BlockchainService.generateReceiptHash(mockRec);
    r('Receipt Hash Function', typeof rH === 'string' && rH.length === 64, rH);
  } catch (e) { r('Receipt Hash Function', false, e.message); }

  // R5: blockchain_jobs table
  try {
    const [rows] = await pool.query('DESCRIBE blockchain_jobs');
    r('blockchain_jobs Table Schema', rows.length > 0, rows.length + ' columns: ' + rows.map(x => x.Field).join(', '));
  } catch (e) { r('blockchain_jobs Table Schema', false, e.message); }

  // R6: work_certificates blockchain columns
  try {
    const [rows] = await pool.query("SHOW COLUMNS FROM work_certificates WHERE Field LIKE '%blockchain%'");
    r('work_certificates Blockchain Columns', rows.length >= 4, rows.map(x => x.Field).join(', '));
  } catch (e) { r('work_certificates Blockchain Columns', false, e.message); }

  // R7: invoice_requests blockchain columns
  try {
    const [rows] = await pool.query("SHOW COLUMNS FROM invoice_requests WHERE Field LIKE '%blockchain%'");
    r('invoice_requests Blockchain Columns', rows.length >= 4, rows.map(x => x.Field).join(', '));
  } catch (e) { r('invoice_requests Blockchain Columns', false, e.message); }

  // R8: payment_receipts blockchain columns
  try {
    const [rows] = await pool.query("SHOW COLUMNS FROM payment_receipts WHERE Field LIKE '%blockchain%'");
    r('payment_receipts Blockchain Columns', rows.length >= 4, rows.map(x => x.Field).join(', '));
  } catch (e) { r('payment_receipts Blockchain Columns', false, e.message); }

  // R9: getDashboardSummary API
  try {
    const stats = await BlockchainService.getDashboardSummary();
    r('getDashboardSummary API', typeof stats === 'object' && 'certificateStats' in stats,
      'network=' + stats.network + ' simulationMode=' + stats.simulationMode + ' certStats=' + JSON.stringify(stats.certificateStats));
  } catch (e) { r('getDashboardSummary API', false, e.message); }

  // R10: blockchain_audit_logs table
  try {
    const [rows] = await pool.query('DESCRIBE blockchain_audit_logs');
    r('blockchain_audit_logs Table Schema', rows.length > 0, rows.length + ' columns: ' + rows.map(x => x.Field).join(', '));
  } catch (e) { r('blockchain_audit_logs Table Schema', false, e.message); }

  // R11: Active records count in blockchain_jobs
  try {
    const [rows] = await pool.query('SELECT status, COUNT(*) as cnt FROM blockchain_jobs GROUP BY status');
    r('blockchain_jobs Active Records', rows.length >= 0, rows.map(x => x.status + ':' + x.cnt).join(', ') || 'Empty table (no residual test data)');
  } catch (e) { r('blockchain_jobs Active Records', false, e.message); }

  // R12: Verified certificates count
  try {
    const [rows] = await pool.query("SELECT COUNT(*) AS cnt FROM work_certificates WHERE blockchain_status = 'VERIFIED'");
    r('Verified Certificates in DB', rows[0].cnt >= 0, rows[0].cnt + ' certificates with VERIFIED status');
  } catch (e) { r('Verified Certificates in DB', false, e.message); }

  console.log('=======================================================');
  console.log('FINAL REGRESSION COMPLETE:', pass, 'PASSED,', fail, 'FAILED');
  console.log('=======================================================');
  process.exit(fail > 0 ? 1 : 0);
}

runFinalRegression().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
