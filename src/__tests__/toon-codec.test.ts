/**
 * toon-codec.test.ts — shared safe TOON codec (Sub-Task 1.1).
 *
 * Covers the encoding contract: object/array payloads only, serialized JSON of
 * at least 256 characters, TOON strictly shorter, and a strict decode that
 * round-trips to the original payload. Also covers the cheap text sniffers the
 * MCP and plugin layers use to recognize JSON and tabular TOON.
 */
import { decode } from '@toon-format/toon';
import { describe, expect, it } from 'vitest';
import {
  decodeToon,
  looksLikeJson,
  looksLikeToon,
  TOON_MAX_CACHE,
  TOON_MAX_ENTRY_CHARS,
  TOON_MIN_CHARS,
  tryEncodeToon,
  tryEncodeToonText,
} from '../lib/toon.js';
import { loggedCommandPayload } from './helpers/toon-fixtures.js';

/** Uniform rows: the tabular shape TOON compresses best. */
const UNIFORM_USERS = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  name: `user${i + 1}`,
  role: 'developer',
  active: true,
}));

/** Payload whose `JSON.stringify` output is exactly `length` characters. */
function payloadWithJsonLength(length: number): { padding: string } {
  const empty = { padding: '' };
  return { padding: 'p'.repeat(length - JSON.stringify(empty).length) };
}

/** Deep, non-uniform nesting: JSON is shorter than the indented TOON form. */
function deeplyNestedPayload(padding: number): unknown {
  return { root: { one: { two: { three: { four: { five: { six: { seven: { eight: 'd'.repeat(padding) } } } } } } } } };
}

describe('codec constants', () => {
  it('exposes the contract thresholds', () => {
    expect(TOON_MIN_CHARS).toBe(256);
    expect(TOON_MAX_CACHE).toBe(100);
    expect(TOON_MAX_ENTRY_CHARS).toBe(262_144);
  });
});

describe('tryEncodeToon', () => {
  it('encodes a uniform array above the threshold so decode round-trips the payload', () => {
    const json = JSON.stringify(UNIFORM_USERS);
    expect(json.length).toBeGreaterThanOrEqual(TOON_MIN_CHARS);

    const toon = tryEncodeToon(UNIFORM_USERS);

    expect(toon).toBeTypeOf('string');
    expect(toon!.length).toBeLessThan(json.length);
    expect(decode(toon!)).toEqual(UNIFORM_USERS);
  });

  it('encodes a uniform object with a nested tabular array', () => {
    const payload = { group: 'staff', users: UNIFORM_USERS };
    expect(JSON.stringify(payload).length).toBeGreaterThanOrEqual(TOON_MIN_CHARS);

    const toon = tryEncodeToon(payload);

    expect(toon).toBeTypeOf('string');
    expect(decode(toon!)).toEqual(payload);
  });

  it('returns undefined below the 256-character threshold and accepts exactly 256', () => {
    const tooSmall = payloadWithJsonLength(TOON_MIN_CHARS - 1);
    const boundary = payloadWithJsonLength(TOON_MIN_CHARS);
    expect(JSON.stringify(tooSmall)).toHaveLength(TOON_MIN_CHARS - 1);
    expect(JSON.stringify(boundary)).toHaveLength(TOON_MIN_CHARS);

    expect(tryEncodeToon(tooSmall)).toBeUndefined();
    expect(tryEncodeToon(boundary)).toBeTypeOf('string');
  });

  it('returns undefined when TOON is not strictly shorter than JSON', () => {
    const payload = deeplyNestedPayload(200);
    const json = JSON.stringify(payload);
    expect(json.length).toBeGreaterThanOrEqual(TOON_MIN_CHARS);

    expect(tryEncodeToon(payload, json)).toBeUndefined();
  });

  it('ignores non-object payloads', () => {
    for (const payload of ['a long string payload', 42, true, null, undefined]) {
      expect(tryEncodeToon(payload)).toBeUndefined();
    }
  });

  it('uses an explicit jsonText for the threshold and shorter checks', () => {
    expect(tryEncodeToon(UNIFORM_USERS, '{"tiny":1}')).toBeUndefined();
    const json = JSON.stringify(UNIFORM_USERS);
    expect(tryEncodeToon(UNIFORM_USERS, json)).toBeTypeOf('string');
  });

  it('encodes the JSON-normalized value so undefined properties are omitted', () => {
    const payload: { ok: boolean; optional?: string; users: typeof UNIFORM_USERS } = {
      ok: true,
      optional: undefined,
      users: UNIFORM_USERS,
    };
    const json = JSON.stringify(payload);
    expect(json.length).toBeGreaterThanOrEqual(TOON_MIN_CHARS);
    expect(payload).toHaveProperty('optional');

    const toon = tryEncodeToon(payload, json);

    expect(toon).toBeTypeOf('string');
    // JSON drops `undefined`; the decoded TOON value must match JSON, not null.
    const decoded = decode(toon!) as Record<string, unknown>;
    expect(decoded).toEqual(JSON.parse(json));
    expect(decoded).not.toHaveProperty('optional');
  });

  it('swallows serialization failures without throwing', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => tryEncodeToon(circular)).not.toThrow();
    expect(tryEncodeToon(circular)).toBeUndefined();

    expect(() => tryEncodeToon({ big: 1n })).not.toThrow();
    expect(tryEncodeToon({ big: 1n })).toBeUndefined();

    expect(tryEncodeToon({ toJSON: () => undefined })).toBeUndefined();
  });
});

