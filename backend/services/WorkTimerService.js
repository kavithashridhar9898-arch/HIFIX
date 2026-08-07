const pool = require('../config/database');

/**
 * WorkTimerService
 * Handles all backend-persistent work timer logic.
 * Timer accuracy is database-driven — survives app restarts & background.
 *
 * Elapsed time formula:
 *   If active  : elapsed = (now - started_at) - total_paused_ms
 *   If paused  : elapsed = (paused_at - started_at) - total_paused_ms
 *   If completed: elapsed = total_duration_ms
 */
const WorkTimerService = {

  // ── Helpers ─────────────────────────────────────────────────────────────────

  _requireBookingOwnership(session, workerId) {
    if (!session || session.worker_id !== workerId) {
      const err = new Error('Not authorised to manage this timer');
      err.statusCode = 403;
      throw err;
    }
  },

  _requireStatus(session, allowedStatuses, action) {
    if (!allowedStatuses.includes(session.status)) {
      const err = new Error(
        `Cannot ${action} — timer is currently '${session.status}'. Allowed states: ${allowedStatuses.join(', ')}`
      );
      err.statusCode = 400;
      throw err;
    }
  },

  /** Compute current elapsed ms without mutating the DB */
  _computeElapsedMs(session) {
    if (session.status === 'completed') return Number(session.total_duration_ms);

    const reference = session.status === 'paused'
      ? new Date(session.paused_at).getTime()
      : Date.now();

    return reference - new Date(session.started_at).getTime() - Number(session.total_paused_ms);
  },

  /** Format ms → { hours, minutes, seconds, formatted "HH:MM:SS" } */
  _formatDuration(ms) {
    const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
    const hours   = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return {
      hours, minutes, seconds,
      totalSeconds,
      formatted: [
        String(hours).padStart(2, '0'),
        String(minutes).padStart(2, '0'),
        String(seconds).padStart(2, '0'),
      ].join(':'),
    };
  },

  // ── Core Operations ──────────────────────────────────────────────────────────

  /**
   * Start the work timer for a booking.
   * Booking must be 'accepted' or 'in_progress'.
   * Only one active session per booking (enforced by UNIQUE KEY).
   */
  async startTimer({ bookingId, workerId }) {
    // 1. Verify the booking belongs to this worker
    const [bookings] = await pool.query(
      `SELECT b.id, b.status, w.id as worker_profile_id
       FROM bookings b
       INNER JOIN workers w ON b.worker_id = w.id
       WHERE b.id = ? AND w.id = ?`,
      [bookingId, workerId]
    );
    if (bookings.length === 0) {
      const err = new Error('Booking not found or you are not the assigned worker');
      err.statusCode = 404;
      throw err;
    }
    const booking = bookings[0];
    if (!['accepted', 'in_progress'].includes(booking.status)) {
      const err = new Error(
        `Timer can only be started for accepted or in_progress bookings. Current status: ${booking.status}`
      );
      err.statusCode = 400;
      throw err;
    }

    // 2. Check for existing session
    const [existing] = await pool.query(
      'SELECT id, status FROM work_sessions WHERE booking_id = ?',
      [bookingId]
    );
    if (existing.length > 0) {
      const err = new Error(
        `A work session already exists (status: ${existing[0].status}). Use pause/resume/complete instead.`
      );
      err.statusCode = 409;
      throw err;
    }

    // 3. Create session
    const now = new Date();
    const [result] = await pool.query(
      `INSERT INTO work_sessions (booking_id, worker_id, started_at, status)
       VALUES (?, ?, ?, 'active')`,
      [bookingId, workerId, now]
    );

    return this.getSession({ bookingId, workerId });
  },

  /**
   * Pause an active timer.
   */
  async pauseTimer({ bookingId, workerId }) {
    const session = await this._fetchSession(bookingId);
    if (!session) {
      const err = new Error('No active session for this booking'); err.statusCode = 404; throw err;
    }
    this._requireBookingOwnership(session, workerId);
    this._requireStatus(session, ['active'], 'pause');

    const now = new Date();
    await pool.query(
      `UPDATE work_sessions
       SET status = 'paused', paused_at = ?, updated_at = NOW()
       WHERE booking_id = ?`,
      [now, bookingId]
    );
    return this.getSession({ bookingId, workerId });
  },

  /**
   * Resume a paused timer.
   * Adds paused duration to total_paused_ms.
   */
  async resumeTimer({ bookingId, workerId }) {
    const session = await this._fetchSession(bookingId);
    if (!session) {
      const err = new Error('No session for this booking'); err.statusCode = 404; throw err;
    }
    this._requireBookingOwnership(session, workerId);
    this._requireStatus(session, ['paused'], 'resume');

    const now = Date.now();
    const pausedAt = new Date(session.paused_at).getTime();
    const additionalPausedMs = now - pausedAt;

    await pool.query(
      `UPDATE work_sessions
       SET status = 'active',
           paused_at = NULL,
           total_paused_ms = total_paused_ms + ?,
           updated_at = NOW()
       WHERE booking_id = ?`,
      [additionalPausedMs, bookingId]
    );
    return this.getSession({ bookingId, workerId });
  },

  /**
   * Permanently complete and lock the timer.
   * Calculates and stores total_duration_ms.
   * After this, timer data is immutable.
   */
  async completeTimer({ bookingId, workerId }) {
    const session = await this._fetchSession(bookingId);
    if (!session) {
      const err = new Error('No session for this booking'); err.statusCode = 404; throw err;
    }
    this._requireBookingOwnership(session, workerId);
    this._requireStatus(session, ['active', 'paused'], 'complete');

    const elapsedMs = this._computeElapsedMs(session);

    if (elapsedMs < 60000) { // Minimum 1 minute
      const err = new Error('Minimum work duration is 1 minute before completing');
      err.statusCode = 400;
      throw err;
    }

    const now = new Date();
    await pool.query(
      `UPDATE work_sessions
       SET status = 'completed',
           completed_at = ?,
           total_duration_ms = ?,
           paused_at = NULL,
           locked = TRUE,
           updated_at = NOW()
       WHERE booking_id = ?`,
      [now, elapsedMs, bookingId]
    );

    return this.getSession({ bookingId, workerId });
  },

  /**
   * Get the current session state with computed values.
   */
  async getSession({ bookingId, workerId }) {
    const session = await this._fetchSession(bookingId);
    if (!session) return null;

    if (workerId && session.worker_id !== workerId) {
      const err = new Error('Not authorised'); err.statusCode = 403; throw err;
    }

    const elapsedMs = this._computeElapsedMs(session);
    const duration  = this._formatDuration(elapsedMs);

    return {
      ...session,
      elapsedMs,
      duration,
    };
  },

  async _fetchSession(bookingId) {
    const [rows] = await pool.query(
      'SELECT * FROM work_sessions WHERE booking_id = ?',
      [bookingId]
    );
    return rows[0] || null;
  },
};

module.exports = WorkTimerService;
