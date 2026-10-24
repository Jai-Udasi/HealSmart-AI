'use strict';

/**
 * Centralised error handling middleware.
 * Sends a uniform JSON error envelope to the client.
 * Never exposes internal stack traces in API responses.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';

  // Handle SQLite unique constraint or CHECK constraint violations cleanly
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    status = 400;
    message = 'A record with that unique value (e.g. email) already exists.';
  } else if (err.code && err.code.startsWith('SQLITE_CONSTRAINT')) {
    status = 400;
    message = 'Database constraint violation: invalid data provided.';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON in request body.';
  }

  console.error(`[ERROR] ${req.method} ${req.path} → ${status}: ${message}`);

  const errorPayload = {
    message,
    ...(err.details ? { details: err.details } : {}),
  };

  res.status(status).json({
    success: false,
    error: errorPayload,
  });
}

/**
 * 404 handler — must be registered after all routes.
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { message: `Route not found: ${req.method} ${req.path}` },
  });
}

module.exports = { errorHandler, notFoundHandler };
