import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * Context for tRPC procedures
 * Includes the user session and database client
 */
export const createContext = async () => {
  const session = await auth();
  
  return {
    session,
    prisma,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;