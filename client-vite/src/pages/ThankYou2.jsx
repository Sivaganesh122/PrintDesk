import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaCheckCircle, FaDownload, FaTimes, FaClock } from 'react-icons/fa';
import { apiService } from '../services/api';
import './ThankYou.css'; // We'll create this CSS file

const ThankYou = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(30); // 30 seconds to cancel
  const [cancelling, setCancelling] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const orderData = location.state?.orderData;

  useEffect(() => {
    if (!orderData) {
      navigate('/');
      return;
    }

    // Countdown timer for cancellation
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [orderData, navigate]);

  const handleCancel = async () => {
    if (timeLeft <= 0) {
      toast.error('Cancellation time has expired');
      return;
    }

    if (!orderData?.token) {
      toast.error('Order token not found');
      return;
    }

    setCancelling(true);
    
    try {
      await apiService.deleteOrder(orderData.token);
      toast.success('Order cancelled successfully');
      navigate('/');
    } catch (error) {
      console.error('Cancel error:', error);
      toast.error('Failed to cancel order. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  const generateBillPDF = () => {
    const { jsPDF } = require('jspdf');
    const doc = new jsPDF();
    
    // Add header
    doc.setFontSize(20);
    doc.text('Faculty Portal System', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text('Order Receipt', 105, 35, { align: 'center' });
    
    // Add order details
    doc.setFontSize(10);
    doc.text(`Order Token: ${orderData.token}`, 20, 50);
    doc.text(`Faculty ID: ${orderData.facultyId}`, 20, 60);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 70);
    
    // Add document details
    doc.text('Document Details:', 20, 85);
    doc.text(`Total Pages: ${orderData.totalPages}`, 30, 95);
    
    // Add print options
    doc.text('Print Options:', 20, 110);
    doc.text(`Double-sided: ${orderData.printOptions.doubleSided ? 'Yes' : 'No'}`, 30, 120);
    doc.text(`Copies: ${orderData.printOptions.copies}`, 30, 130);
    
    // Add footer
    doc.setFontSize(8);
    doc.text('Thank you for using Faculty Portal System', 105, 280, { align: 'center' });
    
    return doc;
  };

  const handleDownloadReceipt = async () => {
    setDownloading(true);
    
    try {
      const doc = generateBillPDF();
      const fileName = `receipt_${orderData.token}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      doc.save(fileName);
      toast.success('Receipt downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download receipt');
    } finally {
      setDownloading(false);
    }
  };

  const handleTrackOrder = () => {
    navigate('/tracking');
  };

  if (!orderData) {
    return null;
  }

  return (
    <div className="thank-you-container">
      <div className="animated-bg-layer"></div>
      
      <div className="thank-you-card">
        <div className="thank-you-header">
          <FaCheckCircle className="success-icon" />
          <h1>Order Confirmed!</h1>
          <p className="subtitle">Your document request has been successfully submitted</p>
        </div>

        <div className="order-details-grid">
          <div className="order-detail-section">
            <h3>Order Details</h3>
            <p><strong>Faculty ID:</strong> {orderData.facultyId}</p>
            <p><strong>Total Pages:</strong> {orderData.totalPages}</p>
            <p><strong>Order Token:</strong> {orderData.token}</p>
          </div>

          <div className="order-detail-section">
            <h3>Print Options</h3>
            <p><strong>Double-sided:</strong> {orderData.printOptions.doubleSided ? 'Yes' : 'No'}</p>
            <p><strong>Copies:</strong> {orderData.printOptions.copies}</p>
          </div>
        </div>

        {timeLeft > 0 && (
          <div className="cancellation-notice">
            <FaClock className="clock-icon" />
            <span>You have {timeLeft} seconds to cancel this request if needed.</span>
          </div>
        )}

        <div className="action-buttons">
          <button
            className="download-button"
            onClick={handleDownloadReceipt}
            disabled={downloading}
          >
            <FaDownload className="button-icon" />
            {downloading ? 'Downloading...' : 'Download Receipt'}
          </button>

          <button
            className="track-button"
            onClick={handleTrackOrder}
          >
            Track Request
          </button>

          {timeLeft > 0 && (
            <button
              className="cancel-button"
              onClick={handleCancel}
              disabled={cancelling}
            >
              <FaTimes className="button-icon" />
              {cancelling ? 'Cancelling...' : 'Cancel Request'}
            </button>
          )}
        </div>

        <div className="back-link">
          <button onClick={() => navigate('/')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThankYou;