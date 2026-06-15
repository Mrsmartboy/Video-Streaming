import { ConnectionOptions } from 'bullmq';

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';

export const queueConnection: ConnectionOptions = {
  // Parsing redis://redis:6379
  host: redisUrl.split('//')[1]?.split(':')[0] || 'redis',
  port: parseInt(redisUrl.split('//')[1]?.split(':')[1] || '6379', 10),
};

export const TRANSCODE_QUEUE_NAME = 'video-transcoding';
export const TRANSCODE_JOB_NAME = 'transcode-job';
