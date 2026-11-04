const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../server');
const { pool, initializeDatabase } = require('../config/db');
const { cleanupOldFiles } = require('../scripts/cleanupFiles');
const { uploadsDir } = require('../config/localStorage');

const PDF = Buffer.from('%PDF-1.4 test document');
const STUDENT = { registration_number: '727624BCS001', password: 'student-pass-1' };
const OTHER_STUDENT = { registration_number: '727624BCS002', password: 'student-pass-2' };

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const registerStudent = async ({ registration_number, password }) => {
  const res = await request(app).post('/api/auth/student-register').send({
    name: 'Test Student',
    registration_number,
    department: 'CSE',
    email: `${registration_number}@example.edu`,
    password,
    confirm_password: password
  });
  expect(res.status).toBe(201);
  return res.body.token;
};

const submitOrder = (token, documents = [{}]) => {
  const specs = documents.map((document) => ({
    selectedPages: [1, 3, 4],
    color: true,
    doubleSided: true,
    copies: 2,
    paperSize: 'A3',
    bindingType: 'Spiral',
    ...document.spec
  }));
  const req = request(app).post('/api/print-job/create').set(auth(token))
    .field('documents', JSON.stringify(specs));
  documents.forEach((document) => {
    req.attach('files', document.buffer || PDF, document.filename || 'notes.pdf');
  });
  return req;
};

const submitJob = (token, document = {}) => submitOrder(token, [document]);

const firstDocument = (res) => res.body.data.documents[0];

let adminToken;
let studentToken;
let otherStudentToken;
let departmentToken;

beforeAll(async () => {
  await initializeDatabase();

  const admin = await request(app).post('/api/auth/login')
    .send({ username: 'admin', password: process.env.ADMIN_INITIAL_PASSWORD });
  expect(admin.status).toBe(200);
  adminToken = admin.body.data.token;

  studentToken = await registerStudent(STUDENT);
  otherStudentToken = await registerStudent(OTHER_STUDENT);

  await pool.query(
    'INSERT INTO faculty (department_name, password) VALUES ($1, $2)',
    ['CSE', await bcrypt.hash('dept-pass', 10)]
  );
  const department = await request(app).post('/api/faculty-login')
    .send({ department_name: 'CSE', password: 'dept-pass' });
  expect(department.status).toBe(200);
  departmentToken = department.body.token;
});

afterAll(async () => {
  await pool.end();
});

describe('access control', () => {
  const adminRoutes = [
    '/api/admin/dashboard',
    '/api/admin/print-jobs',
    '/api/admin/printers',
    '/api/admin/print-events',
    '/api/admin/payments',
    '/api/payment/all',
    '/api/reports/customers',
    '/api/reports/sales'
  ];

  test.each(adminRoutes)('%s rejects requests without a token', async (route) => {
    expect((await request(app).get(route)).status).toBe(401);
  });

  test.each(adminRoutes)('%s rejects student tokens', async (route) => {
    expect((await request(app).get(route).set(auth(studentToken))).status).toBe(403);
  });

  test.each(adminRoutes)('%s rejects department tokens', async (route) => {
    expect((await request(app).get(route).set(auth(departmentToken))).status).toBe(403);
  });

  test('admin routes accept admin tokens', async () => {
    expect((await request(app).get('/api/admin/dashboard').set(auth(adminToken))).status).toBe(200);
  });

  test('payments cannot be recorded without an admin token', async () => {
    const res = await request(app).post('/api/payment/process').set(auth(studentToken)).send({});
    expect(res.status).toBe(403);
  });

  test('removed public routes are gone', async () => {
    expect((await request(app).get('/api/print-job/all')).status).toBe(404);
    expect((await request(app).get('/uploads/anything.pdf')).status).toBe(404);
    expect((await request(app).get('/api/files/anything.pdf')).status).toBe(404);
    expect((await request(app).post('/api/auth/register').send({ name: 'x' })).status).toBe(404);
  });
});

