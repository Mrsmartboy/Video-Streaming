import fs from 'fs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Queue } from 'bullmq';
import prisma from './config/prisma';
import { queueConnection, TRANSCODE_QUEUE_NAME, TRANSCODE_JOB_NAME } from './config/queue';

const s3Client = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT || 'http://minio:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadminpassword',
  },
  forcePathStyle: true,
});

const transcodeQueue = new Queue(TRANSCODE_QUEUE_NAME, {
  connection: queueConnection,
});

async function main() {
  console.log('--- Verification Pipeline Script ---');
  
  // Find first lesson dynamically
  const firstLesson = await prisma.lesson.findFirst();
  if (!firstLesson) {
    console.error('No lessons found in the database. Please run the seed script first.');
    process.exit(1);
  }
  const lessonId = firstLesson.id;
  const dummyFilePath = '/app/dummy.mp4';
  const rawKey = `raw/${lessonId}/test-dummy.mp4`;
  
  if (!fs.existsSync(dummyFilePath)) {
    console.error(`Dummy file not found at ${dummyFilePath}. Run dummy generation first.`);
    process.exit(1);
  }

  // 1. Upload dummy file to raw bucket in MinIO
  console.log(`Uploading ${dummyFilePath} to MinIO raw bucket at key: ${rawKey}...`);
  const fileBuffer = fs.readFileSync(dummyFilePath);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.MINIO_RAW_BUCKET || 'lms-raw-videos',
      Key: rawKey,
      Body: fileBuffer,
      ContentType: 'video/mp4',
    })
  );
  console.log('Upload to MinIO completed.');

  // 2. Update lesson's video status in DB to PENDING
  console.log('Updating lesson database status to PENDING...');
  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      videoKey: rawKey,
      videoStatus: 'PENDING',
    },
  });

  // 3. Push transcode job to BullMQ
  console.log('Enqueuing transcode job into BullMQ...');
  await transcodeQueue.add(TRANSCODE_JOB_NAME, {
    lessonId,
    rawKey,
  });

  console.log('Job successfully enqueued. Monitor backend-worker logs to watch transcoding.');
  console.log('Verification script completed.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error running verification script:', err);
  process.exit(1);
});
