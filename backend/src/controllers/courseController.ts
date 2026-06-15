import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/types';
import { deleteLessonVideoFiles } from '../services/storage';

export async function createCourse(req: AuthRequest, res: Response) {
  const { title, description, imageUrl } = req.body;
  const instructorId = req.user?.id;

  if (!instructorId) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  if (!title || !description) {
    return res.status(400).json({ message: 'Title and description are required.' });
  }

  try {
    const course = await prisma.course.create({
      data: {
        title,
        description,
        imageUrl,
        instructorId,
      },
    });
    return res.status(201).json(course);
  } catch (error) {
    console.error('Create course error:', error);
    return res.status(500).json({ message: 'Error creating course.' });
  }
}

export async function getCourses(_req: AuthRequest, res: Response) {
  try {
    const courses = await prisma.course.findMany({
      include: {
        instructor: {
          select: {
            name: true,
          },
        },
      },
    });
    return res.json(courses);
  } catch (error) {
    console.error('Get courses error:', error);
    return res.status(500).json({ message: 'Error fetching courses.' });
  }
}

export async function getInstructorCourses(req: AuthRequest, res: Response) {
  const instructorId = req.user?.id;
  if (!instructorId) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  try {
    const courses = await prisma.course.findMany({
      where: { instructorId },
      include: {
        _count: {
          select: { enrollments: true },
        },
      },
    });
    return res.json(courses);
  } catch (error) {
    console.error('Get instructor courses error:', error);
    return res.status(500).json({ message: 'Error fetching courses.' });
  }
}

export async function getCourseDetails(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const userId = req.user?.id;

  try {
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        instructor: {
          select: {
            name: true,
          },
        },
        lessons: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!course) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    // Check if current user is enrolled (or if they are the instructor)
    let isEnrolled = false;
    if (userId) {
      if (course.instructorId === userId) {
        isEnrolled = true;
      } else {
        const enrollment = await prisma.enrollment.findUnique({
          where: {
            userId_courseId: {
              userId,
              courseId: id,
            },
          },
        });
        isEnrolled = !!enrollment;
      }
    }

    return res.json({
      ...course,
      isEnrolled,
    });
  } catch (error) {
    console.error('Get course details error:', error);
    return res.status(500).json({ message: 'Error fetching course details.' });
  }
}

export async function enrollInCourse(req: AuthRequest, res: Response) {
  const { id: courseId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  try {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    // Don't enroll if they are the instructor
    if (course.instructorId === userId) {
      return res.status(400).json({ message: 'Instructors are automatically enrolled in their own courses.' });
    }

    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (existingEnrollment) {
      return res.status(400).json({ message: 'You are already enrolled in this course.' });
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        userId,
        courseId,
      },
    });

    return res.status(201).json(enrollment);
  } catch (error) {
    console.error('Enroll course error:', error);
    return res.status(500).json({ message: 'Error enrolling in course.' });
  }
}

export async function createLesson(req: AuthRequest, res: Response) {
  const { id: courseId } = req.params;
  const { title, description, order } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  try {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    if (course.instructorId !== userId) {
      return res.status(403).json({ message: 'Only the course instructor can add lessons.' });
    }

    if (!title || !description || order === undefined) {
      return res.status(400).json({ message: 'Title, description, and order are required.' });
    }

    const lesson = await prisma.lesson.create({
      data: {
        title,
        description,
        order: Number(order),
        courseId,
        videoStatus: 'PENDING',
      },
    });

    return res.status(201).json(lesson);
  } catch (error) {
    console.error('Create lesson error:', error);
    return res.status(500).json({ message: 'Error creating lesson.' });
  }
}

export async function updateLesson(req: AuthRequest, res: Response) {
  const { lessonId } = req.params;
  const { title, description, order } = req.body;
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
      return res.status(403).json({ message: 'Only the course instructor can update lessons.' });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (order !== undefined) updateData.order = Number(order);

    const updated = await prisma.lesson.update({
      where: { id: lessonId },
      data: updateData,
    });

    return res.json(updated);
  } catch (error) {
    console.error('Update lesson error:', error);
    return res.status(500).json({ message: 'Error updating lesson.' });
  }
}

export async function deleteLesson(req: AuthRequest, res: Response) {
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
      return res.status(403).json({ message: 'Only the course instructor can delete lessons.' });
    }

    // Clean up S3/MinIO video files for this lesson
    await deleteLessonVideoFiles(lessonId);

    // Delete from database
    await prisma.lesson.delete({
      where: { id: lessonId },
    });

    return res.json({ message: 'Lesson deleted successfully.' });
  } catch (error) {
    console.error('Delete lesson error:', error);
    return res.status(500).json({ message: 'Error deleting lesson.' });
  }
}
