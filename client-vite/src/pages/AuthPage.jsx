import React from 'react';
import { useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import StudentAuthCard from '../components/StudentAuthCard';
import logo from './nialogo-removebg.png';
import './AuthPage.css';

const AuthPage = () => {
  const location = useLocation();
  const initialTab = location.pathname === '/register' ? 'register' : 'login';

  return (
    <div className="auth-page-wrapper">
      <Helmet>
        <title>{initialTab === 'register' ? 'Register Account' : 'Student Login'} - PrintDesk</title>
        <meta name="description" content="Student login and registration portal for academic printing." />
      </Helmet>

      {/* Background decoration */}
      <div className="auth-page-bg-mesh" aria-hidden="true"></div>

      <div className="auth-page-container">
        <div className="auth-page-brand">
          <img src={logo} alt="NIA Educational Institutions" className="auth-page-logo" />
          <h2>PrintDesk Portal</h2>
          <p>Sign in or create an account to submit and track your campus print jobs.</p>
        </div>

        <div className="auth-page-card-area">
          <StudentAuthCard initialTab={initialTab} />
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
