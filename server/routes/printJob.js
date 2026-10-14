const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const { handleFileUpload } = require('../config/localStorage');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit
  }
});

// File upload endpoint
router.post('/upload', 
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    try {
      // Upload file to storage
      const fileResult = await handleFileUpload(req.file);
      const fileKey = fileResult.filename;

      logger.info('File uploaded:', { 
        originalName: req.file.originalname,
        filename: fileKey,
        size: req.file.size
      });

      res.status(200).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          stored_filename: fileKey,
          original_name: req.file.originalname,
          size: req.file.size
        }
      });
    } catch (error) {
      logger.error('Error uploading file:', error);
      res.status(500).json({ error: 'Failed to upload file' });
    }
  })
);

// Create print job (simplified for frontend)
router.post('/create', 
  upload.single('file'),
  [
    body('rollNumber').notEmpty().withMessage('Roll number is required'),
    body('totalPages').isInt({ min: 1 }).withMessage('Total pages must be at least 1'),
    body('totalPrice').isFloat({ min: 0 }).withMessage('Total price must be positive')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const {
      rollNumber,
      totalPages,
      totalPrice,
      colorPages = 0,
      bwPages = 0,
      printOptions = {}
    } = req.body;

    const client = await pool.connect();

    try {
      // Upload file to storage
      const fileResult = await handleFileUpload(req.file);
      const fileKey = fileResult.filename;

      // Generate tracking number
      const trackingNumber = `TRK${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Create print job with simplified data
      const result = await client.query(
        `INSERT INTO print_jobs (
          tracking_number, customer_name, customer_email, customer_phone, print_type, 
          quantity, paper_size, paper_type, color_type, binding, 
          urgency, total_price, special_instructions, file_path, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
        RETURNING id, tracking_number`,
        [
          trackingNumber, // tracking_number
          rollNumber, // customer_name
          `${rollNumber}@example.com`, // customer_email (placeholder)
          'N/A', // customer_phone (placeholder)
          'Academic Print', // print_type
          totalPages, // quantity
          'A4', // paper_size (default)
          'Standard', // paper_type (default)
          colorPages > 0 ? 'Color' : 'Black & White', // color_type
          'None', // binding (default)
          'Normal', // urgency (default)
          parseFloat(totalPrice), // total_price
          `Pages: ${totalPages}, Color: ${colorPages}, BW: ${bwPages}`, // special_instructions
          fileKey, // file_path
          'pending' // status
        ]
      );

      const printJob = result.rows[0];

      logger.info('Print job created:', { 
        id: printJob.id, 
        trackingNumber: printJob.tracking_number,
        customerName: rollNumber
      });

      res.status(201).json({
        success: true,
        message: 'Print job created successfully',
        data: {
          id: printJob.id,
          trackingNumber: printJob.tracking_number
        }
      });
    } finally {
      client.release();
    }
  })
);

// Get print job by tracking number
router.get('/track/:trackingNumber', asyncHandler(async (req, res) => {
  const { trackingNumber } = req.params;

  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT id, customer_name, customer_email, customer_phone, print_type, 
       quantity, paper_size, paper_type, color_type, binding, urgency, 
       total_price, special_instructions, status, created_at, updated_at
       FROM print_jobs WHERE tracking_number = $1`,
      [trackingNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Print job not found' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } finally {
    client.release();
  }
}));

// Get all print jobs (admin only)
router.get('/all', asyncHandler(async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT id, tracking_number, customer_name, customer_email, 
       print_type, quantity, total_price, status, created_at
       FROM print_jobs ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      data: result.rows
    });
  } finally {
    client.release();
  }
}));

// Update print job status
router.patch('/:id/status', 
  [body('status').isIn(['pending', 'processing', 'completed', 'cancelled']).withMessage('Invalid status')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { id } = req.params;
    const { status } = req.body;

    const client = await pool.connect();

    try {
      const result = await client.query(
        'UPDATE print_jobs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id',
        [status, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Print job not found' });
      }

      logger.info('Print job status updated:', { id, status });

      res.json({
        success: true,
        message: 'Status updated successfully'
      });
    } finally {
      client.release();
    }
  })
);

// Cancel/delete print job by tracking number or id
router.delete('/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE print_jobs SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
       WHERE tracking_number = $1 OR id::text = $1 RETURNING id, tracking_number`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found or already cancelled' });
    }

    logger.info('Print job cancelled:', { token });

    res.json({
      success: true,
      message: 'Order cancelled successfully'
    });
  } finally {
    client.release();
  }
}));

module.exports = router; 