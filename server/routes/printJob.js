const express = require('express');
const crypto = require('crypto');
const fs = require('fs').promises;
const { pool } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateRequester } = require('../middleware/auth');
const { uploadDocuments } = require('../middleware/upload');
const { logger } = require('../utils/logger');
const { handleFileUpload } = require('../config/localStorage');

const router = express.Router();

// Keep in sync with PRICING in client-vite/src/context/PrintJobContext.jsx
const PRICE_PER_PAGE = { bw: 1, color: 2 };
const BINDING_PRICE_PER_COPY = { None: 0, Spiral: 30, Paper: 10 };
const PAPER_SIZES = ['A4', 'A3'];
const MAX_COPIES = 10;
// The client offers cancellation for 30 seconds; the extra time covers a slow request
const CANCEL_WINDOW_SECONDS = 40;

const generateNumber = (prefix) => `${prefix}${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

const parseDocuments = (value) => {
  try {
    const documents = JSON.parse(value);
    return Array.isArray(documents) ? documents : null;
  } catch (error) {
    return null;
  }
};

const isValidPageList = (pages) => Array.isArray(pages)
  && pages.length > 0
  && pages.every((page) => Number.isInteger(page) && page > 0)
  && new Set(pages).size === pages.length;

const getSpecificationError = (spec) => {
  if (!spec || !isValidPageList(spec.selectedPages)) {
    return 'select at least one page';
  }
  if (!Number.isInteger(spec.copies) || spec.copies < 1 || spec.copies > MAX_COPIES) {
    return `copies must be between 1 and ${MAX_COPIES}`;
  }
  if (!PAPER_SIZES.includes(spec.paperSize)) {
    return 'invalid paper size';
  }
  if (!Object.keys(BINDING_PRICE_PER_COPY).includes(spec.bindingType)) {
    return 'invalid binding type';
  }
  return null;
};

const calculatePrice = ({ selectedPages, color, copies, bindingType }) => {
  const pagesCost = selectedPages.length * copies * (color ? PRICE_PER_PAGE.color : PRICE_PER_PAGE.bw);
  const bindingCost = BINDING_PRICE_PER_COPY[bindingType] * copies;
  return { pagesCost, bindingCost, totalPrice: pagesCost + bindingCost };
};

// Create an order with one print job per document. The "files" field holds the documents and
// the "documents" field holds a JSON array with the specification for each file, in the same order.
router.post('/create',
  authenticateRequester,
  uploadDocuments,
  asyncHandler(async (req, res) => {
    if (req.requester.role === 'admin') {
      return res.status(403).json({ error: 'Log in as a student or department to submit a print job' });
    }

    const specs = parseDocuments(req.body.documents);
    if (!specs || specs.length !== req.files.length) {
      return res.status(400).json({ error: 'Each uploaded file needs its own print specification' });
    }

    for (let i = 0; i < specs.length; i++) {
      const specError = getSpecificationError(specs[i]);
      if (specError) {
        return res.status(400).json({ error: `${req.files[i].originalname}: ${specError}` });
      }
    }

    const orderNumber = generateNumber('ORD');
    const storedFiles = [];
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const documents = [];
      for (let i = 0; i < specs.length; i++) {
        const spec = specs[i];
        const file = req.files[i];
        const { pagesCost, bindingCost, totalPrice } = calculatePrice(spec);

        const fileResult = await handleFileUpload(file);
        storedFiles.push(fileResult.path);

        const result = await client.query(
          `INSERT INTO print_jobs (
            tracking_number, customer_name, customer_email, customer_phone, print_type,
            quantity, paper_size, paper_type, color_type, binding,
            urgency, total_price, file_path, status,
            copies, double_sided, selected_pages, original_filename, order_number
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
          RETURNING id, tracking_number`,
          [
            generateNumber('TRK'),
            req.requester.ownerName,
            req.requester.email,
            'N/A',
            'Academic Print',
            spec.selectedPages.length,
            spec.paperSize,
            'Standard',
            spec.color ? 'Color' : 'Black & White',
            spec.bindingType,
            'Normal',
            totalPrice,
            fileResult.filename,
            'pending',
            spec.copies,
            Boolean(spec.doubleSided),
            spec.selectedPages,
            file.originalname,
            orderNumber
          ]
        );

        documents.push({
          id: result.rows[0].id,
          trackingNumber: result.rows[0].tracking_number,
          fileName: file.originalname,
          pages: spec.selectedPages.length,
          color: Boolean(spec.color),
          doubleSided: Boolean(spec.doubleSided),
          copies: spec.copies,
          paperSize: spec.paperSize,
          bindingType: spec.bindingType,
          pagesCost,
          bindingCost,
          totalPrice
        });
      }

      await client.query('COMMIT');

      logger.info('Print order created:', {
        orderNumber,
        documents: documents.length,
        customerName: req.requester.ownerName
      });

      res.status(201).json({
        success: true,
        message: 'Print order created successfully',
        data: {
          orderNumber,
          customerName: req.requester.ownerName,
          totalPrice: documents.reduce((sum, document) => sum + document.totalPrice, 0),
          documents
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      await Promise.all(storedFiles.map((filePath) => fs.unlink(filePath).catch(() => {})));
      throw error;
    } finally {
      client.release();
    }
  })
);

// Cancel a whole order shortly after it was submitted
router.delete('/order/:orderNumber', authenticateRequester, asyncHandler(async (req, res) => {
  const { orderNumber } = req.params;

  const result = await pool.query(
    `SELECT id, status, customer_name,
       created_at > CURRENT_TIMESTAMP - make_interval(secs => $2) AS can_cancel
     FROM print_jobs WHERE order_number = $1`,
    [orderNumber, CANCEL_WINDOW_SECONDS]
  );

  const jobs = result.rows;
  const isOwner = jobs.length > 0
    && jobs[0].customer_name.trim().toLowerCase() === req.requester.ownerName?.trim().toLowerCase();

  if (!isOwner || jobs.every((job) => job.status === 'cancelled')) {
    return res.status(404).json({ error: 'Order not found or already cancelled' });
  }

  if (!jobs[0].can_cancel) {
    return res.status(400).json({ error: 'Order cannot be cancelled after 30 seconds' });
  }

  if (jobs.some((job) => job.status !== 'pending')) {
    return res.status(400).json({ error: 'Printing has already started on this order' });
  }

  await pool.query(
    `UPDATE print_jobs SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE order_number = $1`,
    [orderNumber]
  );

  logger.info('Print order cancelled:', { orderNumber });

  res.json({
    success: true,
    message: 'Order cancelled successfully'
  });
}));

module.exports = router;
