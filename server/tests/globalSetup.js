const fs = require('fs');
const { Client } = require('pg');

// Recreates the test database before each run
module.exports = async () => {
  require('./env');

  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres'
  });

  await client.connect();
  await client.query('DROP DATABASE IF EXISTS print_repository_test WITH (FORCE)');
  await client.query('CREATE DATABASE print_repository_test');
  await client.end();

  fs.rmSync(process.env.UPLOAD_PATH, { recursive: true, force: true });
  fs.mkdirSync(process.env.UPLOAD_PATH, { recursive: true });
};
