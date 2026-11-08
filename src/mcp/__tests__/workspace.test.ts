/**
 * workspace.test.ts — workspace-root resolution precedence + emptiness guard.
 *
 * Pure unit tests: explicit `env`/`cwd` arguments for the matrix, plus one
 * stub-based test proving the production defaults are read at CALL time
 * (never at module load).
 */
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveWorkspaceRoot } from '../workspace.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('resolveWorkspaceRoot', () => {
  it('uses an absolute DH_WORKSPACE_ROOT when set', () => {
    const root = resolveWorkspaceRoot({ env: { DH_WORKSPACE_ROOT: '/overrides/ws' }, cwd: '/base' });
    expect(root).toBe(path.resolve('/overrides/ws'));
  });

  it('trims a padded override before resolving (cwd taken verbatim)', () => {
    expect(resolveWorkspaceRoot({ env: { DH_WORKSPACE_ROOT: ' /overrides/ws ' }, cwd: '/base' })).toBe(
      path.resolve('/overrides/ws')
    );
  });

  it('resolves a relative DH_WORKSPACE_ROOT against the provided cwd', () => {
    const root = resolveWorkspaceRoot({ env: { DH_WORKSPACE_ROOT: 'workspaces/demo' }, cwd: '/base' });
    expect(root).toBe(path.resolve('/base', 'workspaces/demo'));
  });

  it('falls back to cwd when DH_WORKSPACE_ROOT is unset', () => {
    expect(resolveWorkspaceRoot({ env: {}, cwd: '/base' })).toBe(path.resolve('/base'));
  });

  it('treats an empty or whitespace-only override as unset', () => {
    expect(resolveWorkspaceRoot({ env: { DH_WORKSPACE_ROOT: '' }, cwd: '/base' })).toBe(path.resolve('/base'));
    expect(resolveWorkspaceRoot({ env: { DH_WORKSPACE_ROOT: '   ' }, cwd: '/base' })).toBe(path.resolve('/base'));
  });

  it('normalizes the resolved root (trailing separators, dot segments)', () => {
    expect(resolveWorkspaceRoot({ env: {}, cwd: '/base/../base/' })).toBe(path.resolve('/base'));
    expect(resolveWorkspaceRoot({ env: { DH_WORKSPACE_ROOT: './sub/../sub' }, cwd: '/base' })).toBe(
      path.resolve('/base/sub')
    );
  });

  it('throws a descriptive error when the effective cwd is empty', () => {
    expect(() => resolveWorkspaceRoot({ env: {}, cwd: '' })).toThrow(/cwd is empty/);
    expect(() => resolveWorkspaceRoot({ env: {}, cwd: '   ' })).toThrow(/cwd is empty/);
  });

  it('reads process.env / process.cwd at call time when no options are passed', () => {
    vi.spyOn(process, 'cwd').mockReturnValue('/mock-cwd');
    vi.stubEnv('DH_WORKSPACE_ROOT', '');
    expect(resolveWorkspaceRoot()).toBe(path.resolve('/mock-cwd'));
    vi.stubEnv('DH_WORKSPACE_ROOT', 'nested/ws');
    expect(resolveWorkspaceRoot()).toBe(path.resolve('/mock-cwd', 'nested/ws'));
  });

  it('resolves an override when only env is provided (cwd defaults)', () => {
    vi.spyOn(process, 'cwd').mockReturnValue('/mock-cwd');
    expect(resolveWorkspaceRoot({ env: { DH_WORKSPACE_ROOT: '/abs' } })).toBe('/abs');
  });
});
