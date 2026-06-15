import { Response } from 'express';
import { Queue } from 'bullmq';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/types';
import { getPresignedUploadUrl, getProcessedVideoObject, deleteLessonVideoFiles } from '../services/storage';
import { queueConnection, TRANSCODE_QUEUE_NAME, TRANSCODE_JOB_NAME } from '../config/queue';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-token-key-change-in-prod';

const transcodeQueue = new Queue(TRANSCODE_QUEUE_NAME, {
  connection: queueConnection,
});

export async function getUploadUrl(req: AuthRequest, res: Response) {
  const { lessonId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: true },
    });

    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found.' });
    }

    if (lesson.course.instructorId !== userId) {
      return res.status(403).json({ message: 'Only the course instructor can upload videos.' });
    }

    const fileId = crypto.randomUUID();
    const rawKey = `raw/${lessonId}/${fileId}.mp4`;

    // Update videoKey in db and set status to PENDING
    await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        videoKey: rawKey,
        videoStatus: 'PENDING',
      },
    });

    const uploadUrl = await getPresignedUploadUrl(rawKey, 'video/mp4');

    return res.json({
      uploadUrl,
      rawKey,
    });
  } catch (error) {
    console.error('Get upload URL error:', error);
    return res.status(500).json({ message: 'Error generating upload URL.' });
  }
}

export async function notifyUploadComplete(req: AuthRequest, res: Response) {
  const { lessonId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: true },
    });

    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found.' });
    }

    if (lesson.course.instructorId !== userId) {
      return res.status(403).json({ message: 'Only the course instructor can update video status.' });
    }

    if (!lesson.videoKey) {
      return res.status(400).json({ message: 'No video upload has been initiated for this lesson.' });
    }

    // Update status to PROCESSING
    await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        videoStatus: 'PROCESSING',
      },
    });

    // Enqueue transcoding job
    await transcodeQueue.add(TRANSCODE_JOB_NAME, {
      lessonId: lesson.id,
      rawKey: lesson.videoKey,
    });

    return res.json({
      message: 'Video upload confirmed. Transcoding job queued.',
      status: 'PROCESSING',
    });
  } catch (error) {
    console.error('Notify upload complete error:', error);
    return res.status(500).json({ message: 'Error queueing transcoding job.' });
  }
}

