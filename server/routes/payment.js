const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

// No payment gateway is connected in this version, so nothing here is open to students
router.use(authenticateAdmin);

// Process payment
router.post('/process', 
  [
    body('printJobId').isInt({ min: 1 }).withMessage('Valid print job ID is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Valid amount is required'),
    body('paymentMethod').notEmpty().withMessage('Payment method is required'),
    body('customerName').notEmpty().withMessage('Customer name is required'),
    body('customerEmail').isEmail().withMessage('Valid email is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const {
      printJobId,
      amount,
      paymentMethod,
      customerName,
      customerEmail,
      transactionId
    } = req.body;

    const client = await pool.connect();

    try {
      // Verify print job exists
      const printJobResult = await client.query(
        'SELECT id, total_price FROM print_jobs WHERE id = $1',
        [printJobId]
      );

      if (printJobResult.rows.length === 0) {
        return res.status(404).json({ error: 'Print job not found' });
      }

      const printJob = printJobResult.rows[0];

      // Verify amount matches
      if (parseFloat(amount) !== parseFloat(printJob.total_price)) {
        return res.status(400).json({ error: 'Amount does not match print job total' });
      }

      // Create payment record
      const paymentResult = await client.query(
        `INSERT INTO payments (
          print_job_id, amount, payment_method, customer_name, 
          customer_email, transaction_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING id`,
        [
          printJobId, 
          parseFloat(amount), 
          paymentMethod, 
          customerName, 
          customerEmail, 
          transactionId || null, 
          'completed'
        ]
      );

      // Update print job status to paid
      await client.query(
        'UPDATE print_jobs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['paid', printJobId]
      );

      logger.info('Payment processed:', { 
        paymentId: paymentResult.rows[0].id,
        printJobId,
        amount,
        customerEmail 
      });

      res.json({
        success: true,
        message: 'Payment processed successfully',
        data: {
          paymentId: paymentResult.rows[0].id,
          printJobId,
          amount
        }
      });
    } finally {
      client.release();
    }
  })
);

// Get payment by print job ID
router.get('/print-job/:printJobId', asyncHandler(async (req, res) => {
  const { printJobId } = req.params;

  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT id, amount, payment_method, customer_name, customer_email, 
       transaction_id, status, created_at
       FROM payments WHERE print_job_id = $1`,
      [printJobId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } finally {
    client.release();
  }
}));

// Get all payments (admin only)
router.get('/all', asyncHandler(async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT p.id, p.amount, p.payment_method, p.customer_name, 
       p.customer_email, p.status, p.created_at, pj.tracking_number
       FROM payments p
       JOIN print_jobs pj ON p.print_job_id = pj.id
       ORDER BY p.created_at DESC`
    );

    res.json({
      success: true,
      data: result.rows
    });
  } finally {
    client.release();
  }
}));

module.exports = router; 