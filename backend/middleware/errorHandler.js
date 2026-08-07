/**
 * Centralized Error Handler Middleware
 *
 * Converts thrown errors into consistent JSON API responses.
 * Must be registered as the LAST middleware in server.js.
 *
 * Expected error shape (thrown anywhere in the app):
 *   const err = new Error('Human message');
 *   err.statusCode = 404;          // optional — defaults to 500
 *   err.errors = [{ field, msg }]; // optional — for validation arrays
 *   throw err;
 */

const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  // Log stack trace in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[ErrorHandler] ${req.method} ${req.path}`, err);
  } else {
    console.error(`[ErrorHandler] ${req.method} ${req.path} — ${err.message}`);
  }

  const statusCode = err.statusCode || 500;

  const response = {
    success:   false,
    message:   err.message || 'Internal server error',
    ...(err.errors && { errors: err.errors }),
  };

  // In production, don't leak stack traces
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    response.stack = err.stack;
  }

  return res.status(statusCode).json(response);
};

module.exports = errorHandler;
