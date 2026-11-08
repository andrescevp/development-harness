/**
 * smoke-report.mjs — shared reporting and cleanup for the release-gate smokes.
 *
 * Keeps check output consistent across smoke scripts: one line per assertion,
 * a collected failure count, best-effort temp-root removal, and a final
 * summary that drives the process exit code.
 */
import fs from 'node:fs';

export function createChecker() {
  let failures = 0;
  return {
    check(label, ok, detail = '') {
      if (ok) console.log(`  ok — ${label}`);
      else {
        failures += 1;
        console.error(`  FAIL — ${label}${detail ? `: ${detail}` : ''}`);
      }
    },
    count: () => failures,
  };
}

export function cleanupRoot(rootDir) {
  if (rootDir === undefined) return;
  try {
    fs.rmSync(rootDir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup; never mask the check result
  }
}

export function reportResult(log, failures, successMessage) {
  if (failures > 0) {
    console.error(`${log} FAIL — ${failures} check(s) failed`);
    process.exitCode = 1;
  } else {
    console.log(`${log} OK — ${successMessage}`);
  }
}
