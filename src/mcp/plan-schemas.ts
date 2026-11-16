/**
 * plan-schemas.ts — MCP input schema for `plan_create` phases/sub-tasks.
 * Split from server.ts to keep the server factory under the code-file guideline.
 */
import * as z from 'zod/v4';

export const planPhasesSchema = z.array(
  z.object({
    title: z.string(),
    parallelizable: z.boolean().describe('Phase may run alongside other ready phases').optional(),
    dependsOn: z.array(z.string()).describe('Phase numbers this phase depends on').optional(),
    subTasks: z.array(
      z.object({
        title: z.string(),
        delegatedTo: z
          .string()
          .min(1)
          .describe('Agent ID responsible for executing this sub-task (must exist in ## Agent Selection)'),
        parallelizable: z.boolean().describe('Task may run concurrently with other ready tasks').optional(),
        dependsOn: z.array(z.string()).describe('Sub-task refs (N.M) this task depends on').optional(),
        filesScope: z.array(z.string()).describe('Declared file paths/globs for conflict detection').optional(),
        isolation: z.enum(['shared', 'worktree']).describe('Worktree isolation mode').optional(),
      })
    ),
  })
);
