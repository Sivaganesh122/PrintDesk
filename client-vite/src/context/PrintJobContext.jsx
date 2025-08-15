import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';

const PrintJobContext = createContext();

export const usePrintJob = () => {
  const context = useContext(PrintJobContext);
  if (!context) {
    throw new Error('usePrintJob must be used within a PrintJobProvider');
  }
  return context;
};

export const PrintJobProvider = ({ children }) => {
  const [currentJob, setCurrentJob] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [selectedPages, setSelectedPages] = useState([]);
  const [printOptions, setPrintOptions] = useState({
    color: false,
    doubleSided: false,
    copies: 1
  });
  const [pricing, setPricing] = useState({
    bwPages: 0,
    colorPages: 0,
    totalPages: 0,
    subtotal: 0,
    total: 0
  });

  // Pricing constants
  const PRICING = {
    BW_PRICE: 1,
    COLOR_PRICE: 2
  };

  // Calculate pricing based on selections
  const calculatePricing = useCallback((pages, options) => {
    if (!pages || pages.length === 0) {
      return {
        bwPages: 0,
        colorPages: 0,
        totalPages: 0,
        subtotal: 0,
        total: 0
      };
    }

    const { color, copies } = options;
    const totalPages = pages.length * copies;
    const bwPages = color ? 0 : totalPages;
    const colorPages = color ? totalPages : 0;
    
    const bwCost = bwPages * PRICING.BW_PRICE;
    const colorCost = colorPages * PRICING.COLOR_PRICE;
    const subtotal = bwCost + colorCost;
    const total = subtotal;

    return {
      bwPages,
      colorPages,
      totalPages,
      subtotal,
      total
    };
  }, [PRICING.BW_PRICE, PRICING.COLOR_PRICE]);

  // Update pricing when selections change
  const updatePricing = useCallback(() => {
    if (selectedPages.length > 0) {
      const newPricing = calculatePricing(selectedPages, printOptions);
      setPricing(newPricing);
    } else {
      setPricing({
        bwPages: 0,
        colorPages: 0,
        totalPages: 0,
        subtotal: 0,
        total: 0
      });
    }
  }, [selectedPages, printOptions, calculatePricing]);

  // Update pricing whenever selectedPages or printOptions change
  useEffect(() => {
    updatePricing();
  }, [selectedPages, printOptions, updatePricing]);

  // Handle file upload
  const handleFileUpload = async (file) => {
    if (!file) {
      console.error('No file provided for upload');
      toast.error('No file selected');
      return false;
    }

    console.log('Uploading file:', file.name, 'Size:', file.size, 'Type:', file.type);

    // Validate file type
    const allowedTypes = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'];
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      const errorMsg = `Invalid file type: ${fileExtension}. Please upload PDF, DOC, DOCX, JPG, JPEG, or PNG files.`;
      console.error(errorMsg);
      toast.error(errorMsg);
      return false;
    }

    // Validate file size (25MB)
    const maxSize = 25 * 1024 * 1024; // 25MB in bytes
    if (file.size > maxSize) {
      const errorMsg = `File too large: ${(file.size / (1024 * 1024)).toFixed(2)}MB. Maximum size is 25MB.`;
      console.error(errorMsg);
      toast.error(errorMsg);
      return false;
    }

    // Upload file to backend
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      console.log('Sending file upload request...');
      const response = await fetch('http://localhost:5001/api/print-job/upload', {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - let the browser set it with the boundary
      });

      console.log('Upload response status:', response.status);
      
      if (!response.ok) {
        let errorMessage = 'Upload failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          console.error('Server error response:', errorData);
        } catch (e) {
          console.error('Error parsing error response:', e);
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Upload successful, server response:', result);
      
      if (!result.success || !result.data || !result.data.stored_filename) {
        console.error('Invalid server response:', result);
        throw new Error('Invalid server response. Please try again.');
      }
      
      // Store the uploaded file info
      const uploadedFileInfo = {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        serverFilename: result.data.stored_filename,
        originalName: result.data.original_name
      };
      
      console.log('Setting uploaded file:', uploadedFileInfo);
      setUploadedFile(file); // Store the actual File object, not metadata
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      console.log('Generated preview URL');
      setFilePreview(previewUrl);
      
      // Reset selections
      setSelectedPages([]);
      setPrintOptions({
        color: false,
        doubleSided: false,
        copies: 1
      });
      
      // Reset the file input to allow re-uploading the same file
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        fileInput.value = '';
      }
      
      return true;
    } catch (error) {
      console.error('Upload error:', error);
      const errorMsg = error.message || 'Failed to upload file. Please try again.';
      toast.error(errorMsg);
      return false;
    }
  };

  // Handle page selection
  const togglePageSelection = (pageIndex) => {
    setSelectedPages(prev => {
      const newSelection = prev.includes(pageIndex)
        ? prev.filter(p => p !== pageIndex)
        : [...prev, pageIndex].sort((a, b) => a - b);
      return newSelection;
    });
  };

  // Select all pages
  const selectAllPages = (pageCount) => {
    const allPages = Array.from({ length: pageCount }, (_, i) => i);
    setSelectedPages(allPages);
  };

  // Clear all selections
  const clearAllSelections = () => {
    setSelectedPages([]);
  };

  // Handle print options change
  const updatePrintOptions = (newOptions) => {
    setPrintOptions(prev => {
      const updated = { ...prev, ...newOptions };
      return updated;
    });
  };

  // Clear current job
  const clearJob = () => {
    setCurrentJob(null);
    setUploadedFile(null);
    setFilePreview(null);
    setSelectedPages([]);
    setPrintOptions({
      color: false,
      doubleSided: false,
      copies: 1
    });
    setPricing({
      bwPages: 0,
      colorPages: 0,
      totalPages: 0,
      subtotal: 0,
      total: 0
    });
  };

  // Set current job (for thank you page)
  const setJob = (jobData) => {
    setCurrentJob(jobData);
  };

  const value = {
    currentJob,
    uploadedFile,
    filePreview,
    selectedPages,
    setSelectedPages, // Add this line to expose setSelectedPages
    printOptions,
    pricing,
    PRICING,
    handleFileUpload,
    togglePageSelection,
    selectAllPages,
    clearAllSelections,
    updatePrintOptions,
    clearJob,
    setJob,
    updatePricing
  };

  return (
    <PrintJobContext.Provider value={value}>
      {children}
    </PrintJobContext.Provider>
  );
}; 