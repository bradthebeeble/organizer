import { router } from './trpc';
import { userRouter } from './routers/user';
import { projectRouter } from './routers/project';
import { taskRouter } from './routers/task';

/**
 * This is the primary router for your server.
 * 
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = router({
  user: userRouter,
  project: projectRouter,
  task: taskRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;