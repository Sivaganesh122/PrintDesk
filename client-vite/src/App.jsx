import React from 'react';
import { Routes, Route } from 'react-router-dom';
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
  const { admin } = useAdminAuth();

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
          <Route path="/print-job" element={<PrintJob />} />
          <Route path="/thank-you" element={<ThankYou />} />
          <Route path="/tracking" element={<Tracking />} />
          <Route 
            path="/admin-login" 
            element={<AdminLogin />}
          />
          <Route 
            path="/admin" 
            element={
              admin ? <Admin /> : <AdminLogin />
            } 
          />
          <Route path="/faculty-login" element={<Faculty />} />
          <Route path="*" element={<NotFound />} />
          <Route path="/thank-you2" element={<ThankYou2 />} />
          
          <Route path="/printjob2" element={<PrintJob2 />} />
        </Routes>
      </main>
    </div>
  );
}

export default App; 