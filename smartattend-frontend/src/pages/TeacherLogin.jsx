import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeaderAuth } from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { teacherLogin } from '../lib/db';
import { KeyRound, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import './AuthPages.css';

export default function TeacherLogin() {
  const navigate = useNavigate();
  const { loginAsTeacher } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const teacher = await teacherLogin(username.trim(), password);
      if (teacher) {
        loginAsTeacher(teacher);
        toast.success('Welcome back!');
        navigate('/teacher/dashboard');
      } else {
        toast.error('Invalid username or password');
      }
    } catch {
      toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="container" style={{ maxWidth: 480 }}>
        <HeaderAuth />
        <div className="auth-card glass animate-slide-up">
          <h2 style={{ textAlign: 'center' }}>
            <span className="gradient-text">Teacher Login</span>
          </h2>
          <p className="auth-desc">Sign in with your credentials</p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="input-group">
              <label>Username</label>
              <input className="input" type="text" placeholder="ananyaroy" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input className="input" type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-stretch btn-lg" type="submit" disabled={loading}>
              {loading ? <><Loader2 size={18} className="spin-icon" /> Signing in...</> : <><KeyRound size={18} /> Login</>}
            </button>
          </form>

          <div className="auth-links">
            <span>Don't have an account?</span>
            <button onClick={() => navigate('/teacher/register')}>Register instead</button>
          </div>
        </div>
      </div>
    </div>
  );
}
