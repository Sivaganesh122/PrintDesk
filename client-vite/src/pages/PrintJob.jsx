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
import { toast } from "react-toastify";
import {
  FaPrint,
  FaEye,
  FaCheck,
  FaChevronRight,
  FaChevronLeft,
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

const PrintJob = () => {
  const navigate = useNavigate();
  const {
    uploadedFile,
    selectedPages,
    setSelectedPages,
    printOptions,
    pricing,
    handleFileUpload,
    updatePrintOptions,
    togglePageSelection,
    selectAllPages,
    clearAllSelections,
  } = usePrintJob();

  const [step, setStep] = useState(0);
  const stepCount = 3;

  const [rollNumber, setRollNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewPages, setPreviewPages] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [paperSize, setPaperSize] = useState("");
  const [bindingType, setBindingType] = useState("");



  const stepRef = useRef();

  useEffect(() => {
    const loadPdfJs = async () => {
      try {
        // Load PDF.js from CDN to avoid import.meta issues
        if (!window.pdfjsLib) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          script.onload = () => {
            // Set worker source
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          };
          document.head.appendChild(script);
        }
      } catch (error) {
        console.error('Failed to load PDF.js:', error);
      }
    };
    loadPdfJs();
  }, []);

  const generatePdfPreview = async (file) => {
    try {
      // Wait for PDF.js to load if not already loaded
      if (!window.pdfjsLib) {
        await new Promise((resolve) => {
          const checkPdfJs = () => {
            if (window.pdfjsLib) {
              resolve();
            } else {
              setTimeout(checkPdfJs, 100);
            }
          };
          checkPdfJs();
        });
      }
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
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
      
      if (pages.length > 0) {
        setPreviewPages(pages);
        setShowPreview(true);
        return true;
      } else {
        throw new Error('No pages could be rendered');
      }
    } catch (error) {
      console.error('PDF preview error:', error);
      toast.error("Failed to generate PDF preview. Using placeholder.");
      
      // Create a placeholder preview
      setPreviewPages([{
        id: 0,
        thumbnail: `https://via.placeholder.com/150x200/6c757d/ffffff?text=PDF+File`,
        pageNumber: 1,
        selected: false,
        type: "pdf",
      }]);
      setShowPreview(true);
      return true;
    }
  };

  const generateImagePreview = async (file) => {
    const url = URL.createObjectURL(file);
    setPreviewPages([
      {
        id: 0,
        thumbnail: url,
        pageNumber: 1,
        selected: false,
        type: "image",
      },
    ]);
    setShowPreview(true);
  };

  const generateDocumentPreview = async (file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "docx") {
      const result = await convertDocxToPreview(file);
      if (result.success) {
        setPreviewPages(result.pages);
        setShowPreview(true);
      } else toast.error(result.error);
    } else if (ext === "doc") {
      const result = await convertDocToPreview(file);
      if (result.success) {
        setPreviewPages(result.pages);
        setShowPreview(true);
      } else toast.error(result.error);
    } else {
      setPreviewPages([
        {
          id: 0,
          thumbnail: `https://via.placeholder.com/150x200/6c757d/ffffff?text=Doc`,
          pageNumber: 1,
          selected: false,
          type: "document",
        },
      ]);
      setShowPreview(true);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      toast.error('No file selected');
      return;
    }

    try {
      setLoading(true);
      
      // Reset preview state
      setShowPreview(false);
      setPreviewPages([]);
      setSelectedPages([]);
      
      console.log('Selected file:', file.name, 'Type:', file.type, 'Size:', file.size);
      
      // Upload the file
      const uploadSuccess = await handleFileUpload(file);
      
      if (!uploadSuccess) {
        toast.error('Failed to upload file. Please try again.');
        return;
      }
      
      // Generate preview based on file type
      const fileExtension = file.name.split('.').pop().toLowerCase();
      let previewGenerated = false;
      
      try {
        if (fileExtension === 'pdf') {
          await generatePdfPreview(file);
        } else if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExtension)) {
          await generateImagePreview(file);
        } else if (['docx', 'doc'].includes(fileExtension)) {
          await generateDocumentPreview(file);
        } else {
          // For unsupported file types, create a generic preview
          setPreviewPages([{
            id: 0,
            thumbnail: `https://via.placeholder.com/150x200/6c757d/ffffff?text=${fileExtension.toUpperCase()}`,
            pageNumber: 1,
            selected: false,
            type: "document",
          }]);
          setShowPreview(true);
        }
        
        toast.success('File loaded successfully!');
      } catch (previewError) {
        console.error('Preview generation error:', previewError);
        // Create a fallback preview
        setPreviewPages([{
          id: 0,
          thumbnail: `https://via.placeholder.com/150x200/6c757d/ffffff?text=File+Preview`,
          pageNumber: 1,
          selected: false,
          type: "document",
        }]);
        setShowPreview(true);
        toast.success('File loaded successfully!');
      }
      
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error(`Failed to process file: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
      // Note: Don't reset the input value here as it prevents re-uploading the same file
      // The value is reset after successful upload in the handleFileUpload function
    }
  };

  // ---- VALIDATION LOGIC for step navigation & submission ----
  const canNext = () => {
    if (step === 0) return !!uploadedFile && !!rollNumber.trim();
    if (step === 1) return !!printOptions.copies && printOptions.copies > 0; 
    if (step === 2) return selectedPages.length > 0;
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (
      !uploadedFile ||
      !rollNumber.trim() ||
      selectedPages.length === 0 ||
      !printOptions.copies ||
      printOptions.copies < 1
    ) {
      toast.error("Please complete all fields");
      return;
    }
    setLoading(true);
    try {
      // Create the print job in the backend
      const formData = new FormData();
      
      // Add the uploaded file to the form data
      if (uploadedFile) {
        formData.append('file', uploadedFile);
      }
      
      // Add the print job data
      formData.append('rollNumber', rollNumber);
      formData.append('totalPages', selectedPages.length);
      formData.append('totalPrice', pricing.total);
      formData.append('colorPages', printOptions.color ? selectedPages.length : 0);
      formData.append('bwPages', printOptions.color ? 0 : selectedPages.length);
      formData.append("paperSize", paperSize);
      formData.append("bindingType", bindingType);

      formData.append('printOptions', JSON.stringify(printOptions));
      
      const response = await fetch('http://localhost:5001/api/print-job/create', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create print job');
      }
      
      const result = await response.json();
      
      const orderData = {
        rollNumber,
        totalPages: selectedPages.length,
        colorPages: printOptions.color ? selectedPages.length : 0,
        bwPages: printOptions.color ? 0 : selectedPages.length,
        price: pricing.total,
        printOptions,
        trackingNumber: result.data.trackingNumber,
        jobId: result.data.id,
      };
      
      navigate("/thank-you", { state: { orderData } });
    } catch (error) {
      console.error('Error creating print job:', error);
      toast.error(error.message || "Failed to create print job");
    } finally {
      setLoading(false);
    }
  };

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
          className="flex-lg-nowrap w-100"
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
              <Form onSubmit={handleSubmit} autoComplete="on">
                <AnimatePresence exitBeforeEnter>
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
                          Roll Number
                        </Form.Label>
                        <Form.Control
                          placeholder="E.g. 727624BCS043"
                          value={rollNumber}
                          onChange={(e) => setRollNumber(e.target.value)}
                          required
                          spellCheck="false"
                          autoFocus
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
                          Select File (.pdf, .docx, .jpg, .png)
                        </Form.Label>
                        <Form.Control
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={handleFileChange}
                          style={{
                            borderRadius: 13,
                            background: "#f7ecd6",
                          }}
                        />
                        <Form.Text className="text-muted">
                          Supported: PDF, DOCX, JPG, PNG
                        </Form.Text>
                      </Form.Group>
                      {uploadedFile && (
                        <Alert variant="success" className="mt-3 mb-1">
                          Uploaded: <b>{uploadedFile.name}</b>
                        </Alert>
                      )}
                    </motion.div>
                  )}
                  {step === 1 && (
                    <motion.div {...ANIMATION.section} key="step2" className="mb-4">
                      <Form.Group className="mb-3">
                        <Form.Check
                          type="switch"
                          id="colorSwitch"
                          label="Color Print"
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
                          <option value="Spiral">Spiral Binding</option>
                          <option value="Paper">Paper Binding</option>
                        </Form.Select>
                      </Form.Group>

                      <Form.Group>
                        <Form.Label>Copies</Form.Label>
                        <Form.Control
                          type="number"
                          min="1"
                          max="10"
                          value={printOptions.copies}
                          onChange={(e) =>
                            updatePrintOptions({ copies: +e.target.value })
                          }
                          style={{
                            width: 90,
                            borderRadius: 13,
                            border: "1.5px solid #e6d3a9c4",
                            background: "#fff7e0",
                            fontWeight: 500,
                          }}
                        />
                      </Form.Group>
                      <AnimatePresence>
                        {(pricing.total > 0 || uploadedFile) && (
                          <motion.div {...ANIMATION.section} className="mt-4" key="pricing">
                            <Alert
                              variant="info"
                              className="py-2 px-2 shadow-none"
                              style={{
                                background: "#fff4dcc0",
                                color: "#9a865d",
                                border: "none",
                                textAlign: "center",
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: "bold",
                                  fontSize: "1.22rem",
                                  color: "#ceae69",
                                }}
                              >
                                ₹{pricing.total.toFixed(2)}
                              </span>
                              <br />
                              <span style={{ fontSize: "0.99em" }}>
                                B&W: {pricing.bwPages}, Color: {pricing.colorPages}
                              </span>
                              <br />
                              <span style={{ fontSize: "0.94em", color: "#ab832f" }}>
                                
                              </span>
                            </Alert>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                  {step === 2 && (
                    <motion.div {...ANIMATION.section} key="step3" className="mb-2">
                      <div
                        className="mb-2 fw-semibold"
                        style={{ color: "#bfa353", letterSpacing: "0.1em", fontSize: "1.18em" }}
                      >
                        <FaEye className="me-2" /> Select Pages
                      </div>
                      {showPreview && (
                        <div style={{ minHeight: 140 }}>
                          <div className="d-flex mb-1 align-items-center">
                            <Button
                              size="sm"
                              variant="outline-primary"
                              className="me-2"
                              onClick={() => selectAllPages(previewPages.length)}
                              tabIndex={0}
                            >
                              Select All
                            </Button>
                            <Button
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
                              {selectedPages.length} page(s)
                            </span>
                          </div>
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
                </AnimatePresence>

                {/* Wizard navigation */}
                <div className="d-flex align-items-center mt-4 justify-content-between">
                  <Button
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
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={() => canNext() && setStep((s) => Math.min(stepCount - 1, s + 1))}
                      className="px-4 py-2"
                      style={{ borderRadius: 13, fontWeight: 600, boxShadow: "0 7px 20px #dab66a20" }}
                      disabled={!canNext()}
                    >
                      Next
                      <FaChevronRight className="ms-1" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
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
                      disabled={
                        loading ||
                        !uploadedFile ||
                        !rollNumber.trim() ||
                        selectedPages.length === 0 ||
                        !printOptions.copies ||
                        printOptions.copies < 1
                      }
                      aria-disabled={
                        loading ||
                        !uploadedFile ||
                        !rollNumber.trim() ||
                        selectedPages.length === 0 ||
                        !printOptions.copies ||
                        printOptions.copies < 1
                      }
                    >
                      {loading ? "Processing..." : "Create Print Job"}
                    </Button>
                  )}
                </div>
              </Form>
            </motion.div>
          </Col>
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
