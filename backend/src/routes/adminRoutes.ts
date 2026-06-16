import { Router } from 'express';
import { getAllUsers, deleteUser } from '../controllers/adminController';
import { authenticateJWT, requireRole } from '../middleware/auth';

const router = Router();

// Secure all admin routes with authentication and require ADMIN role
router.get('/users', authenticateJWT, requireRole('ADMIN'), getAllUsers);
router.delete('/users/:id', authenticateJWT, requireRole('ADMIN'), deleteUser);

export default router;
