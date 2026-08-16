'use strict';

/**
 * AI Prompt Registry
 * ------------------
 * Central registry of all AI feature prompt definitions.
 * Prompts are NOT scattered through controllers or services.
 *
 * Phase 5.0: Only stubs are registered — no working prompts yet.
 * Future phases add the actual prompts by populating the fields below.
 *
 * Each entry conforms to PromptDefinition:
 * {
 *   id:               string,   — matches the feature ID used in AIGateway.request()
 *   version:          string,   — semver for prompt versioning
 *   description:      string,   — human-readable purpose
 *   systemPrompt:     string,   — static system/instruction context
 *   buildUserPrompt:  function | null,  — builds the user-facing prompt from runtime input
 *   outputFormat:     'json' | 'text', — expected output shape
 *   defaultOptions:   object,   — per-feature AI parameters (maxTokens, temperature)
 *   requiresVision:   boolean,  — whether this feature needs image input
 *   status:           'stub' | 'active' | 'deprecated',
 * }
 */

// ── Feature ID constants ──────────────────────────────────────────────────────
// Used by all layers — gateway, controllers, monitoring, tests.
// Import these rather than using raw strings to prevent typos.

const AI_FEATURES = Object.freeze({
  IMAGE_DIAGNOSIS:       'IMAGE_DIAGNOSIS',
  WORKER_RECOMMENDATION: 'WORKER_RECOMMENDATION',
  COST_ESTIMATION:       'COST_ESTIMATION',
  SMART_ASSISTANT:       'SMART_ASSISTANT',
  MAINTENANCE:           'MAINTENANCE',
  FRAUD_DETECTION:       'FRAUD_DETECTION',
});

// ── Prompt Definitions ────────────────────────────────────────────────────────

const _registry = new Map();

function register(definition) {
  if (!definition.id || !AI_FEATURES[definition.id]) {
    throw new Error(`[PromptRegistry] Unknown feature ID: ${definition.id}`);
  }
  _registry.set(definition.id, Object.freeze(definition));
}

// IMAGE_DIAGNOSIS — Phase 5.1
register({
  id:          AI_FEATURES.IMAGE_DIAGNOSIS,
  version:     '1.0.0',
  description: 'Analyze a home service problem image and return a structured preliminary assessment.',
  systemPrompt: `You are the HiFix AI Diagnostic System, an expert home service assessment AI.
Your job is to analyze the user-provided image of a home service or maintenance issue and return a preliminary diagnosis.

STRICT RULES:
1. Base your diagnosis ONLY on what is reasonably visible in the image. NEVER invent hidden or unverified damage.
2. Return your output ONLY as a valid JSON object matching the exact schema below. Do not add conversational text outside JSON.
3. Category MUST be one of these exact HiFix service identifiers:
   - "plumbing"
   - "electrical"
   - "carpentry"
   - "painting"
   - "cleaning"
   - "appliance_repair"
   - "ac_repair"
   - "pest_control"
   - "other"
   - "unknown" (if image is too unclear or unidentifiable)
4. All cost estimates MUST be in Indian Rupees (INR / ₹) as an indicative range only. Example: min: 500, max: 1500, currency: "INR".
5. Confidence MUST be a number between 0.00 and 1.00 based on visual clarity and certainty.
6. Urgency MUST be one of: "low", "medium", "high", "critical".
7. SAFETY HAZARD DETECTION: If you detect high-risk hazards such as exposed electrical wires, sparks, fire/smoke, gas leaks, major water flooding, or structural collapse risk, set "safetyWarning" to a clear, urgent warning string advising immediate professional intervention and safety precautions. Otherwise set "safetyWarning" to null.
8. Set "limitations" to an explicit disclaimer stating that this AI assessment is preliminary and visual only, and that the professional worker will perform the final diagnosis on-site.

JSON SCHEMA REQUIREMENT:
{
  "problem": "Short descriptive title of visible issue",
  "category": "plumbing",
  "confidence": 0.90,
  "urgency": "high",
  "visibleSymptoms": ["Symptom 1", "Symptom 2"],
  "estimatedDuration": { "minHours": 1, "maxHours": 2 },
  "estimatedCost": { "min": 500, "max": 1500, "currency": "INR" },
  "recommendedAction": "Recommended safe next step for the homeowner.",
  "safetyWarning": null,
  "limitations": "AI analysis is preliminary and based only on visual inspection. Final diagnosis and pricing will be confirmed by the assigned professional."
}`,
  buildUserPrompt: (userContext) => {
    if (userContext && typeof userContext === 'string' && userContext.trim().length > 0) {
      return `Analyze the attached image. Additional user notes: "${userContext.trim()}". Provide diagnosis JSON.`;
    }
    return `Analyze the attached image and provide the diagnosis JSON according to the required schema.`;
  },
  outputFormat: 'json',
  defaultOptions: { maxTokens: 1024, temperature: 0.2 },
  requiresVision: true,
  status: 'active',
});

