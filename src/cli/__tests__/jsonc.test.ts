/**
 * jsonc.test.ts — comment- and format-preserving JSONC helpers (sub-task 3.1).
 *
 * Golden fixtures cover line/block comments, trailing commas, CRLF, tabs and
 * 2/4-space indentation, UTF-8 BOM, empty/comment-only files, duplicate keys,
 * invalid syntax with offset/line/column, byte-identical no-ops, nested
 * insertion, removal with pruning, and key-order-insensitive deep equality.
 */
import { describe, expect, it } from 'vitest';
import { OperationalError } from '../errors.js';
import {
  deepEqualJson,
  getAtPath,
  type JsoncEditResult,
  type JsoncParseResult,
  MCP_ENTRY_PATH,
  parseJsonc,
  pruneEmptyObjects,
  removeAtPath,
  setAtPath,
} from '../jsonc.js';
import { MCP_CONFIG_KEY } from '../scope.js';

const CONFIG = [
  '{',
  '  // registry',
  '  "mcp": {',
  '    "servers": {',
  '      "dh": { "type": "local", "command": ["old"] }, // owned',
  '      "other": { "type": "remote" },',
  '    },',
  '  },',
  '  "theme": "dark",',
  '}',
  '',
].join('\n');

const UPDATED_CONFIG = [
  '{',
  '  // registry',
  '  "mcp": {',
  '    "servers": {',
  '      "dh": {',
  '        "type": "local",',
  '        "command": [',
  '          "new"',
  '        ]',
  '      }, // owned',
  '      "other": { "type": "remote" },',
  '    },',
  '  },',
  '  "theme": "dark",',
  '}',
  '',
].join('\n');

function edited(result: JsoncEditResult): { text: string; changed: boolean } {
  if (!result.ok) throw new Error(`unexpected parse failure: ${result.error.message}`);
  return { text: result.text, changed: result.changed };
}

function parsed(result: JsoncParseResult): unknown {
  if (!result.ok) throw new Error(`unexpected parse failure: ${result.error.message}`);
  return result.value;
}

function failure(result: JsoncParseResult | JsoncEditResult) {
  if (result.ok) throw new Error('expected a parse failure');
  return result.error;
}

describe('parseJsonc', () => {
  it('parses comments, trailing commas, duplicate keys, and a BOM', () => {
    const value = parsed(parseJsonc('\uFEFF{\n  // line\n  "a": 1, /* block */\n  "a": 2,\n}\n'));
    expect(value).toStrictEqual({ a: 2 });
  });

  it('treats empty, whitespace-only, and comment-only text as an empty document', () => {
    for (const empty of ['', '  \n\t', '\uFEFF', '// only\n', '/* only */']) {
      expect(parseJsonc(empty)).toStrictEqual({ ok: true, value: undefined });
    }
  });

  it('keeps primitive documents intact', () => {
    expect(parsed(parseJsonc('null'))).toBeNull();
    expect(parsed(parseJsonc('"x"'))).toBe('x');
  });

  it('reports syntax errors with offset, line, and column', () => {
    expect(failure(parseJsonc('{\n  "a": ,\n}'))).toStrictEqual({
      message: 'ValueExpected',
      offset: 9,
      line: 2,
      column: 8,
    });
    expect(failure(parseJsonc('{\n  "a": 1\n  "b": 2\n}'))).toStrictEqual({
      message: 'CommaExpected',
      offset: 13,
      line: 3,
      column: 3,
    });
  });
});

describe('getAtPath', () => {
  const doc = '{"a":{"b":[1,{"c":2}]}}';

  it('reads nested object and array paths', () => {
    expect(parsed(getAtPath(doc, ['a', 'b', 1, 'c']))).toBe(2);
    expect(parsed(getAtPath(doc, 'a.b.0'))).toBe(1);
    expect(parsed(getAtPath(doc, []))).toStrictEqual({ a: { b: [1, { c: 2 }] } });
  });

  it('returns undefined for absent paths and scalar traversal', () => {
    expect(parsed(getAtPath(doc, 'a.missing'))).toBeUndefined();
    expect(parsed(getAtPath(doc, 'a.b.9'))).toBeUndefined();
    expect(parsed(getAtPath(doc, 'a.b.0.deep'))).toBeUndefined();
  });

  it('propagates parse failures', () => {
    expect(failure(getAtPath('{', 'a')).message).toBe('CloseBraceExpected');
  });
});

