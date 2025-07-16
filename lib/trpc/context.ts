import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { NextRequest } from 'next/server';

/**
 * Context for tRPC procedures
 * Includes the user session and database client
 */
export const createContext = async (req: NextRequest) => {
  const session = await auth();
  
  return {
    session,
    prisma,
    req,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;