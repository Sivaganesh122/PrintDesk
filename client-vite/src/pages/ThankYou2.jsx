import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaCheckCircle, FaDownload, FaTimes, FaClock } from 'react-icons/fa';
import { jsPDF } from 'jspdf';
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

    setCancelling(true);

    try {
      await apiService.deleteOrder(orderData.orderNumber, localStorage.getItem('faculty_token'));
      toast.success('Order cancelled successfully');
      navigate('/');
    } catch (error) {
      console.error('Cancel error:', error);
      toast.error(error.message);
    } finally {
      setCancelling(false);
    }
  };

  const generateBillPDF = () => {
    const doc = new jsPDF();
    const LAST_LINE = 270;

    // Add header
    doc.setFontSize(20);
    doc.text('Departments Portal System', 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text('Order Receipt', 105, 35, { align: 'center' });

    // Add order details
    doc.setFontSize(10);
    doc.text(`Order Number: ${orderData.orderNumber}`, 20, 50);
    doc.text(`Department: ${orderData.customerName}`, 20, 60);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 70);

    let y = 85;
    orderData.documents.forEach((document, index) => {
      const lines = [
        `Token: ${document.trackingNumber}`,
        `Pages: ${document.pages} | Copies: ${document.copies} | ${document.color ? 'Color' : 'Black & White'} | ${document.doubleSided ? 'Double-sided' : 'Single-sided'}`,
        `Paper Size: ${document.paperSize} | Binding: ${document.bindingType}`
      ];
      const title = doc.splitTextToSize(`${index + 1}. ${document.fileName}`, 170);

      if (y + (title.length + lines.length) * 7 > LAST_LINE) {
        doc.addPage();
        y = 20;
      }

      doc.setFont(undefined, 'bold');
      doc.text(title, 20, y);
      y += title.length * 7;
      doc.setFont(undefined, 'normal');
      lines.forEach((line) => {
        doc.text(line, 25, y);
        y += 7;
      });
      y += 3;
    });

    // Add footer
    doc.setFontSize(8);
    doc.text('Thank you for using Departments Portal System', 105, 285, { align: 'center' });

    return doc;
  };

  const handleDownloadReceipt = async () => {
    setDownloading(true);

    try {
      const doc = generateBillPDF();
      const fileName = `receipt_${orderData.orderNumber}_${new Date().toISOString().split('T')[0]}.pdf`;

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
          <p className="subtitle">
            Your document {orderData.documents.length === 1 ? 'request has' : 'requests have'} been successfully submitted
          </p>
        </div>

        <div className="order-details-grid">
          <div className="order-detail-section">
            <h3>Order Details</h3>
            <p><strong>Department:</strong> {orderData.customerName}</p>
            <p style={{ overflowWrap: 'anywhere' }}><strong>Order Number:</strong> {orderData.orderNumber}</p>
          </div>

          {orderData.documents.map((document, index) => (
            <div className="order-detail-section" key={document.id}>
              <h3 style={{ overflowWrap: 'anywhere' }}>{index + 1}. {document.fileName}</h3>
              <p><strong>Pages:</strong> {document.pages}</p>
              <p><strong>Copies:</strong> {document.copies}</p>
              <p><strong>Print:</strong> {document.color ? 'Color' : 'Black & White'}</p>
              <p><strong>Double-sided:</strong> {document.doubleSided ? 'Yes' : 'No'}</p>
              <p><strong>Paper Size:</strong> {document.paperSize}</p>
              <p><strong>Binding:</strong> {document.bindingType}</p>
            </div>
          ))}
        </div>

        {timeLeft > 0 && (
          <div className="cancellation-notice">
            <FaClock className="clock-icon" />
            <span>
              You have {timeLeft} seconds to cancel this request if needed.
              {orderData.documents.length > 1 && ' Cancelling removes all documents in the request.'}
            </span>
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
