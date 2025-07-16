import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';

/**
 * Maps Prisma errors to tRPC errors with appropriate error codes and messages
 */
export function mapPrismaError(error: unknown): TRPCError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        return new TRPCError({
          code: 'CONFLICT',
          message: 'A record with this data already exists',
          cause: error,
        });
      case 'P2025':
        // Record not found
        return new TRPCError({
          code: 'NOT_FOUND',
          message: 'Record not found',
          cause: error,
        });
      case 'P2003':
        // Foreign key constraint violation
        return new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Referenced record does not exist',
          cause: error,
        });
      case 'P2004':
        // Constraint violation
        return new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Data violates database constraints',
          cause: error,
        });
      default:
        return new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database error occurred',
          cause: error,
        });
    }
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unknown database error occurred',
      cause: error,
    });
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Database connection error',
      cause: error,
    });
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Database initialization error',
      cause: error,
    });
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invalid data provided',
      cause: error,
    });
  }

  // If it's already a TRPCError, return it as-is
  if (error instanceof TRPCError) {
    return error;
  }

  // For any other error, return a generic internal server error
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    cause: error,
  });
}

/**
 * Custom error class for business logic errors
 */
export class BusinessLogicError extends Error {
  constructor(message: string, public code = 'BUSINESS_ERROR') {
    super(message);
    this.name = 'BusinessLogicError';
  }
}

/**
 * Maps business logic errors to tRPC errors
 */
export function mapBusinessLogicError(error: BusinessLogicError): TRPCError {
  return new TRPCError({
    code: 'BAD_REQUEST',
    message: error.message,
    cause: error,
  });
}