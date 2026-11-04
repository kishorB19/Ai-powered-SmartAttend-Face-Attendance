import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeaderAuth } from '../components/Header';
import { checkTeacherExists, createTeacher } from '../lib/db';
import { UserPlus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import './AuthPages.css';

export default function TeacherRegister() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!username.trim() || !name.trim() || !password) {
      toast.error('All fields are required');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords don\'t match');
      return;
    }
    setLoading(true);
    try {
      const exists = await checkTeacherExists(username.trim());
      if (exists) {
        toast.error('Username already taken');
        setLoading(false);
        return;
      }
      await createTeacher(username.trim(), password, name.trim());
      toast.success('Account created! Please login now.');
      navigate('/teacher/login');
    } catch {
      toast.error('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="container" style={{ maxWidth: 480 }}>
        <HeaderAuth backTo="/teacher/login" />
        <div className="auth-card glass animate-slide-up">
          <h2 style={{ textAlign: 'center' }}>
            <span className="gradient-text">Teacher Register</span>
          </h2>
          <p className="auth-desc">Create your teacher profile</p>

          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="input-group">
              <label>Username</label>
              <input className="input" type="text" placeholder="ananyaroy" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Full Name</label>
              <input className="input" type="text" placeholder="Ananya Roy" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input className="input" type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Confirm Password</label>
              <input className="input" type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-stretch btn-lg" type="submit" disabled={loading}>
              {loading ? <><Loader2 size={18} className="spin-icon" /> Creating...</> : <><UserPlus size={18} /> Register</>}
            </button>
          </form>

          <div className="auth-links">
            <span>Already have an account?</span>
            <button onClick={() => navigate('/teacher/login')}>Login instead</button>
          </div>
        </div>
      </div>
    </div>
  );
}
