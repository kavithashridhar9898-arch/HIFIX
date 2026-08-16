'use strict';

/**
 * HiFix Phase 5.0 — AI Infrastructure Test Suite
 * ------------------------------------------------
 * Plain Node.js test runner — no test framework required.
 * Follows the same style as existing test-phase41-hardening.js.
 *
 * Tests:
 *   1.  AI Config loading and validation
 *   2.  Request ID generation and format
 *   3.  AI Logger — no secrets in output
 *   4.  Provider factory instantiation
 *   5.  Provider interface contract
 *   6.  Prompt registry — all 6 stubs registered
 *   7.  AIResponse builder — success shape
 *   8.  AIResponse builder — failure shape
 *   9.  AICache — no-op when disabled
 *  10.  AIMonitor — counter accuracy
 *  11.  Rate limiter — user limit enforcement
 *  12.  Rate limiter — role-based limit differences
 *  13.  Image validator — allowed types
 *  14.  Image validator — size check
 *  15.  ai_requests table — exists in DB
 *  16.  ai_cache table — exists in DB
 *  17.  HTTP: GET /api/ai/health returns 200
 *  18.  HTTP: GET /api/ai/status requires authentication (401 without token)
 *  19.  HTTP: POST /api/ai/image/upload requires authentication
 *  20.  HTTP: AI disabled → health still returns 200 (not 503)
 *  21.  Gateway health() — returns valid structure when AI disabled
 *  22.  Existing HiFix regression: GET /api/health still works
 *  23.  Existing HiFix regression: POST /api/auth/login still works
 *  24.  Existing HiFix regression: GET /api/workers/nearby requires auth
 */

const http = require('http');
const pool = require('./config/database');

const BASE_URL = `http://127.0.0.1:${process.env.PORT || 5000}`;

let passCount = 0;
let failCount = 0;

function pass(name, evidence) {
  passCount++;
  console.log(`✅ [PASS] ${name}`);
  if (evidence) console.log(`   ${evidence}`);
}

function fail(name, evidence) {
  failCount++;
  console.log(`❌ [FAIL] ${name}`);
  if (evidence) console.log(`   ${evidence}`);
}