// WORKER_RECOMMENDATION — Phase 5.2
register({
  id:          AI_FEATURES.WORKER_RECOMMENDATION,
  version:     '0.1.0-stub',
  description: 'Recommend the most suitable worker(s) based on job requirements, location, and ratings.',
  systemPrompt: '', // Populated in Phase 5.2
  buildUserPrompt: null,
  outputFormat: 'json',
  defaultOptions: { maxTokens: 512, temperature: 0.3 },
  requiresVision: false,
  status: 'stub',
});

// COST_ESTIMATION — Phase 5.3
register({
  id:          AI_FEATURES.COST_ESTIMATION,
  version:     '0.1.0-stub',
  description: 'Estimate the cost of a home service job based on description, location, and service type.',
  systemPrompt: '', // Populated in Phase 5.3
  buildUserPrompt: null,
  outputFormat: 'json',
  defaultOptions: { maxTokens: 512, temperature: 0.2 },
  requiresVision: false,
  status: 'stub',
});

// SMART_ASSISTANT — Phase 5.4
register({
  id:          AI_FEATURES.SMART_ASSISTANT,
  version:     '0.1.0-stub',
  description: 'Conversational assistant to help homeowners describe their problem and get guidance.',
  systemPrompt: '', // Populated in Phase 5.4
  buildUserPrompt: null,
  outputFormat: 'text',
  defaultOptions: { maxTokens: 800, temperature: 0.7 },
  requiresVision: false,
  status: 'stub',
});

// MAINTENANCE — Phase 5.5
register({
  id:          AI_FEATURES.MAINTENANCE,
  version:     '0.1.0-stub',
  description: 'Predict maintenance requirements and schedules based on booking history and property data.',
  systemPrompt: '', // Populated in Phase 5.5
  buildUserPrompt: null,
  outputFormat: 'json',
  defaultOptions: { maxTokens: 512, temperature: 0.2 },
  requiresVision: false,
  status: 'stub',
});

// FRAUD_DETECTION — Phase 5.6
register({
  id:          AI_FEATURES.FRAUD_DETECTION,
  version:     '0.1.0-stub',
  description: 'Detect suspicious patterns in bookings, payments, and user behavior.',
  systemPrompt: '', // Populated in Phase 5.6
  buildUserPrompt: null,
  outputFormat: 'json',
  defaultOptions: { maxTokens: 512, temperature: 0.1 },
  requiresVision: false,
  status: 'stub',
});

// ── Registry API ──────────────────────────────────────────────────────────────

const promptRegistry = {
  /**
   * Get a prompt definition by feature ID.
   * @param {string} featureId
   * @returns {object|null}
   */
  get(featureId) {
    return _registry.get(featureId) || null;
  },

  /**
   * Check if a feature exists in the registry.
   * @param {string} featureId
   * @returns {boolean}
   */
  has(featureId) {
    return _registry.has(featureId);
  },

  /**
   * List all registered features.
   * @returns {object[]}
   */
  list() {
    return Array.from(_registry.values()).map(def => ({
      id:             def.id,
      version:        def.version,
      description:    def.description,
      outputFormat:   def.outputFormat,
      requiresVision: def.requiresVision,
      status:         def.status,
    }));
  },

  /**
   * List only active (non-stub) features.
   * @returns {object[]}
   */
  listActive() {
    return this.list().filter(def => def.status === 'active');
  },
};

module.exports = { promptRegistry, AI_FEATURES };
