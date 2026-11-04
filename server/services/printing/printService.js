const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { pool } = require('../../config/db');
const { uploadsDir } = require('../../config/localStorage');
const { logger } = require('../../utils/logger');
const {
  documentKey, jobPrefix, pageRanges, normalizePageRanges, printOptions, isVirtualPrinter, describePrinter, describeJob
} = require('./status');

// Prints jobs on the printers connected to the computer this server runs on, and follows
// them through the Windows print queue. A job's print_state moves through:
//   sending  - the admin pressed Print and the file is being handed to Windows
//   printing - it is in the Windows print queue
//   stalled  - still in the queue but held up, for example out of paper; it carries on once fixed
//   printed  - it left the print queue after printing
//   error    - it failed or was removed from the queue; print_message says what
// Every change is also written to print_events, which the admin page shows as the printer activity log.

const ACTIVE_STATES = ['sending', 'printing', 'stalled'];
const PRINTABLE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];
const PAPER_SIZES = ['A4', 'A3'];
const MAX_COPIES = 10;
// How old the printer list may be when the admin page asks for it
const SNAPSHOT_MAX_AGE_MS = 2000;
const WORK_DIR = path.join(os.tmpdir(), 'printdesk-printing');

const printerBackend = () => {
  if (process.env.PRINTERS_SIMULATE === '1') return require('./simulatedPrinter');
  if (process.platform === 'win32') return require('./windowsPrinter');
  return null;
};

// Jobs handed to Windows and not finished yet, by document key
const tracked = new Map();
let lastSnapshot = { printers: [], jobs: [] };
let lastSnapshotAt = 0;
let snapshotInFlight = null;
const lastPrinterStatus = new Map();
let monitorTimer = null;
let monitorBusy = false;

const logEvent = async ({ jobId = null, trackingNumber = null, printer = null, state, message }) => {
  try {
    await pool.query(
      'INSERT INTO print_events (print_job_id, tracking_number, printer, state, message) VALUES ($1, $2, $3, $4, $5)',
      [jobId, trackingNumber, printer, state, String(message || '').slice(0, 500)]
    );
  } catch (error) {
    logger.error('Could not record a printer event:', error);
  }
};

// Notes when a printer changes state, for example runs out of paper or comes back
const logPrinterChanges = async (printers) => {
  for (const printer of printers) {
    const previous = lastPrinterStatus.get(printer.name);
    lastPrinterStatus.set(printer.name, printer.status);
    if (previous === undefined || previous === printer.status) continue;
    const now = describePrinter(printer.status);
    await logEvent({
      printer: printer.name,
      state: now.ok ? 'printer-ready' : 'printer-problem',
      message: now.ok ? `Ready${now.message ? ` (${now.message.toLowerCase()})` : ''}` : now.message
    });
  }
};

const refreshSnapshot = async () => {
  const backend = printerBackend();
  if (!backend) return lastSnapshot;
  // Several callers at once share one look at the queue
  if (!snapshotInFlight) {
    snapshotInFlight = backend.snapshot()
      .then(async (result) => {
        lastSnapshot = result;
        lastSnapshotAt = Date.now();
        await logPrinterChanges(result.printers);
        return result;
      })
      .finally(() => { snapshotInFlight = null; });
  }
  return snapshotInFlight;
};

// The printers on this computer with their state and how many jobs are waiting on each
const getPrinters = async () => {
  if (!printerBackend()) {
    return { available: false, reason: 'Printing from PrintDesk works when the server runs on Windows.', printers: [] };
  }
  if (Date.now() - lastSnapshotAt > SNAPSHOT_MAX_AGE_MS) await refreshSnapshot();
  return {
    available: true,
    printers: lastSnapshot.printers.map((p) => {
      const state = describePrinter(p.status);
      const virtual = isVirtualPrinter(p);
      return {
        name: p.name,
        status: p.status,
        ok: state.ok,
        statusText: state.ok ? (state.message ? `Ready (${state.message.toLowerCase()})` : 'Ready') : state.message,
        isDefault: p.isDefault === true,
        virtual,
        queued: lastSnapshot.jobs.filter((j) => j.printer === p.name).length
      };
    })
  };
};

const startMonitor = () => {
  const interval = parseInt(process.env.PRINT_MONITOR_MS, 10);
  if (monitorTimer || interval === 0) return;
  monitorTimer = setInterval(() => { monitorTick().catch((error) => logger.error('Print monitor failed:', error)); }, interval || 2000);
  monitorTimer.unref();
};

const stopMonitor = () => {
  clearInterval(monitorTimer);
  monitorTimer = null;
};

