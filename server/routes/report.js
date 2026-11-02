const express = require('express');
const { pool } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateAdmin);

// Get sales report
router.get('/sales', asyncHandler(async (req, res) => {
  const { startDate, endDate, groupBy = 'day' } = req.query;

  const client = await pool.connect();

  try {
    let dateFilter = '';
    let params = [];

    if (startDate && endDate) {
      dateFilter = 'WHERE p.created_at BETWEEN $1 AND $2';
      params = [startDate, endDate];
    }

    let groupByClause = '';
    let selectClause = '';

    switch (groupBy) {
      case 'day':
        groupByClause = 'DATE(p.created_at)';
        selectClause = 'DATE(p.created_at) as date';
        break;
      case 'week':
        groupByClause = 'DATE_TRUNC(\'week\', p.created_at)';
        selectClause = 'DATE_TRUNC(\'week\', p.created_at) as week';
        break;
      case 'month':
        groupByClause = 'DATE_TRUNC(\'month\', p.created_at)';
        selectClause = 'DATE_TRUNC(\'month\', p.created_at) as month';
        break;
      default:
        groupByClause = 'DATE(p.created_at)';
        selectClause = 'DATE(p.created_at) as date';
    }

    const query = `
      SELECT ${selectClause}, 
             COUNT(*) as total_orders,
             SUM(p.amount) as total_revenue
      FROM payments p
      ${dateFilter}
      GROUP BY ${groupByClause}
      ORDER BY ${groupByClause} DESC
    `;

    const result = await client.query(query, params);

    res.json({
      success: true,
      data: {
        report: result.rows,
        summary: {
          totalOrders: result.rows.reduce((sum, row) => sum + parseInt(row.total_orders), 0),
          totalRevenue: result.rows.reduce((sum, row) => sum + parseFloat(row.total_revenue), 0)
        }
      }
    });
  } finally {
    client.release();
  }
}));

// Get print type report
router.get('/print-types', asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const client = await pool.connect();

  try {
    let dateFilter = '';
    let params = [];

    if (startDate && endDate) {
      dateFilter = 'WHERE pj.created_at BETWEEN $1 AND $2';
      params = [startDate, endDate];
    }

    const query = `
      SELECT pj.print_type,
             COUNT(*) as total_jobs,
             SUM(pj.total_price) as total_revenue,
             AVG(pj.total_price) as avg_price
      FROM print_jobs pj
      ${dateFilter}
      GROUP BY pj.print_type
      ORDER BY total_revenue DESC
    `;

    const result = await client.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } finally {
    client.release();
  }
}));

// Get status report
router.get('/status', asyncHandler(async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT status,
             COUNT(*) as count,
             SUM(total_price) as total_value
      FROM print_jobs
      GROUP BY status
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } finally {
    client.release();
  }
}));

// Get customer report
router.get('/customers', asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;

  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT customer_email,
             customer_name,
             COUNT(*) as total_orders,
             SUM(total_price) as total_spent,
             AVG(total_price) as avg_order_value
      FROM print_jobs
      GROUP BY customer_email, customer_name
      ORDER BY total_spent DESC
      LIMIT $1
    `, [parseInt(limit)]);

    res.json({
      success: true,
      data: result.rows
    });
  } finally {
    client.release();
  }
}));

module.exports = router; 