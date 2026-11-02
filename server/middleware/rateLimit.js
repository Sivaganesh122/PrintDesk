const rateLimit = require('express-rate-limit');

// Students on campus share one public IP, so only failed attempts count towards the limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many failed attempts. Please try again in 15 minutes.',
    message: 'Too many failed attempts. Please try again in 15 minutes.'
  }
});

module.exports = { authLimiter };
