import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  FaClock, FaShieldAlt, FaUniversity, FaArrowRight, FaMoneyBillWave, FaFileAlt,
  FaPrint, FaSearch, FaMapMarkerAlt
} from 'react-icons/fa';
import logo from './nialogo-removebg.png';
import AOS from 'aos';
import 'aos/dist/aos.css';
import StudentAuthCard from '../components/StudentAuthCard';
import { useAuth } from '../context/AuthContext';
import './Home.css';

// --- Mesh Animated Background ---
function AnimatedBackground() {
  // Floating golden orbs/flowers
  return (
    <div className="animated-bg-layer" aria-hidden>
      {/* SVG mesh/net */}
      <svg
        width="100%"
        height="100%"
        className="mesh-bg"
        style={{
          position: "absolute", left: 0, top: 0,
          zIndex: 1, width: "100vw", height: "100vh",
          opacity: 0.14,
          pointerEvents: "none"
        }}
      >
        <defs>
          <linearGradient id="goldMesh" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffe7bc" />
            <stop offset="50%" stopColor="#deb97e" />
            <stop offset="100%" stopColor="#e2bb69" />
          </linearGradient>
        </defs>
        {/* Diagonal lines mesh */}
        {[...Array(17)].map((_, idx) => (
          <line
            key={idx}
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
            key={idx}
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
      {/* Floating gold orbs/petals with soft motion */}
      <div className="petals-container">
        {[...Array(9)].map((_, idx) => (
          <motion.div
            key={idx}
            className="petal-orb"
            initial={{
              opacity: 0.9,
              y: Math.sin(idx * 3.8) * 70,
              x: Math.cos(idx * 2.1) * 40,
              scale: 0.94 + Math.random() * 0.40,
              rotate: idx * 31,
            }}
            animate={{
              y: ["0%", `-${70 + Math.random() * 50}%`],
              x: [`${5 + idx * 8}%`, `${16 + idx * 10}%`],
              opacity: [0.45, 0.7, 0.57, 0.45],
              rotate: 360,
            }}
            transition={{
              repeat: Infinity,
              repeatType: "reverse",
              duration: 9 + idx * 1.8,
              delay: idx * 0.61,
              ease: "easeInOut",
            }}
            style={{
              left: `${5 + idx * 11}%`,
              top: `${13 + idx * 8}%`,
              width: 32 + ((idx % 2) * 13),
              height: 32 + ((idx % 3) * 13),
              background: idx % 2
                ? 'radial-gradient(circle at 68% 37%, #fcfaef77 38%, #eec27315 78%)'
                : 'radial-gradient(circle at 63% 81%, #fff7e417 44%, #edd3a7 83%)',
              borderRadius: "54% 41% 57% 48%",
              position: "absolute",
              zIndex: 2,
              filter: "blur(2.2px)",
              pointerEvents: "none"
            }}
          />
        ))}
      </div>
    </div>
  );
}

// --- Motion settings ---
const staggerContainer = {
  hidden: { opacity: 0, y: 40 },
  show: {
    opacity: 1, y: 0,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 }
  }
};
const fadeItem = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7 } }
};

