// Pretend printers for trying printing without real ones (PRINTERS_SIMULATE=1). Each look at
// the queue prints one more page of the first job on each printer. With
// PRINTERS_SIMULATE_PAPER_OUT=N a printer runs out of paper on page N once, and paper is
// "loaded" again a few looks later.
const fs = require('fs').promises;
const path = require('path');

const PAPER_OUT_LOOKS = 3;

const printers = [
  { name: 'Simulated Laser', isDefault: true },
  { name: 'Simulated Colour Inkjet', isDefault: false }
].map((p) => ({ ...p, status: 'Normal', queue: [], paperOutLooks: 0, paperOutUsed: false }));

// A rough page count that is good enough for pretending; images are one page
const countPages = async (file) => {
  if (!file.toLowerCase().endsWith('.pdf')) return 1;
  const text = (await fs.readFile(file)).toString('latin1');
  return Math.max((text.match(/\/Type\s*\/Page(?!s)/g) || []).length, 1);
};

const rangeLength = (ranges) => ranges.split(',').reduce((sum, range) => {
  const [start, end = start] = range.split('-').map(Number);
  return sum + end - start + 1;
}, 0);

const find = (name) => {
  const printer = printers.find((p) => p.name === name);
  if (!printer) throw new Error(`No printer named ${name}`);
  return printer;
};

const printFile = async (file, options) => {
  const printer = find(options.printer);
  const pages = options.pages ? rangeLength(options.pages) : await countPages(file);
  printer.queue.push({ document: path.basename(file), totalPages: pages * (options.copies || 1), pagesPrinted: 0, options });
};

const advance = (printer) => {
  const job = printer.queue[0];
  if (!job) return;
  const paperOutAt = parseInt(process.env.PRINTERS_SIMULATE_PAPER_OUT, 10) || 0;
  if (printer.paperOutLooks > 0) {
    printer.paperOutLooks--;
    if (printer.paperOutLooks === 0) printer.status = 'Normal';
  } else if (paperOutAt && !printer.paperOutUsed && job.pagesPrinted + 1 === paperOutAt) {
    printer.paperOutUsed = true;
    printer.paperOutLooks = PAPER_OUT_LOOKS;
    printer.status = 'PaperOut';
  } else {
    job.pagesPrinted++;
    if (job.pagesPrinted >= job.totalPages) printer.queue.shift();
  }
};

const snapshot = async () => {
  printers.forEach(advance);
  return {
    printers: printers.map((p) => ({ name: p.name, status: p.status, isDefault: p.isDefault, port: 'SIMULATED', driver: 'PrintDesk simulated printer' })),
    jobs: printers.flatMap((p) => p.queue.map((j, i) => ({
      printer: p.name,
      document: j.document,
      status: i === 0 ? (p.status === 'Normal' ? 'Printing' : 'Error, Printing') : 'Normal',
      pagesPrinted: j.pagesPrinted,
      totalPages: j.totalPages
    })))
  };
};

const removeJobs = async (printerName, documentPrefix) => {
  const printer = find(printerName);
  printer.queue = printer.queue.filter((j) => !j.document.includes(documentPrefix));
};

// Lets tests start from empty queues
const reset = () => printers.forEach((p) => Object.assign(p, { status: 'Normal', queue: [], paperOutLooks: 0, paperOutUsed: false }));

module.exports = { snapshot, removeJobs, printFile, reset };
