// Centralized API URL constants for the frontend application.
// All API endpoint paths are defined here for easy maintenance.

// ─── Auth ────────────────────────────────────────────────────
export const API_AUTH_LOGIN = '/api/auth/login';
export const API_AUTH_REGISTER = '/api/auth/register';

// ─── Courses ─────────────────────────────────────────────────
export const API_COURSES = '/api/courses';
export const API_COURSES_INSTRUCTOR = '/api/courses/instructor-only';
export const API_COURSE_DETAILS = (courseId: string) => `/api/courses/${courseId}`;
export const API_COURSE_ENROLL = (courseId: string) => `/api/courses/${courseId}/enroll`;
export const API_COURSE_CREATE_LESSON = (courseId: string) => `/api/courses/${courseId}/lessons`;

// ─── Lessons (management) ────────────────────────────────────
export const API_LESSON_UPDATE = (lessonId: string) => `/api/courses/lessons/${lessonId}`;
export const API_LESSON_DELETE = (lessonId: string) => `/api/courses/lessons/${lessonId}`;

// ─── Videos ──────────────────────────────────────────────────
export const API_VIDEO_UPLOAD_URL = (lessonId: string) => `/api/videos/lessons/${lessonId}/upload-url`;
export const API_VIDEO_UPLOAD_COMPLETE = (lessonId: string) => `/api/videos/lessons/${lessonId}/upload-complete`;
export const API_VIDEO_IMPORT_URL = (lessonId: string) => `/api/videos/lessons/${lessonId}/import-url`;
export const API_VIDEO_DELETE = (lessonId: string) => `/api/videos/lessons/${lessonId}/video`;
export const API_VIDEO_PLAYBACK_TOKEN = (lessonId: string) => `/api/videos/lessons/${lessonId}/playback-token`;
export const API_VIDEO_DRM_LICENSE = (lessonId: string) => `/api/videos/lessons/${lessonId}/drm-license`;

// ─── Admin ───────────────────────────────────────────────────
export const API_ADMIN_USERS = '/api/admin/users';
export const API_ADMIN_USER_DELETE = (userId: string) => `/api/admin/users/${userId}`;

