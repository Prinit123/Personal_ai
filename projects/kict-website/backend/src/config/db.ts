import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export const connectDB = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log('PostgreSQL database connected successfully via Prisma.');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};
