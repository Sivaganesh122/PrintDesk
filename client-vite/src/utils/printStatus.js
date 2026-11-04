// Shared wording for printing on the printers connected to the server's computer.

// print_state values while a job is on its way to or through a printer. "stalled" means held
// up by the printer, for example out of paper; it carries on once fixed.
export const ACTIVE_PRINT_STATES = ['sending', 'printing', 'stalled'];

export const PRINT_STATE_LABELS = {
  sending: 'Sending',
  sent: 'Sent',
  printing: 'Printing',
  stalled: 'Printer needs attention',
  printed: 'Printed',
  error: 'Failed',
  'printer-problem': 'Printer problem',
  'printer-ready': 'Printer ready'
};

// [1, 2, 3, 5] -> "1-3, 5"
export const pageRangesText = (pages) => {
  const sorted = [...new Set((pages || []).filter((p) => Number.isInteger(p) && p > 0))].sort((a, b) => a - b);
  const ranges = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    while (sorted[i + 1] === sorted[i] + 1) i++;
    ranges.push(start === sorted[i] ? `${start}` : `${start}-${sorted[i]}`);
  }
  return ranges.join(', ');
};
