import React, { useState, useEffect, useRef } from "react";
import {
  Container,
  Row,
  Col,
  Form,
  Button,
  Alert,
  ProgressBar,
} from "react-bootstrap";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { usePrintJob } from "../context/PrintJobContext";
import { useAuth } from "../context/AuthContext";
import { apiService } from "../services/api";
import { toast } from "react-toastify";
import {
  FaPrint,
  FaEye,
  FaCheck,
  FaChevronRight,
  FaChevronLeft,
  FaTimes,
} from "react-icons/fa";
import { convertDocxToPreview, convertDocToPreview } from "../utils/documentConverter";
import niaLogo from "./nialogo.jpeg";
import uploadIllustration from "./file.png";
import { motion, AnimatePresence } from "framer-motion";

const ANIMATION = {
  section: { initial: { opacity: 0, y: 25 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 30 }, transition: { duration: 0.65, ease: [0.23, 1, 0.32, 1] } },
  previewItem: { initial: { opacity: 0, scale: 0.98 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.96 }, transition: { duration: 0.37 } },
};

function AnimatedBackground() {
  return (
    <div
      style={{
        position: "fixed",
        zIndex: 0,
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        overflow: "hidden",
        background:
          "radial-gradient(ellipse at 60% 10%, #fff8e67a 35%, transparent 73%), linear-gradient(120deg, #f6efe0 65%, #e7ce97 98%)",
        transition: "background 2.2s cubic-bezier(0.23,1,0.32,1)",
      }}
      aria-hidden
    >
      <svg
        width="100%"
        height="100%"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          mixBlendMode: "overlay",
          opacity: 0.17,
          zIndex: 1,
        }}
      >
        <defs>
          <pattern
            id="grid"
            width="64"
            height="64"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 64 0 L 0 0 0 64"
              fill="none"
              stroke="#e8d4a478"
              strokeWidth="1.1"
            />
          </pattern>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="url(#grid)"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          zIndex: 2,
          pointerEvents: "none",
        }}
      >
        {[...Array(14)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: Math.random() * 480 }}
            animate={{
              opacity: [0, 0.48, 0.44, 0],
              y: [
                Math.random() * 100 + 40,
                `-${Math.random() * 12 + 60}%`,
                `-${Math.random() * 25 + 80}%`,
                `-${Math.random() * 140 + 100}%`,
              ],
            }}
            transition={{
              repeat: Infinity,
              duration: Math.random() * 12 + 10,
              delay: Math.random() * 3,
              ease: "linear",
            }}
            style={{
              position: "absolute",
              left: `${Math.random() * 100}%`,
              width: Math.random() * 2 + 1.2,
              height: Math.random() * 18 + 5,
              borderRadius: 22,
              background: "linear-gradient(50deg,#e2bb697e 9%,#fffbe85b 87%)",
              filter: "blur(0.6px)",
              pointerEvents: "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// PDF.js is large, so it is only downloaded when someone adds a PDF
const loadPdfJs = async () => {
  const [pdfjsLib, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjsLib;
};

const PrintJob = ({ isDepartment = false }) => {
  const navigate = useNavigate();
  const {
    documents,
    PRICING,
    MAX_DOCUMENTS,
    calculateDocumentPrice,
    validateFile,
    addDocument,
    removeDocument,
    updateDocument,
    clearDocuments,
  } = usePrintJob();

  const [step, setStep] = useState(0);
  const stepCount = 3;

  const { user } = useAuth();
  // The server stores the job under the logged in identity, so this is display only
  const rollNumber = (isDepartment ? localStorage.getItem("faculty_department") : user?.registration_number) || "";
  const [loading, setLoading] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState(null);

  // Steps 2 and 3 edit one document at a time, chosen with the document selector
  const activeDocument = documents.find((document) => document.id === activeDocumentId) || documents[0];
  const previewPages = activeDocument?.previewPages || [];
  const selectedPages = activeDocument?.selectedPages || [];
  const printOptions = activeDocument?.printOptions || { color: false, doubleSided: false, copies: 1 };
  const paperSize = activeDocument?.paperSize || "A4";
  const bindingType = activeDocument?.bindingType || "None";
  const showPreview = previewPages.length > 0;

  const updateActiveDocument = (changes) => updateDocument(activeDocument.id, changes);
  const updatePrintOptions = (changes) => updateActiveDocument({ printOptions: { ...printOptions, ...changes } });
  const setPaperSize = (value) => updateActiveDocument({ paperSize: value });
  const setBindingType = (value) => updateActiveDocument({ bindingType: value });
  const selectAllPages = () => updateActiveDocument({ selectedPages: previewPages.map((page) => page.id) });
  const clearAllSelections = () => updateActiveDocument({ selectedPages: [] });
  const togglePageSelection = (pageId) => updateActiveDocument({
    selectedPages: selectedPages.includes(pageId)
      ? selectedPages.filter((page) => page !== pageId)
      : [...selectedPages, pageId].sort((a, b) => a - b),
  });

  const [pageRange, setPageRange] = useState({ from: "", to: "" });
  const [pageRangeError, setPageRangeError] = useState("");

  // A range typed for one document doesn't carry over to the next
  useEffect(() => {
    setPageRange({ from: "", to: "" });
    setPageRangeError("");
  }, [activeDocument?.id]);

  // Replaces the selection. Single pages can still be clicked to add or remove them afterwards.
  const applyPageRange = () => {
    const from = Number(pageRange.from);
    const to = Number(pageRange.to);
    const lastPage = previewPages.length;

    if (pageRange.from === "" || pageRange.to === "") {
      setPageRangeError("Enter both a From and a To page.");
    } else if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > lastPage) {
      setPageRangeError(`Enter page numbers from 1 to ${lastPage}.`);
    } else if (from > to) {
      setPageRangeError("The From page can't be after the To page.");
    } else {
      setPageRangeError("");
      updateActiveDocument({
        selectedPages: previewPages
          .filter((page) => page.pageNumber >= from && page.pageNumber <= to)
          .map((page) => page.id),
      });
    }
  };

  const handlePageRangeKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyPageRange();
    }
  };

  const pricing = calculateDocumentPrice({ selectedPages, printOptions, bindingType });
  const bindingCost = pricing.bindingCost;
  const estimatedTotal = pricing.total;
  const orderTotal = documents.reduce((sum, document) => sum + calculateDocumentPrice(document).total, 0);
  const documentsWithoutPages = documents.filter((document) => document.selectedPages.length === 0);
  const orderIsReady = documents.length > 0 && documentsWithoutPages.length === 0 && !!rollNumber.trim();

  const stepRef = useRef();

  // Documents are not kept after leaving this page or submitting the order
  useEffect(() => clearDocuments, []);

  const placeholderPage = (text, type) => ({
    id: 0,
    thumbnail: `https://via.placeholder.com/150x200/6c757d/ffffff?text=${text}`,
    pageNumber: 1,
    selected: false,
    type,
  });

  const generatePdfPreview = async (file) => {
    try {
      const pdfjsLib = await loadPdfJs();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pages = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 0.41 });
          const canvas = document.createElement("canvas");
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
          pages.push({
            id: i - 1,
            thumbnail: canvas.toDataURL(),
            pageNumber: i,
            selected: false,
            type: "pdf",
          });
        } catch (pageError) {
          console.error(`Error rendering page ${i}:`, pageError);
          // Add a placeholder for failed pages
          pages.push({
            id: i - 1,
            thumbnail: `https://via.placeholder.com/150x200/6c757d/ffffff?text=Page+${i}`,
            pageNumber: i,
            selected: false,
            type: "pdf",
          });
        }
      }

      if (pages.length === 0) {
        throw new Error('No pages could be rendered');
      }
      return pages;
    } catch (error) {
      // Without the real page count the price and page selection would be wrong, so the file isn't added
      console.error('PDF preview error:', error);
      toast.error(`${file.name}: this PDF could not be read, so it was not added. If it has a password, remove it and try again.`);
      return [];
    }
  };

  const generateDocumentPreview = async (file, extension) => {
    const result = extension === "docx" ? await convertDocxToPreview(file) : await convertDocToPreview(file);
    if (!result.success) {
      toast.error(result.error);
      return [];
    }
    return result.pages;
  };

  const generatePreviewPages = async (file) => {
    const extension = file.name.split('.').pop().toLowerCase();
    try {
      if (extension === 'pdf') {
        return await generatePdfPreview(file);
      }
      if (['docx', 'doc'].includes(extension)) {
        return await generateDocumentPreview(file, extension);
      }
      return [{ ...placeholderPage("Image", "image"), thumbnail: URL.createObjectURL(file) }];
    } catch (previewError) {
      console.error('Preview generation error:', previewError);
      toast.error(`${file.name}: this file could not be read, so it was not added.`);
      return [];
    }
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    // Clear the input so the same file can be chosen again, such as to print it with other settings
    e.target.value = '';

    setLoading(true);
    try {
      let documentCount = documents.length;
      for (const file of files) {
        if (documentCount >= MAX_DOCUMENTS) {
          toast.error(`You can upload at most ${MAX_DOCUMENTS} documents at a time.`);
          break;
        }
        if (!validateFile(file)) {
          continue;
        }
        const pages = await generatePreviewPages(file);
        if (pages.length > 0) {
          addDocument(file, pages);
          documentCount++;
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // ---- VALIDATION LOGIC for step navigation & submission ----
  const canNext = () => {
    if (loading) return false;
    if (step === 0) return documents.length > 0 && !!rollNumber.trim();
    if (step === 1) return documentsWithoutPages.length === 0;
    return true;
  };

  const handleNext = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (canNext()) {
      // Each step starts on the first document
      setActiveDocumentId(documents[0].id);
      setStep((prev) => Math.min(stepCount - 1, prev + 1));
    }
  };

  const handleSubmit = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Only allow submission on the final step (Step 3)
    if (step !== stepCount - 1) {
      return;
    }

    if (!orderIsReady) {
      toast.error("Please complete all fields");
      return;
    }
    setLoading(true);
    try {
      // The files and the specifications are matched by their position in these two lists
      const formData = new FormData();
      documents.forEach((document) => formData.append('files', document.file));
      formData.append('documents', JSON.stringify(documents.map((document) => ({
        // Page numbers are sent counting from 1
        selectedPages: document.selectedPages.map((page) => page + 1),
        color: document.printOptions.color,
        doubleSided: document.printOptions.doubleSided,
        copies: document.printOptions.copies,
        paperSize: document.paperSize,
        bindingType: document.bindingType,
      }))));

      const authToken = localStorage.getItem(isDepartment ? 'faculty_token' : 'studentToken');
      const { data: result } = await apiService.createPrintJob(formData, authToken);

      navigate(isDepartment ? "/thank-you2" : "/thank-you", { state: { orderData: result.data } });
    } catch (error) {
      console.error('Error creating print job:', error);
      toast.error(error.response?.data?.error || error.message || "Failed to create print job");
    } finally {
      setLoading(false);
    }
  };

  const documentSelector = documents.length > 1 && (
    <div className="d-flex flex-wrap mb-3" style={{ gap: "0.4rem" }} role="group" aria-label="Choose a document">
      {documents.map((document, index) => {
        const isActive = document.id === activeDocument?.id;
        const needsPages = document.selectedPages.length === 0;
        return (
          <Button
            key={document.id}
            type="button"
            size="sm"
            variant={isActive ? "primary" : needsPages ? "outline-danger" : "outline-secondary"}
            aria-pressed={isActive}
            title={document.file.name}
            onClick={() => setActiveDocumentId(document.id)}
            style={{ borderRadius: 10, maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {index + 1}. {document.file.name}
          </Button>
        );
      })}
    </div>
  );

  return (
    <>
      <Helmet>
        <title> Academic Printing</title>
        <style>{`
          body {
            font-family: 'Inter', 'Poppins', sans-serif;
            background: #f9f5e9;
          }
        `}</style>
      </Helmet>
      <AnimatedBackground />
      <div style={{ height: "74px", minHeight: "5vw" }} />
      <Container
        fluid
        className="d-flex justify-content-center align-items-stretch"
        style={{
          maxWidth: 1330,
          minHeight: "75vh",
          position: "relative",
          zIndex: 2,
        }}
      >
        <Row
          className="flex-lg-nowrap w-100 justify-content-center"
          style={{
            gap: "2.5vw",
            width: "100%",
            margin: "0 auto",
          }}
        >
         <Col
  xs={12}
  lg={6}
  className="d-flex flex-column justify-content-center align-items-center"
  style={{ 
    minWidth: 0, 
    minHeight: 430,
    marginTop: "35px", 
  }}
>
            <motion.div
              className="w-100"
              style={{
                maxWidth: 510,
                minWidth: 0,
                margin: "0 auto 0px auto",
                background:
                  "linear-gradient(118deg, #fcfaef 85%, #f2e6c7 110%)",
                boxShadow: "0 8px 48px 0 rgba(214,181,125,0.14)",
                borderRadius: "2.2rem",
                backdropFilter: "blur(2.0px)",
                border: "1.6px solid #e6d9bc55",
                padding: "2.6rem 1.6rem 2.1rem 1.6rem",
                position: "relative",
                zIndex: 2,
              }}
              initial={{ opacity: 0, x: -60 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05, duration: 0.82 }}
              ref={stepRef}
              tabIndex={0}
            >
              <div className="text-center">
                <img
                  src={niaLogo}
                  alt="NIA Logo"
                  style={{
                    width: 59,
                    background: "#fffef7cc",
                    borderRadius: 27,
                    marginBottom: 10,
                    marginTop: -12,
                    boxShadow: "0 2px 14px 0 rgba(180,156,77,0.09)",
                  }}
                />
              </div>
              <ProgressBar
                className="mb-4"
                animated
                now={((step + 1) / stepCount) * 100}
                style={{
                  height: "7.5px",
                  borderRadius: 6,
                  background: "#e1c892",
                  boxShadow: "0 3px 14px #dbc47e22",
                }}
                variant="warning"
              />
              <div className="mb-5 d-flex justify-content-between align-items-center px-2">
                <div style={{ fontWeight: 700, fontSize: 19, letterSpacing: 0.3 }}>
                  <FaPrint style={{ color: "#bc9c61", marginRight: 7, fontSize: 18 }} />
                   Academic Printing
                </div>
                <div>
                  <span
                    style={{
                      fontWeight: 600,
                      color: "#cbb279",
                      fontSize: 16,
                      letterSpacing: 0.3,
                    }}
                  >
                    Step {step + 1} / {stepCount}
                  </span>
                </div>
              </div>
              <Form onSubmit={(e) => e.preventDefault()} autoComplete="on">
                <AnimatePresence mode="wait">
                  {step === 0 && (
                    <motion.div {...ANIMATION.section} key="step1" className="mb-4">
                      <div className="text-center mb-4">
                        <img
                          src={uploadIllustration}
                          alt="Upload Doc"
                          style={{
                            width: 105,
                            background: "#fcf9e2",
                            borderRadius: "21px",
                            boxShadow: "0 8px 20px #e6d2a522",
                          }}
                        />
                      </div>
                      <Form.Group className="mb-4">
                        <Form.Label className="fw-semibold">
                          {isDepartment ? "Department" : "Roll Number"}
                        </Form.Label>
                        <Form.Control
                          value={rollNumber}
                          readOnly
                          required
                          spellCheck="false"
                          style={{
                            borderRadius: 14,
                            border: "1.5px solid #d2ba88bb",
                            fontSize: "1.16rem",
                            background: "#fffbe9",
                            fontWeight: 500,
                          }}
                        />
                      </Form.Group>

                      <Form.Group>
                        <Form.Label className="fw-semibold">
                          Select Files (.pdf, .docx, .jpg, .png)
                        </Form.Label>
                        <Form.Control
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={handleFileChange}
                          disabled={loading || documents.length >= MAX_DOCUMENTS}
                          style={{
                            borderRadius: 13,
                            background: "#f7ecd6",
                          }}
                        />
                        <Form.Text className="text-muted">
                          Supported: PDF, DOCX, JPG, PNG. Up to {MAX_DOCUMENTS} documents. You can choose separate settings for each one in the next steps.
                        </Form.Text>
                      </Form.Group>
                      {loading && (
                        <Alert variant="info" className="mt-3 mb-1">
                          Reading your documents...
                        </Alert>
                      )}
                      {documents.length > 0 && (
                        <div className="mt-3">
                          <div className="fw-semibold mb-2">
                            {documents.length} {documents.length === 1 ? "document" : "documents"} added
                          </div>
                          {documents.map((document, index) => (
                            <Alert
                              key={document.id}
                              variant="success"
                              className="d-flex align-items-center justify-content-between py-2 px-3 mb-2"
                            >
                              <span style={{ minWidth: 0, overflowWrap: "anywhere", marginRight: 10 }}>
                                {index + 1}. <b>{document.file.name}</b> ({document.previewPages.length} {document.previewPages.length === 1 ? "page" : "pages"})
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline-danger"
                                aria-label={`Remove ${document.file.name}`}
                                onClick={() => removeDocument(document.id)}
                              >
                                <FaTimes />
                              </Button>
                            </Alert>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                  {step === 1 && (
                    <motion.div {...ANIMATION.section} key="step2-pages" className="mb-2">
                      <div
                        className="mb-2 fw-semibold"
                        style={{ color: "#bfa353", letterSpacing: "0.1em", fontSize: "1.18em" }}
                      >
                        <FaEye className="me-2" /> Select Pages
                      </div>
                      {documentSelector}
                      {documentsWithoutPages.length > 0 && (
                        <Alert variant="warning" className="py-2 px-3 mb-2">
                          Select at least one page in: {documentsWithoutPages.map((document) => document.file.name).join(", ")}
                        </Alert>
                      )}
                      {showPreview && (
                        <div style={{ minHeight: 140 }}>
                          <div className="d-flex mb-1 align-items-center">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline-primary"
                              className="me-2"
                              onClick={() => selectAllPages(previewPages.length)}
                              tabIndex={0}
                            >
                              Select All
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline-secondary"
                              onClick={clearAllSelections}
                              tabIndex={0}
                            >
                              Clear
                            </Button>
                            <span
                              className="ms-auto"
                              style={{
                                color: "#bca672",
                                fontSize: 15,
                                fontWeight: 600,
                              }}
                            >
                              {selectedPages.length} page(s) selected
                            </span>
                          </div>
                          <div className="d-flex flex-wrap align-items-center mt-2" style={{ gap: "0.5rem" }}>
                            <span style={{ fontWeight: 600, fontSize: 15 }}>Select a range:</span>
                            <Form.Control
                              type="number"
                              size="sm"
                              min="1"
                              max={previewPages.length}
                              placeholder="From"
                              aria-label="From page"
                              value={pageRange.from}
                              onChange={(e) => setPageRange({ ...pageRange, from: e.target.value })}
                              onKeyDown={handlePageRangeKeyDown}
                              style={{ width: 80 }}
                            />
                            <Form.Control
                              type="number"
                              size="sm"
                              min="1"
                              max={previewPages.length}
                              placeholder="To"
                              aria-label="To page"
                              value={pageRange.to}
                              onChange={(e) => setPageRange({ ...pageRange, to: e.target.value })}
                              onKeyDown={handlePageRangeKeyDown}
                              style={{ width: 80 }}
                            />
                            <Button type="button" size="sm" variant="outline-primary" onClick={applyPageRange}>
                              Apply
                            </Button>
                            <span style={{ color: "#bca672", fontSize: 14 }}>of {previewPages.length} pages</span>
                          </div>
                          {pageRangeError && (
                            <div role="alert" className="small mt-1" style={{ color: "#bf1b1b" }}>
                              {pageRangeError}
                            </div>
                          )}
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit,minmax(89px,1fr))",
                              gap: "1.2em 0.55em",
                              background: "#f8eee1c7",
                              borderRadius: 17,
                              boxShadow: "0 2px 16px #e7c37d19",
                              padding: "17px 8px 7px 8px",
                              marginTop: 7,
                            }}
                          >
                            <AnimatePresence>
                              {previewPages.map((page) => (
                                <motion.div
                                  key={page.id}
                                  {...ANIMATION.previewItem}
                                  whileHover={{ scale: 1.045, boxShadow: "0 7px 29px #d6b57d2b" }}
                                  className={`page-thumbnail position-relative`}
                                  style={{
                                    userSelect: "none",
                                    padding: "7px 2px 34px 2px",
                                    borderRadius: 14,
                                    background: "#fffdfa",
                                    border:
                                      selectedPages.includes(page.id)
                                        ? "2px solid #d4a76a"
                                        : "1.6px solid #f3e4c2",
                                    boxShadow: selectedPages.includes(page.id)
                                      ? "0 9px 27px #e0b96a2a"
                                      : "0 3px 19px #e0d3a51e",
                                    transition: "all 0.22s cubic-bezier(0.44,1.15,0.46,1)",
                                    cursor: "pointer",
                                  }}
                                  tabIndex={0}
                                  role="button"
                                  aria-pressed={selectedPages.includes(page.id)}
                                  onClick={() => togglePageSelection(page.id)}
                                  onKeyDown={(e) => {
                                    if (["Enter", " "].includes(e.key))
                                      togglePageSelection(page.id);
                                  }}
                                >
                                  <img
                                    src={page.thumbnail}
                                    alt={`Page ${page.pageNumber}`}
                                    style={{
                                      width: "100%",
                                      borderRadius: 7,
                                      background: "#ece4ce",
                                      objectFit: "contain",
                                      minHeight: 69,
                                      maxHeight: 114,
                                    }}
                                  />
                                  <div className="text-center small mt-1 mb-2" style={{ fontWeight: 500 }}>Page {page.pageNumber}</div>
                                  <Button
                                    type="button"
                                    variant={
                                      selectedPages.includes(page.id)
                                        ? "primary"
                                        : "outline-primary"
                                    }
                                    size="sm"
                                    className="select-btn"
                                    style={{
                                      position: "absolute",
                                      left: 9,
                                      right: 9,
                                      bottom: 7,
                                      borderRadius: 10,
                                      padding: "2px 0",
                                      fontSize: "0.96em",
                                      boxShadow: "0 1px 5px #dac47b16",
                                      zIndex: 6,
                                    }}
                                    tabIndex={-1}
                                  >
                                    {selectedPages.includes(page.id) ? (
                                      <FaCheck size={12} />
                                    ) : (
                                      "Select"
                                    )}
                                  </Button>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                  {step === 2 && (
                    <motion.div {...ANIMATION.section} key="step3-options" className="mb-4">
                      <div
                        className="mb-3 fw-semibold"
                        style={{ color: "#bfa353", letterSpacing: "0.05em", fontSize: "1.15em" }}
                      >
                        <FaPrint className="me-2" /> Printing Specifications
                      </div>
                      {documentSelector}
                      {documents.length > 1 && (
                        <div className="mb-3 small text-muted" style={{ overflowWrap: "anywhere" }}>
                          These settings apply only to <b>{activeDocument?.file.name}</b>.
                        </div>
                      )}
                      <Form.Group className="mb-3">
                        <Form.Check
                          type="switch"
                          id="colorSwitch"
                          label="Color Print (₹2/page vs ₹1/page B&W)"
                          checked={printOptions.color}
                          onChange={(e) =>
                            updatePrintOptions({ color: e.target.checked })
                          }
                          className="mb-2"
                        />
                        <Form.Check
                          type="switch"
                          id="doubleSwitch"
                          label="Double-sided"
                          checked={printOptions.doubleSided}
                          onChange={(e) =>
                            updatePrintOptions({ doubleSided: e.target.checked })
                          }
                          className="mb-2"
                        />
                      </Form.Group>

                      <Form.Group className="mb-4">
                        <Form.Label className="fw-semibold">Paper Size</Form.Label>
                        <Form.Select
                          value={paperSize}
                          onChange={(e) => setPaperSize(e.target.value)}
                          required
                          style={{
                            borderRadius: 14,
                            border: "1.5px solid #d2ba88bb",
                            fontSize: "1.16rem",
                            background: "#fffbe9",
                            fontWeight: 500,
                          }}
                        >
                          <option value="A4">A4</option>
                          <option value="A3">A3</option>
                        </Form.Select>
                      </Form.Group>

                      <Form.Group className="mb-4">
                        <Form.Label className="fw-semibold">Binding Type</Form.Label>
                        <Form.Select
                          value={bindingType}
                          onChange={(e) => setBindingType(e.target.value)}
                          required
                          style={{
                            borderRadius: 14,
                            border: "1.5px solid #d2ba88bb",
                            fontSize: "1.16rem",
                            background: "#fffbe9",
                            fontWeight: 500,
                          }}
                        >
                          <option value="None">None</option>
                          <option value="Spiral">Spiral Binding (₹{PRICING.BINDING_PRICE_PER_COPY.Spiral}/copy)</option>
                          <option value="Paper">Paper Binding (₹{PRICING.BINDING_PRICE_PER_COPY.Paper}/copy)</option>
                        </Form.Select>
                      </Form.Group>

                      <Form.Group>
                        <Form.Label className="fw-semibold">Number of Copies</Form.Label>
                        <Form.Control
                          type="number"
                          min="1"
                          max="10"
                          value={printOptions.copies}
                          onChange={(e) =>
                            updatePrintOptions({ copies: Math.min(10, Math.max(1, Math.floor(+e.target.value) || 1)) })
                          }
                          style={{
                            width: 110,
                            borderRadius: 13,
                            border: "1.5px solid #e6d3a9c4",
                            background: "#fff7e0",
                            fontWeight: 500,
                          }}
                        />
                      </Form.Group>
                      <AnimatePresence>
                        {(pricing.total > 0 || selectedPages.length > 0) && (
                          <motion.div {...ANIMATION.section} className="mt-4" key="pricing">
                            <Alert
                              variant="info"
                              className="py-3 px-3 shadow-none"
                              style={{
                                background: "#fff4dcc0",
                                color: "#9a865d",
                                border: "1.5px solid #ecd5a3",
                                borderRadius: "14px",
                                textAlign: "center",
                              }}
                            >
                              <div style={{ fontSize: "0.95rem", color: "#8a754b", marginBottom: "4px" }}>
                                {documents.length > 1 ? 'Estimated Cost of This Document' : 'Estimated Total Cost'} ({selectedPages.length} pages × {printOptions.copies} {printOptions.copies > 1 ? 'copies' : 'copy'})
                              </div>
                              <span
                                style={{
                                  fontWeight: "bold",
                                  fontSize: "1.65rem",
                                  color: "#b88a3b",
                                }}
                              >
                                ₹{estimatedTotal.toFixed(2)}
                              </span>
                              <br />
                              <span style={{ fontSize: "0.95em", fontWeight: 500 }}>
                                {printOptions.color ? `Color: ${pricing.colorPages} pages` : `B&W: ${pricing.bwPages} pages`} | {paperSize || 'A4'} | {bindingType || 'None'} Binding{bindingCost > 0 && ` (₹${bindingCost.toFixed(2)})`}
                              </span>
                              {documents.length > 1 && (
                                <div className="mt-3 pt-3" style={{ borderTop: "1px solid #ecd5a3", textAlign: "left" }}>
                                  <div className="fw-semibold mb-1" style={{ color: "#8a754b" }}>Order Summary</div>
                                  {documents.map((document, index) => (
                                    <div key={document.id} className="d-flex justify-content-between" style={{ fontSize: "0.92em", gap: 12 }}>
                                      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{index + 1}. {document.file.name}</span>
                                      <span>₹{calculateDocumentPrice(document).total.toFixed(2)}</span>
                                    </div>
                                  ))}
                                  <div className="d-flex justify-content-between mt-2" style={{ fontWeight: "bold", color: "#b88a3b", fontSize: "1.15rem" }}>
                                    <span>Order Total ({documents.length} documents)</span>
                                    <span>₹{orderTotal.toFixed(2)}</span>
                                  </div>
                                </div>
                              )}
                            </Alert>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Wizard navigation */}
                <div className="d-flex align-items-center mt-4 justify-content-between">
                  <Button
                    key="btn-back"
                    type="button"
                    variant="outline-secondary"
                    size="md"
                    disabled={step === 0}
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                    className="px-4 py-2"
                    style={{ borderRadius: 13, fontWeight: 600, opacity: step === 0 ? 0.66 : 1 }}
                  >
                    <FaChevronLeft className="me-1" />
                    Back
                  </Button>
                  {step < stepCount - 1 ? (
                    <Button
                      key="btn-next"
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={handleNext}
                      className="px-4 py-2"
                      style={{ borderRadius: 13, fontWeight: 600, boxShadow: "0 7px 20px #dab66a20" }}
                      disabled={!canNext()}
                    >
                      Next
                      <FaChevronRight className="ms-1" />
                    </Button>
                  ) : (
                    <Button
                      key="btn-submit"
                      type="button"
                      onClick={handleSubmit}
                      size="lg"
                      style={{
                        minWidth: 145,
                        fontWeight: 700,
                        letterSpacing: "0.32px",
                        borderRadius: 14,
                        boxShadow: "0 10px 32px 0 rgba(212,167,106,0.13)",
                        background:
                          "linear-gradient(91deg,#d0a669,#b38b59 84%,#e3c586 99%)",
                        fontSize: "1.13rem",
                        border: "none",
                        padding: "0.7em 1.3em",
                      }}
                      disabled={loading || !orderIsReady}
                      aria-disabled={loading || !orderIsReady}
                    >
                      {loading ? "Processing..." : "Create Print Job"}
                    </Button>
                  )}
                </div>
              </Form>
            </motion.div>
          </Col>
          {step === 1 && (
          <Col
            xs={12}
            lg={6}
            className="d-flex flex-column align-items-center justify-content-center"
            style={{
              minWidth: 0,
              minHeight: 370,
              marginTop: 0,
              zIndex: 2,
            }}
          >
            <motion.div
              className="w-100"
              style={{
                maxWidth: 480,
                minWidth: 0,
                minHeight: 380,
                margin: "0 auto",
                background:
                  "linear-gradient(120deg,#fffbe0c9 60%, #e4d3a2 140%)",
                boxShadow: "0 7px 40px 0 rgba(212,167,106,0.19)",
                borderRadius: "2rem",
                border: "1.7px solid #e6d9bc3e",
                padding: "2.2rem 1.6rem 1.5rem 1.6rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                zIndex: 2,
              }}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.13, duration: 0.88 }}
            >
              <div className="mb-2 text-center fw-bold" style={{
                color: "#c2a05e",
                fontSize: 17,
                letterSpacing: 0.03
              }}>
                <FaEye className="me-2" />
                Print Preview
                {documents.length > 1 && (
                  <div className="small fw-normal" style={{ overflowWrap: "anywhere" }}>{activeDocument?.file.name}</div>
                )}
              </div>
              {!!previewPages.length ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit,minmax(89px,1fr))",
                    gap: "1.14em 0.6em",
                    width: "100%",
                  }}
                >
                  <AnimatePresence>
                    {previewPages.map((page, i) => (
                      <motion.div
                        key={page.id}
                        {...ANIMATION.previewItem}
                        style={{
                          borderRadius: 14,
                          background: "#fffdfa",
                          border: selectedPages.includes(page.id)
                            ? "1.9px solid #dfbd7e"
                            : "1.4px solid #f0e5d3",
                          boxShadow: selectedPages.includes(page.id)
                            ? "0 5px 17px #e0b96a1a"
                            : "0 2px 11px #e2d5bc10",
                          padding: "7px 2px 9px 2px",
                          userSelect: "none",
                          marginBottom: 6,
                          transition: "all 0.17s cubic-bezier(0.42,1,0.37,1)",
                        }}
                      >
                        <img
                          src={page.thumbnail}
                          alt={`Page ${page.pageNumber}`}
                          style={{
                            width: "100%",
                            borderRadius: 7,
                            minHeight: 66,
                            maxHeight: 117,
                            background: "#faefda",
                            objectFit: "contain",
                            marginBottom: 2,
                          }}
                        />
                        <div className="text-center small" style={{
                          marginTop: 2,
                          fontWeight: selectedPages.includes(page.id) ? 700 : 500,
                          color: selectedPages.includes(page.id)
                            ? "#b09860"
                            : "#ad9e74"
                        }}>
                          Page {page.pageNumber}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div
                  className="pt-2 pb-2 text-center"
                  style={{
                    color: "#b8a166",
                    fontWeight: 500,
                    fontSize: 17,
                  }}
                >
                  <span>Upload a document to see preview here...</span>
                </div>
              )}
            </motion.div>
          </Col>
          )}
        </Row>
      </Container>
      <style>{`
        @media (max-width: 900px) {
          .container, .Container { padding-right:0;padding-left:0; }
        }
        @media (max-width: 992px) {
          .container, .Container { padding-bottom: 12px; }
        }
        @media (max-width: 750px) {
          .page-thumbnail { min-width:69px; }
        }
        @media (max-width: 576px) {
          .container, .Container {padding-right:0;padding-left:0;}
          .page-thumbnail { padding-bottom:27px; }
        }
      `}</style>
    </>
  );
};

export default PrintJob;
