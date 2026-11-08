/**
 * bundle-scan.ts — conservative self-containment scan for the plugin bundle.
 *
 * OpenCode loads the managed `dist/plugin.js` from a directory without a
 * node_modules tree, so the bundle may only import Node builtins, relative
 * files, or absolute paths. A minimal lexer drops comments and quoted text so
 * the check never matches text that merely looks like an import.
 */
import { builtinModules } from 'node:module';

// tsup emits bare builtin specifiers (`import fs from "fs"`), which Node always
// resolves as builtins and never from a package; accept those alongside node:.
const NODE_BUILTINS = new Set(builtinModules);

interface ScanToken {
  readonly kind: 'word' | 'string' | 'punct';
  readonly value: string;
}

function isWordStart(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95 || code === 36;
}

function isWordPart(code: number): boolean {
  return isWordStart(code) || (code >= 48 && code <= 57);
}

/** Skip a `${...}` body inside a template literal; nested code is not scanned. */
function skipInterpolation(source: string, start: number): number {
  let depth = 1;
  let index = start;
  while (index < source.length && depth > 0) {
    const char = source[index] as string;
    if (char === '{') depth += 1;
    else if (char === '}') depth -= 1;
    index += 1;
  }
  return index;
}

function readString(source: string, start: number): { value: string; next: number } {
  const quote = source[start] as string;
  let index = start + 1;
  let value = '';
  while (index < source.length) {
    const char = source[index] as string;
    if (char === '\\') {
      index += 2;
      continue;
    }
    if (char === quote) return { value, next: index + 1 };
    if (quote === '`' && char === '$' && source[index + 1] === '{') {
      index = skipInterpolation(source, index + 2);
      continue;
    }
    value += char;
    index += 1;
  }
  return { value, next: source.length };
}

/** Minimal lexer: drops comments, keeps string values, tags words/punctuation. */
function tokenize(source: string): ScanToken[] {
  const tokens: ScanToken[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index] as string;
    if (char === '/' && source[index + 1] === '/') {
      const end = source.indexOf('\n', index + 2);
      index = end === -1 ? source.length : end + 1;
      continue;
    }
    if (char === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }
    if (isWordStart(source.charCodeAt(index))) {
      let end = index + 1;
      while (end < source.length && isWordPart(source.charCodeAt(end))) end += 1;
      tokens.push({ kind: 'word', value: source.slice(index, end) });
      index = end;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      const result = readString(source, index);
      tokens.push({ kind: 'string', value: result.value });
      index = result.next;
      continue;
    }
    if (char !== ' ' && char !== '\t' && char !== '\r' && char !== '\n') tokens.push({ kind: 'punct', value: char });
    index += 1;
  }
  return tokens;
}

function isAllowedSpecifier(specifier: string): boolean {
  if (specifier.startsWith('node:')) return true;
  if (NODE_BUILTINS.has(specifier)) return true;
  if (specifier === '.' || specifier === '..') return true;
  if (specifier.startsWith('./') || specifier.startsWith('../')) return true;
  if (specifier.startsWith('/')) return true;
  return /^[A-Za-z]:[\\/]/.test(specifier);
}

/** Find the specifier after `from` in an import/export statement. */
function fromSpecifier(tokens: readonly ScanToken[], start: number): string | undefined {
  for (let index = start + 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) return undefined;
    if (token.kind === 'punct' && token.value === ';') return undefined;
    if (token.kind === 'word' && (token.value === 'import' || token.value === 'export')) return undefined;
    if (token.kind === 'word' && token.value === 'from') {
      const specifier = tokens[index + 1];
      if (specifier?.kind === 'string') return specifier.value;
    }
  }
  return undefined;
}

/**
 * Bare runtime specifiers in a bundled module: static `import ... from`,
 * `export ... from`, side-effect `import 'x'`, and dynamic `import('x')`.
 * Comments and quoted text are ignored; `node:` builtins, bare Node builtins,
 * relative paths, and absolute paths are allowed.
 */
export function scanBareSpecifiers(source: string): string[] {
  const tokens = tokenize(source);
  const bare = new Set<string>();
  const record = (specifier: string | undefined): void => {
    if (specifier !== undefined && !isAllowedSpecifier(specifier)) bare.add(specifier);
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token?.kind !== 'word') continue;

    if (token.value === 'import') {
      const next = tokens[index + 1];
      if (next?.kind === 'string') {
        record(next.value);
        continue;
      }
      if (next?.kind === 'punct' && next.value === '(') {
        const argument = tokens[index + 2];
        if (argument?.kind === 'string') record(argument.value);
        continue;
      }
      if (next?.kind === 'punct' && next.value === '.') continue; // import.meta
      record(fromSpecifier(tokens, index));
      continue;
    }

    if (token.value === 'export') {
      const next = tokens[index + 1];
      const reExport =
        (next?.kind === 'punct' && (next.value === '{' || next.value === '*')) ||
        (next?.kind === 'word' && next.value === 'type' && tokens[index + 2]?.value === '{');
      if (reExport) record(fromSpecifier(tokens, index));
    }
  }

  return [...bare];
}