describe('logins', () => {
  test('stored passwords are hashed and plain text ones get migrated', async () => {
    await pool.query("INSERT INTO faculty (department_name, password) VALUES ('ECE', 'plain-text')");

    await initializeDatabase();

    const { rows } = await pool.query("SELECT password FROM faculty WHERE department_name = 'ECE'");
    expect(rows[0].password).toMatch(/^\$2/);

    const res = await request(app).post('/api/faculty-login')
      .send({ department_name: 'ECE', password: 'plain-text' });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(rows[0].password);
  });

  test('wrong passwords are rejected', async () => {
    const attempts = [
      request(app).post('/api/auth/login').send({ username: 'admin', password: 'wrong' }),
      request(app).post('/api/auth/student-login').send({ ...STUDENT, password: 'wrong' }),
      request(app).post('/api/faculty-login').send({ department_name: 'CSE', password: 'wrong' })
    ];
    for (const attempt of attempts) {
      expect((await attempt).status).toBe(401);
    }
  });

  test('a hash cannot be used as the password', async () => {
    const { rows } = await pool.query("SELECT password_hash FROM admin_users WHERE username = 'admin'");
    const res = await request(app).post('/api/auth/login')
      .send({ username: 'admin', password: rows[0].password_hash });
    expect(res.status).toBe(401);
  });
});

