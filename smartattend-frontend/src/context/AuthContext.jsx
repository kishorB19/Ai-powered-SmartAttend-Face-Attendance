import React, { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { role: 'teacher'|'student', data: {...} }

  const loginAsTeacher = useCallback((teacherData) => {
    setUser({ role: 'teacher', data: teacherData });
  }, []);

  const loginAsStudent = useCallback((studentData) => {
    setUser({ role: 'student', data: studentData });
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loginAsTeacher, loginAsStudent, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
