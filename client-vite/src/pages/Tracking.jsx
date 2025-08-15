import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Badge } from 'react-bootstrap';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { FaSearch, FaFileAlt, FaClock, FaCheckCircle, FaTimes } from 'react-icons/fa';

function AnimatedBackground() {
  return (
    <div className="animated-bg-layer" aria-hidden>
      <svg
        width="100%"
        height="100%"
        className="mesh-bg"
        style={{
          position: "absolute", left: 0, top: 0,
          zIndex: 1, width: "100vw", height: "100vh",
          opacity: 0.14,
          pointerEvents: "none"
        }}
      >
        <defs>
          <linearGradient id="goldMesh" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffe7bc" />
            <stop offset="50%" stopColor="#deb97e" />
            <stop offset="100%" stopColor="#e2bb69" />
          </linearGradient>
        </defs>
        {[...Array(17)].map((_, idx) => (
          <line
            key={idx}
            x1={0}
            y1={idx * 75}
            x2={1920}
            y2={idx * 75 - 170}
            stroke="url(#goldMesh)"
            strokeWidth={1.29}
            opacity="0.19"
          />
        ))}
        {[...Array(16)].map((_, idx) => (
          <line
            key={idx}
            x1={idx * 120}
            y1={0}
            x2={idx * 60 + 180}
            y2={1100}
            stroke="url(#goldMesh)"
            strokeWidth={0.97}
            opacity="0.13"
          />
        ))}
      </svg>
      <div className="petals-container">
        {[...Array(9)].map((_, idx) => (
          <motion.div
            key={idx}
            className="petal-orb"
            initial={{
              opacity: 0.9,
              y: Math.sin(idx * 3.8) * 70,
              x: Math.cos(idx * 2.1) * 40,
              scale: 0.94 + Math.random() * 0.40,
              rotate: idx * 31,
            }}
            animate={{
              y: ["0%", `-${70 + Math.random() * 50}%`],
              x: [`${5 + idx * 8}%`, `${16 + idx * 10}%`],
              opacity: [0.45, 0.7, 0.57, 0.45],
              rotate: 360,
            }}
            transition={{
              repeat: Infinity,
              repeatType: "reverse",
              duration: 9 + idx * 1.8,
              delay: idx * 0.61,
              ease: "easeInOut",
            }}
            style={{
              left: `${5 + idx * 11}%`,
              top: `${13 + idx * 8}%`,
              width: 32 + ((idx % 2) * 13),
              height: 32 + ((idx % 3) * 13),
              background: idx % 2
                ? 'radial-gradient(circle at 68% 37%, #fcfaef77 38%, #eec27315 78%)'
                : 'radial-gradient(circle at 63% 81%, #fff7e417 44%, #edd3a7 83%)',
              borderRadius: "54% 41% 57% 48%",
              position: "absolute",
              zIndex: 2,
              filter: "blur(2.2px)",
              pointerEvents: "none"
            }}
          />
        ))}
      </div>
    </div>
  );
}

const fadeItem = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7 } }
};