describe('creating print jobs', () => {
  test('requires a login', async () => {
    const res = await request(app).post('/api/print-job/create').attach('files', PDF, 'notes.pdf');
    expect(res.status).toBe(401);
  });

  test('saves the print options and uses the logged in identity', async () => {
    const res = await submitJob(studentToken, { spec: { rollNumber: 'SOMEONE-ELSE' } });
    expect(res.status).toBe(201);

    const { rows } = await pool.query('SELECT * FROM print_jobs WHERE id = $1', [firstDocument(res).id]);
    expect(rows[0]).toMatchObject({
      customer_name: STUDENT.registration_number,
      customer_email: `${STUDENT.registration_number.toLowerCase()}@example.edu`,
      quantity: 3,
      copies: 2,
      double_sided: true,
      selected_pages: [1, 3, 4],
      paper_size: 'A3',
      binding: 'Spiral',
      color_type: 'Color',
      original_filename: 'notes.pdf',
      order_number: res.body.data.orderNumber
    });
  });

  test('the price is calculated on the server', async () => {
    const res = await submitJob(studentToken, { spec: { totalPrice: 0.01 } });
    // (3 pages x Rs.2 for color + Rs.30 for spiral binding) x 2 copies
    expect(res.body.data.totalPrice).toBe(72);
  });

  test.each([
    ['None', false, 1, 3],
    ['Paper', false, 1, 13],
    ['Spiral', false, 1, 33],
    ['Paper', false, 3, 39],
    ['Spiral', true, 2, 72]
  ])('prices %s binding (color: %s, copies: %i)', async (bindingType, color, copies, expected) => {
    const res = await submitJob(studentToken, {
      spec: { bindingType, color, doubleSided: false, copies }
    });
    expect(res.body.data.totalPrice).toBe(expected);
  });

  test('each document in an order keeps its own specification and price', async () => {
    const res = await submitOrder(studentToken, [
      { filename: 'first.pdf', spec: { selectedPages: [1, 2], color: false, doubleSided: false, copies: 1, paperSize: 'A4', bindingType: 'None' } },
      { filename: 'second.pdf', spec: { selectedPages: [2], color: true, doubleSided: true, copies: 3, paperSize: 'A3', bindingType: 'Spiral' } },
      { filename: 'third.png', buffer: Buffer.from('89504e470d0a1a0a', 'hex'), spec: { selectedPages: [1], color: false, doubleSided: false, copies: 2, paperSize: 'A4', bindingType: 'Paper' } }
    ]);
    expect(res.status).toBe(201);

    // 2 x Rs.1 = 2, (1 x Rs.2 + Rs.30) x 3 = 96, (1 x Rs.1 + Rs.10) x 2 = 22
    expect(res.body.data.documents.map((document) => document.totalPrice)).toEqual([2, 96, 22]);
    expect(res.body.data.totalPrice).toBe(120);

    const { rows } = await pool.query('SELECT * FROM print_jobs WHERE order_number = $1 ORDER BY id', [res.body.data.orderNumber]);
    expect(rows.map((row) => [row.original_filename, row.quantity, row.copies, row.paper_size, row.binding, row.color_type, row.double_sided])).toEqual([
      ['first.pdf', 2, 1, 'A4', 'None', 'Black & White', false],
      ['second.pdf', 1, 3, 'A3', 'Spiral', 'Color', true],
      ['third.png', 1, 2, 'A4', 'Paper', 'Black & White', false]
    ]);
    expect(new Set(rows.map((row) => row.tracking_number)).size).toBe(3);
    expect(new Set(rows.map((row) => row.file_path)).size).toBe(3);
  });

  test('one bad file rejects the whole order and stores nothing', async () => {
    const countJobs = async () => (await pool.query('SELECT COUNT(*) FROM print_jobs')).rows[0].count;
    const jobsBefore = await countJobs();
    const filesBefore = fs.readdirSync(uploadsDir).length;

    const res = await submitOrder(studentToken, [
      { filename: 'good.pdf' },
      { filename: 'bad.pdf', buffer: Buffer.from('<script></script>') }
    ]);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('bad.pdf');
    expect(await countJobs()).toBe(jobsBefore);
    expect(fs.readdirSync(uploadsDir).length).toBe(filesBefore);
  });

  test('one bad specification rejects the whole order and names the file', async () => {
    const res = await submitOrder(studentToken, [
      { filename: 'good.pdf' },
      { filename: 'wrong.pdf', spec: { copies: 50 } }
    ]);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('wrong.pdf');
  });

  test('a failed save removes the files already stored', async () => {
    const filesBefore = fs.readdirSync(uploadsDir).length;
    const tooLong = `${'x'.repeat(300)}.pdf`;

    const res = await submitOrder(studentToken, [{ filename: 'good.pdf' }, { filename: tooLong }]);

    expect(res.status).toBe(500);
    expect(fs.readdirSync(uploadsDir).length).toBe(filesBefore);
  });

  test('every file needs a specification', async () => {
    const res = await request(app).post('/api/print-job/create').set(auth(studentToken))
      .field('documents', JSON.stringify([]))
      .attach('files', PDF, 'notes.pdf');
    expect(res.status).toBe(400);

    const malformed = await request(app).post('/api/print-job/create').set(auth(studentToken))
      .field('documents', 'not-json')
      .attach('files', PDF, 'notes.pdf');
    expect(malformed.status).toBe(400);
  });

  test('an order can have at most 10 documents', async () => {
    const res = await submitOrder(studentToken, Array.from({ length: 11 }, () => ({})));
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('at most 10');
  });

  test('department jobs are stored under the department', async () => {
    const res = await submitJob(departmentToken);
    expect(res.status).toBe(201);
    expect(res.body.data.customerName).toBe('CSE');
  });

  test('admins cannot submit orders', async () => {
    expect((await submitJob(adminToken)).status).toBe(403);
  });

  test.each([
    ['a disallowed extension', { filename: 'page.html', buffer: Buffer.from('<script></script>') }],
    ['a file renamed to pdf', { filename: 'page.pdf', buffer: Buffer.from('<script></script>') }]
  ])('rejects %s', async (name, overrides) => {
    const before = fs.readdirSync(uploadsDir).length;
    const res = await submitJob(studentToken, overrides);
    expect(res.status).toBe(400);
    expect(fs.readdirSync(uploadsDir).length).toBe(before);
  });

  test.each([
    ['too many copies', { copies: 11 }],
    ['no pages', { selectedPages: [] }],
    ['malformed pages', { selectedPages: 'not-a-list' }],
    ['repeated pages', { selectedPages: [1, 1] }],
    ['an unknown paper size', { paperSize: 'B5' }],
    ['an unknown binding', { bindingType: 'Staple' }]
  ])('rejects %s', async (name, spec) => {
    expect((await submitJob(studentToken, { spec })).status).toBe(400);
  });

  test('stored filenames ignore the name the client sent', async () => {
    const res = await submitJob(studentToken, { filename: '../../evil.pdf' });
    expect(res.status).toBe(201);
    const { rows } = await pool.query('SELECT file_path FROM print_jobs WHERE id = $1', [firstDocument(res).id]);
    expect(rows[0].file_path).not.toContain('evil');
    expect(path.basename(rows[0].file_path)).toBe(rows[0].file_path);
  });
});

