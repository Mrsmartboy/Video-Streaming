import { Response } from 'express';
import { Queue } from 'bullmq';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/types';
import { deleteLessonVideoFiles } from '../services/storage';
import { queueConnection, TRANSCODE_QUEUE_NAME } from '../config/queue';

/**
 * Get all registered users (excluding password hashes)
 */
export async function getAllUsers(_req: AuthRequest, res: Response) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json(users);
  } catch (error) {
    console.error('Get all users error:', error);
    return res.status(500).json({ message: 'Error fetching users.' });
  }
}

/**
 * Safely deletes a user (STUDENT or INSTRUCTOR) with proper cascade cleanup
 */
export async function deleteUser(req: AuthRequest, res: Response) {
  const { id } = req.params;

  if (req.user?.id === id) {
    return res.status(400).json({ message: 'You cannot delete your own admin account.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        coursesCreated: {
          include: {
            lessons: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // 1. If user is an INSTRUCTOR, clean up queue jobs and S3 files for all their courses/lessons first
    if (user.role === 'INSTRUCTOR') {
      const queue = new Queue(TRANSCODE_QUEUE_NAME, { connection: queueConnection });
      try {
        const jobs = await queue.getJobs(['waiting', 'delayed', 'paused', 'active']);
        
        for (const course of user.coursesCreated) {
          for (const lesson of course.lessons) {
            // Remove BullMQ transcoding jobs
            for (const job of jobs) {
              if (job.data && job.data.lessonId === lesson.id) {
                await job.remove();
                console.log(`[Admin Cleanup] Removed BullMQ job ${job.id} for Lesson ${lesson.id}`);
              }
            }
            // Delete raw and processed HLS videos from S3/MinIO
            await deleteLessonVideoFiles(lesson.id);
          }
        }
      } catch (err) {
        console.error('Error during instructor transcode queue / S3 clean up:', err);
      } finally {
        await queue.close();
      }
    }

    // 2. Perform database deletes in transaction
    await prisma.$transaction(async (tx) => {
      if (user.role === 'INSTRUCTOR') {
        const courseIds = user.coursesCreated.map((c) => c.id);

        if (courseIds.length > 0) {
          // Delete lessons
          await tx.lesson.deleteMany({
            where: { courseId: { in: courseIds } },
          });

          // Delete enrollments in the instructor's courses
          await tx.enrollment.deleteMany({
            where: { courseId: { in: courseIds } },
          });

          // Delete courses
          await tx.course.deleteMany({
            where: { id: { in: courseIds } },
          });
        }
      }

      // Delete student/instructor's own course enrollments
      await tx.enrollment.deleteMany({
        where: { userId: id },
      });

      // Finally delete the user
      await tx.user.delete({
        where: { id },
      });
    });

    return res.json({ message: `Successfully deleted user ${user.name} (${user.role}) and cleaned up all associated records.` });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ message: 'Error deleting user.' });
  }
}
