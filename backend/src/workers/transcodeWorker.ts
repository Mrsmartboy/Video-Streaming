import { Worker, Job } from 'bullmq';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { Readable } from 'stream';
import ffmpeg from 'fluent-ffmpeg';
import prisma from '../config/prisma';
import { getRawVideoObject, uploadProcessedFile } from '../services/storage';
import { queueConnection, TRANSCODE_QUEUE_NAME } from '../config/queue';

// ─── HLS Transcode (multi-bitrate, AES-128 encryption) ────────────────────────
// Produces:
//   master.m3u8          ← top-level master playlist
//   480p/index.m3u8      ← variant playlist (480p)
//   480p/seg000.ts …     ← MPEG-TS segments (480p)
//   720p/index.m3u8      ← variant playlist (720p)
//   720p/seg000.ts …     ← MPEG-TS segments (720p)
//   enc.key              ← raw 16-byte AES-128 key (served by backend)

async function runHlsTranscode(
  inputPath: string,
  outputDir: string,
  keyHex: string,
  keyUri: string
): Promise<void> {
  // Write the raw AES-128 key file FFmpeg will reference
  const keyFilePath = path.join(outputDir, 'enc.key');
  await fs.promises.writeFile(keyFilePath, Buffer.from(keyHex, 'hex'));

  // Write the HLS key-info file: <key-uri>\n<key-file-path>\n[iv]
  const keyInfoPath = path.join(outputDir, 'enc.keyinfo');
  await fs.promises.writeFile(keyInfoPath, `${keyUri}\n${keyFilePath}\n`);

  // Create sub-directories for each variant
  await fs.promises.mkdir(path.join(outputDir, '480p'), { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, '720p'), { recursive: true });

  // Transcode 480p variant
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-c:v', 'libx264',
        '-profile:v', 'main',
        '-crf', '23',
        '-sc_threshold', '0',
        '-g', '48',            // keyframe every 2 s at 24fps
        '-keyint_min', '48',
        '-s', '854x480',
        '-b:v', '800k',
        '-maxrate', '800k',
        '-bufsize', '1600k',
        '-c:a', 'aac',
        '-ar', '48000',
        '-b:a', '128k',
        '-hls_time', '6',
        '-hls_playlist_type', 'vod',
        '-hls_segment_type', 'mpegts',
        '-hls_segment_filename', path.join(outputDir, '480p', 'seg%03d.ts'),
        '-hls_key_info_file', keyInfoPath,
        '-f', 'hls',
      ])
      .output(path.join(outputDir, '480p', 'index.m3u8'))
      .on('start', (cmd) => console.log(`[FFmpeg-HLS 480p] ${cmd}`))
      .on('progress', (p) => { if (p.percent) console.log(`[FFmpeg-HLS 480p] ${p.percent.toFixed(1)}%`); })
      .on('end', () => { console.log('[FFmpeg-HLS 480p] Done'); resolve(); })
      .on('error', (err) => { console.error('[FFmpeg-HLS 480p] Error:', err); reject(err); })
      .run();
  });

  // Transcode 720p variant
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-c:v', 'libx264',
        '-profile:v', 'main',
        '-crf', '23',
        '-sc_threshold', '0',
        '-g', '48',
        '-keyint_min', '48',
        '-s', '1280x720',
        '-b:v', '2500k',
        '-maxrate', '2500k',
        '-bufsize', '5000k',
        '-c:a', 'aac',
        '-ar', '48000',
        '-b:a', '128k',
        '-hls_time', '6',
        '-hls_playlist_type', 'vod',
        '-hls_segment_type', 'mpegts',
        '-hls_segment_filename', path.join(outputDir, '720p', 'seg%03d.ts'),
        '-hls_key_info_file', keyInfoPath,
        '-f', 'hls',
      ])
      .output(path.join(outputDir, '720p', 'index.m3u8'))
      .on('start', (cmd) => console.log(`[FFmpeg-HLS 720p] ${cmd}`))
      .on('progress', (p) => { if (p.percent) console.log(`[FFmpeg-HLS 720p] ${p.percent.toFixed(1)}%`); })
      .on('end', () => { console.log('[FFmpeg-HLS 720p] Done'); resolve(); })
      .on('error', (err) => { console.error('[FFmpeg-HLS 720p] Error:', err); reject(err); })
      .run();
  });

  // Write master playlist manually
  const masterPlaylist = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '',
    '#EXT-X-STREAM-INF:BANDWIDTH=928000,RESOLUTION=854x480,CODECS="avc1.4d401f,mp4a.40.2"',
    '480p/index.m3u8',
    '',
    '#EXT-X-STREAM-INF:BANDWIDTH=2628000,RESOLUTION=1280x720,CODECS="avc1.4d401f,mp4a.40.2"',
    '720p/index.m3u8',
  ].join('\n');

  await fs.promises.writeFile(path.join(outputDir, 'master.m3u8'), masterPlaylist);
}

// ─── Stream-to-file helper ─────────────────────────────────────────────────────
function pipeStreamToFile(stream: Readable, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(filePath);
    stream.pipe(writeStream);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}