describe('tracking', () => {
  let trackingNumber;

  beforeAll(async () => {
    trackingNumber = firstDocument(await submitJob(studentToken)).trackingNumber;
  });

  const myOrders = (token) => request(app).get('/api/tracking/mine').set(auth(token));

  test('the latest order comes first and its documents stay in the order they were added', async () => {
    const first = (await submitOrder(studentToken, [{ filename: 'a.pdf' }, { filename: 'b.pdf' }])).body.data;
    const second = (await submitJob(studentToken, { filename: 'c.pdf' })).body.data;
    await pool.query(
      "UPDATE print_jobs SET created_at = created_at - INTERVAL '1 hour' WHERE order_number = $1",
      [first.orderNumber]
    );

    const res = await myOrders(studentToken);
    const orders = res.body.orders.filter((order) => [first.orderNumber, second.orderNumber].includes(order.orderNumber));
    expect(orders.map((order) => order.fileName)).toEqual(['c.pdf', 'a.pdf', 'b.pdf']);
  });

  test('requires a login', async () => {
    expect((await request(app).get('/api/tracking/mine')).status).toBe(401);
    expect((await request(app).get(`/api/tracking/${trackingNumber}`)).status).toBe(401);
  });

  test('students can see their own jobs with the saved options', async () => {
    const res = await myOrders(studentToken);
    expect(res.status).toBe(200);
    const job = res.body.orders.find((order) => order.token === trackingNumber);
    expect(job).toMatchObject({ copies: 2, doubleSided: true, paperSize: 'A3', binding: 'Spiral', status: 'pending' });
  });

  test('students cannot see other students jobs', async () => {
    const mine = await myOrders(otherStudentToken);
    const byNumber = await request(app).get(`/api/tracking/${trackingNumber}`).set(auth(otherStudentToken));
    const byHistory = await request(app).get(`/api/tracking/${trackingNumber}/history`).set(auth(otherStudentToken));
    expect(mine.status).toBe(200);
    expect(mine.body.orders.map((order) => order.token)).not.toContain(trackingNumber);
    expect([byNumber.status, byHistory.status]).toEqual([404, 404]);
  });

  test('someone with no orders gets an empty list', async () => {
    const token = await registerStudent({ registration_number: '727624BCS003', password: 'student-pass-3' });
    const res = await myOrders(token);
    expect(res.status).toBe(200);
    expect(res.body.orders).toEqual([]);
  });

  test('departments see only their own jobs', async () => {
    await submitJob(departmentToken, { filename: 'memo.pdf' });
    const res = await myOrders(departmentToken);
    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBeGreaterThan(0);
    expect(res.body.orders.every((order) => order.rollNumber === 'CSE')).toBe(true);
  });

  test('admins have no orders of their own to list', async () => {
    expect((await myOrders(adminToken)).status).toBe(403);
  });
});

