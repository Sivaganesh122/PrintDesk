// Turns print settings into printer commands, and Windows printer and print queue states into
// what the admin sees. Kept free of side effects so it can be tested without a printer.

// The document name each job gets in the Windows print queue. The attempt number keeps
// a reprint apart from an earlier copy that may still be in the queue.
const documentKey = (job) => `printdesk-${job.id}-${job.attempt}`;
const jobPrefix = (id) => `printdesk-${id}-`;

// [1, 2, 3, 5, 7, 8] -> "1-3,5,7-8"
const pageRanges = (pages) => {
  const sorted = [...new Set((pages || []).filter((p) => Number.isInteger(p) && p > 0))].sort((a, b) => a - b);
  const ranges = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    while (sorted[i + 1] === sorted[i] + 1) i++;
    ranges.push(start === sorted[i] ? `${start}` : `${start}-${sorted[i]}`);
  }
  return ranges.join(',');
};

// "1-3, 5" -> "1-3,5". Returns null for anything else, including ranges that run backwards.
const normalizePageRanges = (text) => {
  const cleaned = String(text || '').replace(/\s+/g, '');
  if (!/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(cleaned) || cleaned.length > 500) return null;
  const valid = cleaned.split(',').every((range) => {
    const [start, end = start] = range.split('-').map(Number);
    return start >= 1 && end >= start;
  });
  return valid ? cleaned : null;
};

// Settings for pdf-to-printer, which passes them to SumatraPDF.
// settings: { printer, pages ("1-3,5" or empty for all), copies, doubleSided, color, paperSize }
const printOptions = (settings) => {
  const options = {
    printer: settings.printer,
    silent: true,
    copies: Math.min(Math.max(parseInt(settings.copies, 10) || 1, 1), 100),
    side: settings.doubleSided ? 'duplexlong' : 'simplex',
    monochrome: !settings.color
  };
  if (settings.pages) options.pages = settings.pages;
  if (/^[A-Za-z0-9]{1,10}$/.test(settings.paperSize || '')) options.paperSize = settings.paperSize;
  return options;
};

// Printers that save to a file or an app instead of printing on paper. Printing to them from
// the server would open a save window on this computer's screen, so they can't be used.
const isVirtualPrinter = ({ port, driver }) => (
  /^(PORTPROMPT:|nul:|FILE:|SHRFAX:)$/i.test(port || '')
  || /onenote/i.test(port || '')
  || /OneNote|Print To PDF|XPS|Fax|Virtual Print/i.test(driver || '')
);

// Windows printer states that stop printing, and what to tell the admin
const PRINTER_PROBLEMS = {
  PaperJam: 'Paper jam',
  PaperOut: 'Out of paper',
  PaperProblem: 'Paper problem',
  ManualFeed: 'Waiting for paper in the manual feed tray',
  NoToner: 'Out of toner',
  DoorOpen: 'A printer door is open',
  OutputBinFull: 'The output tray is full',
  Offline: 'The printer is offline',
  NotAvailable: 'The printer is not available',
  Paused: 'The printer is paused in Windows',
  OutOfMemory: 'The printer is out of memory',
  UserIntervention: 'The printer needs attention',
  PagePunt: 'The printer could not print a page',
  ServerUnknown: 'The print server cannot be reached',
  Error: 'The printer reported an error'
};
const PRINTER_WARNINGS = { TonerLow: 'Toner is low' };

const flags = (status) => String(status || '').split(',').map((s) => s.trim()).filter(Boolean);

// Problems first, then warnings; null when the printer is fine
const describePrinter = (status) => {
  const all = flags(status);
  const problem = all.find((f) => PRINTER_PROBLEMS[f]);
  if (problem) return { ok: false, message: PRINTER_PROBLEMS[problem] };
  const warning = all.find((f) => PRINTER_WARNINGS[f]);
  if (warning) return { ok: true, message: PRINTER_WARNINGS[warning] };
  return { ok: true, message: null };
};

