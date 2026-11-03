import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, Button, Alert, Table } from 'react-bootstrap';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaCheckCircle, FaDownload, FaTimes, FaClock } from 'react-icons/fa';
import { jsPDF } from 'jspdf';
import { apiService } from '../services/api';

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
      await apiService.deleteOrder(orderData.orderNumber, localStorage.getItem('studentToken'));
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
    doc.text('PrintDesk', 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text('Bill Receipt', 105, 35, { align: 'center' });

    // Add order details
    doc.setFontSize(10);
    doc.text(`Order Number: ${orderData.orderNumber}`, 20, 50);
    doc.text(`Roll Number: ${orderData.customerName}`, 20, 60);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 70);

    // The default PDF font has no rupee sign, so amounts use "Rs."
    let y = 85;
    orderData.documents.forEach((document, index) => {
      const lines = [
        `Token: ${document.trackingNumber}`,
        `Pages: ${document.pages} | Copies: ${document.copies} | ${document.color ? 'Color' : 'Black & White'} | ${document.doubleSided ? 'Double-sided' : 'Single-sided'}`,
        `Paper Size: ${document.paperSize} | Binding: ${document.bindingType}`,
        `Printing: Rs. ${document.pagesCost.toFixed(2)} | Binding: Rs. ${document.bindingCost.toFixed(2)} | Cost: Rs. ${document.totalPrice.toFixed(2)}`
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

    if (y > LAST_LINE) {
      doc.addPage();
      y = 20;
    }

    // Add total
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`Total Amount: Rs. ${orderData.totalPrice.toFixed(2)}`, 20, y + 5);

    // Add footer
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('Thank you for using PrintDesk', 105, 285, { align: 'center' });

    return doc;
  };

  const handleDownloadBill = async () => {
    setDownloading(true);

    try {
      const doc = generateBillPDF();
      const fileName = `bill_${orderData.orderNumber}_${new Date().toISOString().split('T')[0]}.pdf`;

      doc.save(fileName);
      toast.success('Bill downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download bill');
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
    <>
      <Helmet>
        <title>Order Confirmation - PrintDesk</title>
      </Helmet>

      <Container className="py-5">
        <Row className="justify-content-center">
          <Col lg={10}>
            <Card className="text-center border-0 shadow">
              <Card.Body className="p-4 p-md-5">
                <div className="mb-4">
                  <FaCheckCircle size={64} className="text-success mb-3" />
                  <h1 className="text-success">Order Confirmed!</h1>
                  <p className="lead text-muted">
                    Your print {orderData.documents.length === 1 ? 'job has' : 'jobs have'} been successfully created
                  </p>
                </div>

                <p className="mb-1">
                  <strong>Roll Number:</strong> {orderData.customerName}
                </p>
                <p className="mb-4" style={{ overflowWrap: 'anywhere' }}>
                  <strong>Order Number:</strong> {orderData.orderNumber}
                </p>

                <Table responsive bordered size="sm" className="text-start align-middle mb-4">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Pages</th>
                      <th>Copies</th>
                      <th>Print</th>
                      <th>Paper</th>
                      <th>Binding</th>
                      <th className="text-end">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderData.documents.map((document) => (
                      <tr key={document.id}>
                        <td style={{ overflowWrap: 'anywhere', minWidth: 140 }}>{document.fileName}</td>
                        <td>{document.pages}</td>
                        <td>{document.copies}</td>
                        <td>{document.color ? 'Color' : 'B&W'}, {document.doubleSided ? 'double-sided' : 'single-sided'}</td>
                        <td>{document.paperSize}</td>
                        <td>
                          {document.bindingType}
                          {document.bindingCost > 0 && ` (₹${document.bindingCost.toFixed(2)})`}
                        </td>
                        <td className="text-end">₹{document.totalPrice.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={6}>Total Cost</th>
                      <th className="text-end">₹{orderData.totalPrice.toFixed(2)}</th>
                    </tr>
                  </tfoot>
                </Table>

                {timeLeft > 0 && (
                  <Alert variant="warning" className="mb-4">
                    <FaClock className="me-2" />
                    You have {timeLeft} seconds to cancel this order if needed.
                    {orderData.documents.length > 1 && ' Cancelling removes all documents in the order.'}
                  </Alert>
                )}

                <div className="d-grid gap-2 d-md-flex justify-content-md-center">
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
    </>
  );
};

export default ThankYou;
