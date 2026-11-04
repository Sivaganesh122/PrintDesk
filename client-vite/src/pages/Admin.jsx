import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { buildPrintFile, copyCount } from '../utils/printFile';
import { ACTIVE_PRINT_STATES, PRINT_STATE_LABELS } from '../utils/printStatus';
import PrintDialog from '../components/PrintDialog';
import PrintersPanel from '../components/PrintersPanel';
import niaLogo from './nialogo-removebg.png';
import './Admin.css';

const Admin = () => {
  const { admin, loading, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [jobStatusFilter, setJobStatusFilter] = useState('all'); // 'all' | 'pending' | 'completed' | 'delivered' | 'cancelled'
  const [dashboardData, setDashboardData] = useState(null);
  const [printJobs, setPrintJobs] = useState([]);
  const [jobSearch, setJobSearch] = useState('');
  const latestJobsRequest = useRef(0);
  const [loadingData, setLoadingData] = useState(false);
  const [printingJob, setPrintingJob] = useState(null);
  const [printerInfo, setPrinterInfo] = useState(null);
  const [printEvents, setPrintEvents] = useState([]);
  const [showPrintLog, setShowPrintLog] = useState(false);
  const [printDialogJob, setPrintDialogJob] = useState(null);

  useEffect(() => {
    if (!loading && !admin) navigate('/admin-login');
  }, [admin, loading, navigate]);

  const loadPrintJobs = useCallback(async () => {
    // A slower earlier search must not overwrite the results of a newer one
    const request = ++latestJobsRequest.current;
    setLoadingData(true);
    try {
      const response = await apiService.get('/admin/print-jobs', {
        params: { page: 1, limit: 100, search: jobSearch.trim() || undefined }
      });
      if (response.data.success && request === latestJobsRequest.current) {
        setPrintJobs(response.data.data.jobs);
      }
    } catch (error) {
      console.error('Error loading print jobs:', error);
    } finally {
      if (request === latestJobsRequest.current) setLoadingData(false);
    }
  }, [jobSearch]);

  useEffect(() => {
    if (admin) loadDashboardData();
  }, [admin]);

  // Waits for a pause in typing before searching
  useEffect(() => {
    if (!admin) return undefined;
    const timer = setTimeout(loadPrintJobs, jobSearch ? 300 : 0);
    return () => clearTimeout(timer);
  }, [admin, loadPrintJobs, jobSearch]);

  const loadPrinters = useCallback(async () => {
    try {
      const response = await apiService.get('/admin/printers');
      if (response.data.success) setPrinterInfo(response.data.data);
    } catch (error) {
      console.error('Error loading printers:', error);
    }
  }, []);

  const loadPrintEvents = useCallback(async () => {
    try {
      const response = await apiService.get('/admin/print-events', { params: { limit: 50 } });
      if (response.data.success) setPrintEvents(response.data.data);
    } catch (error) {
      console.error('Error loading printer activity:', error);
    }
  }, []);

  // Printer states change on their own (out of paper, offline...), so they are checked regularly
  useEffect(() => {
    if (!admin || activeTab !== 'print-jobs') return undefined;
    loadPrinters();
    const timer = setInterval(loadPrinters, 4000);
    return () => clearInterval(timer);
  }, [admin, activeTab, loadPrinters]);

  useEffect(() => {
    if (!admin || activeTab !== 'print-jobs' || !showPrintLog) return undefined;
    loadPrintEvents();
    const timer = setInterval(loadPrintEvents, 3000);
    return () => clearInterval(timer);
  }, [admin, activeTab, showPrintLog, loadPrintEvents]);

  // Follows jobs on their way through a printer
  const jobsPrinting = printJobs.some(job => ACTIVE_PRINT_STATES.includes(job.print_state));
  useEffect(() => {
    if (!admin || !jobsPrinting) return undefined;
    const timer = setInterval(loadPrintJobs, 2000);
    return () => clearInterval(timer);
  }, [admin, jobsPrinting, loadPrintJobs]);

  // Sends the job to a printer connected to the server's computer. Errors are shown in the print screen.
  const sendToPrinter = async (job, settings) => {
    await apiService.post(`/admin/print-jobs/${job.id}/print`, settings);
    setPrintDialogJob(null);
    loadPrintJobs();
    loadPrinters();
    if (showPrintLog) loadPrintEvents();
  };

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
  const fetchJobFile = async (job) => {
    const response = await apiService.get(`/admin/print-jobs/${job.id}/file`, { responseType: 'blob' });
    return response.data;
  };

  const fetchJobFileUrl = async (job) => window.URL.createObjectURL(await fetchJobFile(job));

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
      let file;
      try {
        file = await fetchJobFile(job);
      } catch {
        alert('Unable to print the file. It may no longer exist.');
        return;
      }

      // Builds a file with only the student's pages, once per copy. If that fails, for example
      // for a protected PDF, the original is printed and the pages and copies are set by hand.
      try {
        file = await buildPrintFile(file, job, getFileExtension(job));
      } catch (error) {
        console.error('Could not prepare the file for printing:', error);
        alert(`This file could not be prepared for printing. In the print dialog, set Pages to ${formatPages(job.selected_pages)} and Copies to ${copyCount(job)}.`);
      }

      // The settings no file can carry stay on screen, below the print dialog, until it closes
      setPrintingJob(job);
      const url = window.URL.createObjectURL(file);
      // The previous job's frame is finished with once another job is printed
      document.querySelectorAll('iframe[data-print-frame]').forEach((frame) => {
        window.URL.revokeObjectURL(frame.src);
        frame.remove();
      });
      const printFrame = document.createElement('iframe');
      printFrame.dataset.printFrame = 'true';
      printFrame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
      printFrame.src = url;
      printFrame.onload = () => {
        printFrame.contentWindow.addEventListener('afterprint', () => setPrintingJob(null));
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
      };
      document.body.appendChild(printFrame);
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

            <PrintersPanel info={printerInfo} events={printEvents} onShowLog={setShowPrintLog} />

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

            <div className="job-search">
              <input
                type="search"
                className="job-search-input"
                placeholder="Search by register number"
                aria-label="Search by register number"
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
              />
              {jobSearch && (
                <button type="button" className="job-search-clear" onClick={() => setJobSearch('')}>
                  Clear
                </button>
              )}
            </div>

            {loadingData && printJobs.length === 0 ? (
              <div className="loading">Loading jobs...</div>
            ) : filteredJobs.length === 0 ? (
              <div className="no-jobs-card">
                <p>
                  No print jobs found in category <strong>{jobStatusFilter === 'all' ? 'All Tasks' : jobStatusFilter}</strong>
                  {jobSearch.trim() && <> for register number <strong>{jobSearch.trim()}</strong></>}.
                </p>
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

                    {job.print_state && (
                      <div className={`print-progress ${job.print_state}`} role="status">
                        <div className="print-progress-head">
                          <span className="print-progress-label">{PRINT_STATE_LABELS[job.print_state] || job.print_state}</span>
                          {job.print_printer && <span className="print-progress-printer">{job.print_printer}</span>}
                        </div>
                        {job.print_message && job.print_message !== PRINT_STATE_LABELS[job.print_state] && (
                          <p className="print-progress-message">{job.print_message}</p>
                        )}
                        {job.print_state === 'printing' && job.print_total_pages > 0 && (
                          <div className="print-progress-bar" aria-hidden="true">
                            <span style={{ width: `${Math.min(100, Math.round(((job.print_pages_printed || 0) / job.print_total_pages) * 100))}%` }} />
                          </div>
                        )}
                      </div>
                    )}

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
                            onClick={() => job.file_path ? setPrintDialogJob(job) : alert('No PDF available for this job.')}
                            className="btn btn-success"
                            title={job.file_path ? 'Print on a printer connected to this computer' : 'No PDF available'}
                            disabled={!job.file_path || ACTIVE_PRINT_STATES.includes(job.print_state)}
                          >
                            {ACTIVE_PRINT_STATES.includes(job.print_state) ? 'Printing...' : 'Print'}
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

      <PrintDialog
        job={printDialogJob}
        printers={printerInfo?.printers}
        onPrint={sendToPrinter}
        onBrowserPrint={printJobPdf}
        onClose={() => setPrintDialogJob(null)}
      />

      {printingJob && (
        <div className="print-check-bar" role="status">
          <span>
            Printing #{printingJob.tracking_number}. In the print dialog, check{' '}
            <strong>Colour: {printingJob.color_type === 'Color' ? 'Colour' : 'Black and white'}</strong>
            {' and '}
            <strong>{printingJob.double_sided ? 'Print on both sides' : 'Print on one side'}</strong>.
            {' '}Pages and copies ({copyCount(printingJob)}) are already in the file.
          </span>
          <button type="button" className="print-check-close" onClick={() => setPrintingJob(null)} aria-label="Close">×</button>
        </div>
      )}
    </div>
  );
};

export default Admin; 