const stopTracking = async (key) => {
  const entry = tracked.get(key);
  tracked.delete(key);
  if (entry?.file) await fs.rm(entry.file, { force: true });
  if (!tracked.size) stopMonitor();
};

// Saves a job's progress. Updates about an older attempt are ignored. The order status follows
// the printer, but never overrides a later status the admin set.
const saveProgress = async (entry, progress) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE print_jobs
       SET print_state = $3, print_message = $4, print_pages_printed = $5, print_total_pages = $6,
           print_updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND print_attempt = $2
       RETURNING status`,
      [entry.jobId, entry.attempt, progress.state, progress.message, progress.pagesPrinted ?? null, progress.totalPages ?? null]
    );
    if (updated.rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }
    if (progress.state === 'printing' || progress.state === 'stalled') {
      await client.query("UPDATE print_jobs SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'pending'", [entry.jobId]);
    } else if (progress.state === 'printed') {
      await client.query("UPDATE print_jobs SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status IN ('pending', 'processing')", [entry.jobId]);
    }
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Looks at the print queue and records what changed for each job being followed
const monitorTick = async () => {
  if (monitorBusy || !tracked.size) return;
  monitorBusy = true;
  try {
    await refreshSnapshot();
    for (const [key, entry] of tracked) {
      if (!entry.sent) continue;
      const printerStatus = lastSnapshot.printers.find((p) => p.name === entry.printer)?.status;
      const queued = lastSnapshot.jobs.find((j) => j.printer === entry.printer && String(j.document || '').includes(key));
      const progress = describeJob(entry.state, queued, printerStatus);
      const summary = JSON.stringify([progress.state, progress.message, progress.pagesPrinted, progress.totalPages]);
      let current = true;
      if (summary !== entry.lastSummary) {
        current = await saveProgress(entry, progress);
        // Page-by-page progress goes on the job card; the log gets changes of state or message
        const logged = `${progress.state}|${progress.state === 'printing' && progress.totalPages ? 'pages' : progress.message}`;
        if (current && logged !== entry.lastLogged) {
          await logEvent({ jobId: entry.jobId, trackingNumber: entry.trackingNumber, printer: entry.printer, state: progress.state, message: progress.message });
          entry.lastLogged = logged;
        }
        entry.lastSummary = summary;
      }
      if (progress.done || !current) await stopTracking(key);
    }
  } finally {
    monitorBusy = false;
  }
};

const failAttempt = async (entry, message) => {
  await saveProgress(entry, { state: 'error', message });
  await logEvent({ jobId: entry.jobId, trackingNumber: entry.trackingNumber, printer: entry.printer, state: 'error', message });
};

// Hands the file to Windows in the background, then the monitor follows it
const sendToPrinter = async (entry, sourcePath, settings) => {
  const backend = printerBackend();
  try {
    for (const [key, other] of tracked) {
      if (other.jobId === entry.jobId && key !== entry.key) await stopTracking(key);
    }
    await backend.removeJobs(settings.printer, jobPrefix(entry.jobId));
    await fs.mkdir(WORK_DIR, { recursive: true });
    // The file name becomes the document name in the Windows print queue, which is how the job is found there
    entry.file = path.join(WORK_DIR, `${entry.key}${path.extname(sourcePath).toLowerCase()}`);
    await fs.copyFile(sourcePath, entry.file);
    await backend.printFile(entry.file, printOptions(settings));
    entry.sent = true;
    await logEvent({
      jobId: entry.jobId,
      trackingNumber: entry.trackingNumber,
      printer: settings.printer,
      state: 'sent',
      message: `Sent to the printer: pages ${settings.pages || 'all'}, ${settings.copies} ${settings.copies > 1 ? 'copies' : 'copy'}, ${settings.doubleSided ? 'both sides' : 'one side'}, ${settings.color ? 'colour' : 'black and white'}, ${settings.paperSize}`
    });
    await monitorTick();
  } catch (error) {
    logger.error('Could not send a job to the printer:', error);
    await stopTracking(entry.key);
    await failAttempt(entry, `Could not send the job to the printer: ${error.message}`.slice(0, 500));
  }
};

const fail = (status, error) => ({ status, error });

// Checks the admin's print settings, filling gaps from the order
const readSettings = (job, body, printers) => {
  const printer = printers.find((p) => p.name === body.printer);
  if (!printer) return fail(400, 'Choose one of the printers connected to this computer.');
  if (printer.virtual) return fail(400, `${printer.name} saves a file instead of printing on paper, so it can't be used from PrintDesk.`);

  let pages = '';
  if (body.pages !== undefined && String(body.pages).trim() !== '') {
    pages = normalizePageRanges(body.pages);
    if (!pages) return fail(400, 'Pages must look like 1-3, 5 (page numbers from 1, ranges going upwards).');
  } else if (body.pages === undefined) {
    pages = pageRanges(job.selected_pages);
  }

  const copies = body.copies === undefined ? job.copies || 1 : Number(body.copies);
  if (!Number.isInteger(copies) || copies < 1 || copies > MAX_COPIES) return fail(400, `Copies must be between 1 and ${MAX_COPIES}.`);

  const paperSize = body.paperSize === undefined ? job.paper_size : body.paperSize;
  if (!PAPER_SIZES.includes(paperSize)) return fail(400, `Paper size must be ${PAPER_SIZES.join(' or ')}.`);

  return {
    settings: {
      printer: printer.name,
      pages,
      copies,
      doubleSided: body.doubleSided === undefined ? job.double_sided === true : body.doubleSided === true,
      color: body.color === undefined ? job.color_type === 'Color' : body.color === true,
      paperSize
    }
  };
};

