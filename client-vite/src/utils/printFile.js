// Prepares a job's file for the browser's print dialog. Web pages can't fill in the print
// dialog (checked with Chrome and Edge on Windows), so the file itself is made to match the
// order, and the dialog can be left on Pages: All and Copies: 1:
//   - only the pages the student chose are kept
//   - those pages are repeated once per copy. For double-sided orders with an odd number of
//     pages, a blank page ends each copy so the next copy starts on a fresh sheet.
// Single/double-sided and colour are printer settings that no file can carry; the admin
// checks those in the dialog against the job card.

// Page sizes in PDF points (1/72 inch)
const PAPER_SIZES = {
  A4: [595.28, 841.89],
  A3: [841.89, 1190.55]
};

// Matches the most copies a student can order
const MAX_COPIES = 10;

// Places an image in the middle of a page of the order's paper size, as large as fits
const addImagePage = (pdf, image, paperSize) => {
  const [width, height] = PAPER_SIZES[paperSize] || PAPER_SIZES.A4;
  const landscape = image.width > image.height;
  const [pageWidth, pageHeight] = landscape ? [height, width] : [width, height];
  const margin = 18;
  const scale = Math.min((pageWidth - margin * 2) / image.width, (pageHeight - margin * 2) / image.height, 1);
  const page = pdf.addPage([pageWidth, pageHeight]);
  page.drawImage(image, {
    x: (pageWidth - image.width * scale) / 2,
    y: (pageHeight - image.height * scale) / 2,
    width: image.width * scale,
    height: image.height * scale
  });
  return page;
};

export const copyCount = (job) => Math.min(Math.max(parseInt(job.copies, 10) || 1, 1), MAX_COPIES);

// Returns a PDF blob ready to print. selected_pages counts from 1; pages that don't exist are skipped.
export const buildPrintFile = async (fileBlob, job, extension) => {
  const { PDFDocument, Duplex, PrintScaling } = await import('pdf-lib');
  const bytes = new Uint8Array(await fileBlob.arrayBuffer());
  const pdf = await PDFDocument.create();
  const copies = copyCount(job);

  // Adds one copy of the job and returns the size of its last page
  let addCopy;
  if (extension === 'pdf') {
    const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const all = source.getPageIndices();
    const chosen = (job.selected_pages || []).map((p) => p - 1).filter((i) => all.includes(i));
    const indices = chosen.length ? chosen : all;
    addCopy = async () => {
      const pages = await pdf.copyPages(source, indices);
      pages.forEach((page) => pdf.addPage(page));
      return pages[pages.length - 1].getSize();
    };
  } else {
    const image = extension === 'png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    addCopy = async () => addImagePage(pdf, image, job.paper_size).getSize();
  }

  for (let copy = 1; copy <= copies; copy++) {
    const { width, height } = await addCopy();
    if (job.double_sided && copy < copies && pdf.getPageCount() % 2 === 1) {
      pdf.addPage([width, height]);
    }
  }

  const preferences = pdf.catalog.getOrCreateViewerPreferences();
  preferences.setDuplex(job.double_sided ? Duplex.DuplexFlipLongEdge : Duplex.Simplex);
  // Print at actual size rather than letting the dialog shrink pages to fit
  preferences.setPrintScaling(PrintScaling.None);

  return new Blob([await pdf.save()], { type: 'application/pdf' });
};
