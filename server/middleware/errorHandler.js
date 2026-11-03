const { logger } = require('../utils/logger');

// Async handler wrapper to catch errors
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  logger.error('Error:', err);

  // Default error
  let error = {
    message: 'Internal Server Error',
    status: 500
  };

  // Handle specific error types
  if (err.name === 'ValidationError') {
    error.message = err.message;
    error.status = 400;
  } else if (err.name === 'UnauthorizedError') {
    error.message = 'Unauthorized';
    error.status = 401;
  } else if (err.name === 'ForbiddenError') {
    error.message = 'Forbidden';
    error.status = 403;
  } else if (err.name === 'NotFoundError') {
    error.message = 'Not Found';
    error.status = 404;
  } else if (err.code === '23505') { // PostgreSQL unique constraint violation
    error.message = 'Resource already exists';
    error.status = 409;
  } else if (err.code === '23503') { // PostgreSQL foreign key constraint violation
    error.message = 'Related resource not found';
    error.status = 400;
  } else if (err.status && err.status < 500) {
    // Only errors raised deliberately with a client status are safe to show
    error.message = err.message;
    error.status = err.status;
  }

  // Send error response
  res.status(error.status).json({
    error: error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = {
  asyncHandler,
  errorHandler
}; 