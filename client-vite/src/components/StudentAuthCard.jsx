import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaEye, FaEyeSlash, FaArrowRight, FaSearch, FaSignOutAlt, FaUserCheck } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import './StudentAuthCard.css';

const DEPARTMENTS = [
  'Computer Science and Engineering (CSE)',
  'Information Technology (IT)',
  'Artificial Intelligence and Machine Learning (AIML)',
  'Cyber Security',
  'Automobile Engineering',
  'ACT',
  'Artificial Intelligence and Data Science (AI & DS)',
  'Electronics and Communication Engineering (ECE)',
  'Electrical and Electronics Engineering (EEE)',
  'Mechanical Engineering (MECH)',
  'Civil Engineering (CIVIL)',
  'Master of Computer Applications (MCA)',
  'Management Studies (MBA)',
  'Other Department'
];

const StudentAuthCard = ({ initialTab = 'login', onAuthSuccess }) => {
  const { user, login, register, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(initialTab); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Login form state
  const [loginData, setLoginData] = useState({
    registration_number: '',
    password: ''
  });

  // Register form state
  const [registerData, setRegisterData] = useState({
    name: '',
    registration_number: '',
    department: DEPARTMENTS[0],
    email: '',
    password: '',
    confirm_password: ''
  });

  const handleLoginChange = (e) => {
    setError('');
    setLoginData({ ...loginData, [e.target.name]: e.target.value });
  };

  const handleRegisterChange = (e) => {
    setError('');
    setRegisterData({ ...registerData, [e.target.name]: e.target.value });
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!loginData.registration_number.trim() || !loginData.password) {
      setError('Please provide both registration number and password.');
      return;
    }

    setLoading(true);
    const res = await login(loginData.registration_number, loginData.password);
    setLoading(false);

    if (res.success) {
      toast.success(`Welcome back, ${res.user?.name || 'Student'}!`);
      if (onAuthSuccess) {
        onAuthSuccess(res.user);
      } else {
        navigate('/');
      }
    } else {
      setError(res.error || 'Login failed. Please check your credentials.');
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    // Basic client validation
    if (!registerData.name.trim()) {
      setError('Full name is required.');
      return;
    }
    if (!registerData.registration_number.trim()) {
      setError('Registration number is required.');
      return;
    }
    if (!registerData.department) {
      setError('Please select a department.');
      return;
    }
    if (!registerData.email.trim() || !registerData.email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!registerData.password || registerData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (registerData.password !== registerData.confirm_password) {
      setError('Passwords do not match. Please verify your password.');
      return;
    }

    setLoading(true);
    const res = await register(registerData);
    setLoading(false);

    if (res.success) {
      toast.success('Registration successful! Welcome to PrintDesk.');
      if (onAuthSuccess) {
        onAuthSuccess(res.user);
      } else {
        navigate('/');
      }
    } else {
      setError(res.error || 'Registration failed. Please try again.');
    }
  };

  // If already logged in, show student session status with Quick Actions
  if (isAuthenticated && user) {
    return (
      <motion.div
        className="student-auth-box auth-logged-in-card"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="user-welcome-header">
          <div className="user-avatar-circle">
            {user.name ? user.name.charAt(0).toUpperCase() : <FaUserCheck />}
          </div>
          <div className="user-details">
            <h4>Welcome, {user.name}</h4>
            <p className="user-meta">
              Reg. No: <strong>{user.registration_number}</strong> • {user.department}
            </p>
          </div>
        </div>

        <div className="user-card-actions">
          <button
            onClick={() => navigate('/print-job')}
            className="action-btn-primary"
          >
            Start Printing <FaArrowRight />
          </button>
          <button
            onClick={() => navigate('/tracking')}
            className="action-btn-secondary"
          >
            <FaSearch /> Track Order
          </button>
          <button
            onClick={logout}
            className="action-btn-logout"
          >
            <FaSignOutAlt /> Sign Out
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="student-auth-box"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Tab Switcher */}
      <div className="auth-tabs">
        <button
          type="button"
          className={`auth-tab-btn ${activeTab === 'login' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('login');
            setError('');
          }}
        >
          Sign In
        </button>
        <button
          type="button"
          className={`auth-tab-btn ${activeTab === 'register' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('register');
            setError('');
          }}
        >
          New Register
        </button>
      </div>

      {/* Header Info */}
      <div className="auth-box-header">
        <h3>{activeTab === 'login' ? 'Student Sign In' : 'Create Student Account'}</h3>
        <p>
          {activeTab === 'login'
            ? 'Enter your registration number and password to proceed.'
            : 'Register your details to start printing documents securely.'}
        </p>
      </div>

      {/* Alert Messages */}
      {error && <div className="auth-alert error">{error}</div>}
      {successMsg && <div className="auth-alert success">{successMsg}</div>}

      <AnimatePresence mode="wait">
        {activeTab === 'login' ? (
          /* LOGIN FORM */
          <motion.form
            key="login-form"
            onSubmit={handleLoginSubmit}
            className="student-auth-form"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="auth-input-group">
              <label>Registration Number</label>
              <div className="auth-input-wrapper">
                <input
                  type="text"
                  name="registration_number"
                  placeholder="e.g. 7276XXXXXXXX"
                  value={loginData.registration_number}
                  onChange={handleLoginChange}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="auth-input-group">
              <label>Password</label>
              <div className="auth-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Enter your password"
                  value={loginData.password}
                  onChange={handleLoginChange}
                  className="with-icon"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <p className="auth-switch-prompt">
              Don't have an account?{' '}
              <button
                type="button"
                className="auth-switch-link"
                onClick={() => {
                  setActiveTab('register');
                  setError('');
                }}
              >
                Register here
              </button>
            </p>
          </motion.form>
        ) : (
          /* REGISTRATION FORM */
          <motion.form
            key="register-form"
            onSubmit={handleRegisterSubmit}
            className="student-auth-form"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="auth-form-row">
              <div className="auth-input-group">
                <label>Full Name</label>
                <div className="auth-input-wrapper">
                  <input
                    type="text"
                    name="name"
                    placeholder="e.g. Harry Potter"
                    value={registerData.name}
                    onChange={handleRegisterChange}
                    required
                  />
                </div>
              </div>

              <div className="auth-input-group">
                <label>Registration Number</label>
                <div className="auth-input-wrapper">
                  <input
                    type="text"
                    name="registration_number"
                    placeholder="e.g. 7276XXXXXXXX"
                    value={registerData.registration_number}
                    onChange={handleRegisterChange}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="auth-form-row">
              <div className="auth-input-group">
                <label>Department</label>
                <div className="auth-input-wrapper">
                  <select
                    name="department"
                    value={registerData.department}
                    onChange={handleRegisterChange}
                    required
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="auth-input-group">
                <label>Email Address</label>
                <div className="auth-input-wrapper">
                  <input
                    type="email"
                    name="email"
                    placeholder="e.g. student@college.edu"
                    value={registerData.email}
                    onChange={handleRegisterChange}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="auth-form-row">
              <div className="auth-input-group">
                <label>Password</label>
                <div className="auth-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="Min 6 characters"
                    value={registerData.password}
                    onChange={handleRegisterChange}
                    className="with-icon"
                    required
                  />
                  <button
                    type="button"
                    className="password-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <div className="auth-input-group">
                <label>Confirm Password</label>
                <div className="auth-input-wrapper">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirm_password"
                    placeholder="Re-enter password"
                    value={registerData.confirm_password}
                    onChange={handleRegisterChange}
                    className="with-icon"
                    required
                  />
                  <button
                    type="button"
                    className="password-eye-btn"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label="Toggle confirm password visibility"
                  >
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Register Account'}
            </button>

            <p className="auth-switch-prompt">
              Already have an account?{' '}
              <button
                type="button"
                className="auth-switch-link"
                onClick={() => {
                  setActiveTab('login');
                  setError('');
                }}
              >
                Sign in here
              </button>
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default StudentAuthCard;
