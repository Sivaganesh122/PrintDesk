const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { logger } = require('../utils/logger');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

// Test the connection
pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Replaces any password still stored as plain text with its bcrypt hash, so existing logins keep working
const hashPlaintextPasswords = async (client, table, column) => {
  const { rows } = await client.query(`SELECT id, ${column} AS value FROM ${table} WHERE ${column} NOT LIKE '$2%'`);

  for (const row of rows) {
    const hash = await bcrypt.hash(row.value, 10);
    await client.query(`UPDATE ${table} SET ${column} = $1 WHERE id = $2`, [hash, row.id]);
  }

  if (rows.length > 0) {
    logger.info(`Hashed ${rows.length} plain text password(s) in ${table}`);
  }
};

// Initialize database tables
const initializeDatabase = async () => {
  try {
    const client = await pool.connect();
    
    // Create print_jobs table (main table for the application)
    await client.query(`
      CREATE TABLE IF NOT EXISTS print_jobs (
        id SERIAL PRIMARY KEY,
        tracking_number VARCHAR(255) UNIQUE NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50) NOT NULL,
        print_type VARCHAR(100) NOT NULL,
        quantity INTEGER NOT NULL,
        paper_size VARCHAR(50) NOT NULL,
        paper_type VARCHAR(50) NOT NULL,
        color_type VARCHAR(50) NOT NULL,
        binding VARCHAR(50) NOT NULL,
        urgency VARCHAR(50) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        special_instructions TEXT,
        file_path VARCHAR(500),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add the print options that older databases don't have columns for
    await client.query(`
      ALTER TABLE print_jobs
        ADD COLUMN IF NOT EXISTS copies INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS double_sided BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS selected_pages INTEGER[],
        ADD COLUMN IF NOT EXISTS original_filename VARCHAR(255),
        ADD COLUMN IF NOT EXISTS order_number VARCHAR(255)
    `);

    // Progress of printing a job on a printer connected to this computer. print_attempt goes up
    // each time the admin presses Print, so news about an older attempt is ignored.
    await client.query(`
      ALTER TABLE print_jobs
        ADD COLUMN IF NOT EXISTS print_state VARCHAR(20),
        ADD COLUMN IF NOT EXISTS print_message TEXT,
        ADD COLUMN IF NOT EXISTS print_pages_printed INTEGER,
        ADD COLUMN IF NOT EXISTS print_total_pages INTEGER,
        ADD COLUMN IF NOT EXISTS print_printer VARCHAR(255),
        ADD COLUMN IF NOT EXISTS print_attempt INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS print_updated_at TIMESTAMP
    `);

    // What happened between this computer and its printers, shown as the printer activity log
    await client.query(`
      CREATE TABLE IF NOT EXISTS print_events (
        id SERIAL PRIMARY KEY,
        print_job_id INTEGER REFERENCES print_jobs(id) ON DELETE SET NULL,
        tracking_number VARCHAR(255),
        printer VARCHAR(255),
        state VARCHAR(30) NOT NULL,
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create payments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        print_job_id INTEGER REFERENCES print_jobs(id),
        amount DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(100) NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        transaction_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create orders table (legacy table)
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        token VARCHAR(255) UNIQUE NOT NULL,
        roll_number VARCHAR(50) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        stored_filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INTEGER NOT NULL,
        file_mimetype VARCHAR(100) NOT NULL,
        total_pages INTEGER NOT NULL,
        color_pages INTEGER DEFAULT 0,
        bw_pages INTEGER DEFAULT 0,
        price DECIMAL(10,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        payment_status VARCHAR(50) DEFAULT 'pending',
        payment_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days')
      )
    `);

    // Create audit_logs table for GDPR/PCI-DSS compliance
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        table_name VARCHAR(50),
        record_id INTEGER,
        old_values JSONB,
        new_values JSONB,
        user_ip VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create users table for student registration and login
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        registration_number VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        department VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create unique case-insensitive index on registration_number to prevent duplicates
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_reg_number ON users (LOWER(TRIM(registration_number)))
    `);

    // Create admin_users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `);

    // Create faculty table for department logins
    await client.query(`
      CREATE TABLE IF NOT EXISTS faculty (
        id SERIAL PRIMARY KEY,
        department_name VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      )
    `);

    // Create system_settings table for payment and other configurations
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create file_uploads table for temporary file storage
    await client.query(`
      CREATE TABLE IF NOT EXISTS file_uploads (
        id SERIAL PRIMARY KEY,
        token VARCHAR(255) NOT NULL UNIQUE,
        original_filename VARCHAR(255) NOT NULL,
        stored_filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INTEGER NOT NULL,
        file_mimetype VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default payment settings
    await client.query(`
      INSERT INTO system_settings (setting_key, setting_value, description) VALUES
        ('payment_enabled', 'false', 'Enable/disable payment processing'),
        ('paytm_merchant_id', '', 'Paytm merchant ID'),
        ('paytm_merchant_key', '', 'Paytm merchant key'),
        ('paytm_environment', 'TEST', 'Paytm environment (TEST/PROD)')
      ON CONFLICT (setting_key) DO NOTHING
    `);

    await hashPlaintextPasswords(client, 'admin_users', 'password_hash');
    await hashPlaintextPasswords(client, 'faculty', 'password');

    // Create the first admin from the environment. There is deliberately no default password.
    const adminCount = await client.query('SELECT COUNT(*) FROM admin_users');
    if (parseInt(adminCount.rows[0].count, 10) === 0) {
      if (process.env.ADMIN_INITIAL_PASSWORD) {
        const passwordHash = await bcrypt.hash(process.env.ADMIN_INITIAL_PASSWORD, 10);
        await client.query(
          `INSERT INTO admin_users (username, password_hash, email, role, is_active)
           VALUES ('admin', $1, 'admin@printdesk.edu', 'admin', true)`,
          [passwordHash]
        );
        logger.info('Created the first admin user');
      } else {
        logger.warn('No admin user exists. Set ADMIN_INITIAL_PASSWORD or run scripts/setPassword.js');
      }
    }

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_print_jobs_tracking_number ON print_jobs(tracking_number);
      CREATE INDEX IF NOT EXISTS idx_print_jobs_order_number ON print_jobs(order_number);
      CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_print_jobs_created_at ON print_jobs(created_at);
      CREATE INDEX IF NOT EXISTS idx_payments_print_job_id ON payments(print_job_id);
      CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
      CREATE INDEX IF NOT EXISTS idx_orders_token ON orders(token);
      CREATE INDEX IF NOT EXISTS idx_orders_roll_number ON orders(roll_number);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
      CREATE INDEX IF NOT EXISTS idx_file_uploads_token ON file_uploads(token);
      CREATE INDEX IF NOT EXISTS idx_file_uploads_status ON file_uploads(status);
      CREATE INDEX IF NOT EXISTS idx_file_uploads_order_id ON file_uploads(order_id);
    `);

    client.release();
    logger.info('Database tables initialized successfully');
  } catch (error) {
    logger.error('Error initializing database:', error);
    throw error;
  }
};

// Helper function to log audit trail
const logAuditTrail = async (action, tableName, recordId, oldValues = null, newValues = null, req = null) => {
  try {
    const client = await pool.connect();
    await client.query(`
      INSERT INTO audit_logs (action, table_name, record_id, old_values, new_values, user_ip, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      action,
      tableName,
      recordId,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      req?.ip || null,
      req?.get('User-Agent') || null
    ]);
    client.release();
  } catch (error) {
    logger.error('Error logging audit trail:', error);
  }
};

module.exports = {
  pool,
  initializeDatabase,
  logAuditTrail
}; 