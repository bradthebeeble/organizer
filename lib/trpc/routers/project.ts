import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { createOptionalUpdate, createOptionalCreate, createProjectAccessFilter } from '../utils';

export const projectRouter = router({
  // Get all projects for current user
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(['ACTIVE', 'ARCHIVED', 'COMPLETED', 'ON_HOLD']).optional(),
        visibility: z.enum(['PUBLIC', 'PRIVATE', 'TEAM']).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!!;
      const whereClause = {
        ...createProjectAccessFilter(userId),
        deletedAt: null,
        ...(input.status && { status: input.status }),
        ...(input.visibility && { visibility: input.visibility }),
      };

      const projects = await ctx.prisma.project.findMany({
        where: whereClause,
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
              tasks: { where: { deletedAt: null } },
              notes: { where: { deletedAt: null } },
              milestones: { where: { deletedAt: null } },
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      return projects;
    }),

  // Get project by ID
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.id,
          ...createProjectAccessFilter(ctx.session.user.id!!),
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
          tasks: {
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
          milestones: {
            where: { deletedAt: null },
            select: {
              id: true,
              title: true,
              status: true,
              dueDate: true,
              progress: true,
            },
            orderBy: {
              dueDate: 'asc',
            },
          },
        },
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found or you do not have access to it',
        });
      }

      return project;
    }),

  // Create a new project
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        visibility: z.enum(['PUBLIC', 'PRIVATE', 'TEAM']).default('PRIVATE'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.create({
        data: createOptionalCreate({
          name: input.name,
          description: input.description,
          visibility: input.visibility,
          ownerId: ctx.session.user.id!,
        }),
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          visibility: true,
          createdAt: true,
          owner: {
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
          type: 'PROJECT_CREATED',
          description: `Created project "${project.name}"`,
          userId: ctx.session.user.id!,
          projectId: project.id,
        },
      });

      return project;
    }),

  // Update project
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        status: z.enum(['ACTIVE', 'ARCHIVED', 'COMPLETED', 'ON_HOLD']).optional(),
        visibility: z.enum(['PUBLIC', 'PRIVATE', 'TEAM']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user has permission to update
      const existingProject = await ctx.prisma.project.findFirst({
        where: {
          id: input.id,
          OR: [
            { ownerId: ctx.session.user.id! },
            { members: { some: { userId: ctx.session.user.id!, role: { in: ['ADMIN', 'OWNER'] } } } },
          ],
          deletedAt: null,
        },
      });

      if (!existingProject) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found or you do not have permission to update it',
        });
      }

      const { id, ...updateInput } = input;
      const updateData = createOptionalUpdate({
        ...updateInput,
        updatedAt: new Date(),
      });
      
      const updatedProject = await ctx.prisma.project.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          visibility: true,
          updatedAt: true,
          owner: {
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
          type: 'PROJECT_UPDATED',
          description: `Updated project "${updatedProject.name}"`,
          userId: ctx.session.user.id!,
          projectId: updatedProject.id,
        },
      });

      return updatedProject;
    }),

  // Delete project (soft delete)
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if user is owner
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.id,
          ownerId: ctx.session.user.id!,
          deletedAt: null,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found or you do not have permission to delete it',
        });
      }

      // Soft delete the project
      await ctx.prisma.project.update({
        where: { id: input.id },
        data: {
          deletedAt: new Date(),
        },
      });

      // Log activity
      await ctx.prisma.activity.create({
        data: {
          type: 'PROJECT_DELETED',
          description: `Deleted project "${project.name}"`,
          userId: ctx.session.user.id!,
          projectId: project.id,
        },
      });

      return { success: true };
    }),

  // Add member to project
  addMember: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        userId: z.string(),
        role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user has permission to add members
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          OR: [
            { ownerId: ctx.session.user.id! },
            { members: { some: { userId: ctx.session.user.id!, role: { in: ['ADMIN', 'OWNER'] } } } },
          ],
          deletedAt: null,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found or you do not have permission to add members',
        });
      }

      // Check if user exists
      const user = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Add member (upsert to handle existing memberships)
      const member = await ctx.prisma.projectMember.upsert({
        where: {
          userId_projectId: {
            userId: input.userId,
            projectId: input.projectId,
          },
        },
        update: {
          role: input.role,
        },
        create: {
          userId: input.userId,
          projectId: input.projectId,
          role: input.role,
        },
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
      });

      return member;
    }),

  // Remove member from project
  removeMember: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user has permission to remove members
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          OR: [
            { ownerId: ctx.session.user.id! },
            { members: { some: { userId: ctx.session.user.id!, role: { in: ['ADMIN', 'OWNER'] } } } },
          ],
          deletedAt: null,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found or you do not have permission to remove members',
        });
      }

      // Cannot remove the owner
      if (project.ownerId === input.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot remove the project owner',
        });
      }

      // Remove member
      await ctx.prisma.projectMember.delete({
        where: {
          userId_projectId: {
            userId: input.userId,
            projectId: input.projectId,
          },
        },
      });

      return { success: true };
    }),
});