import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import courseRoutes from './routes/courseRoutes';
import videoRoutes from './routes/videoRoutes';
import adminRoutes from './routes/adminRoutes';
import prisma from './config/prisma';
import { initStorage } from './services/storage';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Generic error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled Application Error:', err);
  res.status(500).json({ message: 'An unexpected error occurred on the server.' });
});

async function main() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('Database connected successfully.');

    // Initialize MinIO storage buckets
    await initStorage();
    console.log('MinIO Storage Buckets verified/created.');

    app.listen(PORT, () => {
      console.log(`API Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Fatal server startup error:', error);
    process.exit(1);
  }
}

main();
