const express = require('express');
const { pool } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateRequester } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateRequester);

// Limits a query to the requester's own jobs. Admins can see every job.
const ownerFilter = (requester, paramIndex) => (requester.role === 'admin'
  ? { clause: '', params: [] }
  : {
      clause: `AND LOWER(TRIM(customer_name)) = LOWER(TRIM($${paramIndex}))`,
      params: [requester.ownerName]
    });

// The logged in student's or department's print jobs. The latest order comes first,
// and the documents of one order stay in the order they were added.
router.get('/mine', asyncHandler(async (req, res) => {
  if (req.requester.role === 'admin') {
    return res.status(403).json({ error: 'Log in as a student or department to see your orders' });
  }

  const owner = ownerFilter(req.requester, 1);

  const result = await pool.query(
    `SELECT * FROM print_jobs
     WHERE TRUE ${owner.clause}
     ORDER BY created_at DESC, id ASC`,
    owner.params
  );

  const orders = result.rows.map((row) => ({
    token: row.tracking_number,
    orderNumber: row.order_number,
    fileName: row.original_filename,
    rollNumber: row.customer_name,
    status: row.status,
    createdAt: row.created_at,
    totalPages: row.quantity || null,
    copies: row.copies || 1,
    doubleSided: row.double_sided || false,
    colorType: row.color_type || null,
    price: row.total_price || null,
    paperSize: row.paper_size || null,
    binding: row.binding || null,
    urgency: row.urgency || null,
  }));

  res.json({
    success: true,
    orders
  });
}));

// Track print job by tracking number
router.get('/:trackingNumber', asyncHandler(async (req, res) => {
  const { trackingNumber } = req.params;
  const owner = ownerFilter(req.requester, 2);

  const result = await pool.query(
    `SELECT id, tracking_number, customer_name, customer_email, customer_phone,
     print_type, quantity, copies, double_sided, selected_pages, paper_size, paper_type,
     color_type, binding, urgency, total_price, special_instructions, status, created_at, updated_at
     FROM print_jobs WHERE tracking_number = $1 ${owner.clause}`,
    [trackingNumber, ...owner.params]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Print job not found' });
  }

  const printJob = result.rows[0];

  // Get payment information if exists
  const paymentResult = await pool.query(
    `SELECT id, amount, payment_method, status, created_at
     FROM payments WHERE print_job_id = $1`,
    [printJob.id]
  );

  res.json({
    success: true,
    data: {
      ...printJob,
      payment: paymentResult.rows[0] || null
    }
  });
}));

// Get tracking history
router.get('/:trackingNumber/history', asyncHandler(async (req, res) => {
  const { trackingNumber } = req.params;
  const owner = ownerFilter(req.requester, 2);

  const result = await pool.query(
    `SELECT status, created_at, updated_at FROM print_jobs WHERE tracking_number = $1 ${owner.clause}`,
    [trackingNumber, ...owner.params]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Print job not found' });
  }

  const printJob = result.rows[0];

  // Get status history (for now, we'll create a simple history based on current status)
  // In a real application, you might have a separate status_history table
  const statusHistory = [
    {
      status: 'created',
      timestamp: printJob.created_at,
      description: 'Print job created'
    }
  ];

  if (printJob.status !== 'pending') {
    statusHistory.push({
      status: printJob.status,
      timestamp: printJob.updated_at,
      description: `Status updated to ${printJob.status}`
    });
  }

  res.json({
    success: true,
    data: {
      trackingNumber,
      history: statusHistory
    }
  });
}));

module.exports = router;
