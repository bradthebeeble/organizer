import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import type { Context } from './context';
import { mapPrismaError, BusinessLogicError, mapBusinessLogicError } from './errors';

/**
 * Initialize tRPC with context and transformer
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
      },
    };
  },
});

/**
 * Create a server-side caller factory
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * These are the pieces you use to build your tRPC API
 */
export const router = t.router;
export const middleware = t.middleware;

/**
 * Public (unauthenticated) procedure
 */
export const publicProcedure = t.procedure;

/**
 * Error handling middleware
 * Catches and maps common errors to appropriate tRPC errors
 */
const errorMiddleware = middleware(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    // Handle business logic errors
    if (error instanceof BusinessLogicError) {
      throw mapBusinessLogicError(error);
    }
    
    // Always attempt to map Prisma errors - the function handles non-Prisma errors gracefully
    throw mapPrismaError(error);
  }
});

/**
 * Protected (authenticated) procedure
 * Checks if user is authenticated before allowing access
 */
export const protectedProcedure = t.procedure
  .use(errorMiddleware)
  .use(
    middleware(async ({ ctx, next }) => {
      if (!ctx.session?.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to access this resource',
        });
      }
      return next({
        ctx: {
          ...ctx,
          session: { ...ctx.session, user: ctx.session.user },
        },
      });
    })
  );