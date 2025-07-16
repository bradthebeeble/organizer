/**
 * Utility functions for tRPC procedures
 */

/**
 * Filters out undefined values from an object for Prisma updates
 * Also converts undefined to null for nullable fields
 */
export function createOptionalUpdate<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value !== undefined)
  );
}

/**
 * Filters out undefined values from an object for Prisma creates
 * Converts undefined to null for nullable fields
 */
export function createOptionalCreate<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, value === undefined ? null : value])
  );
}

/**
 * Creates a user filter for Prisma queries
 */
export function createUserFilter(userId: string) {
  return { userId };
}

/**
 * Creates an OR filter for project access (owner or member)
 */
export function createProjectAccessFilter(userId: string) {
  return {
    OR: [
      { ownerId: userId },
      { members: { some: { userId } } },
    ],
  };
}