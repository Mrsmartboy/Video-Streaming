import { Router } from 'express';
import { getUploadUrl, notifyUploadComplete, streamVideo, importVideoUrl, getPlaybackToken, getDrmLicense, deleteVideo } from '../controllers/videoController';
import { authenticateJWT, requireRole } from '../middleware/auth';

const router = Router();

// Endpoint for generating a signed upload URL
router.post('/lessons/:lessonId/upload-url', authenticateJWT, requireRole('INSTRUCTOR'), getUploadUrl);

// Endpoint for notifying that upload has finished and triggering transcoding
router.post('/lessons/:lessonId/upload-complete', authenticateJWT, requireRole('INSTRUCTOR'), notifyUploadComplete);

// Endpoint for importing from a third-party URL (e.g. Google Drive)
router.post('/lessons/:lessonId/import-url', authenticateJWT, requireRole('INSTRUCTOR'), importVideoUrl);

// Endpoint for obtaining a short-lived playback token
router.post('/lessons/:lessonId/playback-token', authenticateJWT, getPlaybackToken);

// DRM license server endpoint (Standard ClearKey JSON/JWK responder)
router.post('/lessons/:lessonId/drm-license', getDrmLicense);

// Secure video streaming route
// Matches /lessons/:lessonId/stream/stream.mpd, chunk-stream0-00001.m4s, etc.
// Self-authenticates internally using the playbackToken query/headers/cookies.
router.get('/lessons/:lessonId/stream/*', streamVideo);

// Delete video route
router.delete('/lessons/:lessonId/video', authenticateJWT, requireRole('INSTRUCTOR'), deleteVideo);

export default router;