describe('setAtPath', () => {
  it('creates a document from empty text with 2-space indentation and LF', () => {
    expect(edited(setAtPath('', ['a'], 1))).toStrictEqual({ text: '{\n  "a": 1\n}', changed: true });
  });

  it('inserts missing intermediate objects without deleting comments', () => {
    const result = edited(setAtPath('{\n  // top\n}\n', ['a', 'b'], 1));
    expect(result.text).toBe('{\n  "a": {\n    "b": 1\n  }\n  // top\n}\n');
  });

  it('updates an existing value and keeps comments, trailing commas, and unrelated keys', () => {
    const result = edited(setAtPath(CONFIG, ['mcp', 'servers', 'dh'], { type: 'local', command: ['new'] }));
    expect(result.text).toBe(UPDATED_CONFIG);
    expect(result.changed).toBe(true);
  });

  it('is a byte-identical no-op when the value is deeply equal regardless of key order', () => {
    const result = edited(setAtPath(CONFIG, ['mcp', 'servers', 'dh'], { command: ['old'], type: 'local' }));
    expect(result).toStrictEqual({ text: CONFIG, changed: false });
    const blockComment = '{\n  /* keep */\n  "a": 1,\n}\n';
    expect(edited(setAtPath(blockComment, ['a'], 1))).toStrictEqual({ text: blockComment, changed: false });
  });

  it('detects tabs, 4-space indentation, and CRLF', () => {
    expect(edited(setAtPath('{\n\t// tabs\n\t"a": 1\n}\n', ['b', 'c'], 2)).text).toBe(
      '{\n\t// tabs\n\t"a": 1,\n\t"b": {\n\t\t"c": 2\n\t}\n}\n'
    );
    expect(edited(setAtPath('{\n    // four\n    "a": 1\n}\n', ['b', 'c'], 2)).text).toBe(
      '{\n    // four\n    "a": 1,\n    "b": {\n        "c": 2\n    }\n}\n'
    );
    expect(edited(setAtPath('{\r\n  "a": 1\r\n}\r\n', ['b', 'c'], 2)).text).toBe(
      '{\r\n  "a": 1,\r\n  "b": {\r\n    "c": 2\r\n  }\r\n}\r\n'
    );
  });

  it('preserves a UTF-8 BOM', () => {
    expect(edited(setAtPath('\uFEFF{\n  "a": 1\n}\n', ['b'], 2)).text).toBe('\uFEFF{\n  "a": 1,\n  "b": 2\n}\n');
  });

  it('updates array elements and keeps trailing commas', () => {
    expect(edited(setAtPath('{\n  "a": [1, 2,],\n}\n', ['a', 1], 9)).text).toBe('{\n  "a": [1, 9,],\n}\n');
  });

  it('creates nested objects under an existing parent', () => {
    expect(edited(setAtPath('{\n  "a": {"x": 1}\n}\n', ['a', 'b', 'c'], 2)).text).toBe(
      '{\n  "a": {\n    "x": 1,\n    "b": {\n      "c": 2\n    }\n  }\n}\n'
    );
  });

  it('rejects unsafe path segments', () => {
    for (const path of [['__proto__'], ['constructor', 'prototype'], 'a.prototype.b']) {
      expect(() => setAtPath(CONFIG, path, 1)).toThrow(OperationalError);
    }
    expect(() => getAtPath(CONFIG, ['__proto__'])).toThrow(OperationalError);
    expect(() => removeAtPath(CONFIG, ['constructor'])).toThrow(OperationalError);
    expect(() => pruneEmptyObjects(CONFIG, [['prototype']])).toThrow(OperationalError);
  });

  it('rejects writes through a non-container parent', () => {
    expect(() => setAtPath('{"a": 1}', ['a', 'b'], 2)).toThrow(OperationalError);
  });

  it('refuses edits that would be ambiguous with duplicate keys', () => {
    expect(() => setAtPath('{"a": 1, "a": 2}', ['a'], 3)).toThrow(OperationalError);
    expect(() => removeAtPath('{"a": 1, "a": 2}', ['a'])).toThrow(OperationalError);
  });
});

