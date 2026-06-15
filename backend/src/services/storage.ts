import { S3Client, CreateBucketCommand, HeadBucketCommand, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT || 'http://minio:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadminpassword',
  },
  forcePathStyle: true, // Required for MinIO
});

const clientPresignerClient = new S3Client({
  endpoint: process.env.MINIO_EXTERNAL_ENDPOINT || 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadminpassword',
  },
  forcePathStyle: true,
});

const RAW_BUCKET = process.env.MINIO_RAW_BUCKET || 'lms-raw-videos';
const PROCESSED_BUCKET = process.env.MINIO_PROCESSED_BUCKET || 'lms-processed-videos';

/**
 * Ensures a bucket exists, creating it if it doesn't.
 */
async function ensureBucket(bucketName: string) {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log(`Bucket '${bucketName}' already exists.`);
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      console.log(`Bucket '${bucketName}' not found. Creating it...`);
      await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
      console.log(`Bucket '${bucketName}' created successfully.`);
    } else {
      console.error(`Error checking/creating bucket '${bucketName}':`, error);
      throw error;
    }
  }
}

export async function initStorage() {
  await ensureBucket(RAW_BUCKET);
  await ensureBucket(PROCESSED_BUCKET);
}

/**
 * Generates a pre-signed URL for uploading a file directly to the raw bucket.
 */
export async function getPresignedUploadUrl(key: string, contentType: string = 'video/mp4'): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: RAW_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  // URL valid for 1 hour
  return getSignedUrl(clientPresignerClient, command, { expiresIn: 3600 });
}

/**
 * Uploads a file (Buffer or string content) to the processed bucket.
 */
export async function uploadProcessedFile(key: string, body: Buffer | string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: PROCESSED_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  await s3Client.send(command);
}

/**
 * Downloads a file from the raw bucket (e.g. for worker processing)
 */
export async function getRawVideoObject(key: string) {
  const command = new GetObjectCommand({
    Bucket: RAW_BUCKET,
    Key: key,
  });
  const response = await s3Client.send(command);
  return response.Body; // Node stream
}

/**
 * Downloads/streams a file from the processed bucket (e.g. for user playback)
 */
export async function getProcessedVideoObject(key: string) {
  const command = new GetObjectCommand({
    Bucket: PROCESSED_BUCKET,
    Key: key,
  });
  const response = await s3Client.send(command);
  return response.Body; // Node stream
}

/**
 * Deletes all objects inside a folder/prefix in a given bucket.
 */
export async function deleteFolder(bucket: string, prefix: string) {
  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    });
    const listResponse = await s3Client.send(listCommand);

    if (listResponse.Contents && listResponse.Contents.length > 0) {
      const deleteObjects = listResponse.Contents.map((obj) => ({ Key: obj.Key }));
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: deleteObjects },
      });
      await s3Client.send(deleteCommand);
      console.log(`Successfully deleted ${deleteObjects.length} objects from bucket ${bucket} with prefix ${prefix}`);
    }
  } catch (error) {
    console.error(`Error deleting folder ${prefix} from bucket ${bucket}:`, error);
  }
}

/**
 * Clean up all S3 raw and processed video files for a given lesson.
 */
export async function deleteLessonVideoFiles(lessonId: string) {
  await deleteFolder(RAW_BUCKET, `raw/${lessonId}/`);
  await deleteFolder(RAW_BUCKET, `imported/${lessonId}/`);
  await deleteFolder(PROCESSED_BUCKET, `processed/${lessonId}/`);
}

export { s3Client, RAW_BUCKET, PROCESSED_BUCKET };
