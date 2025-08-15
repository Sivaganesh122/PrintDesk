import React, { useState } from 'react';
import './Facultylogin.css';
import { facultyLogin } from '../context/auth';
import { useNavigate } from 'react-router-dom';

const FacultyLogin = () => {
  const [departmentName, setDepartmentName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const res = await facultyLogin(departmentName, password);

    if (res.success) {
      navigate('/printjob2');
    } else {
      setError(res.error || 'Login failed');
    }

    setIsLoading(false);
  };

  return (
    <div className="admin-login-container">
      <div className="animated-bg-layer"></div>
      <div className="navbar-space"></div>

      <div className="login-card">
        <h1 className="login-title">Faculty Portal</h1>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="text"
              placeholder="Department Name"
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <div className="password-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <span
                className="password-toggle-icon"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </span>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default FacultyLogin;