describe('removeAtPath', () => {
  it('removes a key, keeping sibling formatting and comments', () => {
    const result = edited(removeAtPath(CONFIG, ['mcp', 'servers', 'dh']));
    expect(result.changed).toBe(true);
    expect(result.text).toBe(
      [
        '{',
        '  // registry',
        '  "mcp": {',
        '    "servers": {',
        '      // owned',
        '      "other": { "type": "remote" },',
        '    },',
        '  },',
        '  "theme": "dark",',
        '}',
        '',
      ].join('\n')
    );
  });

  it('is a no-op when the path is absent', () => {
    expect(edited(removeAtPath(CONFIG, ['mcp', 'servers', 'missing']))).toStrictEqual({
      text: CONFIG,
      changed: false,
    });
  });

  it('handles the only property with a trailing comma and keeps leading comments', () => {
    expect(edited(removeAtPath('{\n  // only\n  "a": 1,\n}\n', ['a'])).text).toBe('{\n  // only\n}\n');
  });

  it('preserves CRLF line endings', () => {
    expect(edited(removeAtPath('{\r\n  "a": 1,\r\n  "b": 2\r\n}\r\n', ['b'])).text).toBe('{\r\n  "a": 1\r\n}\r\n');
  });

  it('removes array elements', () => {
    const result = edited(removeAtPath('{"a": [1, 2]}', ['a', 0]));
    expect(parsed(getAtPath(result.text, 'a'))).toStrictEqual([2]);
  });

  it('reports parse failures without editing', () => {
    expect(failure(removeAtPath('{\n  "a": ,\n}', ['a'])).message).toBe('ValueExpected');
  });
});

describe('pruneEmptyObjects', () => {
  it('prunes empty parents deepest-first', () => {
    const input =
      '{\n  "mcp": {\n    "servers": {\n      "dh": { "type": "local" },\n    },\n  },\n  "theme": "dark",\n}\n';
    const removed = edited(removeAtPath(input, ['mcp', 'servers', 'dh']));
    expect(edited(pruneEmptyObjects(removed.text, [['mcp', 'servers'], ['mcp']]))).toStrictEqual({
      text: '{\n  "theme": "dark",\n}\n',
      changed: true,
    });
  });

  it('never prunes a non-empty container', () => {
    const input = '{\n  "mcp": {\n    "servers": {\n      "other": { "type": "remote" },\n    },\n  },\n}\n';
    expect(edited(pruneEmptyObjects(input, [['mcp', 'servers'], ['mcp']]))).toStrictEqual({
      text: input,
      changed: false,
    });
  });

  it('prunes only the listed containers', () => {
    const input = '{\n  "a": {\n    "b": {},\n  },\n  "c": {},\n}\n';
    expect(edited(pruneEmptyObjects(input, [['a', 'b']])).text).toBe('{\n  "a": {\n  },\n  "c": {},\n}\n');
  });

  it('is order independent', () => {
    const input = '{\n  "mcp": {\n    "servers": {},\n  },\n}\n';
    expect(edited(pruneEmptyObjects(input, [['mcp'], ['mcp', 'servers']])).text).toBe('{\n}\n');
  });
});

describe('deepEqualJson', () => {
  it('ignores object key order recursively', () => {
    expect(deepEqualJson({ a: 1, b: { c: [1, 2], d: null } }, { b: { d: null, c: [1, 2] }, a: 1 })).toBe(true);
  });

  it('distinguishes arrays, types, and values', () => {
    expect(deepEqualJson([1, 2], [2, 1])).toBe(false);
    expect(deepEqualJson({ a: 1 }, { a: '1' })).toBe(false);
    expect(deepEqualJson({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqualJson(null, {})).toBe(false);
    expect(deepEqualJson(undefined, undefined)).toBe(true);
  });
});

describe('MCP_ENTRY_PATH', () => {
  it('derives the managed entry path from the shared config key', () => {
    expect(MCP_ENTRY_PATH).toStrictEqual(['mcp', 'servers', 'dh']);
    expect(MCP_ENTRY_PATH.join('.')).toBe(MCP_CONFIG_KEY);
  });
});
