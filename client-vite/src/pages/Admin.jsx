import React, { useEffect, useState, useCallback } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import './Admin.css';

const Admin = () => {
  const { admin, loading, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [printJobs, setPrintJobs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [pdfViewer, setPdfViewer] = useState({ show: false, url: '', jobId: null });
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!loading && !admin) navigate('/admin-login');
  }, [admin, loading, navigate]);

  const loadPrintJobs = useCallback(async () => {
    setLoadingData(true);
    try {
      const response = await apiService.get('/admin/print-jobs?page=1&limit=10');
      if (response.data.success) {
        setPrintJobs(response.data.data.jobs);
      }
    } catch (error) {
      console.error('Error loading print jobs:', error);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (admin) {
      loadDashboardData();
      loadPrintJobs();
      loadPayments();
    }
  }, [admin, loadPrintJobs]);

  const loadDashboardData = async () => {
    try {
      const response = await apiService.get('/admin/dashboard');
      if (response.data.success) {
        setDashboardData(response.data.data);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const loadPayments = async () => {
    try {
      const response = await apiService.get('/admin/payments?page=1&limit=10');
      if (response.data.success) {
        setPayments(response.data.data.payments);
      }
    } catch (error) {
      console.error('Error loading payments:', error);
    }
  };

  const updateJobStatus = async (jobId, status) => {
    try {
      const response = await apiService.patch(`/admin/print-jobs/${jobId}/status`, { status });
      if (response.data.success) {
        loadPrintJobs();
        loadDashboardData();
      }
    } catch (error) {
      console.error('Error updating job status:', error);
    }
  };

  const viewPdf = (job) => {
    if (job.file_path) {
      const pdfUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/uploads/${job.file_path}`;
      setPdfViewer({ show: true, url: pdfUrl, jobId: job.id });
    }
  };

  const printPdf = () => {
    if (pdfViewer.url) {
      const printWindow = window.open(pdfViewer.url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    }
  };

  const printDirectly = () => {
    if (pdfViewer.url) {
      // Show loading message
      alert('Preparing print... Please wait.');
      
      // Method 1: Try using fetch to get PDF data and print
      fetch(pdfViewer.url)
        .then(response => response.blob())
        .then(blob => {
          const url = URL.createObjectURL(blob);
          const printWindow = window.open(url, '_blank');
          if (printWindow) {
            printWindow.onload = () => {
              setTimeout(() => {
                printWindow.print();
                alert('Print dialog opened! Please select your printer and print settings.');
              }, 1000);
            };
          } else {
            // Fallback to iframe method
            printWithIframe();
          }
        })
        .catch(error => {
          console.error('Fetch error:', error);
          // Fallback to iframe method
          printWithIframe();
        });
    } else {
      alert('No PDF available to print.');
    }
  };

  const printWithIframe = () => {
    // Create a hidden iframe for printing
    const printFrame = document.createElement('iframe');
    printFrame.style.display = 'none';
    printFrame.src = pdfViewer.url;
    
    printFrame.onload = () => {
      try {
        // Wait a bit for PDF to fully load
        setTimeout(() => {
          printFrame.contentWindow.print();
          alert('Print dialog opened! Please select your printer and print settings.');
        }, 1000);
      } catch (error) {
        console.error('Print error:', error);
        alert('Direct printing failed. Opening PDF in new window...');
        // Fallback to opening in new window
        const printWindow = window.open(pdfViewer.url, '_blank');
        if (printWindow) {
          printWindow.onload = () => {
            printWindow.print();
          };
        }
      }
      
      // Remove the iframe after printing
      setTimeout(() => {
        if (document.body.contains(printFrame)) {
          document.body.removeChild(printFrame);
        }
      }, 5000);
    };
    
    printFrame.onerror = () => {
      alert('Failed to load PDF. Opening in new window...');
      const printWindow = window.open(pdfViewer.url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    };
    
    document.body.appendChild(printFrame);
  };

  const downloadPdf = () => {
    if (pdfViewer.url) {
      const link = document.createElement('a');
      link.href = pdfViewer.url;
      link.download = `print-job-${pdfViewer.jobId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      alert('No PDF available to download.');
    }
  };

  const closePdfViewer = () => {
    setPdfViewer({ show: false, url: '', jobId: null });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price) => {
    return `₹${parseFloat(price).toFixed(2)}`;
  };

  const getPdfUrl = (job) => {
    return `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/uploads/${job.file_path}`;
  };

  const viewJobPdf = (job) => {
    if (job.file_path) {
      const pdfUrl = getPdfUrl(job);
      fetch(pdfUrl)
        .then(res => {
          if (!res.ok) throw new Error('File not found');
          return res.blob();
        })
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          window.open(url, '_blank');
        })
        .catch(() => alert('Unable to view PDF. File may not exist.'));
    }
  };

  const printJobPdf = (job) => {
    if (job.file_path) {
      const pdfUrl = getPdfUrl(job);
      fetch(pdfUrl)
        .then(res => {
          if (!res.ok) throw new Error('File not found');
          return res.blob();
        })
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const printWindow = window.open(url, '_blank');
          if (printWindow) {
            printWindow.onload = () => {
              setTimeout(() => {
                printWindow.print();
              }, 1000);
            };
          }
        })
        .catch(() => alert('Unable to print PDF. File may not exist.'));
    }
  };

  const downloadJobPdf = (job) => {
    if (job.file_path) {
      const pdfUrl = getPdfUrl(job);
      fetch(pdfUrl)
        .then(res => {
          if (!res.ok) throw new Error('File not found');
          return res.blob();
        })
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `print-job-${job.id}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        })
        .catch(() => alert('Unable to download PDF. File may not exist.'));
    }
  };

  if (loading) return <div className="admin-loading">Loading...</div>;
  if (!admin) return null;

  return (
    <div className="admin-container">
      {/* Header */}
      <header className="admin-header">
        <div className="admin-header-content">
          <h1>Admin Dashboard</h1>
          <div className="admin-user-info">
            <span>Welcome, {admin.username}</span>
            <button onClick={logout} className="logout-btn">Logout</button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="admin-nav">
        <button 
          className={activeTab === 'dashboard' ? 'active' : ''} 
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button 
          className={activeTab === 'print-jobs' ? 'active' : ''} 
          onClick={() => setActiveTab('print-jobs')}
        >
          Print Jobs
        </button>
        <button 
          className={activeTab === 'payments' ? 'active' : ''} 
          onClick={() => setActiveTab('payments')}
        >
          Payments
        </button>
      </nav>

      {/* Main Content */}
      <main className="admin-main">
        {activeTab === 'dashboard' && (
          <div className="dashboard">
            {dashboardData && (
              <>
                <div className="stats-grid">
                  <div className="stat-card">
                    <h3>Total Jobs</h3>
                    <p className="stat-number">{dashboardData.stats.totalJobs}</p>
                  </div>
                  <div className="stat-card">
                    <h3>Pending Jobs</h3>
                    <p className="stat-number pending">{dashboardData.stats.pendingJobs}</p>
                  </div>
                  <div className="stat-card">
                    <h3>Completed Jobs</h3>
                    <p className="stat-number completed">{dashboardData.stats.completedJobs}</p>
                  </div>
                  <div className="stat-card">
                    <h3>Total Revenue</h3>
                    <p className="stat-number revenue">{formatPrice(dashboardData.stats.totalRevenue)}</p>
                  </div>
                </div>

                <div className="recent-jobs">
                  <h2>Recent Print Jobs</h2>
                  <div className="jobs-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Tracking #</th>
                          <th>Customer</th>
                          <th>Type</th>
                          <th>Price</th>
                          <th>Status</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboardData.recentJobs.map(job => (
                          <tr key={job.id}>
                            <td>{job.tracking_number}</td>
                            <td>{job.customer_name}</td>
                            <td>{job.print_type}</td>
                            <td>{formatPrice(job.total_price)}</td>
                            <td>
                              <span className={`status-badge ${job.status}`}>
                                {job.status}
                              </span>
                            </td>
                            <td>{formatDate(job.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'print-jobs' && (
          <div className="print-jobs">
            <h2>Print Jobs Management</h2>
            
            {loadingData ? (
              <div className="loading">Loading jobs...</div>
            ) : (
              <div className="jobs-grid">
                {printJobs.map(job => (
                  <div key={job.id} className="job-card">
                    <div className="job-header">
                      <h3>#{job.tracking_number}</h3>
                      <span className={`status-badge ${job.status}`}>
                        {job.status}
                      </span>
                    </div>
                    <div className="job-details">
                      <p><strong>Customer:</strong> {job.customer_name}</p>
                      <p><strong>Type:</strong> {job.print_type}</p>
                      <p><strong>Quantity:</strong> {job.quantity}</p>
                      <p><strong>Price:</strong> {formatPrice(job.total_price)}</p>
                      <p><strong>Date:</strong> {formatDate(job.created_at)}</p>
                      <p><strong>Paper Size:</strong> {job.paper_size || "A4"}</p>
                      <p><strong>Binding:</strong> {job.binding_type || "N/A"}</p>
                    </div>
                    <div className="job-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        onClick={() => job.file_path ? viewJobPdf(job) : alert('No PDF available for this job.')}
                        className="btn btn-primary"
                        title={job.file_path ? 'View PDF' : 'No PDF available'}
                        disabled={!job.file_path}
                      >
                        View
                      </button>
                      <button
                        onClick={() => job.file_path ? printJobPdf(job) : alert('No PDF available for this job.')}
                        className="btn btn-success"
                        title={job.file_path ? 'Print PDF' : 'No PDF available'}
                        disabled={!job.file_path}
                      >
                        Print
                      </button>
                      <button
                        onClick={() => job.file_path ? downloadJobPdf(job) : alert('No PDF available for this job.')}
                        className="btn btn-info"
                        title={job.file_path ? 'Download PDF' : 'No PDF available'}
                        disabled={!job.file_path}
                      >
                        Download
                      </button>
                      <select
                        value={job.status}
                        onChange={(e) => updateJobStatus(job.id, e.target.value)}
                        className="status-select"
                        style={{ marginLeft: '0.5rem' }}
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="payments">
            <h2>Payment History</h2>
            <div className="payments-table">
              <table>
                <thead>
                  <tr>
                    <th>Transaction ID</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(payment => (
                    <tr key={payment.id}>
                      <td>{payment.transaction_id}</td>
                      <td>{payment.customer_name}</td>
                      <td>{formatPrice(payment.amount)}</td>
                      <td>{payment.payment_method}</td>
                      <td>
                        <span className={`status-badge ${payment.status}`}>
                          {payment.status}
                        </span>
                      </td>
                      <td>{formatDate(payment.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* PDF Viewer Modal */}
      {pdfViewer.show && (
        <div className="pdf-modal">
          <div className="pdf-modal-content">
            <div className="pdf-modal-header">
              <h3>PDF Viewer</h3>
              <div className="pdf-actions">
                <button onClick={printDirectly} className="btn btn-success">
                  Print Directly
                </button>
                <button onClick={printPdf} className="btn btn-primary">
                  Print PDF
                </button>
                <button onClick={downloadPdf} className="btn btn-info">
                  Download PDF
                </button>
                <button onClick={closePdfViewer} className="btn btn-secondary">
                  Close
                </button>
              </div>
            </div>
            <div className="pdf-viewer">
              <iframe
                src={pdfViewer.url}
                title="PDF Viewer"
                width="100%"
                height="600px"
              />
            </div>
          </div>
        </div>
      )}
      <footer style={{ textAlign: 'center', margin: '2rem 0' }}>
        <button onClick={logout} className="logout-btn">Logout</button>
      </footer>
    </div>
  );
};

export default Admin; 
