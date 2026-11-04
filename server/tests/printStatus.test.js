const {
  documentKey, pageRanges, normalizePageRanges, printOptions, isVirtualPrinter, describePrinter, describeJob
} = require('../services/printing/status');

test('page lists become ranges', () => {
  expect(pageRanges([1, 2, 3, 5, 7, 8])).toBe('1-3,5,7-8');
  expect(pageRanges([5, 1, 2, 2])).toBe('1-2,5');
  expect(pageRanges([4])).toBe('4');
  expect(pageRanges([])).toBe('');
  expect(pageRanges(null)).toBe('');
  expect(pageRanges([0, -1, 1.5, 2])).toBe('2');
});

test('typed page ranges are checked', () => {
  expect(normalizePageRanges('1-3, 5')).toBe('1-3,5');
  expect(normalizePageRanges(' 2 ')).toBe('2');
  expect(normalizePageRanges('3-1')).toBeNull();
  expect(normalizePageRanges('0-2')).toBeNull();
  expect(normalizePageRanges('1,,2')).toBeNull();
  expect(normalizePageRanges('1-2-3')).toBeNull();
  expect(normalizePageRanges('a')).toBeNull();
  expect(normalizePageRanges('')).toBeNull();
});

test('print options follow the settings', () => {
  expect(printOptions({ printer: 'Office Laser', pages: '1-2,4', copies: 3, doubleSided: true, color: false, paperSize: 'A4' })).toEqual({
    printer: 'Office Laser', silent: true, copies: 3, side: 'duplexlong', monochrome: true, pages: '1-2,4', paperSize: 'A4'
  });
  expect(printOptions({ printer: 'P', pages: '', copies: 0, doubleSided: false, color: true, paperSize: 'A3,landscape' }))
    .toEqual({ printer: 'P', silent: true, copies: 1, side: 'simplex', monochrome: false });
});

test('printers that save files instead of printing are recognised', () => {
  expect(isVirtualPrinter({ port: 'PORTPROMPT:', driver: 'Microsoft Print To PDF' })).toBe(true);
  expect(isVirtualPrinter({ port: 'nul:', driver: 'Send to Microsoft OneNote 16 Driver' })).toBe(true);
  expect(isVirtualPrinter({ port: 'Microsoft.Office.OneNoteVirtualPrinter_x:print-to-onenote', driver: 'Microsoft Virtual Print Class Driver' })).toBe(true);
  expect(isVirtualPrinter({ port: 'USB001', driver: 'HP LaserJet M110w' })).toBe(false);
  expect(isVirtualPrinter({ port: '192.168.1.20', driver: 'Canon Generic Plus PCL6' })).toBe(false);
});

test('printer problems and warnings are told apart', () => {
  expect(describePrinter('Normal')).toEqual({ ok: true, message: null });
  expect(describePrinter('PaperJam')).toEqual({ ok: false, message: 'Paper jam' });
  expect(describePrinter('TonerLow')).toEqual({ ok: true, message: 'Toner is low' });
  expect(describePrinter('TonerLow, PaperOut')).toEqual({ ok: false, message: 'Out of paper' });
  expect(describePrinter(undefined)).toEqual({ ok: true, message: null });
});

test('a job is followed from the queue to printed', () => {
  const tracked = {};
  const key = documentKey({ id: 7, attempt: 2 });
  expect(key).toBe('printdesk-7-2');

  let p = describeJob(tracked, { document: `${key}.pdf`, status: 'Spooling', pagesPrinted: 0, totalPages: 0 }, 'Normal');
  expect([p.state, p.message, p.done]).toEqual(['printing', 'Preparing the document for the printer', false]);

  p = describeJob(tracked, { status: 'Printing', pagesPrinted: 1, totalPages: 4 }, 'Normal');
  expect([p.state, p.message, p.pagesPrinted, p.totalPages]).toEqual(['printing', 'Printing page 2 of 4', 1, 4]);

  p = describeJob(tracked, { status: 'Printing', pagesPrinted: 1, totalPages: 4 }, 'TonerLow');
  expect(p.message).toBe('Printing page 2 of 4 (toner is low)');

  p = describeJob(tracked, undefined, 'Normal');
  expect([p.state, p.message, p.pagesPrinted, p.totalPages, p.done]).toEqual(['printed', 'Printed', 4, 4, true]);
});

test('printer problems hold a job up and clear when fixed', () => {
  const tracked = {};
  let p = describeJob(tracked, { status: 'Printing, Error', pagesPrinted: 2, totalPages: 5 }, 'PaperOut');
  expect([p.state, p.message, p.done]).toEqual(['stalled', 'Out of paper. Printing continues once it is fixed.', false]);

  p = describeJob(tracked, { status: 'Error', pagesPrinted: 2, totalPages: 5 }, 'Normal');
  expect(p.message).toBe('The printer reported an error. Printing continues once it is fixed.');

  expect(describeJob(tracked, { status: 'Paused' }, 'Normal').state).toBe('stalled');
  expect(describeJob(tracked, { status: 'Printing', pagesPrinted: 3, totalPages: 5 }, 'Normal').state).toBe('printing');
});

test('a job removed from the queue is a failure, not printed', () => {
  const tracked = {};
  const p = describeJob(tracked, { status: 'Deleting, Printing', pagesPrinted: 1, totalPages: 3 }, 'Normal');
  expect([p.state, p.done]).toEqual(['printing', false]);
  const gone = describeJob(tracked, undefined, 'Normal');
  expect([gone.state, gone.done]).toEqual(['error', true]);
});

test('a job never seen in the queue counts as printed after a couple of looks', () => {
  const tracked = {};
  expect(describeJob(tracked, undefined, 'Normal')).toMatchObject({ state: 'printing', done: false });
  expect(describeJob(tracked, undefined, 'Normal')).toMatchObject({ state: 'printed', done: true });
});

test('the queue saying printed finishes the job', () => {
  expect(describeJob({}, { status: 'Printed, Retained', pagesPrinted: 3, totalPages: 3 }, 'Normal')).toMatchObject({ state: 'printed', done: true });
});
