import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p style={{ fontSize: 11 }}>ERROR_CODE: 404</p>
      <h1 style={{ fontSize: 96, margin: 0 }}>404</h1>
      <p>Route not found.</p>
      <p style={{ fontSize: 13 }}>The page you&apos;re looking for doesn&apos;t exist.</p>
      <button onClick={() => navigate('/dashboard')}>&#8592; Back to Dashboard</button>&nbsp;
      <button onClick={() => navigate('/docs')}>View Docs</button>
      <p style={{ fontSize: 12, marginTop: 40 }}>SENTINAL / Security Operations</p>
    </div>
  );
}