const JOB_PROBLEMS = {
  PaperOut: 'Out of paper',
  Offline: 'The printer is offline',
  Blocked: 'The job is blocked in the Windows print queue',
  UserIntervention: 'The printer needs attention',
  Paused: 'The job is paused in the Windows print queue',
  Error: 'The printer reported an error'
};

// How long a job may be missing from the queue, without ever being seen, before it counts as printed.
// Fast printers can take a small job before the agent first looks.
const UNSEEN_POLLS_BEFORE_PRINTED = 2;

const counts = (entry) => ({
  pagesPrinted: Number.isInteger(entry?.pagesPrinted) ? entry.pagesPrinted : null,
  totalPages: Number.isInteger(entry?.totalPages) && entry.totalPages > 0 ? entry.totalPages : null
});

// Works out a tracked job's state from the latest look at the print queue:
//   printing - in the queue and moving
//   stalled  - in the queue but held up by the printer; it carries on once that is fixed
//   printed  - finished
//   error    - removed from the queue before it finished
// tracked: { seen, deleting, unseenPolls, lastCounts } kept between looks; it is updated here.
// Returns { state, message, pagesPrinted, totalPages, done } where done means stop tracking.
const describeJob = (tracked, entry, printerStatus) => {
  if (entry) {
    tracked.seen = true;
    const jobFlags = flags(entry.status);
    const { pagesPrinted, totalPages } = counts(entry);
    tracked.lastCounts = { pagesPrinted, totalPages };

    if (jobFlags.includes('Printed') || jobFlags.includes('Complete')) {
      return { state: 'printed', message: 'Printed', pagesPrinted: totalPages || pagesPrinted, totalPages, done: true };
    }
    if (jobFlags.includes('Deleting') || jobFlags.includes('Deleted')) {
      // Reported once it has left the queue, so the job is never marked failed while still there
      tracked.deleting = true;
      return { state: 'printing', message: 'Being removed from the Windows print queue', pagesPrinted, totalPages, done: false };
    }

    const printer = describePrinter(printerStatus);
    const jobProblem = jobFlags.find((f) => JOB_PROBLEMS[f]);
    if (!printer.ok || jobProblem) {
      // The printer's own reason is usually more specific than the job's
      const message = printer.ok ? JOB_PROBLEMS[jobProblem] : printer.message;
      return { state: 'stalled', message: `${message}. Printing continues once it is fixed.`, pagesPrinted, totalPages, done: false };
    }

    let message = 'Waiting in the print queue';
    if (jobFlags.includes('Printing')) {
      message = totalPages ? `Printing page ${Math.min((pagesPrinted || 0) + 1, totalPages)} of ${totalPages}` : 'Printing';
    } else if (jobFlags.includes('Spooling')) {
      message = 'Preparing the document for the printer';
    }
    if (printer.message) message += ` (${printer.message.toLowerCase()})`;
    return { state: 'printing', message, pagesPrinted, totalPages, done: false };
  }

  // No longer in the queue
  const last = tracked.lastCounts || {};
  if (tracked.deleting) {
    return { state: 'error', message: 'Removed from the Windows print queue before it finished', ...last, done: true };
  }
  if (tracked.seen) {
    return { state: 'printed', message: 'Printed', pagesPrinted: last.totalPages || last.pagesPrinted || null, totalPages: last.totalPages || null, done: true };
  }
  tracked.unseenPolls = (tracked.unseenPolls || 0) + 1;
  if (tracked.unseenPolls >= UNSEEN_POLLS_BEFORE_PRINTED) {
    return { state: 'printed', message: 'Sent to the printer. It left the print queue straight away.', pagesPrinted: null, totalPages: null, done: true };
  }
  return { state: 'printing', message: 'Sending to the printer', pagesPrinted: null, totalPages: null, done: false };
};

module.exports = {
  documentKey,
  jobPrefix,
  pageRanges,
  normalizePageRanges,
  printOptions,
  isVirtualPrinter,
  describePrinter,
  describeJob
};