// ─── Upload all HLS files recursively ─────────────────────────────────────────
async function uploadDir(baseDir: string, lessonId: string): Promise<void> {
  const entries = await fs.promises.readdir(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(baseDir, entry.name);
    if (entry.isDirectory()) {
      await uploadDir(fullPath, lessonId);
    } else {
      if (entry.name === 'input.mp4' || entry.name === 'enc.keyinfo') continue;

      // Build relative key: e.g. "480p/seg001.ts"
      const relative = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      const minioKey = `processed/${lessonId}/${relative}`;

      const fileContent = await fs.promises.readFile(fullPath);
      let contentType = 'application/octet-stream';
      if (entry.name.endsWith('.m3u8')) contentType = 'application/x-mpegURL';
      else if (entry.name.endsWith('.ts'))   contentType = 'video/MP2T';
      else if (entry.name === 'enc.key')     contentType = 'application/octet-stream';

      await uploadProcessedFile(minioKey, fileContent, contentType);
      console.log(`[Worker] Uploaded ${minioKey}`);
    }
  }
}

// ─── BullMQ Worker ────────────────────────────────────────────────────────────
const worker = new Worker(
  TRANSCODE_QUEUE_NAME,
  async (job: Job) => {
    const { lessonId, rawKey } = job.data;
    console.log(`[Worker] Started HLS transcoding job ${job.id} for Lesson ${lessonId}`);

    const tempDir = path.join(os.tmpdir(), `transcode-${lessonId}-${Date.now()}`);
    const inputPath = path.join(tempDir, 'input.mp4');

    try {
      // 1. Create temp directory
      await fs.promises.mkdir(tempDir, { recursive: true });

      // 2. Generate AES-128 encryption key and store in DB
      const cipherKey = crypto.randomBytes(16);
      const cipherKeyHex = cipherKey.toString('hex');
      // KID not needed for HLS AES-128, but keep field for schema compat
      const cipherKidHex = crypto.randomBytes(16).toString('hex');

      await prisma.lesson.update({
        where: { id: lessonId },
        data: {
          videoStatus: 'PROCESSING',
          videoCipherKey: cipherKeyHex,
          videoCipherKid: cipherKidHex,
        },
      });

      // 3. Download raw video (from MinIO or import URL)
      if (job.data.importUrl) {
        console.log(`[Worker] Downloading from import URL: ${job.data.importUrl}`);
        const response = await fetch(job.data.importUrl);
        if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        await fs.promises.writeFile(inputPath, Buffer.from(arrayBuffer));
      } else {
        console.log(`[Worker] Downloading from MinIO key: ${rawKey}`);
        const rawStream = await getRawVideoObject(rawKey);
        if (!rawStream) throw new Error(`Raw video stream empty for key: ${rawKey}`);
        await pipeStreamToFile(rawStream as Readable, inputPath);
      }
      console.log(`[Worker] Input ready at: ${inputPath}`);

      // 4. Build the key URI (backend endpoint that serves the raw AES key)
      const apiUrl = process.env.API_URL || 'http://localhost:5000';
      const keyUri = `${apiUrl}/api/videos/lessons/${lessonId}/stream/enc.key`;

      // 5. Run HLS transcode (outputs master.m3u8, 480p/*, 720p/*, enc.key)
      console.log(`[Worker] Starting HLS AES-128 transcode...`);
      await runHlsTranscode(inputPath, tempDir, cipherKeyHex, keyUri);

      // 6. Upload all HLS files to MinIO
      console.log(`[Worker] Uploading HLS files to MinIO...`);
      await uploadDir(tempDir, lessonId);

      // 7. Mark lesson READY
      await prisma.lesson.update({
        where: { id: lessonId },
        data: { videoStatus: 'READY' },
      });
      console.log(`[Worker] Job ${job.id} completed successfully for Lesson ${lessonId}`);

    } catch (error) {
      console.error(`[Worker] Job failed for Lesson ${lessonId}:`, error);
      try {
        await prisma.lesson.update({
          where: { id: lessonId },
          data: { videoStatus: 'FAILED' },
        });
      } catch (dbErr) {
        console.error(`[Worker] Could not update lesson to FAILED:`, dbErr);
      }
      throw error;

    } finally {
      try {
        if (fs.existsSync(tempDir)) {
          await fs.promises.rm(tempDir, { recursive: true, force: true });
          console.log(`[Worker] Cleaned up temp dir: ${tempDir}`);
        }
      } catch (cleanUpError) {
        console.error(`[Worker] Cleanup error:`, cleanUpError);
      }
    }
  },
  {
    connection: queueConnection,
    concurrency: 1,
    lockDuration: 10 * 60 * 1000,  // 10 minutes — long enough for dual-pass HLS transcode
    lockRenewTime: 2 * 60 * 1000,  // Renew lock every 2 minutes (well before expiry)
    stalledInterval: 60 * 1000,    // Check for stalled jobs every 60s (not every 30s default)
    maxStalledCount: 3,             // Allow 3 stall checks before marking job as failed
  }
);

console.log('[Worker] HLS Video Transcoding worker initialized.');
export default worker;
