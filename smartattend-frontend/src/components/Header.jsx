import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, ArrowLeft } from 'lucide-react';
import './Header.css';

const LOGO_URL = 'https://i.ibb.co/YTYGn5qV/logo.png';

export function HeaderHome() {
  return (
    <div className="header-home animate-fade">
      <img src={LOGO_URL} alt="SmartAttend Logo" className="header-logo-lg" />
      <h1 className="gradient-text">SMART<br />ATTEND</h1>
      <p className="header-subtitle">AI-Powered Face Recognition Attendance</p>
    </div>
  );
}

export function HeaderDashboard({ title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="header-dashboard glass animate-fade">
      <div className="header-left">
        <img src={LOGO_URL} alt="SmartAttend" className="header-logo-sm" />
        <div>
          <h2 className="gradient-text">SMART ATTEND</h2>
          {user && <span className="header-welcome">Welcome, {user.data.name}</span>}
        </div>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
        <LogOut size={16} /> Logout
      </button>
    </header>
  );
}

export function HeaderAuth({ backTo = '/' }) {
  const navigate = useNavigate();
  return (
    <header className="header-auth animate-fade">
      <div className="header-left">
        <img src={LOGO_URL} alt="SmartAttend" className="header-logo-sm" />
        <h2 className="gradient-text">SMART ATTEND</h2>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(backTo)}>
        <ArrowLeft size={16} /> Back
      </button>
    </header>
  );
}
