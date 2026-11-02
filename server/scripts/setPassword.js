// Creates an admin or department login, or changes its password if it already exists.
//   node scripts/setPassword.js admin <username> <password>
//   node scripts/setPassword.js department <department name> <password>
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, initializeDatabase } = require('../config/db');

const QUERIES = {
  admin: {
    sql: `INSERT INTO admin_users (username, password_hash, email, role, is_active)
          VALUES ($1, $2, $1 || '@printdesk.local', 'admin', true)
          ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`
  },
  department: {
    sql: `INSERT INTO faculty (department_name, password)
          VALUES ($1, $2)
          ON CONFLICT (department_name) DO UPDATE SET password = EXCLUDED.password`
  }
};

async function main() {
  const [type, name, password] = process.argv.slice(2);

  if (!QUERIES[type] || !name || !password) {
    console.error('Usage: node scripts/setPassword.js <admin|department> <name> <password>');
    process.exit(1);
  }

  await initializeDatabase();
  await pool.query(QUERIES[type].sql, [name, await bcrypt.hash(password, 10)]);
  console.log(`Password set for ${type} "${name}"`);
  await pool.end();
}

main().catch((error) => {
  console.error(`Failed to set password: ${error.message}`);
  process.exit(1);
});
