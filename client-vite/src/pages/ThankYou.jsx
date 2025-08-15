import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, Button, Alert, Modal } from 'react-bootstrap';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaCheckCircle, FaDownload, FaTimes, FaClock, FaCreditCard } from 'react-icons/fa';
import { apiService } from '../services/api';

const ThankYou = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(30); // 30 seconds to cancel
  const [cancelling, setCancelling] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

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
    doc.text('Print Repository System', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text('Bill Receipt', 105, 35, { align: 'center' });
    
    // Add order details
    doc.setFontSize(10);
    doc.text(`Order Token: ${orderData.token}`, 20, 50);
    doc.text(`Roll Number: ${orderData.rollNumber}`, 20, 60);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 70);
    
    // Add print details
    doc.text('Print Details:', 20, 85);
    doc.text(`Total Pages: ${orderData.totalPages}`, 30, 95);
    doc.text(`Color Pages: ${orderData.colorPages}`, 30, 105);
    doc.text(`B&W Pages: ${orderData.bwPages}`, 30, 115);
    
    // Add print options
    doc.text('Print Options:', 20, 130);
    doc.text(`Color Printing: ${orderData.printOptions.color ? 'Yes' : 'No'}`, 30, 140);
    doc.text(`Double-sided: ${orderData.printOptions.doubleSided ? 'Yes' : 'No'}`, 30, 150);
    doc.text(`Copies: ${orderData.printOptions.copies}`, 30, 160);
    
    // Add pricing
    doc.text('Pricing:', 20, 175);
    doc.text(`B&W Cost: ₹${(orderData.bwPages * 1).toFixed(2)}`, 30, 185);
    doc.text(`Color Cost: ₹${(orderData.colorPages * 2).toFixed(2)}`, 30, 195);
    
    // Add total
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`Total Amount: ₹${orderData.price.toFixed(2)}`, 20, 205);
    
    // Add footer
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('Thank you for using Print Repository System', 105, 280, { align: 'center' });
    
    return doc;
  };

  const handleDownloadBill = async () => {
    setDownloading(true);
    
    try {
      const doc = generateBillPDF();
      const fileName = `bill_${orderData.token}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      doc.save(fileName);
      toast.success('Bill downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download bill');
    } finally {
      setDownloading(false);
    }
  };

  const handlePayment = () => {
    setShowPayment(true);
  };

  const handlePaytmPayment = async () => {
    if (!orderData?.token) {
      toast.error('Order token not found');
      return;
    }

    setProcessingPayment(true);
    
    try {
      const response = await apiService.processPayment({
        orderId: orderData.token,
        amount: orderData.price,
        rollNumber: orderData.rollNumber
      });

      if (response.success && response.paytmParams) {
        // Create a form to submit to Paytm
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = response.paytmUrl;
        form.target = '_blank';

        // Add all Paytm parameters as hidden fields
        Object.keys(response.paytmParams).forEach(key => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = response.paytmParams[key];
          form.appendChild(input);
        });

        // Submit the form
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);

        toast.success('Redirecting to Paytm for payment...');
        setShowPayment(false);
      } else {
        toast.error(response.error || 'Payment initiation failed');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Payment processing failed');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleTrackOrder = () => {
    navigate('/tracking');
  };

  if (!orderData) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>Order Confirmation - Print Repository System</title>
      </Helmet>

      <Container className="py-5">
        <Row className="justify-content-center">
          <Col lg={8}>
            <Card className="text-center border-0 shadow">
              <Card.Body className="p-5">
                <div className="mb-4">
                  <FaCheckCircle size={64} className="text-success mb-3" />
                  <h1 className="text-success">Order Confirmed!</h1>
                  <p className="lead text-muted">
                    Your print job has been successfully created
                  </p>
                </div>

                <Row className="mb-4">
                  <Col md={6}>
                    <Card className="border-0 bg-light">
                      <Card.Body>
                        <h6>Order Details</h6>
                        <p className="mb-1">
                          <strong>Roll Number:</strong> {orderData.rollNumber}
                        </p>
                        <p className="mb-1">
                          <strong>Total Pages:</strong> {orderData.totalPages}
                        </p>
                        <p className="mb-1">
                          <strong>Color Pages:</strong> {orderData.colorPages}
                        </p>
                        <p className="mb-1">
                          <strong>B&W Pages:</strong> {orderData.bwPages}
                        </p>
                        <p className="mb-0">
                          <strong>Total Cost:</strong> ₹{orderData.price.toFixed(2)}
                        </p>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={6}>
                    <Card className="border-0 bg-light">
                      <Card.Body>
                        <h6>Print Options</h6>
                        <p className="mb-1">
                          <strong>Color:</strong> {orderData.printOptions.color ? 'Yes' : 'No'}
                        </p>
                        <p className="mb-1">
                          <strong>Double-sided:</strong> {orderData.printOptions.doubleSided ? 'Yes' : 'No'}
                        </p>
                        <p className="mb-1">
                          <strong>Copies:</strong> {orderData.printOptions.copies}
                        </p>
                        <p className="mb-0">
                          <strong>Order Token:</strong> {orderData.token}
                        </p>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                {timeLeft > 0 && (
                  <Alert variant="warning" className="mb-4">
                    <FaClock className="me-2" />
                    You have {timeLeft} seconds to cancel this order if needed.
                  </Alert>
                )}

                <div className="d-grid gap-2 d-md-flex justify-content-md-center">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handlePayment}
                    className="me-md-2"
                  >
                    <FaCreditCard className="me-2" />
                    Pay Now
                  </Button>
                  
                  <Button
                    variant="outline-success"
                    size="lg"
                    onClick={handleDownloadBill}
                    disabled={downloading}
                    className="me-md-2"
                  >
                    <FaDownload className="me-2" />
                    {downloading ? 'Downloading...' : 'Download Bill'}
                  </Button>

                  <Button
                    variant="outline-primary"
                    size="lg"
                    onClick={handleTrackOrder}
                    className="me-md-2"
                  >
                    Track Order
                  </Button>

                  {timeLeft > 0 && (
                    <Button
                      variant="outline-danger"
                      size="lg"
                      onClick={handleCancel}
                      disabled={cancelling}
                    >
                      <FaTimes className="me-2" />
                      {cancelling ? 'Cancelling...' : 'Cancel Order'}
                    </Button>
                  )}
                </div>

                <div className="mt-4">
                  <Button
                    variant="link"
                    onClick={() => navigate('/')}
                  >
                    Back to Home
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* Payment Modal */}
      <Modal show={showPayment} onHide={() => setShowPayment(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Payment</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="text-center">
            <h5>Payment Amount: ₹{orderData.price.toFixed(2)}</h5>
            <p className="text-muted">Order Token: {orderData.token}</p>
            
            <div className="mt-4">
              <Button 
                variant="success" 
                size="lg" 
                onClick={handlePaytmPayment}
                disabled={processingPayment}
                className="me-3"
              >
                {processingPayment ? 'Processing...' : 'Pay with Paytm'}
              </Button>
              <Button 
                variant="outline-secondary" 
                size="lg"
                onClick={() => setShowPayment(false)}
                disabled={processingPayment}
              >
                Cancel
              </Button>
            </div>
            
            <Alert variant="info" className="mt-3">
              <strong>Note:</strong> You will be redirected to Paytm's secure payment gateway.
              Please complete the payment and return to track your order status.
            </Alert>
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default ThankYou; 