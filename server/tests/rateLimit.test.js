process.env.AUTH_RATE_LIMIT_MAX = '3';

const request = require('supertest');
const app = require('../server');
const { pool, initializeDatabase } = require('../config/db');

beforeAll(async () => {
  await initializeDatabase();
});

afterAll(async () => {
  await pool.end();
});

test('repeated failed logins are blocked', async () => {
  const attempt = () => request(app).post('/api/auth/login').send({ username: 'admin', password: 'wrong' });

  for (let i = 0; i < 3; i++) {
    expect((await attempt()).status).toBe(401);
  }

  expect((await attempt()).status).toBe(429);
});
