import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from './types';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-token-key-change-in-prod';

export function authenticateJWT(req: AuthRequest, res: Response, next: NextFunction) {
  let token: string | undefined;

  // 1. Try reading from Authorization Header (Bearer Token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // 2. Try reading from cookies if cookie parser is used (optional, fallback)
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // 3. Fallback: Check if there's a token query param (useful for video stream requests if headers cannot be set easily)
  if (!token && req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    res.status(401).json({ message: 'Authentication required. Token is missing.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      role: 'STUDENT' | 'INSTRUCTOR';
      name: string;
    };
    req.user = decoded;
    next();
    return;
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired authentication token.' });
    return;
  }
}

export function requireRole(role: 'STUDENT' | 'INSTRUCTOR') {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }
    if (req.user.role !== role) {
      res.status(403).json({ message: `Access denied. Requires '${role}' role.` });
      return;
    }
    next();
    return;
  };
}
