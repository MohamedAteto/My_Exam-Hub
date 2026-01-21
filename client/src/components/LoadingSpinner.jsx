import React from 'react';

const LoadingSpinner = ({ message = "Loading..." }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '3rem',
      minHeight: '400px',
      width: '100%',
      background: 'rgba(255, 255, 255, 0.7)',
      backdropFilter: 'blur(10px)',
      borderRadius: '24px',
      boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      border: '1px solid rgba(255, 255, 255, 0.18)',
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        border: '6px solid var(--primary-light)',
        borderTop: '6px solid var(--primary)',
        borderRadius: '50%',
        animation: 'spin 1s cubic-bezier(0.5, 0, 0.5, 1) infinite',
        marginBottom: '1.5rem',
        boxShadow: '0 0 15px rgba(239, 68, 68, 0.1)'
      }}></div>
      <p style={{
        fontSize: '1.125rem',
        fontWeight: '600',
        color: 'var(--text-primary)',
        letterSpacing: '0.025em',
        margin: 0,
        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      }}>{message}</p>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: .5; }
          }
        `}
      </style>
    </div>
  );
};

export default LoadingSpinner;
