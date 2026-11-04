// Points the app at a separate database and upload folder so tests never touch real data
const os = require('os');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'print_repository_test';
process.env.JWT_SECRET = 'test-only-secret';
process.env.ADMIN_INITIAL_PASSWORD = 'test-admin-password';
process.env.UPLOAD_PATH = path.join(os.tmpdir(), 'printdesk-test-uploads');
process.env.AUTH_RATE_LIMIT_MAX = process.env.AUTH_RATE_LIMIT_MAX || '1000';
process.env.LOG_LEVEL = 'error';
// Pretend printers, and no background timer: each test looks at the print queue itself
process.env.PRINTERS_SIMULATE = '1';
process.env.PRINT_MONITOR_MS = '0';
