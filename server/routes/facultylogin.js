const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { pool } = require('../config/db');
const { signToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { logger } = require('../utils/logger');

// POST /api/faculty-login
router.post('/faculty-login', authLimiter, async (req, res) => {
  const { department_name, password } = req.body;

  if (!department_name || !password) {
    return res.status(400).json({ success: false, message: 'Department name and password required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, department_name, password FROM faculty WHERE department_name = $1',
      [department_name]
    );

    const faculty = result.rows[0];
    if (!faculty || !(await bcrypt.compare(password, faculty.password))) {
      return res.status(401).json({ success: false, message: 'Invalid department name or password' });
    }

    const token = signToken(
      { facultyId: faculty.id, department_name: faculty.department_name, role: 'department' },
      process.env.JWT_EXPIRES_IN || '24h'
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      faculty: { id: faculty.id, department_name: faculty.department_name }
    });
  } catch (err) {
    logger.error('Faculty login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
