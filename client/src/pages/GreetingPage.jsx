import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { storage } from "../utils/storage";

/**
 * Welcome / Splash screen.
 * - Shows the REAL authenticated user's name (storage.getItem("userName"))
 * - Auto-dismisses after 3s (unchanged), then navigates by role (unchanged)
 * - Click anywhere to skip
 * - No API requests are made here
 */
const EASE = [0.16, 1, 0.3, 1];

const GreetingPage = () => {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [isVisible, setIsVisible] = useState(true);
  const [mounted, setMounted] = useState(false);

  const hideTimerRef = useRef(null);
  const navTimerRef = useRef(null);
  const hasNavigatedRef = useRef(false);

  const userRole = (storage.getItem("userRole") || "").toLowerCase();

  // Role-based navigation — unchanged from the original behavior
  const navigateByRole = () => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    if (userRole === 'admin' || userRole === 'board' || userRole === 'superadmin') navigate('/superadmin');
    else if (userRole === 'teacher') navigate('/teacher');
    else if (userRole === 'student') navigate('/student');
    else navigate('/');
  };

  useEffect(() => {
    setMounted(true);

    // Get user name from storage (unchanged behavior)
    const storedName = storage.getItem("userName") || "User";
    setDisplayName(storedName);

    // Auto-hide after 3 seconds, then navigate after the exit animation
    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
      navTimerRef.current = setTimeout(navigateByRole, 800);
    }, 3000);

    return () => {
      clearTimeout(hideTimerRef.current);
      clearTimeout(navTimerRef.current);
    };
  }, [navigate, userRole]);

  // Click anywhere to skip
  const handleSkip = () => {
    if (!isVisible) return;
    clearTimeout(hideTimerRef.current);
    clearTimeout(navTimerRef.current);
    setIsVisible(false);
    navTimerRef.current = setTimeout(navigateByRole, 500);
  };

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          onClick={handleSkip}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            background: 'radial-gradient(60% 50% at 80% 10%, rgba(220,38,38,0.16) 0%, rgba(220,38,38,0) 60%), radial-gradient(50% 45% at 15% 90%, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0) 55%), #0A0B10',
            color: '#FFFFFF',
            fontFamily: "'Inter', sans-serif",
            overflow: 'hidden',
          }}
        >
          {/* Subtle grid texture */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
              backgroundSize: '56px 56px',
              maskImage: 'radial-gradient(70% 70% at 50% 50%, black 30%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(70% 70% at 50% 50%, black 30%, transparent 100%)',
              pointerEvents: 'none',
            }}
          />

          {/* Content */}
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.8, ease: EASE }}
            style={{ textAlign: 'center', padding: '0 1.5rem', position: 'relative' }}
          >
            {/* Brand pill */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.05, duration: 0.6, ease: EASE }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.7rem',
                marginBottom: '2.5rem',
                padding: '0.55rem 1.1rem',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(6px)',
              }}
            >
              <img
                src="/logo.png"
                alt="Exams Hub"
                style={{ width: '26px', height: '26px', objectFit: 'contain' }}
              />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.02em' }}>
                Exams <span style={{ color: '#EF4444' }}>Hub</span>
              </span>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.7, ease: 'easeOut' }}
              style={{
                margin: 0,
                fontSize: '0.8rem',
                fontWeight: 600,
                letterSpacing: '0.35em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.45)',
              }}
            >
              Hello
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.8, ease: EASE }}
              style={{
                margin: '0.4rem 0 0',
                fontSize: 'clamp(2.6rem, 7vw, 4.5rem)',
                fontWeight: 900,
                letterSpacing: '-0.04em',
                lineHeight: 1.05,
                wordBreak: 'break-word',
              }}
            >
              {displayName}
              <span style={{ color: '#EF4444' }}>.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.7, ease: 'easeOut' }}
              style={{
                marginTop: '1.1rem',
                color: 'rgba(255,255,255,0.55)',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.3em',
                fontSize: '0.8rem',
              }}
            >
              Welcome Back to Exams Hub
            </motion.p>
          </motion.div>

          {/* Skip hint */}
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.35, 0.7, 0.35] }}
            transition={{ delay: 1.2, duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              bottom: '2rem',
              left: 0,
              right: 0,
              textAlign: 'center',
              fontSize: '0.72rem',
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.45)',
            }}
          >
            Click anywhere to continue
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GreetingPage;

