import { Router } from 'express';
import {
  createCourse,
  getCourses,
  getCourseDetails,
  enrollInCourse,
  createLesson,
  getInstructorCourses,
  updateLesson,
  deleteLesson
} from '../controllers/courseController';
import { authenticateJWT, requireRole } from '../middleware/auth';

const router = Router();

// Apply JWT authentication to all course endpoints
router.use(authenticateJWT);

router.get('/', getCourses);
router.get('/instructor-only', requireRole('INSTRUCTOR'), getInstructorCourses);
router.post('/', requireRole('INSTRUCTOR'), createCourse);
router.get('/:id', getCourseDetails);
router.post('/:id/enroll', requireRole('STUDENT'), enrollInCourse);
router.post('/:id/lessons', requireRole('INSTRUCTOR'), createLesson);
router.put('/lessons/:lessonId', requireRole('INSTRUCTOR'), updateLesson);
router.delete('/lessons/:lessonId', requireRole('INSTRUCTOR'), deleteLesson);

export default router;
