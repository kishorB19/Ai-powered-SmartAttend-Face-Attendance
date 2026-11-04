import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HeaderHome } from '../components/Header';
import { GraduationCap, BookOpen, ArrowRight, Scan, Users, BarChart3 } from 'lucide-react';
import './HomePage.css';

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="home-page">
      <div className="home-glow" />
      <div className="container">
        <HeaderHome />

        <div className="home-cards">
          <div className="home-card glass animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="home-card-icon student-icon">
              <GraduationCap size={40} />
            </div>
            <h2>I'm a Student</h2>
            <p>Login with Face ID, view your enrolled subjects, and track your attendance in real time.</p>
            <button className="btn btn-primary btn-lg btn-stretch" onClick={() => navigate('/student/login')}>
              Student Portal <ArrowRight size={18} />
            </button>
          </div>

          <div className="home-card glass animate-slide-up" style={{ animationDelay: '0.25s' }}>
            <div className="home-card-icon teacher-icon">
              <BookOpen size={40} />
            </div>
            <h2>I'm a Teacher</h2>
            <p>Manage subjects, take AI-powered face attendance, and view analytics & reports.</p>
            <button className="btn btn-secondary btn-lg btn-stretch" onClick={() => navigate('/teacher/login')}>
              Teacher Portal <ArrowRight size={18} />
            </button>
          </div>
        </div>

        <div className="home-features animate-fade" style={{ animationDelay: '0.4s' }}>
          <div className="home-feature">
            <Scan size={24} />
            <span>AI Face Recognition</span>
          </div>
          <div className="home-feature">
            <Users size={24} />
            <span>Multi-Face Detection</span>
          </div>
          <div className="home-feature">
            <BarChart3 size={24} />
            <span>Real-time Analytics</span>
          </div>
        </div>
      </div>
    </div>
  );
}