describe('cancelling', () => {
  const cancelUrl = (orderNumber) => `/api/print-job/order/${orderNumber}`;

  test('only the owner can cancel, and it cancels every document', async () => {
    const { orderNumber } = (await submitOrder(studentToken, [{}, {}])).body.data;

    const noToken = await request(app).delete(cancelUrl(orderNumber));
    expect(noToken.status).toBe(401);

    const other = await request(app).delete(cancelUrl(orderNumber)).set(auth(otherStudentToken));
    expect(other.status).toBe(404);

    const owner = await request(app).delete(cancelUrl(orderNumber)).set(auth(studentToken));
    expect(owner.status).toBe(200);

    const { rows } = await pool.query('SELECT status FROM print_jobs WHERE order_number = $1', [orderNumber]);
    expect(rows.map((row) => row.status)).toEqual(['cancelled', 'cancelled']);

    const again = await request(app).delete(cancelUrl(orderNumber)).set(auth(studentToken));
    expect(again.status).toBe(404);
  });

  test('an order cannot be cancelled after the time limit', async () => {
    const { orderNumber } = (await submitJob(studentToken)).body.data;
    await pool.query("UPDATE print_jobs SET created_at = created_at - INTERVAL '5 minutes' WHERE order_number = $1", [orderNumber]);

    const res = await request(app).delete(cancelUrl(orderNumber)).set(auth(studentToken));
    expect(res.status).toBe(400);
  });

  test('an order cannot be cancelled once printing has started', async () => {
    const { orderNumber, documents } = (await submitOrder(studentToken, [{}, {}])).body.data;
    await pool.query("UPDATE print_jobs SET status = 'processing' WHERE id = $1", [documents[0].id]);

    const res = await request(app).delete(cancelUrl(orderNumber)).set(auth(studentToken));
    expect(res.status).toBe(400);

    const { rows } = await pool.query('SELECT status FROM print_jobs WHERE id = $1', [documents[1].id]);
    expect(rows[0].status).toBe('pending');
  });
});

