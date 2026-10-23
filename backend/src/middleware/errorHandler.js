'use strict';

/**
 * Centralised error handling middleware.
 * Sends a uniform JSON error envelope to the client.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  console.error(`[ERROR] ${req.method} ${req.path} → ${status}: ${err.message}`);

  res.status(status).json({
    success: false,
    error: {
      message: err.message || 'Internal server error',
      ...(isProduction ? {} : { stack: err.stack }),
    },
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
