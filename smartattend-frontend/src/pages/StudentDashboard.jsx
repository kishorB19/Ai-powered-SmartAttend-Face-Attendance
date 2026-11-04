import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HeaderDashboard } from '../components/Header';
import SubjectCard from '../components/SubjectCard';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import {
  getStudentSubjects,
  getStudentAttendance,
  unenrollStudentFromSubject,
  findSubjectByCode,
  checkAlreadyEnrolled,
  enrollStudentToSubject,
} from '../lib/db';
import { BookPlus, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import './Dashboard.css';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const student = user.data;
  const studentId = student.student_id;

  const [subjects, setSubjects] = useState([]);
  const [statsMap, setStatsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollCode, setEnrollCode] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [autoEnrollOpen, setAutoEnrollOpen] = useState(false);
  const [autoEnrollSubject, setAutoEnrollSubject] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [subs, logs] = await Promise.all([
        getStudentSubjects(studentId),
        getStudentAttendance(studentId),
      ]);
      setSubjects(subs);

      const map = {};
      logs.forEach(log => {
        const sid = log.subject_id;
        if (!map[sid]) map[sid] = { total: 0, attended: 0 };
        map[sid].total += 1;
        if (log.is_present) map[sid].attended += 1;
      });
      setStatsMap(map);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-enroll from join-code
  useEffect(() => {
    const joinCode = searchParams.get('join-code');
    if (joinCode) {
      (async () => {
        const subject = await findSubjectByCode(joinCode);
        if (subject) {
          const already = await checkAlreadyEnrolled(studentId, subject.subject_id);
          if (already) {
            toast('You\'re already enrolled in this subject!', { icon: 'ℹ️' });
          } else {
            setAutoEnrollSubject(subject);
            setAutoEnrollOpen(true);
          }
        } else {
          toast.error('Subject code not found');
        }
        setSearchParams({});
      })();
    }
  }, [searchParams, studentId, setSearchParams]);

  const handleEnroll = async () => {
    if (!enrollCode.trim()) {
      toast.error('Please enter a subject code');
      return;
    }
    setEnrolling(true);
    try {
      const subject = await findSubjectByCode(enrollCode.trim());
      if (!subject) {
        toast.error('Subject not found');
        setEnrolling(false);
        return;
      }
      const already = await checkAlreadyEnrolled(studentId, subject.subject_id);
      if (already) {
        toast('Already enrolled in this subject!', { icon: 'ℹ️' });
        setEnrolling(false);
        return;
      }
      await enrollStudentToSubject(studentId, subject.subject_id);
      toast.success('Successfully enrolled!');
      setEnrollOpen(false);
      setEnrollCode('');
      fetchData();
    } catch {
      toast.error('Enrollment failed');
    } finally {
      setEnrolling(false);
    }
  };

  const handleAutoEnroll = async () => {
    if (!autoEnrollSubject) return;
    setEnrolling(true);
    try {
      await enrollStudentToSubject(studentId, autoEnrollSubject.subject_id);
      toast.success('Successfully enrolled!');
      setAutoEnrollOpen(false);
      setAutoEnrollSubject(null);
      fetchData();
    } catch {
      toast.error('Enrollment failed');
    } finally {
      setEnrolling(false);
    }
  };

  const handleUnenroll = async (subjectId, subjectName) => {
    try {
      await unenrollStudentFromSubject(studentId, subjectId);
      toast.success(`Unenrolled from ${subjectName}`);
      fetchData();
    } catch {
      toast.error('Failed to unenroll');
    }
  };

  return (
    <div className="dashboard-page">
      <div className="container">
        <HeaderDashboard title="Student Dashboard" />

        <div className="flex-between" style={{ marginBottom: '1rem' }}>
          <h2><span className="gradient-text">Your Enrolled Subjects</span></h2>
          <button className="btn btn-primary" onClick={() => setEnrollOpen(true)}>
            <BookPlus size={18} /> Enroll in Subject
          </button>
        </div>

        <hr className="divider" />

        {loading ? (
          <div className="loading-screen">
            <div className="spinner" />
            <span>Loading your subjects...</span>
          </div>
        ) : subjects.length === 0 ? (
          <div className="empty-state">
            <BookPlus size={48} />
            <p>No enrolled subjects yet. Click "Enroll in Subject" to get started!</p>
          </div>
        ) : (
          <>
            {subjects.map(node => {
              const sub = node.subjects;
              const sid = sub.subject_id;
              const stats = statsMap[sid] || { total: 0, attended: 0 };
              const pct = stats.total > 0 ? (stats.attended / stats.total * 100) : 100;

              return (
                <React.Fragment key={sid}>
                  {pct < 75 && (
                    <div className="alert alert-danger" style={{ marginBottom: '0.75rem' }}>
                      <AlertTriangle size={18} />
                      <span>Your attendance in <strong>{sub.name}</strong> is {pct.toFixed(1)}% — below 75%!</span>
                    </div>
                  )}
                  <div style={{ marginBottom: '1rem' }}>
                    <SubjectCard
                      name={sub.name}
                      code={sub.subject_code}
                      section={sub.section}
                      stats={[
                        { icon: '📅', label: 'Total', value: stats.total },
                        { icon: '✅', label: 'Attended', value: stats.attended },
                      ]}
                      footer={
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleUnenroll(sid, sub.name)}
                        >
                          <Trash2 size={14} /> Unenroll
                        </button>
                      }
                    />
                  </div>
                </React.Fragment>
              );
            })}
          </>
        )}
      </div>

      {/* Enroll Modal */}
      <Modal isOpen={enrollOpen} onClose={() => setEnrollOpen(false)} title="Enroll in Subject">
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Enter the subject code provided by your teacher
        </p>
        <div className="input-group" style={{ marginBottom: '1.25rem' }}>
          <label>Subject Code</label>
          <input className="input" type="text" placeholder="E.g. CS101" value={enrollCode} onChange={(e) => setEnrollCode(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-stretch" onClick={handleEnroll} disabled={enrolling}>
          {enrolling ? <><Loader2 size={16} className="spin-icon" /> Enrolling...</> : 'Enroll Now'}
        </button>
      </Modal>

      {/* Auto Enroll Modal */}
      <Modal isOpen={autoEnrollOpen} onClose={() => { setAutoEnrollOpen(false); setAutoEnrollSubject(null); }} title="Quick Enrollment">
        {autoEnrollSubject && (
          <>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              Would you like to enroll in <strong style={{ color: 'var(--color-text)' }}>{autoEnrollSubject.name}</strong>?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setAutoEnrollOpen(false); setAutoEnrollSubject(null); }}>
                No thanks
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAutoEnroll} disabled={enrolling}>
                {enrolling ? <Loader2 size={16} className="spin-icon" /> : 'Yes, enroll!'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