const Home = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    AOS.init({
      duration: 900,
      easing: 'ease-in-out',
      once: true,
      offset: 100
    });
  }, []);

  const handleStartPrintJob = () => navigate('/print-job');
  const handleTrackOrder = () => navigate('/tracking');

  if (isAuthenticated && user) {
    return (
      <div className="home-container student-portal-page">
        <Helmet>
          <title>{user.name} - Student Portal | PrintDesk</title>
          <meta name="description" content="Access document printing, order tracking, and account details" />
        </Helmet>

        {/* Animated background */}
        <AnimatedBackground />

        <div className="student-portal-wrapper">
          {/* Welcome Profile Card */}
          <motion.div
            className="student-profile-hero"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="student-profile-info-grid">
              <div className="student-avatar-badge">
                <span className="avatar-initials">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'S'}
                </span>
              </div>
              <div className="student-info-meta">
                <div className="student-badge-pill">Active Student</div>
                <h1 className="student-portal-heading">Welcome back, <span>{user.name}</span></h1>
                <div className="student-meta-chips">
                  <span className="meta-chip">
                    <strong>Reg No:</strong> {user.registration_number}
                  </span>
                  <span className="meta-chip">
                    <strong>Dept:</strong> {user.department}
                  </span>
                  <span className="meta-chip">
                    <strong>Email:</strong> {user.email}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Quick Action Cards */}
          <div className="student-action-cards-grid">
            {/* Start Print Job Card */}
            <motion.div
              className="student-action-card primary-card"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              onClick={handleStartPrintJob}
            >
              <div className="card-top-row">
                <div className="action-icon-wrapper primary-icon">
                  <FaPrint />
                </div>
                <span className="card-tag">Fast & Secure</span>
              </div>
              <h3>Start New Print Job</h3>
              <p>Upload PDF, Word, or image documents, configure color or black & white, page ranges, and binding preferences.</p>
              <button
                className="card-launch-btn primary-btn"
                onClick={(e) => { e.stopPropagation(); handleStartPrintJob(); }}
              >
                <span>Print Document</span>
                <FaArrowRight />
              </button>
            </motion.div>

            {/* Track Orders Card */}
            <motion.div
              className="student-action-card secondary-card"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              onClick={handleTrackOrder}
            >
              <div className="card-top-row">
                <div className="action-icon-wrapper secondary-icon">
                  <FaSearch />
                </div>
                <span className="card-tag">Live Status</span>
              </div>
              <h3>Track My Orders</h3>
              <p>Check the live status of submitted print jobs, view completion tokens, and pick up verified copies at the counter.</p>
              <button
                className="card-launch-btn secondary-btn"
                onClick={(e) => { e.stopPropagation(); handleTrackOrder(); }}
              >
                <span>Track Status</span>
                <FaArrowRight />
              </button>
            </motion.div>
          </div>

          {/* Information & Rates Strip */}
          <motion.div
            className="student-info-strip"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="info-strip-item">
              <FaMoneyBillWave className="strip-icon" />
              <div>
                <strong>Affordable Campus Rates</strong>
                <span>B&W: ₹1 / page • Color: ₹2 / page</span>
              </div>
            </div>
            <div className="info-strip-divider" />
            <div className="info-strip-item">
              <FaMapMarkerAlt className="strip-icon" />
              <div>
                <strong>Collection Counter</strong>
                <span>Central Reprographics Desk (Ground Floor)</span>
              </div>
            </div>
            <div className="info-strip-divider" />
            <div className="info-strip-item">
              <FaClock className="strip-icon" />
              <div>
                <strong>Operating Hours</strong>
                <span>Mon – Fri: 8:30 AM – 5:30 PM</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-container">
      <Helmet>
        <title>Academic Printing Solution</title>
        <meta name="description" content="Secure, fast document printing for educational institutions" />
      </Helmet>

      {/* Animated background */}
      <AnimatedBackground />

      {/* Hero Section */}
      <section className="hero" id="home">
        <div className="hero-wrapper">
          <motion.div
            className="hero-content"
            initial="hidden"
            animate="show"
            variants={staggerContainer}
          >
            <motion.h1 variants={fadeItem}>
              PrintDesk <span>Portal</span>
            </motion.h1>
            <motion.p className="hero-subtitle" variants={fadeItem}>
              A modern solution for students, faculty, and departments to print documents securely and efficiently on campus.
            </motion.p>
            <motion.div className="hero-auth-box-wrapper" variants={fadeItem}>
              <StudentAuthCard initialTab="login" />
            </motion.div>
          </motion.div>
          <motion.div
            className="hero-image"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1, delay: 0.2, type: 'spring' }}
          >
            <img src={logo} alt="NIA Logo" className="hero-logo-img" />
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features" id="features">
        <div className="section-container">
          <motion.div className="section-header"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}>
            <h2>Features </h2>
            <p>Designed with academic needs in mind</p>
          </motion.div>
          <motion.div className="features-grid"
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            <motion.div className="feature-card" variants={fadeItem}>
              <div className="card-icon"><FaShieldAlt /></div>
              <h3>Secure Uploads</h3>
              <p>Military-grade encryption protects your documents during transfer and storage.</p>
            </motion.div>
            <motion.div className="feature-card" variants={fadeItem}>
              <div className="card-icon"><FaClock /></div>
              <h3>Fast Processing</h3>
              <p>Get your documents printed and ready for pickup in as little as 30 minutes.</p>
            </motion.div>
            <motion.div className="feature-card" variants={fadeItem}>
              <div className="card-icon"><FaUniversity /></div>
              <h3>Campus Integration</h3>
              <p>Seamless integration with university systems for easy authentication and billing.</p>
            </motion.div>
             <motion.div className="feature-card" variants={fadeItem}>
              <div className="card-icon"><FaMoneyBillWave /></div>
              <h3>Transparent Pricing</h3>
              <p></p>
              <p>Black & White:₹1 per page</p>
              <p>Color: ₹2 per page</p>
            </motion.div>
             <motion.div className="feature-card" variants={fadeItem}>
              <div className="card-icon"><FaFileAlt /></div>
              <h3>Supported Formats</h3>
              <p></p>
              <p>PDF Documents</p>
              <p>Microsoft Word (DOC/DOCX)</p>
              <p>Image Files (JPG, PNG)</p>
              <p>Maximum file size: 25MB</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section" id="cta">
        <div className="section-container">
          <motion.div
            className="cta-content"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            <h2>Ready to Print Your Documents?</h2>
            <button onClick={handleStartPrintJob} className="cta-btn">
              Start Your Print Job Now
            </button>
          </motion.div>
        </div>
      </section>

    </div>
  );
};

export default Home;
