import React, { useEffect, useState, useCallback } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import niaLogo from './nialogo-removebg.png';
import './Admin.css';

const Admin = () => {
  const { admin, loading, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [jobStatusFilter, setJobStatusFilter] = useState('all'); // 'all' | 'pending' | 'completed' | 'delivered' | 'cancelled'
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
      const response = await apiService.get('/admin/print-jobs?page=1&limit=100');
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

  const getBackendBaseUrl = () => {
    const raw = import.meta.env.VITE_API_URL || 'http://localhost:5001';
    return raw.replace(/\/api\/?$/, '');
  };

  const getPdfUrl = (job) => {
    if (!job?.file_path || job?.status === 'cancelled') return '';
    return `${getBackendBaseUrl()}/uploads/${job.file_path}`;
  };

  const viewPdf = (job) => {
    if (job?.status === 'cancelled') {
      alert('File access is restricted for cancelled tasks. Only metadata can be viewed.');
      return;
    }
    if (job?.file_path) {
      const pdfUrl = getPdfUrl(job);
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

  const viewJobPdf = (job) => {
    if (job?.status === 'cancelled') {
      alert('File access is restricted for cancelled tasks. Only metadata can be viewed.');
      return;
    }
    if (job?.file_path) {
      const pdfUrl = getPdfUrl(job);
      window.open(pdfUrl, '_blank');
    }
  };

  const printJobPdf = (job) => {
    if (job?.status === 'cancelled') {
      alert('File access is restricted for cancelled tasks. Only metadata can be viewed.');
      return;
    }
    if (job?.file_path) {
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
    if (job?.status === 'cancelled') {
      alert('File access is restricted for cancelled tasks. Only metadata can be viewed.');
      return;
    }
    if (job?.file_path) {
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

  if (loading) {
    return (
      <div className="admin-loading" style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f8fafc',
        color: '#334155',
        fontSize: '1.2rem',
        fontWeight: 600
      }}>
        Loading Admin Dashboard...
      </div>
    );
  }
  if (!admin) return null;

  const statusCounts = {
    all: printJobs.length,
    pending: printJobs.filter(j => j.status === 'pending' || j.status === 'processing').length,
    completed: printJobs.filter(j => j.status === 'completed').length,
    delivered: printJobs.filter(j => j.status === 'delivered').length,
    cancelled: printJobs.filter(j => j.status === 'cancelled').length,
  };

  const filteredJobs = printJobs.filter(job => {
    if (jobStatusFilter === 'all') return true;
    if (jobStatusFilter === 'pending') return job.status === 'pending' || job.status === 'processing';
    return job.status === jobStatusFilter;
  });

  return (
    <div className="admin-container">
      {/* Header */}
      <header className="admin-header">
        <div className="admin-header-content">
          <h1>Admin Dashboard</h1>
          <div className="admin-logo-wrapper">
            <img src={niaLogo} alt="NIA Logo" className="admin-logo" />
          </div>
          <div className="admin-user-info">
            <span>Welcome, {admin.username}</span>
            <button onClick={logout} className="logout-btn">Logout</button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="admin-nav-container">
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
      </div>

      {/* Main Content */}
      <main className="admin-main">
        {activeTab === 'dashboard' && (
          <div className="dashboard">
            {dashboardData ? (
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
                  {dashboardData.stats.deliveredJobs !== undefined && (
                    <div className="stat-card">
                      <h3>Delivered Jobs</h3>
                      <p className="stat-number delivered">{dashboardData.stats.deliveredJobs}</p>
                    </div>
                  )}
                  {dashboardData.stats.cancelledJobs !== undefined && (
                    <div className="stat-card">
                      <h3>Cancelled Jobs</h3>
                      <p className="stat-number cancelled">{dashboardData.stats.cancelledJobs}</p>
                    </div>
                  )}
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
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#fff', fontSize: '1.1rem' }}>
                Loading dashboard data...
              </div>
            )}
          </div>
        )}

        {activeTab === 'print-jobs' && (
          <div className="print-jobs">
            <div className="print-jobs-header">
              <h2>Print Jobs Management</h2>
            </div>

            {/* Print Jobs Classification Filter Tabs */}
            <div className="job-filter-tabs">
              <button
                className={`filter-tab-btn ${jobStatusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setJobStatusFilter('all')}
              >
                All Tasks <span className="filter-count-badge">{statusCounts.all}</span>
              </button>
              <button
                className={`filter-tab-btn pending ${jobStatusFilter === 'pending' ? 'active' : ''}`}
                onClick={() => setJobStatusFilter('pending')}
              >
                Pending Tasks <span className="filter-count-badge">{statusCounts.pending}</span>
              </button>
              <button
                className={`filter-tab-btn completed ${jobStatusFilter === 'completed' ? 'active' : ''}`}
                onClick={() => setJobStatusFilter('completed')}
              >
                Completed <span className="filter-count-badge">{statusCounts.completed}</span>
              </button>
              <button
                className={`filter-tab-btn delivered ${jobStatusFilter === 'delivered' ? 'active' : ''}`}
                onClick={() => setJobStatusFilter('delivered')}
              >
                Delivered <span className="filter-count-badge">{statusCounts.delivered}</span>
              </button>
              <button
                className={`filter-tab-btn cancelled ${jobStatusFilter === 'cancelled' ? 'active' : ''}`}
                onClick={() => setJobStatusFilter('cancelled')}
              >
                Cancelled <span className="filter-count-badge">{statusCounts.cancelled}</span>
              </button>
            </div>
            
            {loadingData ? (
              <div className="loading">Loading jobs...</div>
            ) : filteredJobs.length === 0 ? (
              <div className="no-jobs-card">
                <p>No print jobs found in category <strong>{jobStatusFilter === 'all' ? 'All Tasks' : jobStatusFilter}</strong>.</p>
              </div>
            ) : (
              <div className="jobs-grid">
                {filteredJobs.map(job => (
                  <div key={job.id} className={`job-card ${job.status}`}>
                    <div className="job-header">
                      <h3>#{job.tracking_number}</h3>
                      <span className={`status-badge ${job.status}`}>
                        {job.status}
                      </span>
                    </div>
                    <div className="job-details">
                      <p><strong>Customer:</strong> {job.customer_name}</p>
                      {job.customer_email && <p><strong>Email:</strong> {job.customer_email}</p>}
                      <p><strong>Type:</strong> {job.print_type}</p>
                      <p><strong>Quantity:</strong> {job.quantity}</p>
                      <p><strong>Price:</strong> {formatPrice(job.total_price)}</p>
                      <p><strong>Date:</strong> {formatDate(job.created_at)}</p>
                      <p><strong>Paper Size:</strong> {job.paper_size || "A4"}</p>
                      <p><strong>Binding:</strong> {job.binding_type || "N/A"}</p>
                    </div>

                    <div className="job-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {/* Cancelled jobs: Admin can only view metadata and cannot access files */}
                      {job.status === 'cancelled' ? (
                        <div className="cancelled-file-restricted" title="File access is restricted for cancelled tasks. Only metadata is available.">
                          <span className="lock-icon">🔒</span>
                          <span className="restricted-text">File Access Restricted</span>
                        </div>
                      ) : (
                        <div className="file-btn-group" style={{ display: 'flex', gap: '0.4rem' }}>
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
                        </div>
                      )}

                      <select
                        value={job.status}
                        onChange={(e) => updateJobStatus(job.id, e.target.value)}
                        className="status-select"
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="completed">Completed</option>
                        <option value="delivered">Delivered</option>
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
    </div>
  );
};

export default Admin; 
