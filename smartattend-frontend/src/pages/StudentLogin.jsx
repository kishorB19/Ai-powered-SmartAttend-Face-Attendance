import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { HeaderAuth } from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { getAllStudents, createStudent, updateStudentEmbedding } from '../lib/db';
import { computeFaceDescriptor, matchFace, loadFaceModels } from '../lib/face';
import { Camera, UserPlus, Loader2, UserCheck, Sparkles, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import './AuthPages.css';

export default function StudentLogin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginAsStudent } = useAuth();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [streaming, setStreaming] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showDirectLogin, setShowDirectLogin] = useState(false);
  const [newName, setNewName] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  const [studentsList, setStudentsList] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [modelsReady, setModelsReady] = useState(false);

  const joinCode = searchParams.get('join-code');

  // Preload face recognition models and fetch registered students
  useEffect(() => {
    loadFaceModels().then(() => setModelsReady(true));
    getAllStudents().then(data => {
      setStudentsList(data || []);
      if (data && data.length > 0) {
        setSelectedStudentId(String(data[0].student_id));
      }
    });
  }, []);

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
      console.error(err);
      toast.error('Could not access camera. Please allow camera permissions.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setStreaming(false);
  }, []);

  // Capture face and perform Face Recognition Login
  const captureAndScan = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) {
      toast.error('Camera is not active');
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(imageDataUrl);

    setScanning(true);
    try {
      // 1. Extract 128-dimensional face embedding
      const descriptor = await computeFaceDescriptor(canvas);

      // 2. Fetch all registered students from Supabase
      const allStudents = await getAllStudents();
      setStudentsList(allStudents || []);

      if (!allStudents || allStudents.length === 0) {
        toast('No students registered yet! Please register below.', { icon: 'ℹ️' });
        setShowRegister(true);
        setScanning(false);
        return;
      }

      // 3. Match face descriptor against stored embeddings
      const match = matchFace(descriptor, allStudents, 0.65);

      if (match && match.student) {
        loginAsStudent(match.student);
        toast.success(`Face Recognized! Welcome back, ${match.student.name}!`);
        stopCamera();
        const dest = joinCode ? `/student/dashboard?join-code=${joinCode}` : '/student/dashboard';
        navigate(dest);
        return;
      }

      // If no match found or existing students have NULL embeddings
      const studentsWithoutFace = allStudents.filter(s => !s.face_embedding);
      if (studentsWithoutFace.length > 0) {
        toast('Face not matched. If you already registered, attach your Face ID below!', { icon: '🔍' });
      } else {
        toast('Face not recognized. Register your Face ID below!', { icon: '🔍' });
      }
      setShowRegister(true);
    } catch (err) {
      console.error('Face recognition error:', err);
      toast.error('Face scan failed. Please try again or select your name.');
    } finally {
      setScanning(false);
    }
  }, [loginAsStudent, navigate, stopCamera, joinCode]);

  // Register New Student with Face Embedding
  const handleRegister = useCallback(async () => {
    if (!newName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    setScanning(true);
    try {
      let faceEmbedding = null;

      // Extract embedding from video or canvas
      if (videoRef.current && streaming) {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        faceEmbedding = await computeFaceDescriptor(canvas);
      } else if (capturedImage) {
        const img = new Image();
        img.src = capturedImage;
        await new Promise(r => { img.onload = r; });
        faceEmbedding = await computeFaceDescriptor(img);
      } else {
        // Fallback default embedding
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        faceEmbedding = await computeFaceDescriptor(canvas);
      }

      // Store in Supabase
      const data = await createStudent(newName.trim(), faceEmbedding);
      if (data && data.length > 0) {
        const newStudent = data[0];
        loginAsStudent(newStudent);
        toast.success(`Profile & Face ID registered! Welcome, ${newName}!`);
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
  }, [newName, streaming, capturedImage, loginAsStudent, navigate, stopCamera, joinCode]);

  // Update Face ID for an already registered student who has NULL face_embedding
  const handleUpdateFaceForExisting = async () => {
    if (!selectedStudentId) {
      toast.error('Please select a student');
      return;
    }

    setScanning(true);
    try {
      let faceEmbedding = null;
      if (videoRef.current && streaming) {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        faceEmbedding = await computeFaceDescriptor(canvas);
      } else if (capturedImage) {
        const img = new Image();
        img.src = capturedImage;
        await new Promise(r => { img.onload = r; });
        faceEmbedding = await computeFaceDescriptor(img);
      } else {
        toast.error('Please turn on camera or take a photo first');
        setScanning(false);
        return;
      }

      const updated = await updateStudentEmbedding(selectedStudentId, faceEmbedding);
      if (updated && updated.length > 0) {
        loginAsStudent(updated[0]);
        toast.success(`Face ID updated! Welcome, ${updated[0].name}!`);
        stopCamera();
        const dest = joinCode ? `/student/dashboard?join-code=${joinCode}` : '/student/dashboard';
        navigate(dest);
      }
    } catch (err) {
      console.error('Update face error:', err);
      toast.error(err?.message || 'Failed to update Face ID');
    } finally {
      setScanning(false);
    }
  };

  // Direct login for existing registered student
  const handleDirectLogin = () => {
    const student = studentsList.find(s => String(s.student_id) === String(selectedStudentId));
    if (student) {
      loginAsStudent(student);
      toast.success(`Logged in as ${student.name}!`);
      stopCamera();
      const dest = joinCode ? `/student/dashboard?join-code=${joinCode}` : '/student/dashboard';
      navigate(dest);
    }
  };

  return (
    <div className="auth-page">
      <div className="container" style={{ maxWidth: 620 }}>
        <HeaderAuth />

        <div className="auth-card glass animate-slide-up">
          <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
            <span className="gradient-text">Student Face ID Login</span>
          </h2>
          <p className="auth-desc">Look into your camera to verify your identity</p>

          {/* Camera Area */}
          <div className="camera-area" style={{ position: 'relative' }}>
            <video
              ref={videoRef}
              className="camera-feed"
              autoPlay
              playsInline
              muted
              style={{ display: streaming ? 'block' : 'none' }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {!streaming && (
              <div className="camera-placeholder">
                <Camera size={48} className="camera-icon-muted" />
                <p>Click "Start Camera" to scan your face</p>
              </div>
            )}
          </div>

          {/* Camera Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', marginBottom: '1.25rem' }}>
            {!streaming ? (
              <button className="btn btn-primary btn-stretch" onClick={startCamera}>
                <Camera size={18} /> Start Camera
              </button>
            ) : (
              <>
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={captureAndScan} disabled={scanning}>
                  {scanning ? (
                    <><Loader2 size={18} className="spin-icon" /> Verifying Face...</>
                  ) : (
                    <><Sparkles size={18} /> Scan Face & Login</>
                  )}
                </button>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={stopCamera}>
                  Stop
                </button>
              </>
            )}
          </div>

          {/* Toggle between Register and Select Profile */}
          <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
            <button
              className="btn btn-secondary btn-sm"
              style={{ flex: 1 }}
              onClick={() => {
                setShowRegister(prev => !prev);
                setShowDirectLogin(false);
              }}
            >
              <UserPlus size={16} /> {showRegister ? 'Hide Registration' : 'Register New Face ID'}
            </button>

            {studentsList.length > 0 && (
              <button
                className="btn btn-secondary btn-sm"
                style={{ flex: 1 }}
                onClick={() => {
                  setShowDirectLogin(prev => !prev);
                  setShowRegister(false);
                }}
              >
                <UserCheck size={16} /> {showDirectLogin ? 'Hide Profile' : 'Select Profile'}
              </button>
            )}
          </div>

          {/* Registration Form */}
          {showRegister && (
            <div className="glass-card" style={{ marginTop: '1.25rem', padding: '1.25rem' }}>
              <h4 style={{ marginBottom: '0.75rem', fontSize: '1rem', color: 'var(--color-primary-light)' }}>
                Register New Student Profile
              </h4>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Start the camera above, enter your name, and click register to save your 128-d Face ID to Supabase.
              </p>
              <div className="input-group" style={{ marginBottom: '1rem' }}>
                <label>Full Name</label>
                <input
                  className="input"
                  type="text"
                  placeholder="e.g. Kishor Birajdar"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <button
                className="btn btn-primary btn-stretch"
                onClick={handleRegister}
                disabled={scanning}
              >
                {scanning ? <><Loader2 size={16} className="spin-icon" /> Storing Face Embedding...</> : 'Save Profile & Face ID'}
              </button>
            </div>
          )}

          {/* Existing Student Name Login / Update Face ID */}
          {showDirectLogin && studentsList.length > 0 && (
            <div className="glass-card" style={{ marginTop: '1.25rem', padding: '1.25rem' }}>
              <h4 style={{ marginBottom: '0.75rem', fontSize: '1rem', color: 'var(--color-primary-light)' }}>
                Already Registered Students
              </h4>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Select your name to log in directly, or update your Face ID embedding:
              </p>

              <div className="input-group" style={{ marginBottom: '1rem' }}>
                <label>Select Your Profile</label>
                <select
                  className="input"
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                >
                  {studentsList.map(stu => (
                    <option key={stu.student_id} value={stu.student_id}>
                      {stu.name} (ID: {stu.student_id}) {stu.face_embedding ? '— Face ID Active' : '— Needs Face ID'}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={handleDirectLogin}
                >
                  <UserCheck size={16} /> Login as Selected
                </button>

                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={handleUpdateFaceForExisting}
                  disabled={scanning}
                >
                  {scanning ? <><Loader2 size={16} className="spin-icon" /> Updating...</> : 'Save Camera Face ID'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
