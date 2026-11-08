/**
 * temp-dir.ts — temp directory harness shared by unit tests.
 *
 * Creates a unique directory under the OS temp root, runs the body, and always
 * removes the tree. Keeps tests off the real home and repo state.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export async function withTempDir(run: (dir: string) => void | Promise<void>): Promise<void> {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'dh-test-'));
  try {
    await run(dir);
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}