const Tracking = () => {
  const [searchType, setSearchType] = useState('token');
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!searchValue.trim()) {
      setError('Please enter your roll number');
      return;
    }

    setLoading(true);
    setError('');
    setOrderData(null);

    try {
      const endpoint = `http://localhost:5001/api/tracking/roll/${encodeURIComponent(searchValue)}`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      const responseText = await response.text();
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (jsonError) {
        console.error('Failed to parse JSON:', { responseText, status: response.status });
        throw new Error('Invalid response from server');
      }
      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }
      if (data.success && data.order) {
        let createdAt = data.order.createdAt || data.order.created_at;
        let estimatedCompletion = null;
        if (createdAt && !isNaN(new Date(createdAt))) {
          estimatedCompletion = new Date(new Date(createdAt).getTime() + 30 * 60 * 1000).toISOString();
        }
        const formattedOrder = {
          ...data.order,
          estimatedCompletion
        };
        setOrderData(formattedOrder);
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      setError(error.message || 'Order not found. Please check your roll number.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { variant: 'warning', icon: FaClock, gradient: 'linear-gradient(90deg, #ffd972, #deae40)' },
      processing: { variant: 'info', icon: FaClock, gradient: 'linear-gradient(90deg, #abcff2 82%, #7bb6e6 99%)' },
      completed: { variant: 'success', icon: FaCheckCircle, gradient: 'linear-gradient(90deg, #9be17f, #67c25f)' },
      cancelled: { variant: 'danger', icon: FaTimes, gradient: 'linear-gradient(90deg, #ff9884 10%, #f6583c 88%)' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge 
        bg={config.variant} 
        className="fs-6 ms-2"
        style={{
          background: config.gradient,
          padding: '6px 16px 6px 11px',
          borderRadius: '7px'
        }}
      >
        <Icon className="me-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="home-container" style={{
      minHeight: '100vh',
      backgroundColor: 'var(--light-bg)',
      overflowX: 'hidden',
      fontFamily: "'Poppins', sans-serif",
      color: 'var(--text-dark)',
      position: 'relative',
      zIndex: 2,
      paddingTop: '110px'
    }}>
      <Helmet>
        <title>Track Order - Print Repository System</title>
      </Helmet>
      
      <AnimatedBackground />
      
      <Container className="tracking-wrapper" style={{
        maxWidth: '650px',
        margin: '0 auto',
        padding: '3.8rem 1rem 2.6rem 1rem',
        position: 'relative',
        zIndex: 2
      }}>
        <motion.div
          className="tracking-header text-center mb-5"
          initial="hidden"
          animate="show"
          variants={fadeItem}
        >
          <h1 style={{
            fontSize: '2.14rem',
            fontWeight: '700',
            marginBottom: '12px',
            color: 'var(--secondary-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.7rem'
          }}>
            <FaSearch />
            Track Your Order
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
            style={{
              color: 'var(--text-medium)',
              fontSize: '1.07rem',
              marginBottom: '2.1rem',
              fontWeight: '500',
              maxWidth: '450px',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}>
            Enter your <b>Roll Number</b> to get real-time status updates.
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.19 }}
        >
          <Card className="tracking-search-card mb-4" style={{
            borderRadius: '15px',
            boxShadow: 'var(--shadow)',
            padding: '2.3rem 1.2rem 1.7rem 1.2rem',
            background: 'var(--pure-white)'
          }}>
            <Card.Body>
              <Form onSubmit={handleSearch}>
                <Row className="search-row" style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '24px',
                  alignItems: 'flex-end'
                }}>
                  <Col className="input-group" style={{
                    flex: '1 1 150px',
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: '120px'
                  }}>
                    <Form.Label style={{
                      fontSize: '0.99rem',
                      fontWeight: '500',
                      color: 'var(--text-dark)',
                      marginBottom: '0.45rem'
                    }}>Roll Number</Form.Label>
                    <Form.Control
                      type="text"
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      placeholder={'Enter roll number'}
                      required
                      disabled={loading}
                      style={{
                        padding: '0.77rem 1rem',
                        borderRadius: '8px',
                        border: '1.4px solid #edd4a1',
                        background: '#fcfaf8',
                        fontSize: '1.03rem',
                        width: '100%',
                        outline: 'none',
                        color: 'var(--text-dark)',
                        fontWeight: '500',
                        boxShadow: 'none',
                        transition: 'border 0.29s'
                      }}
                    />
                  </Col>
                  <Col className="input-group search-btn-group" style={{
                    minWidth: '105px',
                    alignItems: 'flex-end'
                  }}>
                    <Form.Label>&nbsp;</Form.Label>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={loading}
                      style={{
                        minWidth: '80px',
                        minHeight: '40px',
                        padding: '0.85rem 1.4rem',
                        fontSize: '1.03rem',
                        borderRadius: '8px',
                        fontWeight: '600',
                        transition: 'var(--transition)',
                        boxShadow: 'var(--shadow)',
                        fontFamily: "'Poppins', sans-serif",
                        border: 'none',
                        background: 'var(--primary-color)',
                        color: '#fff'
                      }}
                    >
                      {loading ? "Going..." : "Go"}
                    </Button>
                  </Col>
                </Row>
              </Form>
            </Card.Body>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: error || orderData ? 1 : 0, y: error || orderData ? 0 : 24 }}
          transition={{ duration: 0.6, delay: 0.07 }}
          className="tracking-result"
          style={{ marginTop: '15px', minHeight: '30px' }}
        >
          {error && (
            <motion.div 
              className="result-alert error-alert"
              initial={{ scale: 0.91, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.31 }}
              style={{
                marginBottom: '1.1rem',
                padding: '1.13rem 1rem',
                borderRadius: '9px',
                fontWeight: '500',
                background: '#fdecf0',
                color: '#bf1b1b',
                boxShadow: '0 2px 13px #ffcfbf44',
                border: '1.2px solid #ffd2c3'
              }}
            >
              {error}
            </motion.div>
          )}

          {orderData && (
            <motion.div 
              className="result-card"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 70, duration: 0.42 }}
              style={{
                borderRadius: '16px',
                background: 'var(--pure-white)',
                boxShadow: 'var(--shadow-hover)',
                padding: '1.9rem 1.32rem',
                animation: 'fadeInPop 0.55s cubic-bezier(.19,1,.22,1)'
              }}
            >
              <div className="result-header" style={{
                fontSize: '1.19rem',
                fontWeight: '600',
                marginBottom: '1.02rem',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--primary-color)'
              }}>
                <FaFileAlt style={{ marginRight: '10px', color: "#dab66a" }} /> 
                Order Details
              </div>
              
              <div className="result-body" style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '18px',
                marginBottom: '1.1rem'
              }}>
                <div className="result-col" style={{
                  flex: '1 1 190px',
                  minWidth: '170px'
                }}>
                  <h4 style={{
                    fontSize: '1.01rem',
                    color: 'var(--secondary-color)',
                    fontWeight: '700',
                    marginBottom: '0.36rem'
                  }}>Order Information</h4>
                  <p style={{
                    fontSize: '1.04rem',
                    fontWeight: '500',
                    marginBottom: '0.23rem'
                  }}>
                    <strong>Token:</strong> <span>{orderData.token}</span>
                  </p>
                  <p style={{
                    fontSize: '1.04rem',
                    fontWeight: '500',
                    marginBottom: '0.23rem'
                  }}>
                    <strong>Roll Number:</strong> <span>{orderData.rollNumber}</span>
                  </p>
                  <p style={{
                    fontSize: '1.04rem',
                    fontWeight: '500',
                    marginBottom: '0.23rem'
                  }}>
                    <strong>Status:</strong> {getStatusBadge(orderData.status)}
                  </p>
                  <p style={{
                    fontSize: '1.04rem',
                    fontWeight: '500',
                    marginBottom: '0.23rem'
                  }}>
                    <strong>Created:</strong> {orderData.createdAt ? new Date(orderData.createdAt).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>

              {orderData.status === 'processing' && (
                <motion.div
                  className="info-alert"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12, duration: 0.46 }}
                  style={{
                    background: '#f2f8fa',
                    color: '#2e638d',
                    padding: '12px 15px',
                    borderRadius: '7px',
                    fontWeight: '500',
                    marginTop: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '1.02em',
                    boxShadow: '0 2px 10px #b7d0e529'
                  }}
                >
                  <FaClock style={{ marginRight: '8px' }} />
                  Estimated completion:&nbsp;
                  <b>{new Date(orderData.estimatedCompletion).toLocaleString()}</b>
                </motion.div>
              )}

              <div className="result-actions" style={{
                marginTop: '1.3rem',
                display: 'flex',
                gap: '0.7rem'
              }}>
                {/* Download Bill button removed as requested */}
              </div>
            </motion.div>
          )}
        </motion.div>
      </Container>

      <style>{`
        .home-container {
          --light-bg: #f9f6f0;
          --text-dark: #2d2a26;
          --text-medium: #5a5650;
          --pure-white: #ffffff;
          --primary-color: #d4a76a;
          --secondary-color: #b38b4d;
          --shadow: 0 4px 24px rgba(212, 167, 106, 0.12);
          --shadow-hover: 0 8px 32px rgba(212, 167, 106, 0.18);
          --transition: all 0.3s ease;
        }
        
        .primary-btn:hover {
          background: var(--secondary-color) !important;
          transform: translateY(-2px) scale(1.04);
        }
        
        .secondary-btn:hover {
          background: rgba(212, 167, 106, 0.11) !important;
          color: var(--secondary-color) !important;
          border-color: var(--secondary-color) !important;
        }
        
        .form-control:focus, .form-select:focus {
          border-color: #d6b377 !important;
          background: #f8ecd2 !important;
          box-shadow: none !important;
        }
        
        @media (max-width: 730px) {
          .tracking-wrapper { padding-top: 2rem !important; }
          .tracking-header h1 { font-size: 1.5rem !important;}
          .tracking-search-card { padding: 1.15rem !important; }
          .result-card { padding: 1.2rem 0.51rem !important;}
        }
        
        @media (max-width:520px) {
          .search-row { flex-direction: column !important; gap: 12px !important;}
          .result-body { flex-direction: column !important;}
        }
        
        @keyframes fadeInPop {
          0% { opacity: 0; transform: scale(0.91);}
          100% {opacity: 1; transform: scale(1);}
        }
      `}</style>
    </div>
  );
};

export default Tracking;
