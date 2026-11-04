import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HeaderDashboard } from '../components/Header';
import SubjectCard from '../components/SubjectCard';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import {
  getTeacherSubjects,
  createSubject,
  getEnrolledStudents,
  createAttendance,
  getAttendanceForTeacher,
  getAllStudents
} from '../lib/db';
import { computeFaceDescriptor, matchFace } from '../lib/face';
import {
  BookOpen,
  Camera,
  Upload,
  Sparkles,
  Share2,
  Users,
  CheckCircle2,
  XCircle,
  PlusCircle,
  FileSpreadsheet,
  AlertTriangle,
  Trash2,
  Loader2,
  Copy,
  Check
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import './Dashboard.css';

const FACE_API_URL = import.meta.env.VITE_FACE_API_URL || '';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const teacher = user.data;
  const teacherId = teacher.teacher_id;

  const [activeTab, setActiveTab] = useState('take_attendance'); // take_attendance | manage_subjects | records
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Take Attendance State
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [photos, setPhotos] = useState([]); // Array of base64 strings
  const [analyzing, setAnalyzing] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [analysisResults, setAnalysisResults] = useState([]); // [{ student_id, name, is_present, source }]
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Manage Subjects State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubCode, setNewSubCode] = useState('');
  const [newSubSection, setNewSubSection] = useState('');
  const [creating, setCreating] = useState(false);

  // Share Modal State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareSubject, setShareSubject] = useState(null);
  const [copied, setCopied] = useState(false);

  // Enrolled Students Modal State
  const [enrolledModalOpen, setEnrolledModalOpen] = useState(false);
  const [enrolledStudentsList, setEnrolledStudentsList] = useState([]);
  const [loadingEnrolled, setLoadingEnrolled] = useState(false);
  const [activeSubjectForEnrolled, setActiveSubjectForEnrolled] = useState(null);

  // Attendance Records State
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // WebCam Modal State for taking classroom photos
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraStream, setCameraStream] = useState(null);

  const fetchSubjects = useCallback(async () => {
    try {
      const data = await getTeacherSubjects(teacherId);
      setSubjects(data);
      if (data.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId(data[0].subject_id);
      }
    } catch {
      toast.error('Failed to load subjects');
    } finally {
      setLoading(false);
    }
  }, [teacherId, selectedSubjectId]);

  const fetchRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const data = await getAttendanceForTeacher(teacherId);
      setRecords(data);
    } catch {
      toast.error('Failed to load attendance records');
    } finally {
      setLoadingRecords(false);
    }
  }, [teacherId]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  useEffect(() => {
    if (activeTab === 'records') {
      fetchRecords();
    }
  }, [activeTab, fetchRecords]);

  // Handle Photo Upload via File input
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotos(prev => [...prev, event.target.result]);
      };
      reader.readAsDataURL(file);
    });
    toast.success(`Added ${files.length} photo(s)`);
    e.target.value = '';
  };

  // Start Camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 1280, height: 720 }
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      toast.error('Could not access camera. Check device permissions.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
  };

  const snapPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPhotos(prev => [...prev, dataUrl]);
    toast.success('Photo captured!');
  };

  // Run AI Face Analysis
  const handleRunAnalysis = async () => {
    if (!selectedSubjectId) {
      toast.error('Please select a subject first');
      return;
    }
    if (photos.length === 0) {
      toast.error('Please add at least one classroom photo');
      return;
    }

    setAnalyzing(true);
    try {
      // 1. Get all enrolled students for this subject
      const enrolledNodes = await getEnrolledStudents(selectedSubjectId);
      if (!enrolledNodes || enrolledNodes.length === 0) {
        toast.error('No students enrolled in this course yet!');
        setAnalyzing(false);
        return;
      }

      const enrolledStudents = enrolledNodes.map(n => n.students).filter(Boolean);
      const detectedIds = new Set();
      const detectedSources = {};

      // Process each classroom photo
      for (let i = 0; i < photos.length; i++) {
        try {
          const img = new Image();
          img.src = photos[i];
          await new Promise(r => { img.onload = r; });

          const descriptor = await computeFaceDescriptor(img);
          const match = matchFace(descriptor, enrolledStudents, 0.70);

          if (match && match.student) {
            const sid = match.student.student_id;
            detectedIds.add(sid);
            detectedSources[sid] = detectedSources[sid] || [];
            detectedSources[sid].push(`Photo ${i + 1}`);
          }
        } catch (e) {
          console.error('Error scanning photo:', e);
        }
      }

      // If no students matched (e.g. photos without faces), mark first photo scan complete
      if (detectedIds.size === 0 && enrolledStudents.length > 0) {
        toast('Scan complete. Review attendance below before saving.', { icon: 'ℹ️' });
      }

      // Build checklist
      const results = enrolledStudents.map(student => {
        const isPresent = detectedIds.has(student.student_id);
        return {
          student_id: student.student_id,
          name: student.name,
          is_present: isPresent,
          source: isPresent ? (detectedSources[student.student_id]?.join(', ') || 'Detected') : '-'
        };
      });

      setAnalysisResults(results);
      setResultModalOpen(true);
    } catch (err) {
      console.error(err);
      toast.error('Face analysis failed. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Toggle present/absent manually in results dialog
  const toggleStudentStatus = (studentId) => {
    setAnalysisResults(prev =>
      prev.map(item =>
        item.student_id === studentId
          ? { ...item, is_present: !item.is_present }
          : item
      )
    );
  };

  // Confirm and save attendance logs to database
  const handleSaveAttendance = async () => {
    setSavingAttendance(true);
    try {
      const currentTimestamp = new Date().toISOString();
      const logs = analysisResults.map(item => ({
        student_id: item.student_id,
        subject_id: selectedSubjectId,
        timestamp: currentTimestamp,
        is_present: item.is_present,
      }));

      await createAttendance(logs);
      toast.success('Attendance saved successfully!');
      setResultModalOpen(false);
      setPhotos([]);
      fetchSubjects();
    } catch {
      toast.error('Failed to save attendance logs');
    } finally {
      setSavingAttendance(false);
    }
  };

  // Create Subject
  const handleCreateSubject = async (e) => {
    e.preventDefault();
    if (!newSubName.trim() || !newSubCode.trim()) {
      toast.error('Subject name and code are required');
      return;
    }
    setCreating(true);
    try {
      await createSubject(newSubCode.trim(), newSubName.trim(), newSubSection.trim() || 'A', teacherId);
      toast.success('Subject created successfully!');
      setCreateModalOpen(false);
      setNewSubName('');
      setNewSubCode('');
      setNewSubSection('');
      fetchSubjects();
    } catch {
      toast.error('Failed to create subject. Code may already exist.');
    } finally {
      setCreating(false);
    }
  };

  // View Enrolled Students
  const handleViewEnrolled = async (subject) => {
    setActiveSubjectForEnrolled(subject);
    setEnrolledModalOpen(true);
    setLoadingEnrolled(true);
    try {
      const data = await getEnrolledStudents(subject.subject_id);
      setEnrolledStudentsList(data.map(d => d.students).filter(Boolean));
    } catch {
      toast.error('Failed to load students');
    } finally {
      setLoadingEnrolled(false);
    }
  };

  // Share Subject
  const openShareModal = (subject) => {
    setShareSubject(subject);
    setShareModalOpen(true);
    setCopied(false);
  };

  const copyShareLink = () => {
    if (!shareSubject) return;
    const link = `${window.location.origin}/?join-code=${shareSubject.subject_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Join link copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  // Attendance Records Processing
  const getProcessedRecords = () => {
    const sessionMap = {};
    records.forEach(r => {
      const ts = r.timestamp;
      const tsGroup = ts ? ts.split('.')[0] : 'Unknown';
      const key = `${tsGroup}_${r.subject_id}`;

      if (!sessionMap[key]) {
        sessionMap[key] = {
          key,
          rawTimestamp: ts,
          timestamp: ts ? new Date(ts).toLocaleString() : 'N/A',
          subjectName: r.subjects?.name || 'Unknown',
          subjectCode: r.subjects?.subject_code || '-',
          presentCount: 0,
          totalCount: 0,
        };
      }
      sessionMap[key].totalCount += 1;
      if (r.is_present) {
        sessionMap[key].presentCount += 1;
      }
    });

    return Object.values(sessionMap).sort(
      (a, b) => new Date(b.rawTimestamp) - new Date(a.rawTimestamp)
    );
  };

  // Export records to CSV
  const handleExportCSV = () => {
    if (!records.length) {
      toast.error('No records to export');
      return;
    }

    const headers = ['Session Timestamp', 'Subject Code', 'Subject Name', 'Student ID', 'Student Name', 'Status'];
    const rows = records.map(r => [
      r.timestamp || '',
      r.subjects?.subject_code || '',
      r.subjects?.name || '',
      r.student_id || '',
      r.students?.name || 'Unknown',
      r.is_present ? 'Present' : 'Absent'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `attendance_records_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Records exported to CSV!');
  };

  const processedSessions = getProcessedRecords();

  return (
    <div className="dashboard-page">
      <div className="container">
        <HeaderDashboard title="Teacher Portal" />

        {/* Tab Navigation */}
        <div className="tabs-nav">
          <button
            className={`tab-btn ${activeTab === 'take_attendance' ? 'active' : ''}`}
            onClick={() => setActiveTab('take_attendance')}
          >
            <Camera size={18} /> Take AI Attendance
          </button>
          <button
            className={`tab-btn ${activeTab === 'manage_subjects' ? 'active' : ''}`}
            onClick={() => setActiveTab('manage_subjects')}
          >
            <BookOpen size={18} /> Manage Subjects
          </button>
          <button
            className={`tab-btn ${activeTab === 'records' ? 'active' : ''}`}
            onClick={() => setActiveTab('records')}
          >
            <FileSpreadsheet size={18} /> Attendance Records
          </button>
        </div>

        {/* ── TAB 1: TAKE AI ATTENDANCE ─────────────────────────────────── */}
        {activeTab === 'take_attendance' && (
          <div>
            <div className="dashboard-header-row">
              <div>
                <h2><span className="gradient-text">Take AI Attendance</span></h2>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
                  Upload classroom photos or snap pictures with your webcam to scan faces and register attendance automatically.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="loading-screen">
                <div className="spinner" />
                <span>Loading subjects...</span>
              </div>
            ) : subjects.length === 0 ? (
              <div className="empty-state">
                <BookOpen size={48} />
                <p>You haven't created any subjects yet. Create a subject first!</p>
                <button className="btn btn-primary" onClick={() => setActiveTab('manage_subjects')}>
                  <PlusCircle size={18} /> Create Subject
                </button>
              </div>
            ) : (
              <div className="glass-card" style={{ padding: '2rem' }}>
                {/* Subject Selector & Photo Action Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', alignItems: 'end', marginBottom: '2rem' }}>
                  <div className="input-group">
                    <label>Select Subject</label>
                    <select
                      className="input"
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                    >
                      {subjects.map(sub => (
                        <option key={sub.subject_id} value={sub.subject_id}>
                          {sub.name} ({sub.subject_code}) - Sec {sub.section || 'A'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <label className="btn btn-secondary" style={{ flex: 1, cursor: 'pointer', textAlign: 'center' }}>
                      <Upload size={18} /> Upload Photos
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                      />
                    </label>

                    <button
                      className="btn btn-secondary"
                      style={{ flex: 1 }}
                      onClick={() => {
                        setCameraModalOpen(true);
                        startCamera();
                      }}
                    >
                      <Camera size={18} /> Snap Photo
                    </button>
                  </div>
                </div>

                {/* Photo Gallery Grid */}
                {photos.length > 0 ? (
                  <div>
                    <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
                      <h4 style={{ fontSize: '1rem', color: 'var(--color-text-muted)' }}>
                        Added Classroom Photos ({photos.length})
                      </h4>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: '#F87171' }}
                        onClick={() => setPhotos([])}
                      >
                        <Trash2 size={16} /> Clear All
                      </button>
                    </div>

                    <div className="photo-gallery">
                      {photos.map((src, idx) => (
                        <div key={idx} className="photo-item">
                          <img src={src} alt={`Classroom ${idx + 1}`} />
                          <span className="photo-item-badge">Photo {idx + 1}</span>
                          <button
                            className="photo-remove-btn"
                            onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                            title="Remove Photo"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '0.85rem 2rem', fontSize: '1.05rem' }}
                        onClick={handleRunAnalysis}
                        disabled={analyzing}
                      >
                        {analyzing ? (
                          <><Loader2 size={20} className="spin-icon" /> Deep Scanning Classroom...</>
                        ) : (
                          <><Sparkles size={20} /> Run Face Analysis</>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="photo-upload-zone" onClick={() => document.getElementById('class-photo-input').click()}>
                    <Camera size={42} style={{ color: 'var(--color-primary-light)', marginBottom: '0.75rem' }} />
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem' }}>No Classroom Photos Added</h3>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                      Upload classroom photos or use your camera to start face attendance scan
                    </p>
                    <input
                      id="class-photo-input"
                      type="file"
                      multiple
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleFileUpload}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: MANAGE SUBJECTS ────────────────────────────────────── */}
        {activeTab === 'manage_subjects' && (
          <div>
            <div className="dashboard-header-row">
              <div>
                <h2><span className="gradient-text">Manage Subjects</span></h2>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
                  Create and manage your course subjects, share enrollment codes, and view students.
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => setCreateModalOpen(true)}>
                <PlusCircle size={18} /> Create New Subject
              </button>
            </div>

            {loading ? (
              <div className="loading-screen">
                <div className="spinner" />
                <span>Loading your subjects...</span>
              </div>
            ) : subjects.length === 0 ? (
              <div className="empty-state">
                <BookOpen size={48} />
                <p>No subjects found. Create your first subject to get started!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {subjects.map(sub => (
                  <SubjectCard
                    key={sub.subject_id}
                    name={sub.name}
                    code={sub.subject_code}
                    section={sub.section}
                    stats={[
                      { icon: '👥', label: 'Students', value: sub.total_students || 0 },
                      { icon: '⏱️', label: 'Sessions', value: sub.total_classes || 0 },
                    ]}
                    footer={
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleViewEnrolled(sub)}
                        >
                          <Users size={16} /> Students ({sub.total_students || 0})
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => openShareModal(sub)}
                        >
                          <Share2 size={16} /> Share Join Code
                        </button>
                      </div>
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: ATTENDANCE RECORDS & ANALYTICS ─────────────────────── */}
        {activeTab === 'records' && (
          <div>
            <div className="dashboard-header-row">
              <div>
                <h2><span className="gradient-text">Attendance Analytics & Logs</span></h2>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
                  Review historical attendance sessions, monitor participation, and export reports.
                </p>
              </div>
              <button
                className="btn btn-secondary"
                onClick={handleExportCSV}
                disabled={!records.length}
              >
                <FileSpreadsheet size={18} /> Export to CSV
              </button>
            </div>

            {loadingRecords ? (
              <div className="loading-screen">
                <div className="spinner" />
                <span>Loading records...</span>
              </div>
            ) : processedSessions.length === 0 ? (
              <div className="empty-state">
                <FileSpreadsheet size={48} />
                <p>No attendance records logged yet. Take your first attendance session!</p>
              </div>
            ) : (
              <div>
                {/* Session Table */}
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Subject</th>
                        <th>Code</th>
                        <th>Attendance Rate</th>
                        <th>Present / Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedSessions.map(session => {
                        const pct = session.totalCount > 0
                          ? ((session.presentCount / session.totalCount) * 100).toFixed(0)
                          : 0;
                        return (
                          <tr key={session.key}>
                            <td>{session.timestamp}</td>
                            <td><strong>{session.subjectName}</strong></td>
                            <td><code>{session.subjectCode}</code></td>
                            <td>
                              <span className={`badge ${Number(pct) >= 75 ? 'badge-present' : 'badge-absent'}`}>
                                {pct}%
                              </span>
                            </td>
                            <td>
                              {session.presentCount} / {session.totalCount} students
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal: Webcam Snapper ─────────────────────────────────────── */}
      <Modal
        isOpen={cameraModalOpen}
        onClose={() => {
          stopCamera();
          setCameraModalOpen(false);
        }}
        title="Snap Classroom Photo"
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{
            position: 'relative',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            background: '#000',
            aspectRatio: '16/9',
            marginBottom: '1.25rem'
          }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className="btn btn-ghost"
              style={{ flex: 1 }}
              onClick={() => {
                stopCamera();
                setCameraModalOpen(false);
              }}
            >
              Done
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={snapPhoto}
            >
              <Camera size={18} /> Capture
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: AI Attendance Scan Results ─────────────────────────── */}
      <Modal
        isOpen={resultModalOpen}
        onClose={() => setResultModalOpen(false)}
        title="AI Attendance Verification"
      >
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Face recognition has detected the following student presence. You can click any student to override their status before confirming.
        </p>

        <div className="table-container" style={{ maxHeight: '350px', marginBottom: '1.5rem' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Detection Source</th>
                <th>Status (Click to toggle)</th>
              </tr>
            </thead>
            <tbody>
              {analysisResults.map(item => (
                <tr
                  key={item.student_id}
                  onClick={() => toggleStudentStatus(item.student_id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td><strong>{item.name}</strong></td>
                  <td style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{item.source}</td>
                  <td>
                    {item.is_present ? (
                      <span className="badge badge-present"><CheckCircle2 size={14} /> Present</span>
                    ) : (
                      <span className="badge badge-absent"><XCircle size={14} /> Absent</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-ghost"
            style={{ flex: 1 }}
            onClick={() => setResultModalOpen(false)}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 2 }}
            onClick={handleSaveAttendance}
            disabled={savingAttendance}
          >
            {savingAttendance ? (
              <><Loader2 size={16} className="spin-icon" /> Saving...</>
            ) : (
              <><CheckCircle2 size={16} /> Confirm & Save Attendance</>
            )}
          </button>
        </div>
      </Modal>

      {/* ── Modal: Create Subject ─────────────────────────────────────── */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New Subject"
      >
        <form onSubmit={handleCreateSubject}>
          <div className="input-group" style={{ marginBottom: '1rem' }}>
            <label>Subject Name</label>
            <input
              className="input"
              type="text"
              placeholder="e.g. Artificial Intelligence"
              value={newSubName}
              onChange={(e) => setNewSubName(e.target.value)}
              required
            />
          </div>

          <div className="input-group" style={{ marginBottom: '1rem' }}>
            <label>Subject Code</label>
            <input
              className="input"
              type="text"
              placeholder="e.g. CS401"
              value={newSubCode}
              onChange={(e) => setNewSubCode(e.target.value)}
              required
            />
          </div>

          <div className="input-group" style={{ marginBottom: '1.5rem' }}>
            <label>Section / Batch</label>
            <input
              className="input"
              type="text"
              placeholder="e.g. Section A"
              value={newSubSection}
              onChange={(e) => setNewSubSection(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-stretch"
            disabled={creating}
          >
            {creating ? <><Loader2 size={16} className="spin-icon" /> Creating...</> : 'Create Subject'}
          </button>
        </form>
      </Modal>

      {/* ── Modal: Share Subject Code & QR ───────────────────────────── */}
      <Modal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title={shareSubject ? `Share ${shareSubject.name}` : 'Share Subject'}
      >
        {shareSubject && (
          <div className="share-box">
            <div className="qr-wrapper">
              <QRCodeSVG
                value={`${window.location.origin}/?join-code=${shareSubject.subject_code}`}
                size={180}
                level="M"
              />
            </div>

            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              Subject Code:
            </p>
            <div className="code-pill">
              {shareSubject.subject_code}
            </div>

            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Students can scan this QR code or enter the code in their dashboard to join automatically.
            </p>

            <button
              className="btn btn-primary btn-stretch"
              onClick={copyShareLink}
            >
              {copied ? <><Check size={16} /> Copied Join Link!</> : <><Copy size={16} /> Copy Direct Join Link</>}
            </button>
          </div>
        )}
      </Modal>

      {/* ── Modal: View Enrolled Students ─────────────────────────────── */}
      <Modal
        isOpen={enrolledModalOpen}
        onClose={() => setEnrolledModalOpen(false)}
        title={activeSubjectForEnrolled ? `Enrolled Students - ${activeSubjectForEnrolled.name}` : 'Enrolled Students'}
      >
        {loadingEnrolled ? (
          <div className="loading-screen" style={{ minHeight: '150px' }}>
            <div className="spinner" />
            <span>Loading students...</span>
          </div>
        ) : enrolledStudentsList.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem 1rem' }}>
            <Users size={36} />
            <p>No students enrolled in this subject yet.</p>
          </div>
        ) : (
          <div className="table-container" style={{ maxHeight: '350px' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student Name</th>
                  <th>Student ID</th>
                </tr>
              </thead>
              <tbody>
                {enrolledStudentsList.map((stu, idx) => (
                  <tr key={stu.student_id || idx}>
                    <td>{idx + 1}</td>
                    <td><strong>{stu.name}</strong></td>
                    <td><code>{stu.student_id}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
