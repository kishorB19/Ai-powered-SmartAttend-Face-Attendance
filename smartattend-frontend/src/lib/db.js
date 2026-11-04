import { supabase } from './supabase.js';

/* ─── Helpers ────────────────────────────────────── */

async function hashPass(pwd) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pwd);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ─── Teacher ────────────────────────────────────── */

export async function checkTeacherExists(username) {
  const { data } = await supabase
    .from('teachers')
    .select('username')
    .eq('username', username);
  return data && data.length > 0;
}

export async function createTeacher(username, password, name) {
  const hashed = await hashPass(password);
  const { data, error } = await supabase
    .from('teachers')
    .insert({ username, password: hashed, name })
    .select();
  if (error) throw error;
  return data;
}

export async function teacherLogin(username, password) {
  const { data } = await supabase
    .from('teachers')
    .select('*')
    .eq('username', username);
  if (data && data.length > 0) {
    const teacher = data[0];
    const hashed = await hashPass(password);
    if (teacher.password === hashed) return teacher;
  }
  return null;
}

/* ─── Student ────────────────────────────────────── */

export async function getAllStudents() {
  const { data } = await supabase.from('students').select('*');
  return data || [];
}

function generateFallbackEmbedding(seed = '') {
  const arr = [];
  let h = 17;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  for (let i = 0; i < 128; i++) {
    const val = Math.sin(h + i * 0.3) * 0.5 + Math.cos(i * 1.7) * 0.5;
    arr.push(parseFloat(val.toFixed(5)));
  }
  return arr;
}

export async function createStudent(name, faceEmbedding = null) {
  const validEmbedding = (Array.isArray(faceEmbedding) && faceEmbedding.length >= 64)
    ? faceEmbedding
    : generateFallbackEmbedding(name + '_' + Date.now());

  const { data, error } = await supabase
    .from('students')
    .insert({ name, face_embedding: validEmbedding })
    .select();
  if (error) throw error;
  return data;
}

export async function updateStudentEmbedding(studentId, faceEmbedding) {
  const validEmbedding = (Array.isArray(faceEmbedding) && faceEmbedding.length >= 64)
    ? faceEmbedding
    : generateFallbackEmbedding(`stu_${studentId}_${Date.now()}`);

  const { data, error } = await supabase
    .from('students')
    .update({ face_embedding: validEmbedding })
    .eq('student_id', studentId)
    .select();
  if (error) throw error;
  return data;
}

/* ─── Subject ────────────────────────────────────── */

export async function createSubject(subjectCode, name, section, teacherId) {
  const { data, error } = await supabase
    .from('subjects')
    .insert({ subject_code: subjectCode, name, section, teacher_id: teacherId })
    .select();
  if (error) throw error;
  return data;
}

export async function getTeacherSubjects(teacherId) {
  const { data } = await supabase
    .from('subjects')
    .select('*, subject_students(count), attendance_logs(timestamp)')
    .eq('teacher_id', teacherId);

  if (!data) return [];

  return data.map(sub => {
    const totalStudents = sub.subject_students?.[0]?.count || 0;
    const timestamps = sub.attendance_logs?.map(l => l.timestamp) || [];
    const uniqueSessions = new Set(timestamps).size;
    return { ...sub, total_students: totalStudents, total_classes: uniqueSessions };
  });
}

/* ─── Enrollment ─────────────────────────────────── */

export async function enrollStudentToSubject(studentId, subjectId) {
  const { data, error } = await supabase
    .from('subject_students')
    .insert({ student_id: studentId, subject_id: subjectId })
    .select();
  if (error) throw error;
  return data;
}

export async function unenrollStudentFromSubject(studentId, subjectId) {
  const { data, error } = await supabase
    .from('subject_students')
    .delete()
    .eq('student_id', studentId)
    .eq('subject_id', subjectId);
  if (error) throw error;
  return data;
}

export async function getStudentSubjects(studentId) {
  const { data } = await supabase
    .from('subject_students')
    .select('*, subjects(*)')
    .eq('student_id', studentId);
  return data || [];
}

export async function getStudentAttendance(studentId) {
  const { data } = await supabase
    .from('attendance_logs')
    .select('*, subjects(*)')
    .eq('student_id', studentId);
  return data || [];
}

/* ─── Attendance ─────────────────────────────────── */

export async function createAttendance(logs) {
  const { data, error } = await supabase
    .from('attendance_logs')
    .insert(logs)
    .select();
  if (error) throw error;
  return data;
}

export async function getAttendanceForTeacher(teacherId) {
  const { data } = await supabase
    .from('attendance_logs')
    .select('*, subjects!inner(*), students(*)')
    .eq('subjects.teacher_id', teacherId);
  return data || [];
}

export async function getEnrolledStudents(subjectId) {
  const { data } = await supabase
    .from('subject_students')
    .select('*, students(*)')
    .eq('subject_id', subjectId);
  return data || [];
}

export async function findSubjectByCode(code) {
  const { data } = await supabase
    .from('subjects')
    .select('subject_id, name, subject_code')
    .eq('subject_code', code);
  return data && data.length > 0 ? data[0] : null;
}

export async function checkAlreadyEnrolled(studentId, subjectId) {
  const { data } = await supabase
    .from('subject_students')
    .select('*')
    .eq('subject_id', subjectId)
    .eq('student_id', studentId);
  return data && data.length > 0;
}
