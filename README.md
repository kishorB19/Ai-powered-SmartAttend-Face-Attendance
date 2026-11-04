# SmartAttend — AI-Powered Face Attendance System

A modern, high-precision AI facial recognition attendance platform featuring a custom glassmorphism React web frontend and a Python face-recognition pipeline backed by Supabase.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/kishorB19/Ai-powered-SmartAttend-Face-Attendance&root-directory=smartattend-frontend)

---

## 🚀 Key Features

### 👨‍🎓 Student Experience
- **Live Facial Login & Registration**: Seamless camera-based face verification with fallback registration.
- **Subject Dashboard**: Track enrolled courses, total sessions, and attendance percentages in real time.
- **Instant Join & QR Scanning**: Enroll via course codes or auto-join directly through QR code links (`?join-code=<CODE>`).
- **Low Attendance Warning**: Automatic smart alerts when attendance dips below 75%.

### 👩‍🏫 Teacher Portal
- **AI Classroom Attendance**:
  - Upload multi-angle classroom photos or snap pictures with your webcam.
  - Deep face analysis scans all enrolled students simultaneously.
  - Review detection sources and verify attendance status before saving.
- **Course & Batch Management**:
  - Create subjects with custom codes, names, and sections.
  - View real-time enrolled student rosters.
  - Generate instant shareable join links and dynamic QR codes.
- **Analytics & Export**:
  - Historical session logs with participation breakdown.
  - One-click **CSV Export** for grading and administrative records.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, React Router 7, Vanilla CSS Design System, Lucide Icons, QR Code SVG, React Hot Toast
- **Database**: Supabase (PostgreSQL)
- **Face Recognition Pipeline**: Python, OpenCV, Face Recognition Embeddings
- **Deployment**: Vercel ready (`vercel.json` included)

---

## 📦 Getting Started

### 1. Frontend Setup
```bash
cd smartattend-frontend
npm install
npm run dev
```

### 2. Environment Variables
Create a `.env` file in `smartattend-frontend/`:
```env
VITE_SUPABASE_URL=https://bjssqridabxydpbuvqse.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_wMM7nQKmmM3fBphaJ3djVg_Y26B3WOU
VITE_FACE_API_URL=
```

### 3. Vercel Deployment
1. Go to [Vercel Dashboard](https://vercel.com/new).
2. Import repository `kishorB19/Ai-powered-SmartAttend-Face-Attendance`.
3. Set **Root Directory** to `smartattend-frontend`.
4. Add the environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Click **Deploy**!
