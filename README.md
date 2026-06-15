# StreamLMS - Full-Stack HLS Adaptive Video Streaming Platform

StreamLMS is a containerized, high-performance Learning Management System (LMS) designed for secure, adaptive video streaming. It utilizes React (Vite, TypeScript, Tailwind CSS v4) on the frontend, Express (TypeScript, Prisma ORM, PostgreSQL) on the backend, and uses Redis, BullMQ, and FFmpeg to handle video transcoding.

---

## 🌟 Key Features

### 1. Adaptive Bitrate Streaming (HLS)
Instead of streaming heavy static MP4 files, videos are transcoded into **HTTP Live Streaming (HLS)** format. The custom player automatically adjusts video quality dynamically (480p and 720p) based on the user's active network bandwidth, ensuring smooth playback with zero buffering.

### 2. Multi-Option Video Upload
Instructors can upload videos in two ways:
- **Direct MP4 Upload**: Uploads files directly to the raw storage bucket in MinIO using secure pre-signed PUT URLs.
- **Google Drive & Remote Link Import**: Pasting a shareable Google Drive link (automatically converted to a direct-download link) or any direct MP4 link. The background worker downloads the file internally, saving user bandwidth.

### 3. Protected Content Delivery
Videos are fully secured. The system restricts direct access to segments and playlists:
- Frontend player requests playlists/segments via a secure proxy route `/api/videos/lessons/:lessonId/stream/*`.
- Express middleware verifies the student's JWT token and course enrollment in PostgreSQL.
- Only verified requests stream segment data from the S3 storage bucket.
- **HLS.js Interceptor**: The frontend custom player intercepts all playlist and segment chunk network requests to attach the student's JWT authorization header.

### 4. Background Job Queue (BullMQ)
Video transcoding is handled asynchronously. When an upload completes:
- A job is pushed to Redis.
- The `backend-worker` picks up the job, runs FFmpeg, generates `.m3u8` playlists and `.ts` chunks, uploads them to the processed bucket, and updates the status to `READY`.

---

## 🏗️ Architecture & Flow

```mermaid
graph TD
    Client[React Frontend - HLS.js] -->|1. Request Stream| API[Express API Server]
    API -->|2. Verify Auth & Enrollment| DB[(PostgreSQL)]
    API -->|3. Fetch Segments| S3[(MinIO Object Storage)]
    S3 -->|4. Pipe Stream Buffer| API
    API -->|5. Return Secure Video Chunks| Client
    
    Instructor[Instructor Dashboard] -->|A. Pastes URL / Uploads MP4| API
    API -->|B. Enqueue Job| Redis[(Redis Queue)]
    Redis -->|C. Process Job| Worker[FFmpeg Transcoder Worker]
    Worker -->|D. Transcode MP4 to HLS| Worker
    Worker -->|E. Save HLS master.m3u8 & .ts Chunks| S3
    Worker -->|F. Update status to READY| DB
```

---

## ⚙️ Environment Configurations

### Backend Environment Variables (`backend/.env`)
Create this file to run database syncs or run the backend server locally on the host:
```env
PORT=5000
DATABASE_URL=postgresql://root:password@localhost:5432/lms_streaming?schema=public
REDIS_URL=redis://localhost:6379
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadminpassword
MINIO_RAW_BUCKET=lms-raw-videos
MINIO_PROCESSED_BUCKET=lms-processed-videos
JWT_SECRET=super-secret-jwt-token-key-change-in-prod
FRONTEND_URL=http://localhost:5173
```

### Frontend Environment Variables (`frontend/.env`)
```env
VITE_API_URL=http://localhost:5000
```

---

## 🚀 Getting Started & Local Run

Ensure you have **Docker Desktop** running on your system.

### 1. Launch Services
Start the entire stack (PostgreSQL, Redis, MinIO, API, Worker, and Frontend) in containerized mode:
```bash
docker-compose up --build -d
```

### 2. Synchronize the Database Schema
Apply the database tables structure to PostgreSQL:
```bash
docker exec -i lms-backend-api npx prisma db push
```

### 3. Seed Database Test Accounts
Populate the database with pre-configured instructor and student accounts:
```bash
docker exec -i lms-backend-api npx prisma db seed
```

---

## 🔑 Test Credentials

Once seeded, you can log in at **`http://localhost:5173`** using:

### Instructor Credentials
- **Email**: `instructor@lms.com`
- **Password**: `password123`
- *Dashboard Capability*: Create courses, add lessons, upload MP4s, paste Google Drive URLs, and watch real-time transcoding job updates.

### Student Credentials
- **Email**: `student@lms.com`
- **Password**: `password123`
- *Portal Capability*: Browse course catalogs, enroll in courses, and stream HLS video lessons with manual resolution switching.

---

## 🛠️ Tech Stack & Key Libraries
- **Frontend**: React, Vite, TypeScript, Tailwind CSS v4 (with custom glassmorphic panels), HLS.js, Lucide Icons, TanStack Query, React Router DOM.
- **Backend API & Worker**: Node.js, Express, TypeScript, Prisma ORM, BullMQ, ioredis, AWS SDK v3 (S3 Client), fluent-ffmpeg, jsonwebtoken, bcryptjs, cors.
- **System Containers**: PostgreSQL 15, Redis 7, MinIO (S3 API & Console).
