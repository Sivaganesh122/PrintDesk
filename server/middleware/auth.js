const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { logger } = require('../utils/logger');

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set');
  }
  return process.env.JWT_SECRET;
};

const signToken = (payload, expiresIn) => jwt.sign(payload, getJwtSecret(), { expiresIn });

const verifyRequestToken = (req) => {
  const token = req.header('Authorization')?.replace(/^Bearer /, '');
  return token ? jwt.verify(token, getJwtSecret()) : null;
};

const handleAuthError = (error, res) => {
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired.' });
  }
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token.' });
  }
  logger.error('Authentication error:', error);
  return res.status(500).json({ error: 'Internal server error.' });
};

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    const decoded = verifyRequestToken(req);

    if (!decoded) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    // Student and department tokens are signed with the same secret, so the role must be checked
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const result = await pool.query(
      'SELECT id, username, email, role, is_active FROM admin_users WHERE id = $1 AND is_active = true',
      [decoded.adminId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token or user not found.' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    handleAuthError(error, res);
  }
};

// Authenticates a student, department or admin. ownerName is the customer_name that
// the requester's print jobs are stored under, and is null for admins.
const authenticateRequester = async (req, res, next) => {
  try {
    const decoded = verifyRequestToken(req);

    if (!decoded) {
      return res.status(401).json({ error: 'Please log in to continue.' });
    }

    let result;
    if (decoded.role === 'student') {
      result = await pool.query(
        'SELECT registration_number AS owner_name, email FROM users WHERE id = $1',
        [decoded.userId]
      );
    } else if (decoded.role === 'department') {
      result = await pool.query(
        'SELECT department_name AS owner_name FROM faculty WHERE id = $1',
        [decoded.facultyId]
      );
    } else if (decoded.role === 'admin') {
      result = await pool.query(
        'SELECT NULL AS owner_name FROM admin_users WHERE id = $1 AND is_active = true',
        [decoded.adminId]
      );
    } else {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token or user not found.' });
    }

    req.requester = {
      role: decoded.role,
      ownerName: result.rows[0].owner_name,
      email: result.rows[0].email || ''
    };
    next();
  } catch (error) {
    handleAuthError(error, res);
  }
};

module.exports = {
  getJwtSecret,
  signToken,
  verifyRequestToken,
  authenticateAdmin,
  authenticateRequester
};
