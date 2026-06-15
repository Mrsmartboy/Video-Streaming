import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

declare const process: any;

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing tables (in order of dependencies)
  await prisma.enrollment.deleteMany({});
  await prisma.lesson.deleteMany({});
  await prisma.course.deleteMany({});
  await prisma.user.deleteMany({});

  // 1. Create Users
  const hashedPassword = await bcrypt.hash('password123', 10);

  const instructor = await prisma.user.create({
    data: {
      email: 'instructor@lms.com',
      password: hashedPassword,
      name: 'Dr. Jane Video',
      role: 'INSTRUCTOR',
    },
  });

  const student = await prisma.user.create({
    data: {
      email: 'student@lms.com',
      password: hashedPassword,
      name: 'John Learner',
      role: 'STUDENT',
    },
  });

  console.log('Users created:');
  console.log(`- Instructor: ${instructor.email} (password: password123)`);
  console.log(`- Student: ${student.email} (password: password123)`);

  // 2. Create Course
  const course = await prisma.course.create({
    data: {
      title: 'Full-Stack HLS Adaptive Video Streaming',
      description: 'Learn how to build, transcode, and stream secure, high-performance HLS videos using React, Express, BullMQ, FFmpeg, and MinIO S3.',
      imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop',
      instructorId: instructor.id,
    },
  });

  console.log(`Course created: "${course.title}"`);

  // 3. Create Lessons
  const lesson1 = await prisma.lesson.create({
    data: {
      title: 'Introduction to HLS Adaptive Streaming',
      description: 'In this lesson, we cover what HTTP Live Streaming (HLS) is, how adaptive bitrate streaming works, and why it is superior to playing static MP4 files over HTTP.',
      order: 1,
      courseId: course.id,
    },
  });

  console.log(`Lessons created:`);
  console.log(`- Lesson 1: ${lesson1.title}`);

  // 4. Enroll Student in Course
  await prisma.enrollment.create({
    data: {
      userId: student.id,
      courseId: course.id,
    },
  });

  console.log(`Student enrolled in course.`);
  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
