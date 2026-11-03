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

  const updateJobStatus = async (jobId, status) => {
    try {
      const response = await apiService.patch(`/admin/print-jobs/${jobId}/status`, { status });
      if (response.data.success) {
        loadPrintJobs();
        loadDashboardData();
      }
    } catch (error) {
      console.error('Error updating job status:', error);
      alert(error.response?.data?.error || 'Failed to update the job status.');
    }
  };

  // Uploaded files need the admin login, so they are fetched rather than linked to directly
  const fetchJobFileUrl = async (job) => {
    const response = await apiService.get(`/admin/print-jobs/${job.id}/file`, { responseType: 'blob' });
    return window.URL.createObjectURL(response.data);
  };

  const getFileExtension = (job) => job.file_path.split('.').pop().toLowerCase();

  const formatPages = (pages) => (pages?.length ? pages.join(', ') : 'Not recorded');

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

  const viewJobPdf = async (job) => {
    if (job?.status === 'cancelled') {
      alert('File access is restricted for cancelled tasks. Only metadata can be viewed.');
      return;
    }
    if (job?.file_path) {
      // Open the tab during the click, otherwise the browser treats it as a popup
      const viewWindow = window.open('', '_blank');
      if (!viewWindow) {
        alert('Your browser blocked the new tab. Allow pop-ups for this site, or use Download.');
        return;
      }
      try {
        viewWindow.location.href = await fetchJobFileUrl(job);
      } catch {
        viewWindow.close();
        alert('Unable to open the file. It may no longer exist.');
      }
    }
  };

  const printJobPdf = async (job) => {
    if (job?.status === 'cancelled') {
      alert('File access is restricted for cancelled tasks. Only metadata can be viewed.');
      return;
    }
    if (job?.file_path) {
      if (!['pdf', 'jpg', 'jpeg', 'png'].includes(getFileExtension(job))) {
        alert('Word documents cannot be printed from the browser. Download the file and print it from Word.');
        return;
      }
      try {
        const url = await fetchJobFileUrl(job);
        const printFrame = document.createElement('iframe');
        printFrame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
        printFrame.src = url;
        printFrame.onload = () => {
          printFrame.contentWindow.focus();
          printFrame.contentWindow.print();
        };
        document.body.appendChild(printFrame);
      } catch {
        alert('Unable to print the file. It may no longer exist.');
      }
    }
  };

  const downloadJobPdf = async (job) => {
    if (job?.status === 'cancelled') {
      alert('File access is restricted for cancelled tasks. Only metadata can be viewed.');
      return;
    }
    if (job?.file_path) {
      try {
        const url = await fetchJobFileUrl(job);
        const link = document.createElement('a');
        link.href = url;
        link.download = job.original_filename || `print-job-${job.id}.${getFileExtension(job)}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      } catch {
        alert('Unable to download the file. It may no longer exist.');
      }
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
                      {job.original_filename && <p><strong>File:</strong> {job.original_filename}</p>}
                      {job.order_number && (
                        <p style={{ overflowWrap: 'anywhere' }}>
                          <strong>Order:</strong> {job.order_number} (document {job.order_document_number} of {job.order_document_count})
                        </p>
                      )}
                      <p><strong>Pages:</strong> {formatPages(job.selected_pages)} ({job.quantity} total)</p>
                      <p><strong>Copies:</strong> {job.copies}</p>
                      <p><strong>Color:</strong> {job.color_type}</p>
                      <p><strong>Sides:</strong> {job.double_sided ? 'Double-sided' : 'Single-sided'}</p>
                      <p><strong>Paper Size:</strong> {job.paper_size}</p>
                      <p><strong>Binding:</strong> {job.binding}</p>
                      <p><strong>Price:</strong> {formatPrice(job.total_price)}</p>
                      <p><strong>Date:</strong> {formatDate(job.created_at)}</p>
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
      </main>
    </div>
  );
};

export default Admin; 
