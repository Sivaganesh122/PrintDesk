const express = require('express');
const { pool } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;
const { authenticateAdmin } = require('../middleware/auth');
const { uploadsDir } = require('../config/localStorage');
const { getPrinters, printJob, listEvents } = require('../services/printing/printService');

const router = express.Router();

router.use(authenticateAdmin);

router.param('id', (req, res, next, id) => {
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid print job id' });
  }
  next();
});

// Get dashboard stats
router.get('/dashboard', asyncHandler(async (req, res) => {
  const client = await pool.connect();

  try {
    // Get total print jobs
    const totalJobsResult = await client.query('SELECT COUNT(*) FROM print_jobs');
    const totalJobs = parseInt(totalJobsResult.rows[0].count);

    // Get pending jobs
    const pendingJobsResult = await client.query("SELECT COUNT(*) FROM print_jobs WHERE status IN ('pending', 'processing')");
    const pendingJobs = parseInt(pendingJobsResult.rows[0].count);

    // Get completed jobs
    const completedJobsResult = await client.query("SELECT COUNT(*) FROM print_jobs WHERE status = 'completed'");
    const completedJobs = parseInt(completedJobsResult.rows[0].count);

    // Get delivered jobs
    const deliveredJobsResult = await client.query("SELECT COUNT(*) FROM print_jobs WHERE status = 'delivered'");
    const deliveredJobs = parseInt(deliveredJobsResult.rows[0].count);

    // Get cancelled jobs
    const cancelledJobsResult = await client.query("SELECT COUNT(*) FROM print_jobs WHERE status = 'cancelled'");
    const cancelledJobs = parseInt(cancelledJobsResult.rows[0].count);

    // Get total revenue
    const revenueResult = await client.query('SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = $1', ['completed']);
    const totalRevenue = parseFloat(revenueResult.rows[0].coalesce);

    // Get recent jobs
    const recentJobsResult = await client.query(
      `SELECT id, tracking_number, customer_name, print_type, total_price, status, created_at
       FROM print_jobs ORDER BY created_at DESC LIMIT 10`
    );

    res.json({
      success: true,
      data: {
        stats: {
          totalJobs,
          pendingJobs,
          completedJobs,
          deliveredJobs,
          cancelledJobs,
          totalRevenue
        },
        recentJobs: recentJobsResult.rows
      }
    });
  } finally {
    client.release();
  }
}));

// Get all print jobs with pagination
router.get('/print-jobs', asyncHandler(async (req, res) => {
  const { status } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  const client = await pool.connect();

  try {
    let query = `
    SELECT id, tracking_number, customer_name, customer_email, print_type,
       quantity, copies, double_sided, selected_pages, paper_size, color_type, binding,
       original_filename, total_price, status, created_at, file_path, order_number,
       print_state, print_message, print_pages_printed, print_total_pages, print_printer, print_updated_at,
       ROW_NUMBER() OVER (PARTITION BY order_number ORDER BY id) AS order_document_number,
       COUNT(*) OVER (PARTITION BY order_number) AS order_document_count
FROM print_jobs
    `;
    let countQuery = 'SELECT COUNT(*) FROM print_jobs';
    const conditions = [];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    // Matches any part of the register number. Students' jobs are stored under their
    // register number, so this finds one student's jobs.
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search) {
      params.push(`%${search.replace(/[\\%_]/g, '\\$&')}%`);
      conditions.push(`customer_name ILIKE $${params.length}`);
    }

    if (conditions.length) {
      const where = ` WHERE ${conditions.join(' AND ')}`;
      query += where;
      countQuery += where;
    }

    query += ` ORDER BY created_at DESC, id ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    const [jobsResult, countResult] = await Promise.all([
      client.query(query, [...params, limit, offset]),
      client.query(countQuery, params)
    ]);

    const totalJobs = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalJobs / limit);

    res.json({
      success: true,
      data: {
        jobs: jobsResult.rows,
        pagination: {
          currentPage: page,
          totalPages,
          totalJobs,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } finally {
    client.release();
  }
}));

// Get print job details
router.get('/print-jobs/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT id, tracking_number, customer_name, customer_email, customer_phone,
       print_type, quantity, copies, double_sided, selected_pages, paper_size, paper_type,
       color_type, binding, urgency, original_filename, order_number, total_price, special_instructions,
       status, created_at, updated_at
       FROM print_jobs WHERE id = $1`,
      [id]
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

// Update print job status
router.patch('/print-jobs/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'processing', 'completed', 'delivered', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const client = await pool.connect();

  try {
    const result = await client.query(
      'UPDATE print_jobs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Print job not found' });
    }

    logger.info('Print job status updated by admin:', { id, status });

    res.json({
      success: true,
      message: 'Status updated successfully'
    });
  } finally {
    client.release();
  }
}));

// Serve the uploaded file for a print job
// The printers connected to this computer, with their state and queue length
router.get('/printers', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getPrinters() });
}));

// Recent activity between this computer and its printers
router.get('/print-events', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await listEvents(req.query.limit) });
}));

// Prints the job on a connected printer. The body can change the order's settings:
// { printer, pages: "1-3,5" or "" for all, copies, doubleSided, color, paperSize }
router.post('/print-jobs/:id/print', asyncHandler(async (req, res) => {
  const result = await printJob(req.params.id, req.body || {});
  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }
  logger.info('Print job sent to a printer by admin:', { id: req.params.id, printer: result.settings.printer });
  res.status(202).json({ success: true, data: result.settings });
}));

router.get('/print-jobs/:id/file', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT file_path, status FROM print_jobs WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Print job not found' });
    }
    const { file_path: filePath, status } = result.rows[0];

    // For cancelled tasks, admin can only view metadata and cannot access files
    if (status === 'cancelled') {
      return res.status(403).json({ error: 'File access is restricted for cancelled tasks. Only metadata can be viewed.' });
    }

    if (!filePath) {
      return res.status(404).json({ error: 'No file associated with this print job' });
    }
    const absPath = path.join(uploadsDir, path.basename(filePath));
    try {
      await fs.access(absPath);
    } catch (err) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.sendFile(absPath);
  } finally {
    client.release();
  }
}));

// Get all payments
router.get('/payments', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const client = await pool.connect();

  try {
    const [paymentsResult, countResult] = await Promise.all([
      client.query(
        `SELECT p.id, p.amount, p.payment_method, p.customer_name, p.customer_email,
         p.transaction_id, p.status, p.created_at, pj.tracking_number
         FROM payments p
         JOIN print_jobs pj ON p.print_job_id = pj.id
         ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`,
        [parseInt(limit), offset]
      ),
      client.query('SELECT COUNT(*) FROM payments')
    ]);

    const totalPayments = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalPayments / limit);

    res.json({
      success: true,
      data: {
        payments: paymentsResult.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalPayments,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        }
      }
    });
  } finally {
    client.release();
  }
}));

// Orders endpoint stub
router.get('/orders', (req, res) => {
  res.json({ success: true, data: [] });
});
// Payment settings endpoint stub
router.get('/payment-settings', (req, res) => {
  res.json({ success: true, data: { paymentEnabled: true } });
});
// Payment stats endpoint stub
router.get('/payment-stats', (req, res) => {
  res.json({ success: true, data: { totalPayments: 0, totalAmount: 0 } });
});

module.exports = router; 