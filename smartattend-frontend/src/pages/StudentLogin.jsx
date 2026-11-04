import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { HeaderAuth } from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { getAllStudents, createStudent } from '../lib/db';
import { Camera, UserPlus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import './AuthPages.css';

const FACE_API_URL = import.meta.env.VITE_FACE_API_URL || '';

export default function StudentLogin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginAsStudent } = useAuth();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [streaming, setStreaming] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [newName, setNewName] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  const streamRef = useRef(null);

  const joinCode = searchParams.get('join-code');

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setStreaming(true);
    } catch (err) {
      toast.error('Could not access camera. Please allow camera permission.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setStreaming(false);
  }, []);

  const captureAndScan = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(imageDataUrl);

    if (!FACE_API_URL) {
      // No backend configured — show info and registration
      toast('Face recognition backend not configured.\nUse registration to create your profile.', { icon: 'ℹ️' });
      setShowRegister(true);
      return;
    }

    setScanning(true);
    try {
      const blob = await (await fetch(imageDataUrl)).blob();
      const formData = new FormData();
      formData.append('image', blob, 'face.jpg');

      const res = await fetch(`${FACE_API_URL}/api/face/predict`, {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();

      if (result.detected && Object.keys(result.detected).length > 0) {
        const studentId = Object.keys(result.detected)[0];
        const allStudents = await getAllStudents();
        const student = allStudents.find(s => String(s.student_id) === String(studentId));

        if (student) {
          loginAsStudent(student);
          toast.success(`Welcome back, ${student.name}!`);
          const dest = joinCode ? `/student/dashboard?join-code=${joinCode}` : '/student/dashboard';
          navigate(dest);
          stopCamera();
          return;
        }
      }

      toast('Face not recognized. You may be a new student!', { icon: '🔍' });
      setShowRegister(true);
    } catch (err) {
      toast.error('Face scan failed. Please try again.');
    } finally {
      setScanning(false);
    }
  }, [FACE_API_URL, loginAsStudent, navigate, stopCamera, joinCode]);

  const handleRegister = useCallback(async () => {
    if (!newName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    setScanning(true);
    try {
      let faceEmbedding = null;

      if (FACE_API_URL && capturedImage) {
        const blob = await (await fetch(capturedImage)).blob();
        const formData = new FormData();
        formData.append('image', blob, 'face.jpg');

        const res = await fetch(`${FACE_API_URL}/api/face/embedding`, {
          method: 'POST',
          body: formData,
        });
        const result = await res.json();
        if (result.embedding) {
          faceEmbedding = result.embedding;
        }
      }

      const data = await createStudent(newName.trim(), faceEmbedding);
      if (data && data.length > 0) {
        if (FACE_API_URL) {
          await fetch(`${FACE_API_URL}/api/face/train`, { method: 'POST' });
        }
        loginAsStudent(data[0]);
        toast.success(`Profile created! Welcome, ${newName}!`);
        stopCamera();
        const dest = joinCode ? `/student/dashboard?join-code=${joinCode}` : '/student/dashboard';
        navigate(dest);
      }
    } catch (err) {
      console.error('Student registration error:', err);
      toast.error(err?.message || 'Registration failed. Please try again.');
    } finally {
      setScanning(false);
    }
  }, [newName, capturedImage, FACE_API_URL, loginAsStudent, navigate, stopCamera, joinCode]);

  return (
    <div className="auth-page">
      <div className="container" style={{ maxWidth: 600 }}>
        <HeaderAuth />

        <div className="auth-card glass animate-slide-up">
          <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
            <span className="gradient-text">Student Login</span>
          </h2>
          <p className="auth-desc">Use Face ID to login or register a new profile</p>

          <div className="camera-area">
            <video ref={videoRef} className="camera-feed" autoPlay playsInline muted style={{ display: streaming ? 'block' : 'none' }} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {!streaming && (
              <div className="camera-placeholder" onClick={startCamera}>
                <Camera size={48} />
                <span>Click to start camera</span>
              </div>
            )}
          </div>

          {streaming && !showRegister && (
            <button className="btn btn-primary btn-stretch btn-lg" onClick={captureAndScan} disabled={scanning}>
              {scanning ? <><Loader2 size={18} className="spin-icon" /> Scanning...</> : <><Camera size={18} /> Capture & Scan Face</>}
            </button>
          )}

          {showRegister && (
            <div className="register-section animate-slide-up">
              <hr className="divider" />
              <h3 style={{ textAlign: 'center' }}>
                <span className="gradient-text">Register New Profile</span>
              </h3>
              <div className="input-group">
                <label>Your Name</label>
                <input
                  className="input"
                  type="text"
                  placeholder="E.g. Hamza Rizvi"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <button className="btn btn-primary btn-stretch btn-lg" onClick={handleRegister} disabled={scanning}>
                {scanning ? <><Loader2 size={18} className="spin-icon" /> Creating...</> : <><UserPlus size={18} /> Create Account</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
