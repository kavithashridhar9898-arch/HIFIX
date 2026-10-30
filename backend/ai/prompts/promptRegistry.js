'use strict';

/**
 * AI Prompt Registry
 * ------------------
 * Central registry of all AI feature prompt definitions.
 * Prompts are NOT scattered through controllers or services.
 */

const AI_FEATURES = Object.freeze({
  IMAGE_DIAGNOSIS:       'IMAGE_DIAGNOSIS',
  WORKER_RECOMMENDATION: 'WORKER_RECOMMENDATION',
  COST_ESTIMATION:       'COST_ESTIMATION',
  SMART_ASSISTANT:       'SMART_ASSISTANT',
  MAINTENANCE:           'MAINTENANCE',
  FRAUD_DETECTION:       'FRAUD_DETECTION',
});

const _registry = new Map();

function register(definition) {
  if (!definition.id || !AI_FEATURES[definition.id]) {
    throw new Error(`[PromptRegistry] Unknown feature ID: ${definition.id}`);
  }
  _registry.set(definition.id, Object.freeze(definition));
}

// IMAGE_DIAGNOSIS — Phase 5.1 + Enterprise 19-Section Report & Optional OCR
register({
  id:          AI_FEATURES.IMAGE_DIAGNOSIS,
  version:     '2.0.0',
  description: 'Analyze a property maintenance photograph, optionally extract readable text, and generate a comprehensive 19-section technical maintenance report.',
  systemPrompt: `You are the HiFix Principal Building Diagnostics & Maintenance Engineering AI.
Examine the uploaded photograph, combine visible evidence with any provided homeowner context or extracted labels, and return ONLY a single valid JSON object (no markdown fences or extra text).

RULES:
1. Base "visibleSymptoms" strictly on what is visible in the photograph. Never invent measurements or unverified defects. If the image is unclear or blank, state that visual evidence is insufficient and set "visualClarity": "unclear".
2. Distinguish customer-reported context from visual observations, and frame "possibleCauses" as hypotheses requiring on-site inspection. Do not treat readable equipment labels as proof of a defect.
3. "category" MUST be one of: "plumbing" | "electrical" | "carpentry" | "painting" | "cleaning" | "appliance_repair" | "ac_repair" | "pest_control" | "other" | "unknown".
4. Provide realistic indicative INR (₹) cost ranges (materials + labour = total).

IF THE USER PROMPT STARTS WITH "[OCR_ONLY]", return ONLY:
{"problem":"OCR Text Extraction","category":"other","confidence":0.95,"hasReadableText":true,"extractedText":"<exact readable text or empty string>","detectedLabels":["<label>"],"equipmentSummary":"<brief note on readable text>"}

OTHERWISE, return ONLY this concise JSON object:
{
  "problem": "<concise technical title>",
  "reportTitle": "<formal engineering report title>",
  "category": "<allowed category>",
  "confidence": 0.85,
  "visualClarity": "clear",
  "urgency": "high",
  "executiveSummary": "<2-3 sentence technical executive summary>",
  "visibleSymptoms": ["<direct visual observation 1>", "<direct visual observation 2>"],
  "aiAssessment": {
    "technicalAnalysis": "<engineering interpretation of visible condition>",
    "evidenceBasis": "<what is directly visible vs inferred from customer context>",
    "uncertaintyNotes": "<what requires physical on-site instrument verification>"
  },
  "possibleCauses": ["<hypothesis 1>", "<hypothesis 2>", "<hypothesis 3>"],
  "recommendedInspection": ["<on-site inspection step 1>", "<on-site inspection step 2>"],
  "repairRecommendations": ["<professional repair step 1>", "<professional repair step 2>"],
  "estimatedDuration": { "minHours": 1, "maxHours": 2 },
  "estimatedMaterialCosts": { "min": 200, "max": 600, "currency": "INR", "items": ["<replacement material/part>"] },
  "estimatedLabourCosts": { "min": 300, "max": 600, "currency": "INR", "scope": "<diagnostic and repair labour scope>" },
  "estimatedCost": { "min": 500, "max": 1200, "currency": "INR" },
  "recommendedAction": "<primary recommended action>",
  "safetyWarning": "<clear safety precaution or null>",
  "safetyPrecautions": ["<safety precaution 1>", "<safety precaution 2>"],
  "immediateNextSteps": ["<immediate step 1>", "<immediate step 2>"]
}`,
  buildUserPrompt: (userContext) => {
    if (typeof userContext === 'string' && userContext.startsWith('[OCR_ONLY]')) {
      return `[OCR_ONLY] Extract any readable text, labels, ratings, or model numbers from the image. Do not invent text if none is legible. Return the OCR JSON.`;
    }
    if (userContext && typeof userContext === 'string' && userContext.trim().length > 0) {
      return `Analyze the attached photograph and return the technical maintenance report JSON.\n\nContext:\n${userContext.trim()}`;
    }
    return `Analyze the attached photograph and return the technical maintenance report JSON.`;
  },
  outputFormat: 'json',
  defaultOptions: { maxTokens: 1500, temperature: 0.2 },
  requiresVision: true,
  status: 'active',
});

// WORKER_RECOMMENDATION — Phase 5.2
register({
  id:          AI_FEATURES.WORKER_RECOMMENDATION,
  version:     '0.1.0-stub',
  description: 'Recommend the most suitable worker(s) based on job requirements, location, and ratings.',
  systemPrompt: '',
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
  systemPrompt: '',
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
  systemPrompt: '',
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
  systemPrompt: '',
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
  systemPrompt: '',
  buildUserPrompt: null,
  outputFormat: 'json',
  defaultOptions: { maxTokens: 512, temperature: 0.1 },
  requiresVision: false,
  status: 'stub',
});

// ── Registry API ──────────────────────────────────────────────────────────────

const promptRegistry = {
  get(featureId) {
    return _registry.get(featureId) || null;
  },
  has(featureId) {
    return _registry.has(featureId);
  },
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
  listActive() {
    return this.list().filter(def => def.status === 'active');
  },
};

module.exports = { promptRegistry, AI_FEATURES };