// Starts printing a job. Returns { status, error } when it can't be printed.
const printJob = async (id, body = {}) => {
  const { rows } = await pool.query(
    `SELECT id, tracking_number, status, file_path, selected_pages, copies, double_sided, color_type, paper_size, print_state
     FROM print_jobs WHERE id = $1`,
    [id]
  );
  const job = rows[0];
  if (!job) return fail(404, 'Print job not found');
  if (job.status === 'cancelled') return fail(403, 'Cancelled jobs cannot be printed.');
  if (!job.file_path) return fail(404, 'No file associated with this print job');
  if (!PRINTABLE_EXTENSIONS.includes(path.extname(job.file_path).slice(1).toLowerCase())) {
    return fail(400, 'Word documents cannot be printed from PrintDesk. Download the file and print it from Word.');
  }
  if (ACTIVE_STATES.includes(job.print_state)) return fail(409, 'This job is already being printed.');

  const sourcePath = path.join(uploadsDir, path.basename(job.file_path));
  try {
    await fs.access(sourcePath);
  } catch {
    return fail(404, 'File not found');
  }

  const { printers, available, reason } = await getPrinters();
  if (!available) return fail(503, reason);
  const { settings, status, error } = readSettings(job, body, printers);
  if (error) return fail(status, error);

  const { rows: [started] } = await pool.query(
    `UPDATE print_jobs
     SET print_state = 'sending', print_message = $2, print_attempt = print_attempt + 1, print_printer = $3,
         print_pages_printed = NULL, print_total_pages = NULL, print_updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING print_attempt`,
    [id, `Sending to ${settings.printer}`, settings.printer]
  );

  const entry = { jobId: job.id, attempt: started.print_attempt, trackingNumber: job.tracking_number, printer: settings.printer, state: {}, sent: false };
  entry.key = documentKey({ id: job.id, attempt: entry.attempt });
  tracked.set(entry.key, entry);
  startMonitor();
  // Handing the file over can take a few seconds, so the admin page follows it instead of waiting
  entry.sending = sendToPrinter(entry, sourcePath, settings);
  return { status: 202, settings };
};

const listEvents = async (limit = 50) => {
  const { rows } = await pool.query(
    'SELECT id, print_job_id, tracking_number, printer, state, message, created_at FROM print_events ORDER BY id DESC LIMIT $1',
    [Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200)]
  );
  return rows;
};

// Jobs that were printing when the server stopped can't be followed any more
const recoverAfterRestart = async () => {
  const { rows } = await pool.query(
    `UPDATE print_jobs
     SET print_state = 'error',
         print_message = 'The server restarted while this job was printing. Check the printer before printing it again.',
         print_updated_at = CURRENT_TIMESTAMP
     WHERE print_state = ANY($1::text[])
     RETURNING id, tracking_number, print_printer`,
    [ACTIVE_STATES]
  );
  for (const row of rows) {
    await logEvent({ jobId: row.id, trackingNumber: row.tracking_number, printer: row.print_printer, state: 'error', message: 'Lost track of this job because the server restarted' });
  }
  await pool.query("DELETE FROM print_events WHERE created_at < CURRENT_TIMESTAMP - interval '30 days'");
};

// For tests: waits for jobs being handed over, and starts again from nothing
const settle = () => Promise.all([...tracked.values()].map((entry) => entry.sending));
const reset = () => {
  stopMonitor();
  tracked.clear();
  lastPrinterStatus.clear();
  lastSnapshot = { printers: [], jobs: [] };
  lastSnapshotAt = 0;
};

module.exports = { getPrinters, printJob, listEvents, recoverAfterRestart, monitorTick, settle, reset };
