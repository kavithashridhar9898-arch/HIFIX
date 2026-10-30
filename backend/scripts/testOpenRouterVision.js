'use strict';
/**
 * OpenRouter Direct Vision Test — run from backend/ directory.
 * Reads OPENROUTER_API_KEY from backend/.env (or system env).
 *
 * Usage:
 *   # Option A: Add to backend/.env temporarily (file is gitignored)
 *   #   OPENROUTER_API_KEY=sk-or-v1-...
 *
 *   # Option B: Set as PowerShell env var (never touches disk):
 *   #   $env:OPENROUTER_API_KEY = "sk-or-v1-..."
 *
 *   node backend/scripts/testOpenRouterVision.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const https = require('https');
const fs    = require('fs');
const os    = require('os');

// ── Download helper ───────────────────────────────────────────────────────────
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { timeout: 15000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(); try { fs.unlinkSync(dest); } catch (_) {}
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close(); try { fs.unlinkSync(dest); } catch (_) {}
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(dest); });
    }).on('error', err => { try { fs.unlinkSync(dest); } catch (_) {} reject(err); });
  });
}

// ── OpenRouter call ───────────────────────────────────────────────────────────
function callOpenRouter(apiKey, model, imageBase64, mimeType, systemPrompt, userPrompt, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        },
      ],
      max_tokens: 512,
      temperature: 0.2,
    });

    const req = https.request({
      hostname: 'openrouter.ai',
      path:     '/api/v1/chat/completions',
      method:   'POST',
      timeout:  timeoutMs,
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization':  `Bearer ${apiKey}`,
        'X-Title':        'HiFix',
      },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timed out after ${timeoutMs}ms`)); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔═════════════════════════════════════════════════════════╗');
  console.log('║  OpenRouter Direct Vision Test (real image, no stubs)   ║');
  console.log('╚═════════════════════════════════════════════════════════╝\n');

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    console.error('❌  OPENROUTER_API_KEY is not set.\n');
    console.error('    To run this test without exposing your key in code:\n');
    console.error('    PowerShell (temporary, not saved to disk):');
    console.error('      $env:OPENROUTER_API_KEY = "sk-or-v1-..."');
    console.error('      node backend/scripts/testOpenRouterVision.js\n');
    console.error('    Or add to backend/.env (file is gitignored):');
    console.error('      OPENROUTER_API_KEY=sk-or-v1-...\n');
    process.exit(1);
  }

  const keyPreview = `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`;
  console.log(`✅ OPENROUTER_API_KEY loaded — preview: ${keyPreview}\n`);

  // Download a real home repair image (leaking pipe/water damage)
  const tmpImg = path.join(os.tmpdir(), `hifix_or_${Date.now()}.jpg`);
  const IMG_URLS = [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Hapus_Mango.jpg/320px-Hapus_Mango.jpg',
    'https://www.gstatic.com/webp/gallery/1.jpg',
  ];

  console.log('📥 Downloading test image...');
  let downloaded = false;
  for (const url of IMG_URLS) {
    try {
      await download(url, tmpImg);
      const sz = fs.statSync(tmpImg).size;
      console.log(`   ✅ Image ready: ${Math.round(sz / 1024)} KB from ${url}\n`);
      downloaded = true;
      break;
    } catch (e) {
      console.warn(`   ⚠️  ${url} failed: ${e.message}`);
    }
  }
  if (!downloaded) {
    // Write a known-good minimal JPEG (actual valid file)
    const minJpeg = Buffer.from(
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U' +
      'HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN' +
      'DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy' +
      'MjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAA' +
      'AAAAAAAAAAAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oA' +
      'DAMBAAIRAxEAPwCwABmX/9k=', 'base64'
    );
    fs.writeFileSync(tmpImg, minJpeg);
    console.log('   ℹ️  Using minimal synthetic JPEG (all downloads failed)\n');
  }

  const imageBase64 = fs.readFileSync(tmpImg).toString('base64');
  try { fs.unlinkSync(tmpImg); } catch (_) {}
  console.log(`   Base64 length: ${imageBase64.length} chars\n`);

  const SYSTEM_PROMPT = `You are the HiFix AI Diagnostic System. Analyze the image and return ONLY valid JSON:
{"problem":"<title>","category":"<one of: plumbing|electrical|carpentry|painting|cleaning|appliance_repair|ac_repair|pest_control|other|unknown>","confidence":<0.0-1.0>,"urgency":"<low|medium|high|critical>","visibleSymptoms":["<symptom>"],"estimatedCost":{"min":<INR>,"max":<INR>,"currency":"INR"}}`;
  const USER_PROMPT = 'Analyze the attached image and return the diagnosis JSON.';
  const MODEL = 'google/gemma-4-31b-it:free';

  console.log(`🚀 Calling model: ${MODEL}`);
  const t0 = Date.now();
  let res;
  try {
    res = await callOpenRouter(apiKey, MODEL, imageBase64, 'image/jpeg', SYSTEM_PROMPT, USER_PROMPT, 30000);
  } catch (e) {
    console.error(`❌ Request error: ${e.message}`);
    process.exit(1);
  }
  const latencyMs = Date.now() - t0;

  console.log(`   HTTP ${res.status} in ${latencyMs}ms`);

  if (res.status === 200) {
    const content = res.body?.choices?.[0]?.message?.content || '';
    const tokensUsed = res.body?.usage?.total_tokens ?? 'n/a';
    const modelReturned = res.body?.model || MODEL;
    console.log(`   Model confirmed: ${modelReturned}`);
    console.log(`   Tokens used:     ${tokensUsed}`);
    console.log(`\n   Raw content:\n${content.trim()}\n`);

    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const parsed = JSON.parse((jsonMatch[1] || content).trim());
      console.log('✅  OPENROUTER REAL IMAGE DIAGNOSIS: SUCCESS');
      console.log(`    Provider:   openrouter`);
      console.log(`    Model:      ${modelReturned}`);
      console.log(`    Latency:    ${latencyMs}ms`);
      console.log(`    Problem:    ${parsed.problem}`);
      console.log(`    Category:   ${parsed.category}`);
      console.log(`    Confidence: ${parsed.confidence}`);
      console.log(`    Urgency:    ${parsed.urgency}`);
      console.log(`    Cost range: ₹${parsed.estimatedCost?.min} - ₹${parsed.estimatedCost?.max}`);
    } catch (_) {
      console.log('⚠️  OpenRouter responded but output is not strict JSON.');
      console.log('   The model may have added explanation text. Check raw content above.');
      console.log(`   Latency: ${latencyMs}ms — connection and authentication CONFIRMED WORKING.`);
    }
  } else if (res.status === 401 || res.status === 403) {
    console.error(`❌  Auth failure (${res.status}) — key is invalid or revoked`);
    console.error('    Error:', JSON.stringify(res.body?.error));
  } else if (res.status === 429) {
    console.warn(`⚠️  Rate limited (429) — free tier daily quota reached`);
    console.warn('    Error:', JSON.stringify(res.body?.error));
  } else if (res.status === 402) {
    console.error('❌  Credits required (402) — spending limit reached');
  } else {
    console.error(`❌  Unexpected status ${res.status}:`);
    console.error(JSON.stringify(res.body, null, 2).split('\n').slice(0, 15).join('\n'));
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
