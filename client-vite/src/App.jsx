import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';

// Import components
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import PrintJob from './pages/PrintJob.jsx';
import ThankYou from './pages/ThankYou.jsx';
import Tracking from './pages/Tracking.jsx';
import Admin from './pages/Admin.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import NotFound from './pages/NotFound.jsx';
import Faculty from './pages/Facultylogin.jsx';
import ThankYou2 from './pages/ThankYou2.jsx';
import PrintJob2 from './pages/Printjob2.jsx';
import AuthPage from './pages/AuthPage.jsx';

// Import contexts
import { useAuth } from './context/AuthContext.jsx';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext.jsx';

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <AdminAuthProvider>
      <AppContent />
    </AdminAuthProvider>
  );
}

function AppContent() {
  const { admin, loading } = useAdminAuth();
  const { user, loading: userLoading } = useAuth();

  return (
    <div className="App">
      <Helmet>
        <title>Print Repository System</title>
        <meta name="description" content="Efficient printing management for educational institutions" />
      </Helmet>
      
      <Navbar />
      
      <main className="container-fluid p-0">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage />} />
          <Route 
            path="/print-job" 
            element={user ? <PrintJob /> : (userLoading ? null : <Navigate to="/" replace />)} 
          />
          <Route path="/thank-you" element={<ThankYou />} />
          <Route 
            path="/tracking" 
            element={user ? <Tracking /> : (userLoading ? null : <Navigate to="/" replace />)} 
          />
          <Route 
            path="/admin-login" 
            element={admin ? <Admin /> : <AdminLogin />}
          />
          <Route 
            path="/admin" 
            element={
              loading ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: '80vh',
                  color: '#4a5568',
                  fontSize: '1.1rem',
                  fontWeight: 500
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    border: '4px solid #e2e8f0',
                    borderTop: '4px solid #3b82f6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginBottom: '1rem'
                  }} />
                  <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                  Loading Admin Portal...
                </div>
              ) : admin ? (
                <Admin />
              ) : (
                <AdminLogin />
              )
            } 
          />
          <Route path="/faculty-login" element={<Faculty />} />
          <Route path="/departments-login" element={<Faculty />} />
          <Route path="*" element={<NotFound />} />
          <Route path="/thank-you2" element={<ThankYou2 />} />
          
          <Route path="/printjob2" element={<PrintJob2 />} />
        </Routes>
      </main>
    </div>
  );
}

export default App; 