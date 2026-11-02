import React, { createContext, useContext, useRef, useState } from 'react';
import { toast } from 'react-toastify';

const PrintJobContext = createContext();

export const usePrintJob = () => {
  const context = useContext(PrintJobContext);
  if (!context) {
    throw new Error('usePrintJob must be used within a PrintJobProvider');
  }
  return context;
};

// Pricing constants, for display. The server calculates the final price (routes/printJob.js).
const PRICING = {
  BW_PRICE: 1,
  COLOR_PRICE: 2,
  BINDING_PRICE_PER_COPY: { None: 0, Spiral: 30, Paper: 10 }
};

// Keep in sync with MAX_DOCUMENTS in server/middleware/upload.js
const MAX_DOCUMENTS = 10;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB in bytes
const ALLOWED_TYPES = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'];

const calculateDocumentPrice = ({ selectedPages, printOptions, bindingType }) => {
  const { color, copies } = printOptions;
  const pageCount = selectedPages.length * copies;
  const pagesCost = pageCount * (color ? PRICING.COLOR_PRICE : PRICING.BW_PRICE);
  const bindingCost = PRICING.BINDING_PRICE_PER_COPY[bindingType] * copies;

  return {
    bwPages: color ? 0 : pageCount,
    colorPages: color ? pageCount : 0,
    pagesCost,
    bindingCost,
    total: pagesCost + bindingCost
  };
};

export const PrintJobProvider = ({ children }) => {
  // Each document has its own file, preview, page selection and print specification
  const [documents, setDocuments] = useState([]);
  const nextDocumentId = useRef(1);

  // Shows why a file can't be added and returns false
  const validateFile = (file) => {
    const fileExtension = file.name.split('.').pop().toLowerCase();

    if (!ALLOWED_TYPES.includes(fileExtension)) {
      toast.error(`${file.name}: invalid file type. Please upload PDF, DOC, DOCX, JPG, JPEG, or PNG files.`);
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error(`${file.name}: file too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 25MB.`);
      return false;
    }

    return true;
  };

  // All pages start selected. Files are only sent to the server when the order is submitted.
  const addDocument = (file, previewPages) => {
    const document = {
      id: nextDocumentId.current++,
      file,
      previewPages,
      selectedPages: previewPages.map((page) => page.id),
      printOptions: { color: false, doubleSided: false, copies: 1 },
      paperSize: 'A4',
      bindingType: 'None'
    };
    setDocuments((prev) => [...prev, document]);
  };

  const removeDocument = (id) => {
    setDocuments((prev) => prev.filter((document) => document.id !== id));
  };

  const updateDocument = (id, changes) => {
    setDocuments((prev) => prev.map((document) => (
      document.id === id ? { ...document, ...changes } : document
    )));
  };

  const clearDocuments = () => {
    setDocuments([]);
  };

  const value = {
    documents,
    PRICING,
    MAX_DOCUMENTS,
    calculateDocumentPrice,
    validateFile,
    addDocument,
    removeDocument,
    updateDocument,
    clearDocuments
  };

  return (
    <PrintJobContext.Provider value={value}>
      {children}
    </PrintJobContext.Provider>
  );
};
