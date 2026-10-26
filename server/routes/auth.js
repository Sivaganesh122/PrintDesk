const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

const router = express.Router();

// Admin login
router.post('/login', 
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  asyncHandler(async (req, res) => {
    console.log('==== LOGIN DEBUG ====');
    console.log('req.headers:', req.headers);
    console.log('req.body:', req.body);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { username, password } = req.body;

    const client = await pool.connect();

    try {
      const result = await client.query(
        'SELECT id, username, password_hash FROM admin_users WHERE username = $1',
        [username]
      );

      // ✅ Debug output
      console.log('LOGIN DEBUG - DB result:', result.rows);

      if (result.rows.length === 0) {
        console.log('LOGIN DEBUG - Username not found.');
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const admin = result.rows[0];

      // ✅ Debug password values
      console.log('LOGIN DEBUG - Plain password from client:', password);
      console.log('LOGIN DEBUG - Stored password in DB:', admin.password_hash);

      // ✅ Plain-text check (TEMPORARY)
      if (password !== admin.password_hash) {
        console.log('LOGIN DEBUG - Plaintext passwords do not match.');
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { adminId: admin.id, username: admin.username },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      logger.info('Admin login successful:', { username: admin.username });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          admin: {
            id: admin.id,
            username: admin.username
          }
        }
      });
    } finally {
      client.release();
    }
  })
);

// Admin registration (still hashes password)
router.post('/register', 
  [
    body('name').notEmpty().withMessage('Name is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    let { uid, password, name } = req.body;

    let username = uid;
    if (!username) {
      username = 'U' + Math.random().toString(36).substring(2, 10).toUpperCase();
    }
    if (!password) {
      password = Math.random().toString(36).slice(-8);
    }

    const client = await pool.connect();

    try {
      const existingAdmin = await client.query(
        'SELECT id FROM admin_users WHERE username = $1',
        [username]
      );

      if (existingAdmin.rows.length > 0) {
        return res.status(400).json({ error: 'Admin already exists with this username' });
      }

      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      const result = await client.query(
        'INSERT INTO admin_users (username, password_hash, name, email) VALUES ($1, $2, $3, $4) RETURNING id',
        [username, passwordHash, name, `${username}@example.com`]
      );

      logger.info('Admin registered:', { username, name });

      res.status(201).json({
        success: true,
        message: 'Admin registered successfully',
        data: {
          id: result.rows[0].id,
          username,
          name,
          password
        }
      });
    } finally {
      client.release();
    }
  })
);

// Token verification
router.get('/verify', asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT id, email, name FROM admin_users WHERE id = $1',
        [decoded.adminId]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      res.json({
        success: true,
        data: {
          admin: result.rows[0]
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}));

// Token validation endpoint for frontend
router.get('/validate', asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT id, username FROM admin_users WHERE id = $1',
        [decoded.adminId]
      );
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      res.json({
        success: true,
        user: {
          id: result.rows[0].id,
          username: result.rows[0].username
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}));



// Student / User Registration
router.post('/student-register',
  [
    body('name').trim().notEmpty().withMessage('Full name is required'),
    body('registration_number').trim().notEmpty().withMessage('Registration number is required'),
    body('department').trim().notEmpty().withMessage('Department is required'),
    body('email').trim().isEmail().withMessage('A valid email address is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('confirm_password').custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { name, registration_number, department, email, password } = req.body;
    const cleanRegNo = registration_number.trim();
    const cleanEmail = email.trim().toLowerCase();

    const client = await pool.connect();
    try {
      // Check for duplicate registration number
      const existingReg = await client.query(
        'SELECT id FROM users WHERE LOWER(TRIM(registration_number)) = LOWER(TRIM($1))',
        [cleanRegNo]
      );

      if (existingReg.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Registration number already exists. Duplicates are not allowed.'
        });
      }

      // Check for duplicate email
      const existingEmail = await client.query(
        'SELECT id FROM users WHERE LOWER(TRIM(email)) = $1',
        [cleanEmail]
      );

      if (existingEmail.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Email already registered. Please login instead.'
        });
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      const result = await client.query(
        `INSERT INTO users (name, registration_number, department, email, password_hash)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, registration_number, department, email, created_at`,
        [name.trim(), cleanRegNo, department.trim(), cleanEmail, passwordHash]
      );

      const user = result.rows[0];

      // Sign JWT
      const token = jwt.sign(
        {
          userId: user.id,
          registration_number: user.registration_number,
          name: user.name,
          role: 'student'
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      logger.info('Student registered successfully:', {
        registration_number: user.registration_number,
        name: user.name
      });

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        token,
        user
      });
    } finally {
      client.release();
    }
  })
);

// Student / User Login with Registration Number & Password
router.post('/student-login',
  [
    body('registration_number').trim().notEmpty().withMessage('Registration number is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { registration_number, password } = req.body;
    const cleanRegNo = registration_number.trim();

    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, name, registration_number, department, email, password_hash
         FROM users
         WHERE LOWER(TRIM(registration_number)) = LOWER(TRIM($1))`,
        [cleanRegNo]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Invalid registration number or password'
        });
      }

      const user = result.rows[0];

      // Verify password
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          error: 'Invalid registration number or password'
        });
      }

      // Sign JWT
      const token = jwt.sign(
        {
          userId: user.id,
          registration_number: user.registration_number,
          name: user.name,
          role: 'student'
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      logger.info('Student logged in successfully:', {
        registration_number: user.registration_number,
        name: user.name
      });

      res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          registration_number: user.registration_number,
          department: user.department,
          email: user.email
        }
      });
    } finally {
      client.release();
    }
  })
);

// Student Session Verification (Me)
router.get('/student-me', asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    if (!decoded.userId) {
      return res.status(401).json({ success: false, error: 'Invalid token payload' });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT id, name, registration_number, department, email FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ success: false, error: 'User not found' });
      }

      res.json({
        success: true,
        user: result.rows[0]
      });
    } finally {
      client.release();
    }
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}));

module.exports = router;