export async function getPlaybackToken(req: AuthRequest, res: Response) {
  const { lessonId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: true },
    });

    if (!lesson) {
      res.status(404).json({ message: 'Lesson not found.' });
      return;
    }

    if (lesson.videoStatus !== 'READY') {
      res.status(400).json({ message: `Video is not ready. Status: ${lesson.videoStatus}` });
      return;
    }

    // Verify enrollment (or if they are the instructor)
    if (lesson.course.instructorId !== userId) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId: lesson.courseId,
          },
        },
      });

      if (!enrollment) {
        res.status(403).json({ message: 'Access denied. You must be enrolled in this course.' });
        return;
      }
    }

    // Generate short-lived playback token (expires in 15 minutes)
    const playbackToken = jwt.sign(
      {
        userId,
        lessonId,
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const apiUrl = process.env.API_URL || 'http://localhost:5000';
    const streamUrl = `${apiUrl}/api/videos/lessons/${lessonId}/stream/master.m3u8?playbackToken=${playbackToken}`;

    // Set cookie for Safari native player playback support
    res.cookie('playbackToken', playbackToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.json({
      playbackToken,
      streamUrl,
    });
    return;
  } catch (error) {
    console.error('Get playback token error:', error);
    res.status(500).json({ message: 'Error generating playback token.' });
    return;
  }
}

export async function streamVideo(req: AuthRequest, res: Response) {
  const { lessonId } = req.params;
  const relativePath = req.params[0]; // Wildcard path (e.g. master.m3u8, 720p/index.m3u8, etc.)

  if (!relativePath) {
    res.status(400).json({ message: 'Missing playlist/segment path.' });
    return;
  }

  // 1. Domain Hotlink Protection (Origin and Referer checking)
  const referer = req.headers.referer;
  const origin = req.headers.origin;
  const allowedFrontend = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (referer && !referer.startsWith(allowedFrontend)) {
    res.status(403).json({ message: 'Access denied: domain restriction violation.' });
    return;
  }
  if (origin && origin !== allowedFrontend) {
    res.status(403).json({ message: 'Access denied: domain restriction violation.' });
    return;
  }

  // 2. Playback Token Authentication
  let token: string | undefined;
  if (req.query.playbackToken) {
    token = req.query.playbackToken as string;
  } else if (req.headers['x-playback-token']) {
    token = req.headers['x-playback-token'] as string;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.headers.cookie) {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.playbackToken) {
      token = cookies.playbackToken;
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Playback authorization token missing.' });
    return;
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    res.status(403).json({ message: 'Playback token invalid or expired.' });
    return;
  }

  if (decoded.lessonId !== lessonId) {
    res.status(403).json({ message: 'Playback token does not match requested lesson.' });
    return;
  }

  try {
    // 3. Intercept AES-128 decryption key requests (HLS #EXT-X-KEY URI points here as enc.key)
    if (relativePath === 'enc.key' || relativePath.endsWith('/enc.key')) {
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { videoCipherKey: true },
      });

      if (!lesson || !lesson.videoCipherKey) {
        res.status(404).json({ message: 'Decryption key not found for this lesson.' });
        return;
      }

      const keyBuffer = Buffer.from(lesson.videoCipherKey, 'hex');
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', 16);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.send(keyBuffer);
      return;
    }

    // 4. Construct processed S3 key: processed/${lessonId}/${relativePath}
    const s3Key = `processed/${lessonId}/${relativePath}`;

    // Get content type based on file extension
    let contentType = 'application/octet-stream';
    if (relativePath.endsWith('.m3u8')) {
      contentType = 'application/x-mpegURL';
    } else if (relativePath.endsWith('.ts')) {
      contentType = 'video/MP2T';
    } else if (relativePath.endsWith('.mpd')) {
      contentType = 'application/dash+xml';
    } else if (relativePath.endsWith('.m4s')) {
      contentType = 'video/iso.segment';
    }

    // Get stream from MinIO
    const stream = await getProcessedVideoObject(s3Key);

    // Set appropriate headers and pipe to response
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache segments for speed
    
    // Check if stream is indeed a NodeJS ReadableStream
    if (stream && typeof (stream as any).pipe === 'function') {
      (stream as any).pipe(res);
      return;
    } else {
      console.error('Invalid stream object from storage:', stream);
      res.status(500).json({ message: 'Error reading video stream.' });
      return;
    }
  } catch (error: any) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      res.status(404).json({ message: 'Requested video file not found.' });
      return;
    }
    console.error('Stream video error:', error);
    res.status(500).json({ message: 'Error serving video stream.' });
    return;
  }
}

function cleanImportUrl(url: string): string {
  const match1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match1 && match1[1]) {
    return `https://docs.google.com/uc?export=download&confirm=t&id=${match1[1]}`;
  }
  const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (url.includes('drive.google.com') && match2 && match2[1]) {
    return `https://docs.google.com/uc?export=download&confirm=t&id=${match2[1]}`;
  }
  return url;
}

