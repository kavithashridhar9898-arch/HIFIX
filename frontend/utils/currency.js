/**
 * Indian Rupee (INR) currency formatting utilities.
 * All monetary values in HiFix are denominated in INR.
 */

/**
 * Format a number as Indian Rupees.
 * Examples: 500 → ₹500, 1250 → ₹1,250, 125000 → ₹1,25,000
 *
 * @param {number|string} amount
 * @param {boolean} showPaise - whether to show decimals (default true)
 * @returns {string}
 */
export const formatINR = (amount, showPaise = false) => {
  const num = Number(amount) || 0;
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: showPaise ? 2 : 0,
    maximumFractionDigits: showPaise ? 2 : 0,
  });
};

/**
 * Format with always 2 decimal places (for invoices/receipts).
 */
export const formatINRExact = (amount) => formatINR(amount, true);

/**
 * Parse a formatted INR string back to number.
 */
export const parseINR = (str) => {
  if (!str) return 0;
  return Number(String(str).replace(/[₹,\s]/g, '')) || 0;
};

/**
 * Format seconds as human readable hours/minutes.
 * e.g. 5400 → "1h 30m"
 */
export const formatDuration = (totalSeconds) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

/**
 * Format ms as HH:MM:SS display string.
 */
export const msToHHMMSS = (ms) => {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [
    String(h).padStart(2, '0'),
    String(m).padStart(2, '0'),
    String(s).padStart(2, '0'),
  ].join(':');
};
