const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
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
const facultyRoutes = require('./routes/facultylogin');


// Import middleware and config
const { errorHandler } = require('./middleware/errorHandler');
const { getJwtSecret } = require('./middleware/auth');
const { logger } = require('./utils/logger');
const { initializeDatabase } = require('./config/db');
const { initializeStorage } = require('./config/localStorage');
const { recoverAfterRestart } = require('./services/printing/printService');

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
  'http://127.0.0.1:3000',
  ...(process.env.CLIENT_ORIGIN ? [process.env.CLIENT_ORIGIN] : [])
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

// Uploaded documents are not served statically. Admins fetch them through
// /api/admin/print-jobs/:id/file, which checks the login.

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

// Initialize database and start server
const startServer = async () => {
  try {
    getJwtSecret();

    // Initialize database
    await initializeDatabase();
    logger.info('Database initialized');

    // Initialize storage
    await initializeStorage();
    logger.info('Storage initialized');

    await recoverAfterRestart();

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

// The tests import the app without starting a server
if (require.main === module) {
  startServer();
}

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