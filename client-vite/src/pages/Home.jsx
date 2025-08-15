import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  FaClock, FaShieldAlt, FaUniversity, FaArrowRight,FaMoneyBillWave,FaFileAlt
} from 'react-icons/fa';
import logo from './nialogo-removebg.png';
import AOS from 'aos';
import 'aos/dist/aos.css';

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
              The <span>Academic Printing</span>
            </motion.h1>
            <motion.p className="hero-subtitle" variants={fadeItem}>
              A modern solution for students and faculty to print documents securely and efficiently on campus.
            </motion.p>
            <motion.div className="hero-actions" variants={fadeItem}>
              <button onClick={handleStartPrintJob} className="primary-btn">
                Start Printing <FaArrowRight className="btn-icon" />
              </button>
              <button onClick={handleTrackOrder} className="secondary-btn">
                Track Order
              </button>
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

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

        :root {
          --primary-color: #dab66a;
          --primary-light: #e8c9a0;
          --primary-highlight: #ffe7bc;
          --secondary-color: #b38b59;
          --text-dark: #5C4D3D;
          --text-medium: #7A6B5B;
          --text-light: #cdb78c;
          --light-bg: #fcfaef;
          --pure-white: #FDFDFD;
          --panel-bg: #fcfaeed5;
          --shadow: 0 4px 20px rgba(214,181,125,0.13);
          --shadow-hover: 0 8px 30px rgba(186,154,89,0.13);
          --transition: all 0.37s cubic-bezier(0.16, 1, 0.3, 1);
        }
        * { scroll-behavior: smooth; }

        .home-container {
          font-family: 'Poppins', sans-serif;
          color: var(--text-dark);
          min-height: 100vh;
          background-color: var(--light-bg);
          position: relative;
          z-index: 1;
          padding-top: 110px;
        }
          .feature-card2 {
  background: var(--pure-white);
  border-radius: 14px;
  padding: 2.2rem 1.6rem;
  box-shadow: var(--shadow);
  transition: var(--transition);
  min-height: 255px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;  /* fixed spelling */
  text-align: center;
  margin: 0 auto; /* if you want to center the card itself too */
}

        .animated-bg-layer {
          position: fixed;
          top: 0; left: 0; width: 100vw; height: 100vh;
          z-index: 0; pointer-events: none; overflow: hidden;
          background: radial-gradient(ellipse at 60% 11%, #fff8e668 36%, transparent 74%),
            linear-gradient(120deg, #f7f1de 64%, #e7ce97 100%);
          transition: background 2.2s cubic-bezier(0.23,1,0.32,1);
        }
        .mesh-bg { position: absolute; left: 0; top: 0; width: 100vw; height: 100vh; }
        .petals-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
        .petal-orb { opacity: 0.82; }

        .section-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 2rem;
          position: relative;
          z-index: 2;
        }
        .hero {
          width: 100%;
          padding: 5.3rem 0 3.7rem 0;
          position: relative;
        }
        .hero-wrapper {
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 1200px;
          margin: 0 auto;
          gap: 3.5rem;
          position: relative;
          z-index: 2;
        }
        .hero-content {
          flex: 1.1;


          
          padding: 2.5rem 2rem 2.2rem 2rem;
        }
        .hero-content h1 {
          font-size: 3.2rem;
          font-weight: 700;
          line-height: 1.19;
          margin-bottom: 1.4rem;
          color: var(--text-dark);
        }
        .hero-content h1 span {
          color: var(--secondary-color);
          position: relative;
        }
        .hero-content h1 span::after {
          content: '';
          position: absolute;
          bottom: 5px;
          left: 0; width: 100%; height: 13px;
          background: linear-gradient(90deg, var(--primary-highlight) 30%, var(--primary-color) 80%);
          z-index: -1;
          border-radius: 5px; opacity: 0.34;
        }
        .hero-subtitle {
          font-size: 1.18rem;
          color: var(--text-medium);
          margin-bottom: 2.3rem;
          max-width: 540px;
          font-weight: 500;
        }
        .hero-actions {
          display: flex;
          gap: 1rem;
        }
        .primary-btn, .secondary-btn {
          padding: 0.90rem 1.8rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 1.06rem;
          cursor: pointer;
          transition: var(--transition);
          display: flex; align-items: center; gap: 0.67rem;
          font-family: 'Poppins', sans-serif;
          box-shadow: var(--shadow);
        }
        .primary-btn {
          background: var(--primary-color);
          color: #fff;
          border: none;
        }
        .primary-btn:hover {
          background: var(--secondary-color);
          transform: translateY(-2px) scale(1.04);
        }
        .secondary-btn {
          background: transparent;
          color: var(--primary-color);
          border: 2px solid var(--primary-color);
        }
        .secondary-btn:hover {
          background: rgba(212, 167, 106, 0.11);
          color: var(--secondary-color);
        }
        .btn-icon { transition: transform 0.4s ease; }
        .primary-btn:hover .btn-icon { transform: translateX(6px);}
        .hero-image {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 210px;
        }
        .hero-logo-img {
          width: 100%; max-width: 370px; height: auto;
          filter: drop-shadow(0 8px 26px rgba(92,77,61,0.09));
          animation: floatLogo 8.8s ease-in-out infinite;
          transition: filter 0.21s;
        }
        @keyframes floatLogo {
          0% { transform: translateY(5px);}
          50% { transform: translateY(-19px);}
          100% {transform: translateY(5px);}
        }

        .features {
          padding: 5.2rem 0 3.5rem 0;
          position: relative;
        }
        .section-header {
          text-align: center;
          margin-bottom: 3.3rem;
        }
        .section-header h2 {
          font-size: 2.15rem;
          font-weight: 600;
          color: var(--text-dark);
          margin-bottom: 0.6rem;
        }
        .section-header p {
          font-size: 1.12rem;
          color: var(--text-medium);
          max-width: 550px;
          margin: 0 auto;
        }
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
          gap: 2rem;
        }
        .feature-card {
          background: var(--pure-white);
          border-radius: 14px;
          padding: 2.2rem 1.6rem;
          box-shadow: var(--shadow);
          transition: var(--transition);
          text-align: center;
          min-height: 255px;
        }
        .feature-card:hover {
          transform: translateY(-7px) scale(1.022);
          box-shadow: var(--shadow-hover);
        }
        .card-icon {
          width: 61px;
          height: 61px;
          margin: 0 auto 1.12rem;
          background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-highlight) 100%);
          border-radius: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 1.91rem;
          box-shadow: 0 3px 15px rgba(212,167,106,0.085);
        }
        .feature-card h3 {
          font-size: 1.17rem;
          margin-bottom: 1rem;
          color: var(--text-dark);
          font-weight: 700;
        }
        .feature-card p {
          color: var(--text-medium);
          font-size: 1rem;
          font-weight: 500;
        }

        .cta-section {
          background: linear-gradient(115deg, var(--primary-color) 0%, var(--secondary-color) 100%);
          padding: 4.2rem 0;
          text-align: center;
          color: var(--pure-white);
          position: relative;
          overflow: hidden;
        }
        .cta-content {
          max-width: 660px;
          margin: 0 auto;
        }
        .cta-content h2 {
          font-size: 2.09rem;
          margin-bottom: 1.23rem;
          font-weight: 800;
          line-height: 1.25;
        }
        .cta-btn {
          background: var(--pure-white);
          color: var(--secondary-color);
          border: none;
          padding: 1.13rem 2.2rem;
          font-size: 1.09rem;
          font-weight: 700;
          border-radius: 9px;
          cursor: pointer;
          transition: var(--transition);
          box-shadow: var(--shadow);
        }
        .cta-btn:hover {
          color: var(--primary-color);
          background: #fcf8ee;
          transform: translateY(-2px) scale(1.05);
        }

        /* Responsive styles */
        @media (max-width: 1120px) {
          .hero-content h1 { font-size: 2.48rem;}
          .hero-logo-img { max-width: 250px; }
        }
        @media (max-width: 900px) {
          .hero-wrapper {
            flex-direction: column;
            align-items: center;
            gap: 2.65rem;
            text-align: center;
            padding: 0;
          }
          .hero-content {align-items:center;}
          .hero-subtitle {margin: 0 auto;}
          .hero-image { width: 100%; max-width: 310px; margin: 0 auto;}
        }
        @media (max-width: 768px) {
          .section-header h2 { font-size: 1.41rem;}
          .hero-content h1 { font-size: 1.71rem;}
          .hero-logo-img { height:0px;}
          .section-container { padding: 0 1.35rem; }
          
        }
        @media (max-width: 560px) {
          .hero-content h1 { font-size: 1.22rem;}
          .hero-logo-img { max-width: 75px;}
          .hero-actions {
            flex-direction: column;
            gap: 0.6rem;
            width: 100%;
          }
          .primary-btn, .secondary-btn { width: 100%; justify-content: center; }
          .features-grid { grid-template-columns: 1fr;}
        }
      `}</style>
    </div>
  );
};

export default Home;