export async function importVideoUrl(req: AuthRequest, res: Response) {
  const { lessonId } = req.params;
  const { url } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  if (!url) {
    res.status(400).json({ message: 'Video URL is required.' });
    return;
  }

  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: true },
    });

    if (!lesson) {
      res.status(404).json({ message: 'Lesson not found.' });
      return;
    }

    if (lesson.course.instructorId !== userId) {
      res.status(403).json({ message: 'Only the course instructor can update video content.' });
      return;
    }

    const cleanedUrl = cleanImportUrl(url);
    const fileId = crypto.randomUUID();
    const mockRawKey = `imported/${lessonId}/${fileId}.mp4`;

    // Update videoKey in db and set status to PROCESSING
    await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        videoKey: mockRawKey,
        videoStatus: 'PROCESSING',
      },
    });

    // Enqueue transcoding job
    await transcodeQueue.add(TRANSCODE_JOB_NAME, {
      lessonId: lesson.id,
      rawKey: mockRawKey,
      importUrl: cleanedUrl,
    });

    res.json({
      message: 'Video URL import initiated. Transcoding job queued.',
      status: 'PROCESSING',
    });
    return;
  } catch (error) {
    console.error('Import video URL error:', error);
    res.status(500).json({ message: 'Error queueing transcoding job.' });
    return;
  }
}

export async function getDrmLicense(req: AuthRequest, res: Response) {
  const { lessonId } = req.params;

  // 1. Playback Token Authentication
  let token: string | undefined;
  if (req.query.playbackToken) {
    token = req.query.playbackToken as string;
  } else if (req.headers['x-playback-token']) {
    token = req.headers['x-playback-token'] as string;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.headers.cookie) {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.playbackToken) {
      token = cookies.playbackToken;
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Playback authorization token missing.' });
    return;
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    res.status(403).json({ message: 'Playback token invalid or expired.' });
    return;
  }

  if (decoded.lessonId !== lessonId) {
    res.status(403).json({ message: 'Playback token does not match requested lesson.' });
    return;
  }

  const userId = decoded.userId;

  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: true },
    });

    if (!lesson) {
      res.status(404).json({ message: 'Lesson not found.' });
      return;
    }

    // Verify enrollment (or if they are the instructor)
    if (lesson.course.instructorId !== userId) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId: lesson.courseId,
          },
        },
      });

      if (!enrollment) {
        res.status(403).json({ message: 'Access denied. You must be enrolled in this course.' });
        return;
      }
    }

    if (!lesson.videoCipherKey || !lesson.videoCipherKid) {
      res.status(404).json({ message: 'DRM keys not configured for this lesson.' });
      return;
    }

    // Standard ClearKey EME response: JWK format
    const keyIdBase64Url = Buffer.from(lesson.videoCipherKid, 'hex').toString('base64url');
    const keyBase64Url = Buffer.from(lesson.videoCipherKey, 'hex').toString('base64url');

    res.json({
      keys: [
        {
          kty: 'oct',
          k: keyBase64Url,
          kid: keyIdBase64Url
        }
      ],
      type: 'temporary'
    });
    return;
  } catch (error) {
    console.error('DRM License error:', error);
    res.status(500).json({ message: 'Error serving DRM license.' });
    return;
  }
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const list: Record<string, string> = {};
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join('='));
    }
  });
  return list;
}

export async function deleteVideo(req: AuthRequest, res: Response) {
  const { lessonId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: true },
    });

    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found.' });
    }

    if (lesson.course.instructorId !== userId) {
      return res.status(403).json({ message: 'Only the course instructor can delete videos.' });
    }

    // Clean up any pending transcode jobs for this lesson from the BullMQ queue
    try {
      const jobs = await transcodeQueue.getJobs(['waiting', 'delayed', 'paused', 'active']);
      for (const job of jobs) {
        if (job.data && job.data.lessonId === lessonId) {
          await job.remove();
          console.log(`[Queue] Removed pending transcoding job ${job.id} for Lesson ${lessonId}`);
        }
      }
    } catch (queueErr) {
      console.error('Error removing queued transcoding jobs during video deletion:', queueErr);
    }

    // Update lesson to remove video details and reset status
    await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        videoKey: null,
        videoStatus: 'PENDING',
        videoCipherKey: null,
        videoCipherKid: null,
      },
    });

    // Clean up S3/MinIO files
    await deleteLessonVideoFiles(lessonId);

    return res.json({ message: 'Video deleted successfully and lesson reset to pending.' });
  } catch (error) {
    console.error('Delete video error:', error);
    return res.status(500).json({ message: 'Error deleting video.' });
  }
}


