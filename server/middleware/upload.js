const multer = require('multer');
const path = require('path');

const DEFAULT_ALLOWED_TYPES = 'pdf,doc,docx,jpg,jpeg,png';
const DEFAULT_MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
// Keep in sync with MAX_DOCUMENTS in client-vite/src/context/PrintJobContext.jsx
const MAX_DOCUMENTS = 10;

// Leading bytes of each allowed format, so a renamed file can't pass the extension check
const FILE_SIGNATURES = {
  pdf: ['25504446'],
  png: ['89504e47'],
  jpg: ['ffd8ff'],
  jpeg: ['ffd8ff'],
  docx: ['504b0304'],
  doc: ['d0cf11e0']
};

const getFileExtension = (filename) => path.extname(filename).toLowerCase().substring(1);

const getAllowedTypes = () => (process.env.ALLOWED_FILE_TYPES || DEFAULT_ALLOWED_TYPES)
  .split(',')
  .map((type) => type.trim().toLowerCase());

const matchesSignature = (file) => {
  const signatures = FILE_SIGNATURES[getFileExtension(file.originalname)];
  if (!signatures) {
    return false;
  }
  const header = file.buffer.subarray(0, 8).toString('hex');
  return signatures.some((signature) => header.startsWith(signature));
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || DEFAULT_MAX_FILE_SIZE
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = getAllowedTypes();
    if (allowedTypes.includes(getFileExtension(file.originalname))) {
      cb(null, true);
    } else {
      const error = new Error(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
      error.status = 400;
      cb(error);
    }
  }
});

// Accepts the files in the "files" field and rejects anything that isn't what it claims to be
const uploadDocuments = (req, res, next) => {
  upload.array('files', MAX_DOCUMENTS)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File is too large.' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: `You can upload at most ${MAX_DOCUMENTS} documents at a time.` });
      }
      return res.status(err.status || 400).json({ error: err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one file is required' });
    }

    const mismatch = req.files.find((file) => !matchesSignature(file));
    if (mismatch) {
      return res.status(400).json({ error: `The content of ${mismatch.originalname} does not match its file type.` });
    }

    next();
  });
};

module.exports = { uploadDocuments };
