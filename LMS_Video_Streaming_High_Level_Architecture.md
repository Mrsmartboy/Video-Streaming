# LMS Video Streaming System - High Level Architecture

## Overview
A scalable LMS video streaming platform using React, Node.js, PostgreSQL, Redis, S3/MinIO, FFmpeg, HLS, and CDN.

## Architecture

```text
Users (Web/Mobile)
        |
        v
Load Balancer
        |
        v
API Gateway
        |
  +-----+------+
  |     |      |
 Auth Course Video
 Svc   Svc   Svc
        |
        v
 PostgreSQL
        |
        v
     Redis
        |
        v
   S3 / MinIO
        |
        v
 FFmpeg Workers
        |
        v
 HLS (.m3u8/.ts)
        |
        v
 CloudFront CDN
        |
        v
   HLS.js Player
```

## Core Components


### Frontend
- React
- Vite
- HLS.js
- TanStack Query
- Redux Toolkit
- Tailwind CSS
- Typescript
- Tanstack Table


### Backend
- Node.js
- Express.js / NestJS/ Rest Api
- Typescript
- JWT Authentication
- Refresh Tokens
- Signed URLs
- Enrollment Verification
- CDN Protection
- ORM - Prisma

### Database
- PostgreSQL


### Cache
- Redis

### Queue
- BullMQ

### Storage
- AWS S3 / MinIO
- Local System

### Video Processing
- FFmpeg

### CDN
- CloudFront

## Upload Flow

1. Instructor uploads MP4.
2. File stored in S3/MinIO.
3. Processing job created.
4. FFmpeg worker transcodes video.
5. HLS files generated.
6. Metadata updated in PostgreSQL.

## Playback Flow

1. Student opens lesson.
2. Authentication verified.
3. Enrollment verified.
4. Signed URL generated.
5. HLS playlist returned.
6. Player requests segments through CDN.
7. Video streams adaptively.

## Security

- JWT Authentication
- Refresh Tokens
- Signed URLs
- Enrollment Verification
- CDN Protection

## Scalability

- Multiple API instances
- Multiple FFmpeg workers
- Redis caching
- Database replicas
- CDN edge caching

## Recommended Production Stack

React → API Gateway → Node.js Services → PostgreSQL + Redis → S3 → BullMQ → FFmpeg → HLS → CloudFront CDN → HLS.js Player
