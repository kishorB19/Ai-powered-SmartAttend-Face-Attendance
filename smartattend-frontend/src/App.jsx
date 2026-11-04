import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import HomePage from './pages/HomePage';
import StudentLogin from './pages/StudentLogin';
import StudentDashboard from './pages/StudentDashboard';
import TeacherLogin from './pages/TeacherLogin';
import TeacherRegister from './pages/TeacherRegister';
import TeacherDashboard from './pages/TeacherDashboard';
import Layout from './components/Layout';
import './App.css';

function ProtectedRoute({ role, children }) {
  const { user } = useAuth();
  if (!user || user.role !== role) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function AutoEnrollRedirect() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const joinCode = params.get('join-code');

  if (joinCode && user?.role === 'student') {
    return <Navigate to={`/student/dashboard?join-code=${joinCode}`} replace />;
  }
  if (joinCode) {
    return <Navigate to={`/student/login?join-code=${joinCode}`} replace />;
  }
  return <HomePage />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1A1A2E',
              color: '#E8E6F0',
              border: '1px solid rgba(108, 99, 255, 0.2)',
              borderRadius: '12px',
              fontFamily: "'Outfit', sans-serif",
              fontSize: '0.9rem',
              padding: '12px 20px',
              boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
            },
            success: {
              iconTheme: { primary: '#34D399', secondary: '#1A1A2E' },
            },
            error: {
              iconTheme: { primary: '#F87171', secondary: '#1A1A2E' },
            },
          }}
        />
        <Layout>
          <Routes>
            <Route path="/" element={<AutoEnrollRedirect />} />
            <Route path="/student/login" element={<StudentLogin />} />
            <Route
              path="/student/dashboard"
              element={
                <ProtectedRoute role="student">
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/teacher/login" element={<TeacherLogin />} />
            <Route path="/teacher/register" element={<TeacherRegister />} />
            <Route
              path="/teacher/dashboard"
              element={
                <ProtectedRoute role="teacher">
                  <TeacherDashboard />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
