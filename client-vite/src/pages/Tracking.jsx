import React, { useEffect, useState } from 'react';
import { Container, Table, Badge } from 'react-bootstrap';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { FaFileAlt, FaClock, FaCheckCircle, FaTimes } from 'react-icons/fa';
import { apiService } from '../services/api';

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

const STATUS_BADGES = {
  pending: { variant: 'warning', icon: FaClock, gradient: 'linear-gradient(90deg, #ffd972, #deae40)' },
  processing: { variant: 'info', icon: FaClock, gradient: 'linear-gradient(90deg, #abcff2 82%, #7bb6e6 99%)' },
  completed: { variant: 'success', icon: FaCheckCircle, gradient: 'linear-gradient(90deg, #9be17f, #67c25f)' },
  delivered: { variant: 'success', icon: FaCheckCircle, gradient: 'linear-gradient(90deg, #9be17f, #67c25f)' },
  cancelled: { variant: 'danger', icon: FaTimes, gradient: 'linear-gradient(90deg, #ff9884 10%, #f6583c 88%)' }
};

// The server returns the documents of an order next to each other. Jobs from before
// orders could hold several documents have no order number, so each one stands alone.
const groupByOrder = (documents) => {
  const orders = [];
  documents.forEach((document) => {
    const lastOrder = orders[orders.length - 1];
    if (document.orderNumber && lastOrder?.orderNumber === document.orderNumber) {
      lastOrder.documents.push(document);
    } else {
      orders.push({
        key: document.orderNumber || document.token,
        orderNumber: document.orderNumber,
        createdAt: document.createdAt,
        documents: [document]
      });
    }
  });
  return orders;
};

const formatPrice = (price) => `₹${parseFloat(price).toFixed(2)}`;

const Tracking = () => {
  const [loading, setLoading] = useState(true);
  const [ordersList, setOrdersList] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    const loadOrders = async () => {
      try {
        const { data } = await apiService.getMyOrders();
        if (!ignore) {
          setOrdersList(data.orders);
        }
      } catch (error) {
        console.error('Error fetching orders:', error);
        if (!ignore) {
          setError(error.response?.data?.error || 'Could not load your orders. Please try again.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadOrders();
    return () => {
      ignore = true;
    };
  }, []);

  const getStatusBadge = (status) => {
    const config = STATUS_BADGES[status] || STATUS_BADGES.pending;
    const Icon = config.icon;

    return (
      <Badge
        bg={config.variant}
        style={{
          background: config.gradient,
          padding: '6px 12px 6px 9px',
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
        <title>Track Order - PrintDesk</title>
      </Helmet>

      <AnimatedBackground />

      <Container className="tracking-wrapper" style={{
        maxWidth: '1140px',
        margin: '0 auto',
        padding: '2rem 1rem 2.6rem 1rem',
        position: 'relative',
        zIndex: 2
      }}>
        <motion.div
          className="tracking-header text-center mb-4"
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
            <FaFileAlt />
            Track Your Order
          </h1>
          <p style={{
            color: 'var(--text-medium)',
            fontSize: '1.07rem',
            marginBottom: 0,
            fontWeight: '500'
          }}>
            All your orders, latest first.
          </p>
        </motion.div>

        {loading && (
          <p className="text-center" style={{ color: 'var(--text-medium)', fontWeight: '500' }}>
            Loading your orders...
          </p>
        )}

        {error && (
          <div
            className="result-alert error-alert"
            role="alert"
            style={{
              padding: '1.13rem 1rem',
              borderRadius: '9px',
              fontWeight: '500',
              background: '#fdecf0',
              color: '#bf1b1b',
              border: '1.2px solid #ffd2c3'
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && ordersList.length === 0 && (
          <p className="text-center" style={{ color: 'var(--text-medium)', fontWeight: '500' }}>
            You have no orders yet.
          </p>
        )}

        {ordersList.length > 0 && (
          <div className="orders-table-card" style={{
            borderRadius: '15px',
            background: 'var(--pure-white)',
            boxShadow: 'var(--shadow)',
            padding: '0.75rem'
          }}>
            <Table responsive hover className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Pages</th>
                  <th>Copies</th>
                  <th>Print</th>
                  <th>Paper</th>
                  <th>Binding</th>
                  <th className="text-end">Price</th>
                  <th>Status</th>
                </tr>
              </thead>
              {groupByOrder(ordersList).map((order) => (
                <tbody key={order.key} className="order-group">
                  <tr className="order-group-header">
                    <td colSpan={8} style={{ background: '#fbf3e2', overflowWrap: 'anywhere' }}>
                      <strong>{order.orderNumber ? `Order ${order.orderNumber}` : 'Earlier order'}</strong>
                      <span className="text-muted">
                        {' · '}{new Date(order.createdAt).toLocaleString()}
                        {' · '}{order.documents.length} {order.documents.length === 1 ? 'document' : 'documents'}
                        {' · '}Total {formatPrice(order.documents.reduce((sum, document) => sum + parseFloat(document.price), 0))}
                      </span>
                    </td>
                  </tr>
                  {order.documents.map((document) => (
                    <tr key={document.token} className="order-document">
                      <td style={{ minWidth: 210, overflowWrap: 'anywhere' }}>
                        <div style={{ fontWeight: '600' }}>{document.fileName || 'Print job'}</div>
                        <div className="small text-muted">Token: {document.token}</div>
                      </td>
                      <td>{document.totalPages}</td>
                      <td>{document.copies}</td>
                      <td style={{ minWidth: 120 }}>
                        {document.colorType}
                        <div className="small text-muted">{document.doubleSided ? 'Double-sided' : 'Single-sided'}</div>
                      </td>
                      <td>{document.paperSize}</td>
                      <td>{document.binding}</td>
                      <td className="text-end" style={{ whiteSpace: 'nowrap' }}>{formatPrice(document.price)}</td>
                      <td>{getStatusBadge(document.status)}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </Table>
          </div>
        )}
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