describe('admin job management', () => {
  let jobId;

  beforeAll(async () => {
    jobId = firstDocument(await submitJob(studentToken)).id;
  });

  test('the job list shows which order a document belongs to', async () => {
    const { orderNumber, documents } = (await submitOrder(studentToken, [{}, {}, {}])).body.data;

    const res = await request(app).get('/api/admin/print-jobs?page=1&limit=100').set(auth(adminToken));
    const second = res.body.data.jobs.find((item) => item.id === documents[1].id);
    expect(second.order_number).toBe(orderNumber);
    expect(Number(second.order_document_number)).toBe(2);
    expect(Number(second.order_document_count)).toBe(3);
  });

  test('each document in an order has its own file and status', async () => {
    const { documents } = (await submitOrder(studentToken, [
      { filename: 'one.pdf', buffer: Buffer.from('%PDF-1.4 one') },
      { filename: 'two.pdf', buffer: Buffer.from('%PDF-1.4 second') }
    ])).body.data;

    const readFile = (id) => request(app).get(`/api/admin/print-jobs/${id}/file`).set(auth(adminToken)).buffer(true).parse((r, cb) => {
      const chunks = [];
      r.on('data', (chunk) => chunks.push(chunk));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect((await readFile(documents[0].id)).body.toString()).toBe('%PDF-1.4 one');
    expect((await readFile(documents[1].id)).body.toString()).toBe('%PDF-1.4 second');

    await request(app).patch(`/api/admin/print-jobs/${documents[0].id}/status`).set(auth(adminToken)).send({ status: 'completed' });
    const { rows } = await pool.query('SELECT status FROM print_jobs WHERE id = $1', [documents[1].id]);
    expect(rows[0].status).toBe('pending');
  });

  test('the job list includes the print options', async () => {
    const res = await request(app).get('/api/admin/print-jobs?page=1&limit=100').set(auth(adminToken));
    const job = res.body.data.jobs.find((item) => item.id === jobId);
    expect(job).toMatchObject({ copies: 2, double_sided: true, paper_size: 'A3', binding: 'Spiral' });
  });

  test('the job list can be searched by register number', async () => {
    await submitJob(otherStudentToken);
    const search = async (text) => {
      const res = await request(app).get('/api/admin/print-jobs').query({ limit: 100, search: text }).set(auth(adminToken));
      expect(res.status).toBe(200);
      return res.body.data.jobs.map((job) => job.customer_name);
    };

    const exact = await search('727624bcs002');
    expect(exact.length).toBeGreaterThan(0);
    expect(exact.every((name) => name === OTHER_STUDENT.registration_number)).toBe(true);

    const partial = await search('BCS00');
    expect(partial).toEqual(expect.arrayContaining([STUDENT.registration_number, OTHER_STUDENT.registration_number]));

    expect(await search('%')).toEqual([]);
    expect(await search('_')).toEqual([]);
  });

  test('the search works together with the status filter', async () => {
    const res = await request(app).get('/api/admin/print-jobs')
      .query({ status: 'completed', search: STUDENT.registration_number }).set(auth(adminToken));
    expect(res.body.data.jobs.length).toBeGreaterThan(0);
    expect(res.body.data.jobs.every((job) => job.status === 'completed' && job.customer_name === STUDENT.registration_number)).toBe(true);
    expect(res.body.data.pagination.totalJobs).toBe(res.body.data.jobs.length);
  });

  test('bad pagination values do not cause errors', async () => {
    const res = await request(app).get('/api/admin/print-jobs?page=abc&limit=xyz').set(auth(adminToken));
    expect(res.status).toBe(200);
  });

  test('an invalid job id is rejected', async () => {
    expect((await request(app).get('/api/admin/print-jobs/abc').set(auth(adminToken))).status).toBe(400);
  });

  test('admins can fetch the file, others cannot', async () => {
    const asAdmin = await request(app).get(`/api/admin/print-jobs/${jobId}/file`).set(auth(adminToken));
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.headers['content-type']).toContain('application/pdf');

    const asStudent = await request(app).get(`/api/admin/print-jobs/${jobId}/file`).set(auth(studentToken));
    expect(asStudent.status).toBe(403);
  });

  test('a cancelled job file is restricted', async () => {
    const { id } = firstDocument(await submitJob(studentToken));
    await request(app).patch(`/api/admin/print-jobs/${id}/status`).set(auth(adminToken)).send({ status: 'cancelled' });

    const res = await request(app).get(`/api/admin/print-jobs/${id}/file`).set(auth(adminToken));
    expect(res.status).toBe(403);
  });

  test('status updates are validated', async () => {
    const url = `/api/admin/print-jobs/${jobId}/status`;
    expect((await request(app).patch(url).set(auth(adminToken)).send({ status: 'delivered' })).status).toBe(200);
    expect((await request(app).patch(url).set(auth(adminToken)).send({ status: 'nonsense' })).status).toBe(400);
  });
});

describe('file cleanup', () => {
  const finishJob = async (status, age) => {
    const { id } = firstDocument(await submitJob(studentToken));
    await pool.query(
      `UPDATE print_jobs SET status = $1, updated_at = CURRENT_TIMESTAMP - make_interval(days => $2) WHERE id = $3`,
      [status, age, id]
    );
    const { rows } = await pool.query('SELECT file_path FROM print_jobs WHERE id = $1', [id]);
    return { id, file: path.join(uploadsDir, rows[0].file_path) };
  };

  test('removes only the files of jobs finished long enough ago', async () => {
    const oldDone = await finishJob('completed', 10);
    const oldCancelled = await finishJob('cancelled', 10);
    const recentDone = await finishJob('completed', 1);
    const oldPending = await finishJob('pending', 10);

    await cleanupOldFiles(7);

    expect(fs.existsSync(oldDone.file)).toBe(false);
    expect(fs.existsSync(oldCancelled.file)).toBe(false);
    expect(fs.existsSync(recentDone.file)).toBe(true);
    expect(fs.existsSync(oldPending.file)).toBe(true);

    const { rows } = await pool.query('SELECT file_path FROM print_jobs WHERE id = $1', [oldDone.id]);
    expect(rows[0].file_path).toBeNull();
  });
});

describe('printing on the printers connected to this computer', () => {
  const printService = require('../services/printing/printService');
  const simulated = require('../services/printing/simulatedPrinter');

  const printers = () => request(app).get('/api/admin/printers').set(auth(adminToken));
  const print = (id, body = {}) => request(app).post(`/api/admin/print-jobs/${id}/print`).set(auth(adminToken)).send(body);
  const jobRow = async (id) => (await pool.query(
    'SELECT status, print_state, print_message, print_printer, print_attempt, print_pages_printed, print_total_pages FROM print_jobs WHERE id = $1',
    [id]
  )).rows[0];
  const events = async (trackingNumber) => (await request(app).get('/api/admin/print-events?limit=200').set(auth(adminToken)))
    .body.data.filter((e) => !trackingNumber || e.tracking_number === trackingNumber).reverse();
  const newJob = async (spec) => firstDocument(await submitJob(studentToken, { spec }));

  // Looks at the queue until the job finishes, like the background monitor does every 2 seconds
  const printUntilDone = async (id, seen = []) => {
    await printService.settle();
    for (let i = 0; i < 40; i++) {
      const row = await jobRow(id);
      if (seen[seen.length - 1] !== row.print_state) seen.push(row.print_state);
      if (['printed', 'error'].includes(row.print_state)) return seen;
      await printService.monitorTick();
    }
    throw new Error('The job never finished');
  };

  beforeEach(async () => {
    // A job still being handed to a printer would land in the next test's queue
    await printService.settle();
    printService.reset();
    simulated.reset();
    delete process.env.PRINTERS_SIMULATE_PAPER_OUT;
  });

  test('lists the printers with their state', async () => {
    const res = await printers();
    expect(res.status).toBe(200);
    expect(res.body.data.available).toBe(true);
    expect(res.body.data.printers).toEqual([
      { name: 'Simulated Laser', status: 'Normal', ok: true, statusText: 'Ready', isDefault: true, virtual: false, queued: 0 },
      { name: 'Simulated Colour Inkjet', status: 'Normal', ok: true, statusText: 'Ready', isDefault: false, virtual: false, queued: 0 }
    ]);
  });

  test('prints with the order\'s settings and follows the job to completion', async () => {
    const { id, trackingNumber } = await newJob({ selectedPages: [1, 3, 4], copies: 2, doubleSided: true, color: true, paperSize: 'A3' });

    const res = await print(id, { printer: 'Simulated Laser' });
    expect(res.status).toBe(202);
    expect(res.body.data).toEqual({ printer: 'Simulated Laser', pages: '1,3-4', copies: 2, doubleSided: true, color: true, paperSize: 'A3' });
    expect(await jobRow(id)).toMatchObject({ print_state: 'sending', print_printer: 'Simulated Laser', print_attempt: 1 });

    // Windows usually has the job in its queue by the first look
    expect(await printUntilDone(id)).toEqual(['printing', 'printed']);
    expect(await jobRow(id)).toMatchObject({ status: 'completed', print_state: 'printed', print_total_pages: 6 });

    const log = await events(trackingNumber);
    expect(log.map((e) => e.state)).toEqual(['sent', 'printing', 'printed']);
    expect(log[0].message).toBe('Sent to the printer: pages 1,3-4, 2 copies, both sides, colour, A3');
    expect(log.every((e) => e.printer === 'Simulated Laser' && e.print_job_id === id)).toBe(true);
  });

  test('the admin can change the settings before printing', async () => {
    const { id, trackingNumber } = await newJob({ selectedPages: [1, 3, 4], copies: 2, doubleSided: true, color: true, paperSize: 'A3' });
    const res = await print(id, { printer: 'Simulated Colour Inkjet', pages: '2 - 3', copies: 1, doubleSided: false, color: false, paperSize: 'A4' });
    expect(res.body.data).toEqual({ printer: 'Simulated Colour Inkjet', pages: '2-3', copies: 1, doubleSided: false, color: false, paperSize: 'A4' });
    await printUntilDone(id);
    expect((await jobRow(id)).print_total_pages).toBe(2);
    expect((await events(trackingNumber))[0].message).toBe('Sent to the printer: pages 2-3, 1 copy, one side, black and white, A4');

    // An empty page list prints the whole document
    const all = await newJob();
    expect((await print(all.id, { printer: 'Simulated Laser', pages: '' })).body.data.pages).toBe('');
  });

  test('a printer problem holds the job up, is logged, and printing carries on once fixed', async () => {
    process.env.PRINTERS_SIMULATE_PAPER_OUT = '2';
    const { id, trackingNumber } = await newJob({ selectedPages: [1, 2, 3], copies: 1 });
    await print(id, { printer: 'Simulated Laser' });

    const seen = [];
    let stalled;
    await printService.settle();
    for (let i = 0; i < 40 && !['printed', 'error'].includes(seen[seen.length - 1]); i++) {
      const row = await jobRow(id);
      if (seen[seen.length - 1] !== row.print_state) seen.push(row.print_state);
      if (row.print_state === 'stalled') {
        stalled = row;
        expect((await printers()).body.data.printers[0]).toMatchObject({ ok: false, statusText: 'Out of paper', queued: 1 });
      }
      await printService.monitorTick();
    }

    expect(seen).toEqual(['printing', 'stalled', 'printing', 'printed']);
    expect(stalled.print_message).toBe('Out of paper. Printing continues once it is fixed.');
    expect((await events(trackingNumber)).map((e) => e.state)).toEqual(['sent', 'printing', 'stalled', 'printing', 'printed']);

    const printerLog = (await events()).filter((e) => e.printer === 'Simulated Laser' && !e.tracking_number).map((e) => e.message);
    expect(printerLog.slice(-2)).toEqual(['Out of paper', 'Ready']);
  });

  test('a job can\'t be sent twice while printing, but can be printed again afterwards', async () => {
    const { id } = await newJob();
    expect((await print(id, { printer: 'Simulated Laser' })).status).toBe(202);
    expect((await print(id, { printer: 'Simulated Laser' })).status).toBe(409);
    await printUntilDone(id);
    expect((await print(id, { printer: 'Simulated Laser' })).status).toBe(202);
    expect((await jobRow(id)).print_attempt).toBe(2);
    await printUntilDone(id);
  });

  test('the order status is not moved backwards by the printer', async () => {
    const { id } = await newJob();
    await pool.query("UPDATE print_jobs SET status = 'delivered' WHERE id = $1", [id]);
    await print(id, { printer: 'Simulated Laser' });
    await printUntilDone(id);
    expect(await jobRow(id)).toMatchObject({ status: 'delivered', print_state: 'printed' });
  });

  test('bad print settings are refused', async () => {
    const { id } = await newJob();
    const refused = async (body, pattern) => {
      const res = await print(id, body);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(pattern);
    };
    await refused({ printer: 'No Such Printer' }, /Choose one of the printers/);
    await refused({ printer: 'Simulated Laser', pages: '5-2' }, /Pages must look like/);
    await refused({ printer: 'Simulated Laser', copies: 11 }, /Copies must be between 1 and 10/);
    await refused({ printer: 'Simulated Laser', copies: 1.5 }, /Copies/);
    await refused({ printer: 'Simulated Laser', paperSize: 'A5' }, /Paper size must be A4 or A3/);
    expect((await jobRow(id)).print_state).toBeNull();
  });

  test('cancelled jobs and Word documents are not printed', async () => {
    const cancelled = await newJob();
    await pool.query("UPDATE print_jobs SET status = 'cancelled' WHERE id = $1", [cancelled.id]);
    expect((await print(cancelled.id, { printer: 'Simulated Laser' })).status).toBe(403);

    const word = await newJob();
    await pool.query("UPDATE print_jobs SET file_path = regexp_replace(file_path, '\\.pdf$', '.docx') WHERE id = $1", [word.id]);
    const res = await print(word.id, { printer: 'Simulated Laser' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Word/);
  });

  test('jobs that were printing when the server stopped are marked as lost', async () => {
    const { id, trackingNumber } = await newJob();
    await pool.query("UPDATE print_jobs SET print_state = 'printing', print_printer = 'Simulated Laser' WHERE id = $1", [id]);
    await printService.recoverAfterRestart();
    expect(await jobRow(id)).toMatchObject({ print_state: 'error', print_message: expect.stringMatching(/server restarted/) });
    expect((await events(trackingNumber)).map((e) => e.state)).toEqual(['error']);
  });

  test('the job list includes the print progress', async () => {
    const { id } = await newJob();
    await print(id, { printer: 'Simulated Laser' });
    await printUntilDone(id);
    const res = await request(app).get('/api/admin/print-jobs?limit=100').set(auth(adminToken));
    expect(res.body.data.jobs.find((job) => job.id === id)).toMatchObject({ print_state: 'printed', print_printer: 'Simulated Laser' });
  });
});
