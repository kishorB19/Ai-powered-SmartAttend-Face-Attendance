import React from 'react';
import './Layout.css';

export default function Layout({ children }) {
  return (
    <>
      <div className="app-bg" />
      <main className="main-content">
        {children}
      </main>
    </>
  );
}
