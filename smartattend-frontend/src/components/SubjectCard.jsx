import React from 'react';
import './SubjectCard.css';

export default function SubjectCard({ name, code, section, stats = [], footer, children }) {
  return (
    <div className="subject-card card card-accent animate-slide-up">
      <h3 className="subject-card-name">{name}</h3>
      <div className="subject-card-meta">
        <span className="badge badge-primary">{code}</span>
        <span className="subject-card-section">Section {section}</span>
      </div>
      {stats.length > 0 && (
        <div className="stat-chips">
          {stats.map((s, i) => (
            <span key={i} className="stat-chip">
              {s.icon} <strong>{s.value}</strong> {s.label}
            </span>
          ))}
        </div>
      )}
      {footer && <div className="subject-card-footer">{footer}</div>}
      {children}
    </div>
  );
}
