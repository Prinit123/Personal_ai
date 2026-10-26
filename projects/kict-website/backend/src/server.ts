import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Parsing Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Route
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'GTU Smart College Portal API is running operational.',
    timestamp: new Date().toISOString(),
  });
});

// Global Error Handler
app.use(errorHandler);

// Database Connection and Server Boot
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Smart College Portal Server running on http://localhost:${PORT}`);
  });
});
