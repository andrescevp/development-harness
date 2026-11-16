/**
 * plan-schemas.ts — MCP input schema for `plan_create` phases/sub-tasks.
 * Split from server.ts to keep the server factory under the code-file guideline.
 */
import * as z from 'zod/v4';

/** Single-line, non-blank text (headers and bullets are line-oriented). */
export const singleLine = (label: string) =>
  z
    .string()
    .min(1, `${label} must not be empty`)
    .regex(/^[^\r\n]+$/, `${label} must be a single line`)
    .refine((value) => value.trim().length > 0, `${label} must not be blank`);

const dependencyRef = singleLine('dependency').regex(/^[^\r\n,]+$/, 'dependency must not contain a comma');

export const planPhasesSchema = z.array(
  z.object({
    title: singleLine('phase title'),
    parallelizable: z.boolean().describe('Phase may run alongside other ready phases').optional(),
    dependsOn: z.array(dependencyRef).describe('Phase numbers this phase depends on').optional(),
    subTasks: z.array(
      z.object({
        title: singleLine('sub-task title'),
        delegatedTo: singleLine('delegatedTo').describe(
          'Agent ID responsible for executing this sub-task (must exist in ## Agent Selection)'
        ),
        parallelizable: z.boolean().describe('Task may run concurrently with other ready tasks').optional(),
        dependsOn: z.array(dependencyRef).describe('Sub-task refs (N.M) this task depends on').optional(),
        filesScope: z
          .array(singleLine('Files/Scope entry'))
          .describe('Declared file paths/globs for conflict detection')
          .optional(),
        isolation: z.enum(['shared', 'worktree']).describe('Worktree isolation mode').optional(),
      })
    ),
  })
);