describe('tryEncodeToonText', () => {
  it('encodes JSON text above the threshold and round-trips the parsed value', () => {
    const json = JSON.stringify(UNIFORM_USERS);
    const toon = tryEncodeToonText(`\n  ${json}  \n`);

    expect(toon).toBeTypeOf('string');
    expect(decode(toon!)).toEqual(UNIFORM_USERS);
  });

  it('rejects short, non-JSON, and non-object/array JSON text', () => {
    expect(tryEncodeToonText('{"tiny":1}')).toBeUndefined();
    expect(tryEncodeToonText(`${'prose '.repeat(60)}`)).toBeUndefined();
    expect(tryEncodeToonText(`"${'x'.repeat(TOON_MIN_CHARS)}"`)).toBeUndefined();
    expect(tryEncodeToonText(`${' '.repeat(4)}{"a":1}`)).toBeUndefined();
    expect(tryEncodeToonText('{"broken": }')).toBeUndefined();
  });

  it('rejects JSON whose TOON form is not shorter', () => {
    const json = JSON.stringify(deeplyNestedPayload(200));
    expect(tryEncodeToonText(json)).toBeUndefined();
  });
});

describe('decodeToon', () => {
  it('decodes tabular TOON back to the original payload', () => {
    const toon = tryEncodeToon(UNIFORM_USERS);
    expect(toon).toBeTypeOf('string');
    expect(decodeToon(toon!)).toEqual(UNIFORM_USERS);
  });

  it('returns undefined for malformed or empty input and never throws', () => {
    for (const text of ['', '   ', '[3\t]{id}:', '[2\t]{id}:\n  1']) {
      expect(() => decodeToon(text)).not.toThrow();
      expect(decodeToon(text)).toBeUndefined();
    }

    // TOON decodes a plain scalar document; the sniffers gate such text out.
    expect(() => decodeToon('this is not TOON')).not.toThrow();
  });
});

describe('looksLikeJson', () => {
  it('accepts trimmed objects and arrays', () => {
    expect(looksLikeJson('  {"a":1}  ')).toBe(true);
    expect(looksLikeJson('[1,2]')).toBe(true);
    expect(looksLikeJson('{\n  "a": 1\n}')).toBe(true);
  });

  it('rejects mismatched, empty, and plain text', () => {
    expect(looksLikeJson('')).toBe(false);
    expect(looksLikeJson('   ')).toBe(false);
    expect(looksLikeJson('{"a":1')).toBe(false);
    expect(looksLikeJson('[1,2}')).toBe(false);
    expect(looksLikeJson('plain text')).toBe(false);
  });
});

describe('looksLikeToon', () => {
  it('accepts tab-delimited tabular headers at root and nested indentation', () => {
    const rootToon = tryEncodeToon(UNIFORM_USERS);
    expect(rootToon).toBeTypeOf('string');
    expect(looksLikeToon(rootToon!)).toBe(true);

    const nestedToon = tryEncodeToon({ group: UNIFORM_USERS });
    expect(nestedToon).toBeTypeOf('string');
    expect(looksLikeToon(nestedToon!)).toBe(true);
  });

  it('accepts primitive-array headers and key-value documents without field lists', () => {
    const primitiveArrays = tryEncodeToon(loggedCommandPayload());
    expect(primitiveArrays).toBeTypeOf('string');
    expect(primitiveArrays).toContain('head[20\t]:');
    expect(looksLikeToon(primitiveArrays!)).toBe(true);

    const keyValue = `ok: true\nlogPath: /tmp/log\nnote: ${'x'.repeat(80)}`;
    expect(looksLikeToon(keyValue)).toBe(true);
  });

  it('rejects JSON, short payloads, single-line payloads, and prose', () => {
    expect(looksLikeToon(JSON.stringify(UNIFORM_USERS))).toBe(false);
    expect(looksLikeToon('')).toBe(false);
    expect(looksLikeToon('user[2\t]{id\tname}:\n  1\ta\n  2\tb')).toBe(false);
    expect(looksLikeToon(`name: ${'x'.repeat(90)}`)).toBe(false);
    expect(looksLikeToon('The output uses users[3\t]{id\tname}: headers in prose.')).toBe(false);
    expect(looksLikeToon(`plain prose line one\nplain prose line two ${'x'.repeat(80)}`)).toBe(false);
  });
});