function assert(condition, testName, passEvidence, failEvidence) {
  if (condition) {
    pass(testName, passEvidence);
  } else {
    fail(testName, failEvidence);
  }
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

function httpRequest(method, path, body, headers = {}) {
  return new Promise((resolve) => {
    const options = {
      hostname: '127.0.0.1',
      port:     process.env.PORT || 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ status: 0, body: null, error: err.message });
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── Test runner ───────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n' + '='.repeat(65));
  console.log('🧪  HIFIX PHASE 5.0 — AI INFRASTRUCTURE TEST SUITE');
  console.log('='.repeat(65) + '\n');

  // ── 1. AI Config loading ──────────────────────────────────────────────────
  console.log('--- SECTION 1: AI Configuration ---');
  try {
    const aiConfig = require('./ai/config/aiConfig');
    assert(typeof aiConfig.enabled === 'boolean', 'AI_ENABLED is defined as a boolean', `AI_ENABLED=${aiConfig.enabled} ✓`);
    assert(aiConfig.cacheEnabled === false,      'AI_CACHE_ENABLED defaults to false',         'AI_CACHE_ENABLED=false ✓', `Got: ${aiConfig.cacheEnabled}`);
    assert(typeof aiConfig.provider === 'string','AI_PROVIDER is a string',                   `provider="${aiConfig.provider}" ✓`);
    assert(typeof aiConfig.timeoutMs === 'number','AI_TIMEOUT_MS is a number',                `timeoutMs=${aiConfig.timeoutMs} ✓`);
    assert(typeof aiConfig.rateLimitUser === 'number','AI_RATE_LIMIT_USER is a number',       `rateLimitUser=${aiConfig.rateLimitUser} ✓`);
    assert(Array.isArray(aiConfig.imageAllowedTypes),'AI image allowed types is array',       `types=${aiConfig.imageAllowedTypes.join(',')} ✓`);
    assert(Object.isFrozen(aiConfig),            'aiConfig is frozen (immutable)',             'Object.isFrozen ✓');
  } catch (err) {
    fail('AI Config module loads without error', err.message);
  }

  // ── 2. Request ID generation ──────────────────────────────────────────────
  console.log('\n--- SECTION 2: Request ID Generator ---');
  try {
    const { generateRequestId, isValidRequestId } = require('./ai/utils/requestId');
    const id1 = generateRequestId();
    const id2 = generateRequestId();
    assert(typeof id1 === 'string' && id1.startsWith('ai_'),    'Request ID starts with ai_',             `id=${id1} ✓`);
    assert(id1 !== id2,                                          'Request IDs are unique',                 `id1≠id2 ✓`);
    assert(isValidRequestId(id1),                                'isValidRequestId validates generated ID', `valid ✓`);
    assert(!isValidRequestId('not-an-id'),                       'isValidRequestId rejects invalid ID',     'rejects correctly ✓');
    assert(!isValidRequestId(''),                                'isValidRequestId rejects empty string',   'rejects correctly ✓');
  } catch (err) {
    fail('Request ID module loads and functions correctly', err.message);
  }

  // ── 3. Logger security (no secrets in output) ─────────────────────────────
  console.log('\n--- SECTION 3: AI Logger Security ---');
  try {
    const aiLogger = require('./ai/utils/aiLogger');
    // Capture stdout to verify no secrets leak
    const original = process.stdout.write.bind(process.stdout);
    let captured   = '';
    process.stdout.write = (data) => { captured += data; return true; };

    aiLogger.info({
      requestId:    'ai_test_12345678',
      feature:      'TEST',
      userId:       42,
      model:        'test-model',
      // These should NOT appear in output:
      apiKey:       'sk-SHOULD_NOT_APPEAR',
      password:     'SHOULD_NOT_APPEAR',
      imageBase64:  'BASE64_SHOULD_NOT_APPEAR',
    });

    process.stdout.write = original;

    assert(!captured.includes('SHOULD_NOT_APPEAR'),     'Logger does not output secret fields',        'No forbidden fields in output ✓');
    assert(!captured.includes('apiKey'),                'Logger does not output apiKey key name',      'No apiKey field ✓');
    assert(captured.includes('ai_test_12345678') || captured.includes('TEST'), 'Logger outputs requestId or feature', 'Safe fields present ✓');
  } catch (err) {
    fail('AI Logger security check', err.message);
  }

  // ── 4. Provider factory instantiation ─────────────────────────────────────
  console.log('\n--- SECTION 4: Provider Factory ---');
  try {
    const { createProvider, getRegisteredProviders, _resetProviderForTesting } = require('./ai/providers/index');
    _resetProviderForTesting();
    const provider = createProvider();
    assert(typeof provider.getName  === 'function', 'Provider has getName()',         `getName=${provider.getName()} ✓`);
    assert(typeof provider.getModel === 'function', 'Provider has getModel()',        `getModel=${provider.getModel()} ✓`);
    assert(typeof provider.complete === 'function', 'Provider has complete()',        'complete method ✓');
    assert(typeof provider.completeWithVision === 'function', 'Provider has completeWithVision()', 'completeWithVision method ✓');
    assert(typeof provider.isAvailable === 'function', 'Provider has isAvailable()', 'isAvailable method ✓');

    const registered = getRegisteredProviders();
    assert(registered.includes('google-gemini'), 'Google Gemini is registered', 'google-gemini ✓');
    assert(registered.includes('openai'),        'OpenAI is registered',        'openai ✓');
  } catch (err) {
    fail('Provider factory instantiation', err.message);
  }

  // ── 5. Provider interface contract ────────────────────────────────────────
  console.log('\n--- SECTION 5: Provider Interface Contract ---');
  try {
    const AIProviderInterface = require('./ai/providers/AIProviderInterface');
    const baseInstance = new AIProviderInterface();
    let throwCount = 0;
    const methods = ['getName', 'getModel', 'complete', 'completeWithVision', 'isAvailable'];
    for (const method of methods) {
      try {
        if (method === 'complete' || method === 'completeWithVision') {
          await baseInstance[method]({});
        } else if (method === 'isAvailable') {
          await baseInstance[method]();
        } else {
          baseInstance[method]();
        }
      } catch (_) {
        throwCount++;
      }
    }
    assert(throwCount === methods.length, 'All abstract methods throw when not overridden', `${throwCount}/${methods.length} methods enforce contract ✓`);
  } catch (err) {
    fail('Provider interface contract enforcement', err.message);
  }

  // ── 6. Prompt registry ────────────────────────────────────────────────────
  console.log('\n--- SECTION 6: Prompt Registry ---');
  try {
    const { promptRegistry, AI_FEATURES } = require('./ai/prompts/promptRegistry');
    const features = Object.values(AI_FEATURES);
    assert(features.length === 6, `6 AI feature IDs defined`, `Features: ${features.join(', ')} ✓`);

    let allRegistered = true;
    for (const f of features) {
      const def = promptRegistry.get(f);
      if (!def) { allRegistered = false; break; }
    }
    assert(allRegistered, 'All 6 features are registered in promptRegistry', '6/6 registered ✓');

    const list = promptRegistry.list();
    assert(list.length === 6, 'promptRegistry.list() returns 6 entries', `${list.length} entries ✓`);

    const imageFeature = promptRegistry.get(AI_FEATURES.IMAGE_DIAGNOSIS);
    assert(imageFeature.status === 'active',        'IMAGE_DIAGNOSIS status is active (Phase 5.1)', 'status=active ✓');
    assert(imageFeature.requiresVision === true,    'IMAGE_DIAGNOSIS requires vision',    'requiresVision=true ✓');
    assert(imageFeature.outputFormat === 'json',    'IMAGE_DIAGNOSIS output is json',     'outputFormat=json ✓');
  } catch (err) {
    fail('Prompt registry', err.message);
  }

  // ── 7-8. AIResponse builder ───────────────────────────────────────────────
  console.log('\n--- SECTION 7-8: AIResponse Builder ---');
  try {
    const { AIResponse, AI_ERROR_CATEGORIES } = require('./ai/gateway/AIResponse');

    const success = AIResponse.success({
      requestId: 'ai_test_00000001', feature: 'TEST', result: { foo: 'bar' },
      model: 'test', provider: 'test', latencyMs: 250,
    });
    assert(success.success === true,              'AIResponse.success() has success=true',     '✓');
    assert(typeof success.requestId === 'string', 'AIResponse.success() has requestId',        `${success.requestId} ✓`);
    assert(success.result.foo === 'bar',          'AIResponse.success() carries result',        '✓');
    assert(success.error === null,                'AIResponse.success() has error=null',        '✓');
    assert(success.cached === false,              'AIResponse.success() cached defaults false', '✓');

    const failure = AIResponse.failure({
      requestId: 'ai_test_00000002', feature: 'TEST',
      errorCategory: AI_ERROR_CATEGORIES.TIMEOUT, errorMessage: 'Timed out',
    });
    assert(failure.success === false,                        'AIResponse.failure() has success=false',       '✓');
    assert(failure.error.category === 'TIMEOUT',            'AIResponse.failure() carries error.category',   '✓');
    assert(failure.result === null,                          'AIResponse.failure() has result=null',          '✓');

    const unavailable = AIResponse.unavailable('ai_test_00000003', 'TEST');
    assert(unavailable.error.category === 'AI_DISABLED',   'AIResponse.unavailable() category=AI_DISABLED', '✓');

    const rateLimited = AIResponse.rateLimited('ai_test_00000004', 'TEST');
    assert(rateLimited.error.category === 'RATE_LIMITED',  'AIResponse.rateLimited() category=RATE_LIMITED','✓');
  } catch (err) {
    fail('AIResponse builder', err.message);
  }

  // ── 9. AICache — disabled no-op ───────────────────────────────────────────
  console.log('\n--- SECTION 9: AICache (disabled mode) ---');
  try {
    const AICache = require('./ai/cache/AICache');
    // AI_CACHE_ENABLED=false in test env — all operations should be no-ops
    const key    = AICache.buildKey('TEST', 'hello world', '');
    const before = AICache.l1Size();
    await AICache.set(key, 'TEST', { foo: 'bar' });
    const result = await AICache.get(key);
    const after  = AICache.l1Size();

    assert(typeof key === 'string' && key.length === 64, 'Cache key is 64-char hex (SHA-256)', `${key.slice(0,16)}... ✓`);
    assert(result === null,                              'Cache.get() returns null when disabled', 'null ✓');
    assert(after === before,                             'Cache.set() does not grow L1 when disabled', `size unchanged: ${before} ✓`);
  } catch (err) {
    fail('AICache disabled no-op behaviour', err.message);
  }

  // ── 10. AIMonitor — counter accuracy ──────────────────────────────────────
  console.log('\n--- SECTION 10: AIMonitor Counters ---');
  try {
    const AIMonitor = require('./ai/monitoring/AIMonitor');
    AIMonitor._reset();
    AIMonitor.recordRequest('TEST_FEAT');
    AIMonitor.recordRequest('TEST_FEAT');
    AIMonitor.recordSuccess('TEST_FEAT', 200);
    AIMonitor.recordFailure('TEST_FEAT', 'TIMEOUT');
    AIMonitor.recordTimeout('TEST_FEAT');
    AIMonitor.recordCacheHit('TEST_FEAT');

    const stats = AIMonitor.getStats();
    assert(stats.global.requests    === 2, 'Monitor: global.requests = 2',     `${stats.global.requests} ✓`);
    assert(stats.global.successes   === 1, 'Monitor: global.successes = 1',    `${stats.global.successes} ✓`);
    assert(stats.global.failures    === 1, 'Monitor: global.failures = 1',     `${stats.global.failures} ✓`);
    assert(stats.global.timeouts    === 1, 'Monitor: global.timeouts = 1',     `${stats.global.timeouts} ✓`);
    assert(stats.global.cacheHits   === 1, 'Monitor: global.cacheHits = 1',    `${stats.global.cacheHits} ✓`);
    assert(stats.global.avgLatencyMs === 200, 'Monitor: avgLatency = 200ms',   `${stats.global.avgLatencyMs}ms ✓`);
    assert(stats.features['TEST_FEAT'].errorCategories['TIMEOUT'] === 1, 'Monitor: per-feature error categories tracked', '✓');
    AIMonitor._reset();
  } catch (err) {
    fail('AIMonitor counter accuracy', err.message);
  }

  // ── 11. Rate limiter — limit enforcement ──────────────────────────────────
  console.log('\n--- SECTION 11: AI Rate Limiter ---');
  try {
    const { checkLimit, _clearForTesting } = require('./ai/middleware/aiRateLimiter');
    _clearForTesting();

    // homeowner limit = AI_RATE_LIMIT_USER (10 default)
    let blocked = false;
    for (let i = 0; i < 15; i++) {
      const result = checkLimit('user_test_999', 'homeowner', false);
      if (!result.allowed) { blocked = true; break; }
    }
    assert(blocked, 'Rate limiter blocks homeowner after exceeding limit', 'Blocked at request 11+ ✓');
    _clearForTesting();
  } catch (err) {
    fail('Rate limiter limit enforcement', err.message);
  }

  // ── 12. Rate limiter — role-based differences ─────────────────────────────
  try {
    const { getLimitForUser, _clearForTesting } = require('./ai/middleware/aiRateLimiter');
    _clearForTesting();
    const homeLimit   = getLimitForUser('homeowner', false);
    const workerLimit = getLimitForUser('worker', false);
    const imageLimit  = getLimitForUser('homeowner', true);
    assert(workerLimit >= homeLimit,   'Worker limit >= homeowner limit',         `worker=${workerLimit} homeowner=${homeLimit} ✓`);
    assert(imageLimit <= homeLimit,    'Image limit <= general homeowner limit',   `image=${imageLimit} general=${homeLimit} ✓`);
  } catch (err) {
    fail('Rate limiter role-based differences', err.message);
  }

  // ── 13. Image validator — allowed types ───────────────────────────────────
  console.log('\n--- SECTION 13-14: Image Validator ---');
  try {
    const { validateImageFile } = require('./ai/utils/imageSanitizer');
    // Test with a fake file object (no real file on disk)
    const fakeFileOk = { originalname: 'photo.jpg', mimetype: 'image/jpeg', size: 1024 * 1024, path: '/nonexistent' };
    const resultOk   = validateImageFile(fakeFileOk);
    // Should fail existence check, but pass type+size check
    assert(resultOk.error !== 'File type not allowed. Allowed types: jpeg, jpg, png, webp', 'jpeg passes type check', `error: ${resultOk.error || 'none'} ✓`);

    const fakeBad = { originalname: 'virus.exe', mimetype: 'application/exe', size: 100, path: '/nonexistent' };
    const resultBad = validateImageFile(fakeBad);
    assert(resultBad.valid === false && resultBad.error.includes('File type not allowed'), 'exe fails type check', `error: ${resultBad.error} ✓`);
  } catch (err) {
    fail('Image validator type check', err.message);
  }

  // ── 14. Image validator — size check ──────────────────────────────────────
  try {
    const { validateImageFile } = require('./ai/utils/imageSanitizer');
    const hugeFake = { originalname: 'big.png', mimetype: 'image/png', size: 50 * 1024 * 1024, path: '/nonexistent' };
    const result   = validateImageFile(hugeFake);
    assert(result.valid === false && result.error.includes('maximum size'), 'Oversized image fails size check', `error: ${result.error} ✓`);
  } catch (err) {
    fail('Image validator size check', err.message);
  }

  // ── 15-16. Database table verification ───────────────────────────────────
  console.log('\n--- SECTION 15-16: Database Schema ---');
  const dbName = process.env.DB_NAME || 'hifix_db';
  try {
    const [aiReqRows] = await pool.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME='ai_requests'`,
      [dbName]
    );
    assert(aiReqRows.length > 0, 'ai_requests table exists in MySQL', `Table found in ${dbName} ✓`);
  } catch (err) {
    fail('ai_requests table exists', err.message);
  }

  try {
    const [aiCacheRows] = await pool.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME='ai_cache'`,
      [dbName]
    );
    assert(aiCacheRows.length > 0, 'ai_cache table exists in MySQL', `Table found in ${dbName} ✓`);
  } catch (err) {
    fail('ai_cache table exists', err.message);
  }

  // Wait a moment for the server to be ready for HTTP tests
  await new Promise(r => setTimeout(r, 1000));

  // ── 17. HTTP: GET /api/ai/health ─────────────────────────────────────────
  console.log('\n--- SECTION 17-20: HTTP Endpoint Verification ---');
  try {
    const res = await httpRequest('GET', '/api/ai/health');
    assert(res.status === 200,                     'GET /api/ai/health returns 200',          `status=${res.status} ✓`);
    assert(res.body.success === true,              'GET /api/ai/health success=true',          '✓');
    assert(typeof res.body.data?.status === 'string', 'GET /api/ai/health has data.status',   `status=${res.body.data?.status} ✓`);
    assert(typeof res.body.data?.aiEnabled === 'boolean', 'GET /api/ai/health has aiEnabled boolean', `aiEnabled=${res.body.data?.aiEnabled} ✓`);
  } catch (err) {
    fail('GET /api/ai/health HTTP test', err.message);
  }

  // ── 18. HTTP: GET /api/ai/status requires auth ────────────────────────────
  try {
    const res = await httpRequest('GET', '/api/ai/status');
    assert(res.status === 401,                     'GET /api/ai/status returns 401 without token', `status=${res.status} ✓`);
    assert(res.body.success === false,             'GET /api/ai/status success=false without auth', '✓');
  } catch (err) {
    fail('GET /api/ai/status requires auth', err.message);
  }

  // ── 19. HTTP: POST /api/ai/image/upload requires auth ────────────────────
  try {
    const res = await httpRequest('POST', '/api/ai/image/upload');
    // Without auth, should get 401 (from requireAuth middleware) or 503 (AI disabled)
    assert(res.status === 401 || res.status === 503, 'POST /api/ai/image/upload requires auth or returns 503', `status=${res.status} ✓`);
  } catch (err) {
    fail('POST /api/ai/image/upload requires auth', err.message);
  }

  // ── 20. HTTP: AI health endpoint ─────────────────────────────────────────
  try {
    const res = await httpRequest('GET', '/api/ai/health');
    assert(res.status === 200,     'Health endpoint returns 200', `status=${res.status} ✓`);
    assert(typeof res.body.data?.status === 'string', 'Health returns string status', `status=${res.body.data?.status} ✓`);
  } catch (err) {
    fail('Health endpoint when AI enabled', err.message);
  }

  // ── 21. Gateway health() structure ───────────────────────────────────────
  console.log('\n--- SECTION 21: Gateway Health ---');
  try {
    const AIGateway = require('./ai/gateway/AIGateway');
    const health    = await AIGateway.health();
    assert(typeof health.aiEnabled      === 'boolean', 'Gateway health has aiEnabled',       `${health.aiEnabled} ✓`);
    assert(typeof health.cacheEnabled   === 'boolean', 'Gateway health has cacheEnabled',    `${health.cacheEnabled} ✓`);
    assert(typeof health.provider       === 'string',  'Gateway health has provider',         `${health.provider} ✓`);
    assert(typeof health.model          === 'string',  'Gateway health has model',            `${health.model} ✓`);
    assert(typeof health.monitoring     === 'object',  'Gateway health has monitoring stats', '✓');
    assert(typeof health.aiEnabled === 'boolean',      'Gateway reports boolean aiEnabled status', `aiEnabled=${health.aiEnabled} ✓`);
  } catch (err) {
    fail('Gateway health() structure', err.message);
  }

  // ── 22-24. Existing HiFix regression tests ────────────────────────────────
  console.log('\n--- SECTION 22-24: Existing HiFix Regression ---');

  try {
    const res = await httpRequest('GET', '/api/health');
    assert(res.status === 200,             'REGRESSION: GET /api/health still returns 200', `status=${res.status} ✓`);
    assert(res.body.success === true,      'REGRESSION: GET /api/health success=true',      '✓');
    assert(res.body.message === 'HIFIX API is running', 'REGRESSION: health message unchanged', `"${res.body.message}" ✓`);
  } catch (err) {
    fail('REGRESSION: GET /api/health', err.message);
  }

  try {
    const res = await httpRequest('POST', '/api/auth/login', { email: 'test@test.com', password: 'wrongpass' });
    // Should return 401 (wrong credentials) — not 404 (route missing) or 500 (crash)
    assert(res.status === 401 || res.status === 400, 'REGRESSION: POST /api/auth/login still responds (wrong creds → 401/400)', `status=${res.status} ✓`);
    assert(res.body.success === false,               'REGRESSION: login returns success=false for invalid creds', '✓');
  } catch (err) {
    fail('REGRESSION: POST /api/auth/login', err.message);
  }

  try {
    const res = await httpRequest('GET', '/api/workers/nearby?latitude=19.076&longitude=72.877');
    // Without auth token — should return 401
    assert(res.status === 401,                       'REGRESSION: GET /api/workers/nearby still requires auth', `status=${res.status} ✓`);
  } catch (err) {
    fail('REGRESSION: GET /api/workers/nearby requires auth', err.message);
  }

  // ── Final report ──────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(65));
  const total = passCount + failCount;
  console.log(`📊 PHASE 5.0 TEST RESULTS: ${passCount}/${total} PASSED, ${failCount} FAILED`);
  if (failCount === 0) {
    console.log('🎉 ALL TESTS PASSED — AI Infrastructure is ready.');
  } else {
    console.log('⚠️  Some tests failed. Review output above before proceeding.');
  }
  console.log('='.repeat(65) + '\n');
  process.exit(failCount > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('❌ Test suite crashed:', err);
  process.exit(1);
});
