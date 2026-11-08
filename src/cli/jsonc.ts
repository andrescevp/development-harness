/**
 * jsonc.ts — comment- and format-preserving JSONC text helpers.
 *
 * Reads never throw for invalid syntax: they return a typed parse failure with
 * the first error's offset/line/column. `setAtPath` uses jsonc-parser's
 * `modify` + `applyEdits`; `removeAtPath` splices the AST node so sibling
 * comments/formatting survive (jsonc-parser re-serializes the parent object on
 * removal). Indentation, EOL, trailing commas, and a UTF-8 BOM are preserved.
 */
import {
  applyEdits,
  createScanner,
  type FormattingOptions,
  findNodeAtLocation,
  type Node as JsoncNode,
  modify,
  type ParseError,
  parse,
  parseTree,
  printParseErrorCode,
} from 'jsonc-parser';
import { OperationalError } from './errors.js';
import { MCP_CONFIG_KEY } from './scope.js';

export const MCP_ENTRY_PATH: readonly string[] = MCP_CONFIG_KEY.split('.');
const UNSAFE_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);
const BOM = '\uFEFF';
const DEFAULT_FORMATTING: FormattingOptions = { insertSpaces: true, tabSize: 2, eol: '\n' };
// jsonc-parser exports SyntaxKind as an ambient const enum (unusable under
// verbatimModuleSyntax); these are its stable token codes.
const TOKEN_COMMA = 5;
const TOKEN_EOF = 17;
const TRIVIA_TOKENS: ReadonlySet<number> = new Set([12, 13, 14, 15]);
/** A path segment; numbers (and numeric dotted segments) index arrays. */
type JsonPathSegment = string | number;
export type JsonPathInput = string | readonly JsonPathSegment[];
interface JsoncParseError {
  /** `printParseErrorCode` value, e.g. `ValueExpected`. */
  readonly message: string;
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}
type JsoncParseFailure = { readonly ok: false; readonly error: JsoncParseError };
export type JsoncParseResult = { readonly ok: true; readonly value: unknown } | JsoncParseFailure;
export type JsoncEditResult =
  | { readonly ok: true; readonly text: string; readonly changed: boolean }
  | JsoncParseFailure;
function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isTrivia(token: number): boolean {
  return TRIVIA_TOKENS.has(token);
}
// The scanner (not a regex) keeps empty/comment-only documents from being
// reported as syntax errors without misreading comment markers in strings.
function isTriviaOnly(text: string): boolean {
  const scanner = createScanner(text, false);
  for (let token = scanner.scan(); token !== TOKEN_EOF; token = scanner.scan()) {
    if (!isTrivia(token)) return false;
  }
  return true;
}
function splitBom(text: string): { bom: string; body: string } {
  return text.startsWith(BOM) ? { bom: BOM, body: text.slice(1) } : { bom: '', body: text };
}
function positionAt(text: string, offset: number): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(offset, text.length));
  const before = text.slice(0, clamped);
  return { line: before.split('\n').length, column: clamped - before.lastIndexOf('\n') };
}
/** Parse JSONC text; syntax errors become a typed failure instead of a throw. */
export function parseJsonc(text: string): JsoncParseResult {
  const { bom, body } = splitBom(text);
  if (isTriviaOnly(body)) return { ok: true, value: undefined };

  const errors: ParseError[] = [];
  const value = parse(body, errors, { allowTrailingComma: true, disallowComments: false });
  const first = errors[0];
  if (first === undefined) return { ok: true, value };

  const offset = first.offset + bom.length;
  const { line, column } = positionAt(text, offset);
  return { ok: false, error: { message: printParseErrorCode(first.error), offset, line, column } };
}
function normalizePath(path: JsonPathInput, allowEmpty: boolean): JsonPathSegment[] {
  const raw = typeof path === 'string' ? path.split('.') : [...path];
  if (raw.length === 0 && !allowEmpty) throw new OperationalError('JSONC path must not be empty');
  return raw.map((segment) => {
    if (typeof segment === 'number') {
      if (!Number.isInteger(segment) || segment < 0) throw new OperationalError(`invalid JSONC path index: ${segment}`);
      return segment;
    }
    if (segment === '') throw new OperationalError('JSONC path must not contain empty segments');
    if (UNSAFE_SEGMENTS.has(segment)) throw new OperationalError(`refusing unsafe JSONC path segment: ${segment}`);
    return /^(0|[1-9]\d*)$/.test(segment) ? Number(segment) : segment;
  });
}

