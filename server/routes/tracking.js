const express = require('express');
const { pool, getDb } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

const router = express.Router();

// Track print job by tracking number
router.get('/:trackingNumber', asyncHandler(async (req, res) => {
  const { trackingNumber } = req.params;

  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT id, tracking_number, customer_name, customer_email, customer_phone,
       print_type, quantity, paper_size, paper_type, color_type, binding, urgency,
       total_price, special_instructions, status, created_at, updated_at
       FROM print_jobs WHERE tracking_number = $1`,
      [trackingNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Print job not found' });
    }

    const printJob = result.rows[0];

    // Get payment information if exists
    const paymentResult = await client.query(
      `SELECT id, amount, payment_method, status, created_at
       FROM payments WHERE print_job_id = $1`,
      [printJob.id]
    );

    const response = {
      ...printJob,
      payment: paymentResult.rows[0] || null
    };

    logger.info('Print job tracked:', { trackingNumber, customerEmail: printJob.customer_email });

    res.json({
      success: true,
      data: response
    });
  } finally {
    client.release();
  }
}));

// Track by roll number or tracking number
router.get('/roll/:rollNumber', async (req, res, next) => {
  let client;
  try {
    const { rollNumber } = req.params;
    client = await pool.connect();
    const result = await client.query(
      `SELECT * FROM print_jobs 
       WHERE customer_name = $1 OR tracking_number = $1 
       ORDER BY created_at DESC`,
      [rollNumber]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No print jobs found for this roll number or tracking number' });
    }
    const mappedOrders = result.rows.map(row => ({
      token: row.tracking_number,
      rollNumber: row.customer_name,
      status: row.status,
      createdAt: row.created_at,
      totalPages: row.quantity || null,
      colorPages: row.color_pages || null,
      bwPages: row.bw_pages || null,
      price: row.total_price || null,
      paperSize: row.paper_size || null,
      binding: row.binding || null,
      urgency: row.urgency || null,
      downloadUrl: `/api/print-job/download/${row.tracking_number}`,
      printReceiptUrl: `/api/print-job/receipt/${row.tracking_number}`,
    }));

    res.json({ 
      success: true, 
      orders: mappedOrders,
      order: mappedOrders[0] 
    });
  } catch (err) {
    next(err);
  } finally {
    if (client) client.release();
  }
});

// Get tracking history
router.get('/:trackingNumber/history', asyncHandler(async (req, res) => {
  const { trackingNumber } = req.params;

  const client = await pool.connect();

  try {
    const result = await client.query(
      'SELECT id FROM print_jobs WHERE tracking_number = $1',
      [trackingNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Print job not found' });
    }

    const printJobId = result.rows[0].id;

    // Get status history (for now, we'll create a simple history based on current status)
    // In a real application, you might have a separate status_history table
    const printJob = await client.query(
      'SELECT status, created_at, updated_at FROM print_jobs WHERE id = $1',
      [printJobId]
    );

    const statusHistory = [
      {
        status: 'created',
        timestamp: printJob.rows[0].created_at,
        description: 'Print job created'
      }
    ];

    if (printJob.rows[0].status !== 'pending') {
      statusHistory.push({
        status: printJob.rows[0].status,
        timestamp: printJob.rows[0].updated_at,
        description: `Status updated to ${printJob.rows[0].status}`
      });
    }

    res.json({
      success: true,
      data: {
        trackingNumber,
        history: statusHistory
      }
    });
  } finally {
    client.release();
  }
}));

module.exports = router; 