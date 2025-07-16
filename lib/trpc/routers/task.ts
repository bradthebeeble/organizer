import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { createOptionalUpdate, createOptionalCreate, createProjectAccessFilter } from '../utils';

export const taskRouter = router({
  // Get tasks for a project
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED', 'BLOCKED']).optional(),
        assigneeId: z.string().optional(),
        parentId: z.string().optional().nullable(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      // Check if user has access to the project
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          ...createProjectAccessFilter(ctx.session.user.id!),
          deletedAt: null,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found or you do not have access to it',
        });
      }

      const whereClause = {
        projectId: input.projectId,
        deletedAt: null,
        ...(input.status && { status: input.status }),
        ...(input.assigneeId && { assigneeId: input.assigneeId }),
        ...(input.parentId !== undefined && { parentId: input.parentId }),
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
          startDate: true,
          estimatedHours: true,
          actualHours: true,
          createdAt: true,
          updatedAt: true,
          completedAt: true,
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
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
              children: { where: { deletedAt: null } },
              notes: { where: { deletedAt: null } },
              reminders: { where: { deletedAt: null } },
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

  // Get task by ID
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const task = await ctx.prisma.task.findFirst({
        where: {
          id: input.id,
          deletedAt: null,
          project: {
            OR: [
              { ownerId: ctx.session.user.id! },
              { members: { some: { userId: ctx.session.user.id! } } },
            ],
            deletedAt: null,
          },
        },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueDate: true,
          startDate: true,
          estimatedHours: true,
          actualHours: true,
          createdAt: true,
          updatedAt: true,
          completedAt: true,
          project: {
            select: {
              id: true,
              name: true,
            },
          },
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
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
          children: {
            where: { deletedAt: null },
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              dueDate: true,
              assignee: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          notes: {
            where: { deletedAt: null },
            select: {
              id: true,
              title: true,
              content: true,
              createdAt: true,
              author: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          reminders: {
            where: { deletedAt: null },
            select: {
              id: true,
              title: true,
              reminderDate: true,
              isCompleted: true,
            },
            orderBy: {
              reminderDate: 'asc',
            },
          },
        },
      });

      if (!task) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Task not found or you do not have access to it',
        });
      }

      return task;
    }),

  // Create a new task
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().optional(),
        projectId: z.string(),
        assigneeId: z.string().optional(),
        parentId: z.string().optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
        dueDate: z.date().optional(),
        startDate: z.date().optional(),
        estimatedHours: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user has access to the project
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          ...createProjectAccessFilter(ctx.session.user.id!),
          deletedAt: null,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found or you do not have access to it',
        });
      }

      // If parent task specified, validate it exists and is in the same project
      if (input.parentId) {
        const parentTask = await ctx.prisma.task.findFirst({
          where: {
            id: input.parentId,
            projectId: input.projectId,
            deletedAt: null,
          },
        });

        if (!parentTask) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Parent task not found in this project',
          });
        }
      }

      // If assignee specified, validate they have access to the project
      if (input.assigneeId) {
        const assigneeAccess = await ctx.prisma.project.findFirst({
          where: {
            id: input.projectId,
            OR: [
              { ownerId: input.assigneeId },
              { members: { some: { userId: input.assigneeId } } },
            ],
            deletedAt: null,
          },
        });

        if (!assigneeAccess) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Assignee does not have access to this project',
          });
        }
      }

      const task = await ctx.prisma.task.create({
        data: createOptionalCreate({
          title: input.title,
          description: input.description,
          projectId: input.projectId,
          assigneeId: input.assigneeId,
          parentId: input.parentId,
          priority: input.priority,
          dueDate: input.dueDate,
          startDate: input.startDate,
          estimatedHours: input.estimatedHours,
          creatorId: ctx.session.user.id!,
        }),
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueDate: true,
          startDate: true,
          estimatedHours: true,
          createdAt: true,
          project: {
            select: {
              id: true,
              name: true,
            },
          },
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Log activity
      await ctx.prisma.activity.create({
        data: {
          type: 'TASK_CREATED',
          description: `Created task "${task.title}"`,
          userId: ctx.session.user.id!,
          projectId: input.projectId,
        },
      });

      // Create notification if task is assigned to someone other than creator
      if (input.assigneeId && input.assigneeId !== ctx.session.user.id!) {
        await ctx.prisma.notification.create({
          data: {
            type: 'TASK_ASSIGNED',
            title: 'New task assigned',
            message: `You have been assigned to task "${task.title}"`,
            userId: input.assigneeId,
            data: {
              taskId: task.id,
              projectId: input.projectId,
            },
          },
        });
      }

      return task;
    }),

  // Update task
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().optional(),
        status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED', 'BLOCKED']).optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        assigneeId: z.string().optional().nullable(),
        dueDate: z.date().optional().nullable(),
        startDate: z.date().optional().nullable(),
        estimatedHours: z.number().int().min(0).optional().nullable(),
        actualHours: z.number().int().min(0).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user has access to the task
      const existingTask = await ctx.prisma.task.findFirst({
        where: {
          id: input.id,
          deletedAt: null,
          project: {
            OR: [
              { ownerId: ctx.session.user.id! },
              { members: { some: { userId: ctx.session.user.id! } } },
            ],
            deletedAt: null,
          },
        },
        select: {
          id: true,
          title: true,
          status: true,
          assigneeId: true,
          projectId: true,
        },
      });

      if (!existingTask) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Task not found or you do not have access to it',
        });
      }

      // If assignee is being changed, validate they have access to the project
      if (input.assigneeId && input.assigneeId !== existingTask.assigneeId) {
        const assigneeAccess = await ctx.prisma.project.findFirst({
          where: {
            id: existingTask.projectId,
            OR: [
              { ownerId: input.assigneeId },
              { members: { some: { userId: input.assigneeId } } },
            ],
            deletedAt: null,
          },
        });

        if (!assigneeAccess) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Assignee does not have access to this project',
          });
        }
      }

      const { id, ...updateInput } = input;

      // Handle task completion
      const completedAt = input.status === 'COMPLETED' && existingTask.status !== 'COMPLETED' 
        ? new Date() 
        : input.status !== 'COMPLETED' 
          ? null 
          : undefined;

      const updateData = createOptionalUpdate({
        ...updateInput,
        completedAt,
        updatedAt: new Date(),
      });

      const updatedTask = await ctx.prisma.task.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueDate: true,
          startDate: true,
          estimatedHours: true,
          actualHours: true,
          updatedAt: true,
          completedAt: true,
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Log activity
      await ctx.prisma.activity.create({
        data: {
          type: 'TASK_UPDATED',
          description: `Updated task "${updatedTask.title}"`,
          userId: ctx.session.user.id!,
          projectId: existingTask.projectId,
        },
      });

      // Create notifications
      if (input.assigneeId && input.assigneeId !== existingTask.assigneeId && input.assigneeId !== ctx.session.user.id!) {
        await ctx.prisma.notification.create({
          data: {
            type: 'TASK_ASSIGNED',
            title: 'Task assigned to you',
            message: `You have been assigned to task "${updatedTask.title}"`,
            userId: input.assigneeId,
            data: {
              taskId: updatedTask.id,
              projectId: existingTask.projectId,
            },
          },
        });
      }

      if (input.status === 'COMPLETED' && existingTask.status !== 'COMPLETED') {
        await ctx.prisma.notification.create({
          data: {
            type: 'TASK_COMPLETED',
            title: 'Task completed',
            message: `Task "${updatedTask.title}" has been completed`,
            userId: existingTask.assigneeId || ctx.session.user.id!,
            data: {
              taskId: updatedTask.id,
              projectId: existingTask.projectId,
            },
          },
        });
      }

      return updatedTask;
    }),

  // Delete task (soft delete)
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if user has access to the task
      const task = await ctx.prisma.task.findFirst({
        where: {
          id: input.id,
          deletedAt: null,
          project: {
            OR: [
              { ownerId: ctx.session.user.id! },
              { members: { some: { userId: ctx.session.user.id! } } },
            ],
            deletedAt: null,
          },
        },
        select: {
          id: true,
          title: true,
          projectId: true,
        },
      });

      if (!task) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Task not found or you do not have access to it',
        });
      }

      // Soft delete the task
      await ctx.prisma.task.update({
        where: { id: input.id },
        data: {
          deletedAt: new Date(),
        },
      });

      // Log activity
      await ctx.prisma.activity.create({
        data: {
          type: 'TASK_DELETED',
          description: `Deleted task "${task.title}"`,
          userId: ctx.session.user.id!,
          projectId: task.projectId,
        },
      });

      return { success: true };
    }),
});