const pathLabel = (segments: readonly JsonPathSegment[]): string => segments.map(String).join('.');

function valueAtPath(root: unknown, segments: readonly JsonPathSegment[]): unknown {
  let current = root;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = typeof segment === 'number' ? segment : Number(segment);
      if (!Number.isInteger(index) || index < 0) return undefined;
      current = current[index];
      continue;
    }
    if (!isJsonObject(current) || typeof segment !== 'string' || !Object.hasOwn(current, segment)) return undefined;
    current = current[segment];
  }
  return current;
}
export function getAtPath(text: string, path: JsonPathInput): JsoncParseResult {
  const segments = normalizePath(path, true);
  const result = parseJsonc(text);
  return result.ok ? { ok: true, value: valueAtPath(result.value, segments) } : result;
}
export function deepEqualJson(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((item, index) => deepEqualJson(item, right[index]));
  }
  if (!isJsonObject(left) || !isJsonObject(right)) return false;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => Object.hasOwn(right, key) && deepEqualJson(left[key], right[key]));
}
function assertWritableParents(value: unknown, segments: readonly JsonPathSegment[]): void {
  let current = value;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (current === undefined) return;
    if (Array.isArray(current)) {
      if (typeof segment !== 'number') {
        throw new OperationalError(`cannot write JSONC path ${pathLabel(segments)}: array index expected`);
      }
      current = current[segment];
      continue;
    }
    if (!isJsonObject(current) || typeof segment !== 'string') {
      throw new OperationalError(`cannot write JSONC path ${pathLabel(segments)}: intermediate value is not an object`);
    }
    current = Object.hasOwn(current, segment) ? current[segment] : undefined;
  }
}
function detectFormatting(text: string): FormattingOptions {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const first = parseTree(text)?.children?.[0];
  if (first !== undefined) {
    const lineStart = text.lastIndexOf('\n', first.offset - 1) + 1;
    const prefix = text.slice(lineStart, first.offset);
    if (prefix !== '' && /^[ \t]+$/.test(prefix)) {
      if (prefix.includes('\t')) return { insertSpaces: false, tabSize: 2, eol };
      return { insertSpaces: true, tabSize: prefix.length, eol };
    }
  }
  return { ...DEFAULT_FORMATTING, eol };
}
function assertValidEdit(text: string, action: string): void {
  const errors: ParseError[] = [];
  parse(text, errors, { allowTrailingComma: true, disallowComments: false });
  const first = errors[0];
  if (first !== undefined) {
    throw new OperationalError(
      `internal error: ${action} produced invalid JSONC (${printParseErrorCode(first.error)})`
    );
  }
}
function assertUniquePathKeys(text: string, segments: readonly JsonPathSegment[], action: string): void {
  const root = parseTree(text);
  for (let depth = 1; root !== undefined && depth <= segments.length; depth += 1) {
    const key = segments[depth - 1];
    const parent = depth === 1 ? root : findNodeAtLocation(root, segments.slice(0, depth - 1));
    if (typeof key !== 'string' || parent?.type !== 'object' || parent.children === undefined) continue;
    if (parent.children.filter((property) => property.children?.[0]?.value === key).length > 1) {
      throw new OperationalError(`cannot ${action}: JSONC path ${pathLabel(segments)} has duplicate keys`);
    }
  }
}
// A deeply equal existing value is a byte-identical no-op.
export function setAtPath(text: string, path: JsonPathInput, value: unknown): JsoncEditResult {
  const segments = normalizePath(path, false);
  if (value === undefined) throw new OperationalError('cannot set a JSONC value to undefined; use removeAtPath');

  const parsed = parseJsonc(text);
  if (!parsed.ok) return parsed;
  assertWritableParents(parsed.value, segments);
  if (deepEqualJson(valueAtPath(parsed.value, segments), value)) return { ok: true, text, changed: false };

  const { bom, body } = splitBom(text);
  assertUniquePathKeys(body, segments, 'update');
  let updated: string;
  try {
    const edits = modify(body, segments, value, { formattingOptions: detectFormatting(body) });
    updated = applyEdits(body, edits);
  } catch (err) {
    throw new OperationalError(`cannot update JSONC path ${pathLabel(segments)}`, { cause: err });
  }
  if (updated === body) return { ok: true, text, changed: false };
  assertValidEdit(updated, `setting ${pathLabel(segments)}`);
  return { ok: true, text: bom + updated, changed: true };
}
function findNextComma(text: string, from: number): number | undefined {
  const scanner = createScanner(text, false);
  scanner.setPosition(from);
  for (let token = scanner.scan(); token !== TOKEN_EOF; token = scanner.scan()) {
    if (token === TOKEN_COMMA) return scanner.getTokenOffset();
    if (!isTrivia(token)) return undefined;
  }
  return undefined;
}
// jsonc-parser removal re-serializes the parent object (dropping sibling
// comments/formatting), so splice the key node range instead.
function removeObjectProperty(text: string, segments: readonly JsonPathSegment[]): string | undefined {
  const key = segments[segments.length - 1];
  if (typeof key !== 'string') return undefined;
  const root = parseTree(text);
  if (root === undefined) return undefined;

  const parentPath = segments.slice(0, -1);
  const parent: JsoncNode | undefined = parentPath.length === 0 ? root : findNodeAtLocation(root, parentPath);
  if (parent?.type !== 'object' || parent.children === undefined) return undefined;

  const index = parent.children.findIndex((property) => property.children?.[0]?.value === key);
  const property = index === -1 ? undefined : parent.children[index];
  if (property === undefined) return undefined;

  let start = property.offset;
  let end = property.offset + property.length;
  const previous = index > 0 ? parent.children[index - 1] : undefined;
  if (previous !== undefined) {
    const comma = findNextComma(text, previous.offset + previous.length);
    if (comma === undefined) return undefined;
    start = comma;
  } else {
    const comma = findNextComma(text, end);
    if (comma !== undefined) end = comma + 1;
  }

  if (previous === undefined) {
    const lineStart = text.lastIndexOf('\n', property.offset - 1) + 1;
    const prefix = text.slice(lineStart, property.offset);
    let cursor = end;
    while (text[cursor] === ' ' || text[cursor] === '\t') cursor += 1;
    const lineBreak = text.startsWith('\r\n', cursor) ? 2 : text[cursor] === '\n' ? 1 : 0;
    if (lineBreak > 0) {
      end = cursor + lineBreak;
      if (/^[ \t]*$/.test(prefix)) start = lineStart;
    } else if (/^[ \t]*$/.test(prefix)) {
      end = cursor;
    }
  }
  return text.slice(0, start) + text.slice(end);
}
function removeArrayElement(text: string, segments: readonly JsonPathSegment[]): string {
  try {
    return applyEdits(text, modify(text, [...segments], undefined, { formattingOptions: detectFormatting(text) }));
  } catch (err) {
    throw new OperationalError(`cannot remove JSONC path ${pathLabel(segments)}`, { cause: err });
  }
}
export function removeAtPath(text: string, path: JsonPathInput): JsoncEditResult {
  const segments = normalizePath(path, false);
  const parsed = parseJsonc(text);
  if (!parsed.ok) return parsed;
  if (valueAtPath(parsed.value, segments) === undefined) return { ok: true, text, changed: false };

  const { bom, body } = splitBom(text);
  assertUniquePathKeys(body, segments, 'remove');
  const parent = valueAtPath(parsed.value, segments.slice(0, -1));
  const updated = Array.isArray(parent)
    ? removeArrayElement(body, segments)
    : (removeObjectProperty(body, segments) ?? removeArrayElement(body, segments));
  assertValidEdit(updated, `removing ${pathLabel(segments)}`);
  return { ok: true, text: bom + updated, changed: updated !== body };
}
// Remove listed parents when empty; paths are processed deepest-first.
export function pruneEmptyObjects(text: string, paths: readonly JsonPathInput[]): JsoncEditResult {
  const ordered = paths.map((path) => normalizePath(path, false)).sort((left, right) => right.length - left.length);
  let current = text;
  for (const path of ordered) {
    const parsed = parseJsonc(current);
    if (!parsed.ok) return parsed;
    const value = valueAtPath(parsed.value, path);
    if (!isJsonObject(value) || Object.keys(value).length > 0) continue;

    const removed = removeAtPath(current, path);
    if (!removed.ok) return removed;
    if (removed.changed) current = removed.text;
  }
  return { ok: true, text: current, changed: current !== text };
}
