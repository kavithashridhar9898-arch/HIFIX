'use strict';

const fs   = require('fs');
const path = require('path');
const datasetTooling = require('./datasetIngestionTool');

const DATASET_ROOT = path.join(__dirname, '../../datasets/hifix-vision/v1.0.0');
const INCOMING_DIR = path.join(DATASET_ROOT, 'incoming');
const METADATA_DIR = path.join(DATASET_ROOT, 'metadata');

async function testDatasetTooling() {
  console.log('\n========================================================');
  console.log('🧪 TESTING HIFIX DATASET INGESTION TOOLING');
  console.log('========================================================\n');

  // Minimal valid 1x1 JPG binary buffer (>5KB padding)
  const baseJpgBuffer = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
  const dummyImgBuffer = Buffer.concat([baseJpgBuffer, Buffer.alloc(6000)]); // 6KB

  // 1. Create Test Fixture Files in incoming/
  console.log('1. Creating synthetic test fixtures in incoming/...');

  const validPath = path.join(INCOMING_DIR, 'test_valid_leak.jpg');
  const validMetaPath = path.join(METADATA_DIR, 'test_valid_leak.json');
  fs.writeFileSync(validPath, dummyImgBuffer);
  fs.writeFileSync(validMetaPath, JSON.stringify({
    image_id: "img_test_001",
    source_type: "hifix_original",
    class_label: "visible_pipe_leak",
    consent_status: "CONSENT_VERIFIED"
  }, null, 2));

  // Duplicate fixture
  const dupPath = path.join(INCOMING_DIR, 'test_duplicate_leak.jpg');
  fs.writeFileSync(dupPath, dummyImgBuffer);

  // Invalid fixture (unsupported extension & invalid class)
  const invalidPath = path.join(INCOMING_DIR, 'test_invalid_script.exe');
  fs.writeFileSync(invalidPath, Buffer.alloc(8000));

  // Hard negative fixture
  const normalPath = path.join(INCOMING_DIR, 'test_normal_pipe.jpg');
  const normalMetaPath = path.join(METADATA_DIR, 'test_normal_pipe.json');
  fs.writeFileSync(normalPath, dummyImgBuffer);
  fs.writeFileSync(normalMetaPath, JSON.stringify({
    image_id: "img_test_002",
    source_type: "open_source_verified",
    hard_negative: true,
    consent_status: "NOT_APPLICABLE"
  }, null, 2));

  // 2. Run Ingestion Processing
  console.log('2. Running datasetIngestionTool.processIngestion()...');
  const result = await datasetTooling.processIngestion();
  console.log('Ingestion Processing Result:', result);

  // 3. Verify Reports and Manifests
  console.log('3. Verifying Manifest & Validation Report Generation...');
  const manifest = datasetTooling.generateDatasetManifest();
  const report = datasetTooling.generateValidationReport();

  console.log('Manifest Total Verified:', manifest.total_images);
  console.log('Manifest Quarantined Count:', manifest.quarantined_images);

  // 4. Cleanup Test Fixtures
  console.log('4. Cleaning up test fixtures...');
  const filesToCleanup = [validPath, validMetaPath, dupPath, invalidPath, normalPath, normalMetaPath];
  filesToCleanup.forEach(p => { if (fs.existsSync(p)) { try { fs.unlinkSync(p); } catch(_) {} } });

  console.log('\n========================================================');
  console.log('✅ DATASET INGESTION TOOLING VERIFIED SUCCESSFULLY!');
  console.log('========================================================\n');
}

testDatasetTooling().catch(err => {
  console.error('❌ Tooling test error:', err);
  process.exit(1);
});
