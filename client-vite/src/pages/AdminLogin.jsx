// AdminLogin.jsx
import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import './adminlogin.css';

// AnimatedBackground component
const AnimatedBackground = () => {
  return (
    <div className="animated-bg-layer" aria-hidden>
      <svg
        width="100%"
        height="100%"
        className="mesh-bg"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          zIndex: 1,
          width: '100vw',
          height: '100vh',
          opacity: 0.14,
          pointerEvents: 'none'
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
            key={`line1-${idx}`}
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
            key={`line2-${idx}`}
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
            key={`petal-${idx}`}
            className="petal-orb"
            initial={{
              opacity: 0.9,
              y: Math.sin(idx * 3.8) * 70,
              x: Math.cos(idx * 2.1) * 40,
              scale: 0.94 + Math.random() * 0.4,
              rotate: idx * 31
            }}
            animate={{
              y: ['0%', `-${70 + Math.random() * 50}%`],
              x: [`${5 + idx * 8}%`, `${16 + idx * 10}%`],
              opacity: [0.45, 0.7, 0.57, 0.45],
              rotate: 360
            }}
            transition={{
              repeat: Infinity,
              repeatType: 'reverse',
              duration: 14 + idx * 1.5,
              delay: idx * 0.61,
              ease: 'easeInOut'
            }}
            style={{
              left: `${5 + idx * 11}%`,
              top: `${13 + idx * 8}%`,
              width: 32 + ((idx % 2) * 13),
              height: 32 + ((idx % 3) * 13),
              background: idx % 2
                ? 'radial-gradient(circle at 68% 37%, #fcfaef77 38%, #eec27315 78%)'
                : 'radial-gradient(circle at 63% 81%, #fff7e417 44%, #edd3a7 83%)',
              borderRadius: '54% 41% 57% 48%',
              position: 'absolute',
              zIndex: 2,
              filter: 'blur(2.2px)',
              pointerEvents: 'none'
            }}
          />
        ))}
      </div>
    </div>
  );
};

const AdminLogin = () => {
  const [form, setForm] = useState({ username: '', password: '' });

  const [showPassword, setShowPassword] = useState(false);

const togglePasswordVisibility = () => {
  setShowPassword(prev => !prev);
};
  const { login } = useAdminAuth();
  const navigate = useNavigate();

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    const res = await login(form.username, form.password);
    if (res.success) navigate('/admin');
    else alert(res.error || 'Login failed');
  };

  return (
    <div className="admin-login-container">
      <AnimatedBackground />
      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.8, ease: 'easeInOut' }}
      >
        <h2 className="login-title">Admin Login</h2>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            name="username"
            value={form.username}
            onChange={handleChange}
            placeholder="Username"
            autoFocus
            required
            autoComplete="username"
          />
        <div className="password-wrapper">
  <input
    name="password"
    type={showPassword ? 'text' : 'password'}
    value={form.password}
    onChange={handleChange}
    placeholder="Password"
    required
    autoComplete="current-password"
  />
  <span className="password-toggle-icon" onClick={togglePasswordVisibility}>
    {showPassword ? <FaEyeSlash /> : <FaEye />}
  </span>
</div>

          <button type="submit" className="login-button">Login</button>
        </form>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
