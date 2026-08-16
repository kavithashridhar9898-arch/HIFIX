'use strict';

/**
 * AI In-Process Monitor
 * ----------------------
 * Tracks real-time AI metrics using in-process counters.
 * No external dependencies (no Prometheus, Datadog, etc.).
 * Metrics reset on server restart — suitable for Phase 5.0 observability.
 *
 * Tracks:
 *   - Total requests per feature
 *   - Success / failure / timeout / rate-limited / cache-hit / disabled counts
 *   - Cumulative latency (for average calculation)
 *   - Per-feature breakdown
 *
 * Future phases may forward these metrics to external observability tools
 * without changing the monitor's public interface.
 */

// ── Internal counters ─────────────────────────────────────────────────────────

const _global = {
  requests:    0,
  successes:   0,
  failures:    0,
  timeouts:    0,
  rateLimited: 0,
  cacheHits:   0,
  disabled:    0,
  totalLatencyMs: 0,
};

// Per-feature breakdown — populated lazily
const _features = {};

function ensureFeature(feature) {
  if (!_features[feature]) {
    _features[feature] = {
      requests: 0, successes: 0, failures: 0, timeouts: 0,
      rateLimited: 0, cacheHits: 0, totalLatencyMs: 0,
      errorCategories: {},
    };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

const AIMonitor = {
  recordRequest(feature) {
    _global.requests++;
    ensureFeature(feature);
    _features[feature].requests++;
  },

  recordSuccess(feature, latencyMs) {
    _global.successes++;
    _global.totalLatencyMs += (latencyMs || 0);
    ensureFeature(feature);
    _features[feature].successes++;
    _features[feature].totalLatencyMs += (latencyMs || 0);
  },

  recordFailure(feature, errorCategory) {
    _global.failures++;
    ensureFeature(feature);
    _features[feature].failures++;
    if (errorCategory) {
      _features[feature].errorCategories[errorCategory] =
        (_features[feature].errorCategories[errorCategory] || 0) + 1;
    }
  },

  recordTimeout(feature) {
    _global.timeouts++;
    ensureFeature(feature);
    _features[feature].timeouts++;
  },

  recordRateLimited(feature) {
    _global.rateLimited++;
    ensureFeature(feature);
    _features[feature].rateLimited++;
  },

  recordCacheHit(feature) {
    _global.cacheHits++;
    ensureFeature(feature);
    _features[feature].cacheHits++;
  },

  recordDisabled(feature) {
    _global.disabled++;
    ensureFeature(feature);
  },

  /**
   * Return a snapshot of all current metrics.
   * Safe to expose via a monitoring endpoint (no sensitive data).
   * @returns {object}
   */
  getStats() {
    const avgLatencyMs = _global.successes > 0
      ? Math.round(_global.totalLatencyMs / _global.successes)
      : 0;

    const successRate = _global.requests > 0
      ? Math.round((_global.successes / _global.requests) * 100)
      : 0;

    const featureStats = {};
    for (const [feature, f] of Object.entries(_features)) {
      const fAvgLatency = f.successes > 0 ? Math.round(f.totalLatencyMs / f.successes) : 0;
      featureStats[feature] = {
        requests:       f.requests,
        successes:      f.successes,
        failures:       f.failures,
        timeouts:       f.timeouts,
        rateLimited:    f.rateLimited,
        cacheHits:      f.cacheHits,
        avgLatencyMs:   fAvgLatency,
        errorCategories: f.errorCategories,
      };
    }

    return {
      global: {
        requests:     _global.requests,
        successes:    _global.successes,
        failures:     _global.failures,
        timeouts:     _global.timeouts,
        rateLimited:  _global.rateLimited,
        cacheHits:    _global.cacheHits,
        disabled:     _global.disabled,
        avgLatencyMs,
        successRate:  `${successRate}%`,
      },
      features: featureStats,
    };
  },

  /**
   * Reset all counters. Used in tests only.
   * @private
   */
  _reset() {
    Object.keys(_global).forEach(k => { _global[k] = 0; });
    Object.keys(_features).forEach(k => { delete _features[k]; });
  },
};

module.exports = AIMonitor;
