const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
require('dotenv').config();

// Import cleanup scheduler
const { scheduleCleanup } = require('./scripts/scheduleCleanup');

const app = express();
const PORT = process.env.PORT || 5001;

// Import routes
const authRoutes = require('./routes/auth');
const printJobRoutes = require('./routes/printJob');
const paymentRoutes = require('./routes/payment');
const trackingRoutes = require('./routes/tracking');
const adminRoutes = require('./routes/admin');
const reportRoutes = require('./routes/report');
const { uploadsDir } = require('./config/localStorage');
const facultyRoutes = require('./routes/facultylogin');


// Import middleware and config
const { errorHandler } = require('./middleware/errorHandler');
const { logger } = require('./utils/logger');
const { initializeDatabase } = require('./config/db');
const { initializeStorage, serveFile } = require('./config/localStorage');

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://securegw.paytm.in", "http://localhost:5001", "http://localhost:5173"]
    }
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/reports', express.static(path.join(__dirname, 'reports')));

// File serving route for uploaded files
app.get('/api/files/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadsDir, filename);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Get file stats
    const stats = await fs.stat(filePath);
    
    // Set appropriate headers
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Length': stats.size,
      'Last-Modified': stats.mtime.toUTCString(),
      'Cache-Control': 'public, max-age=3600'
    });
    
    // Send file
    res.sendFile(filePath);
  } catch (error) {
    logger.error('Error serving file:', error);
    res.status(500).json({ error: 'Error serving file' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes); // Fallback for requests without /api
app.use('/api/print-job', printJobRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/admin', adminRoutes); // Fallback for requests without /api
app.use('/api/reports', reportRoutes);
app.use('/api', facultyRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use(errorHandler);

// Ensure uploads directory exists
const ensureUploadsDir = async () => {
  const uploadsDir = path.join(__dirname, 'uploads');
  try {
    await fs.access(uploadsDir);
  } catch (error) {
    await fs.mkdir(uploadsDir, { recursive: true });
    logger.info('Created uploads directory');
  }
};

// Initialize database and start server
const startServer = async () => {
  try {
    // Ensure uploads directory exists
    await ensureUploadsDir();
    
    // Initialize database
    await initializeDatabase();
    logger.info('Database initialized');

    // Initialize storage
    await initializeStorage();
    logger.info('Storage initialized');

    // Start the cleanup scheduler in production
    if (process.env.NODE_ENV === 'production') {
      scheduleCleanup();
      logger.info('Scheduled cleanup job started');
    } else {
      logger.info('Skipping cleanup scheduler in development mode');
    }

    // Start the server
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
      } else {
        logger.error('Server error:', error);
      }
      process.exit(1);
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app; 