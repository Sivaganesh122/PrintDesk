import React from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { FaExclamationTriangle, FaHome, FaArrowLeft } from 'react-icons/fa';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Page Not Found - Print Repository System</title>
      </Helmet>

      <Container className="py-5">
        <Row className="justify-content-center">
          <Col lg={6}>
            <Card className="text-center border-0 shadow">
              <Card.Body className="p-5">
                <div className="mb-4">
                  <FaExclamationTriangle size={64} className="text-warning mb-3" />
                  <h1 className="text-warning">404</h1>
                  <h2>Page Not Found</h2>
                  <p className="lead text-muted">
                    The page you're looking for doesn't exist or has been moved.
                  </p>
                </div>

                <div className="d-grid gap-2 d-md-flex justify-content-md-center">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => navigate('/')}
                    className="me-md-2"
                  >
                    <FaHome className="me-2" />
                    Go Home
                  </Button>
                  
                  <Button
                    variant="outline-secondary"
                    size="lg"
                    onClick={() => navigate(-1)}
                  >
                    <FaArrowLeft className="me-2" />
                    Go Back
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

export default NotFound; 