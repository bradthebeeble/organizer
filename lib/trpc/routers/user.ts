import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { createOptionalUpdate, createProjectAccessFilter } from '../utils';

export const userRouter = router({
  // Get current user profile
  profile: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id! },
      select: {
        id: true,
        name: true,
        email: true,
        displayName: true,
        bio: true,
        image: true,
        timezone: true,
        language: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    return user;
  }),

  // Update user profile
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().optional(),
        displayName: z.string().optional(),
        bio: z.string().optional(),
        timezone: z.string().optional(),
        language: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updateData = createOptionalUpdate({
        ...input,
        updatedAt: new Date(),
      });

      const updatedUser = await ctx.prisma.user.update({
        where: { id: ctx.session.user.id! },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          displayName: true,
          bio: true,
          image: true,
          timezone: true,
          language: true,
          updatedAt: true,
        },
      });

      return updatedUser;
    }),

  // Get user's projects
  projects: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id!;
    const projects = await ctx.prisma.project.findMany({
      where: {
        ...createProjectAccessFilter(userId),
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        members: {
          select: {
            role: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return projects;
  }),

  // Get user's tasks
  tasks: protectedProcedure
    .input(
      z.object({
        status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED', 'BLOCKED']).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const whereClause = {
        assigneeId: userId,
        deletedAt: null,
        ...(input.status && { status: input.status }),
      };

      const tasks = await ctx.prisma.task.findMany({
        where: whereClause,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueDate: true,
          createdAt: true,
          updatedAt: true,
          project: {
            select: {
              id: true,
              name: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          parent: {
            select: {
              id: true,
              title: true,
            },
          },
          _count: {
            select: {
              children: true,
            },
          },
        },
        orderBy: [
          { priority: 'desc' },
          { dueDate: 'asc' },
          { createdAt: 'desc' },
        ],
        take: input.limit,
        skip: input.offset,
      });

      return tasks;
    }),

  // Get user's notifications
  notifications: protectedProcedure
    .input(
      z.object({
        isRead: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const whereClause = {
        userId: userId,
        deletedAt: null,
        ...(input.isRead !== undefined && { isRead: input.isRead }),
      };

      const notifications = await ctx.prisma.notification.findMany({
        where: whereClause,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          data: true,
          isRead: true,
          readAt: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: input.limit,
        skip: input.offset,
      });

      return notifications;
    }),

  // Mark notification as read
  markNotificationRead: protectedProcedure
    .input(
      z.object({
        notificationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const notification = await ctx.prisma.notification.update({
        where: {
          id: input.notificationId,
          userId: userId,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return notification;
    }),

  // Mark all notifications as read
  markAllNotificationsRead: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id!;
    const result = await ctx.prisma.notification.updateMany({
      where: {
        userId: userId,
        isRead: false,
        deletedAt: null,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { count: result.count };
  }),
});