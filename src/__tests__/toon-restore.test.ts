/**
 * toon-restore.test.ts — forwarded quoted/heredoc TOON restoration (Sub-Task 2.2).
 *
 * The `execute.before` hook rewrites a forwarded bash command so remembered
 * TOON payloads become JSON again. Only quoted strings and QUOTED-marker
 * heredoc bodies are eligible: an exact match in the bounded restore cache
 * wins, a clean TOON object/array payload is decoded as a fallback, and
 * edited, invalid, unquoted, or unquoted-heredoc text is left byte-identical.
 * Covered here: single/double quotes, heredocs (plain and `<<-`, quoted
 * markers), exact vs fallback, apostrophe escaping, the 1 MiB cap, unquoted
 * payloads, adversarial opener scans, plain commands, and malformed input.
 */
import { decode } from '@toon-format/toon';
import { beforeEach, describe, expect, it } from 'vitest';
import { cacheConvertedOutput, clearToonCache } from '../tools/toon-cache.js';
import { restoreForwardedCommand, shellSingleQuote } from '../tools/toon-restore.js';
import { encodeFixture, LOGGED_COMMAND_TOON } from './helpers/toon-fixtures.js';

/** Uniform rows: the tabular shape TOON compresses best. */
const FORWARDED_ROWS = Array.from({ length: 7 }, (_, i) => ({
  index: i + 1,
  field: 'owner',
  label: `label-${i + 1}`,
  detail: `detail-${i + 1}`,
}));

/** Same shape with apostrophes: the substituted JSON needs shell escaping. */
const APOSTROPHE_ROWS = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  name: `O'Brien-${i + 1}`,
  note: `note-${i + 1}`,
}));

const FORWARDED_TOON = encodeFixture(FORWARDED_ROWS);
const FORWARDED_JSON = JSON.stringify(FORWARDED_ROWS);
const APOSTROPHE_TOON = encodeFixture(APOSTROPHE_ROWS);
const APOSTROPHE_JSON = JSON.stringify(APOSTROPHE_ROWS);

beforeEach(() => {
  clearToonCache();
});

describe('restoreForwardedCommand — quoted payloads', () => {
  it('restores exact cached TOON in single quotes to the exact original JSON', () => {
    cacheConvertedOutput(FORWARDED_TOON, FORWARDED_JSON);
    const command = `printf '%s' '${FORWARDED_TOON}' > /tmp/rows.json`;

    expect(restoreForwardedCommand(command)).toBe(`printf '%s' '${FORWARDED_JSON}' > /tmp/rows.json`);
  });

  it('decodes valid unknown TOON in double quotes to the JSON equivalent', () => {
    const command = `printf '%s' "${FORWARDED_TOON}"`;

    const restored = restoreForwardedCommand(command);

    expect(restored).toBe(`printf '%s' '${FORWARDED_JSON}'`);
    const payload = restored.slice(restored.lastIndexOf("'", restored.length - 2) + 1, -1);
    expect(JSON.parse(payload)).toEqual(FORWARDED_ROWS);
  });

  it('restores cross-process TOON with primitive-array headers and no field list', () => {
    // A realistic `logged_command` payload has no tabular {fields} header, so
    // this exercises the widened sniffer plus the strict decode fallback.
    const command = `echo '${LOGGED_COMMAND_TOON}'`;

    const restored = restoreForwardedCommand(command);

    expect(restored).not.toBe(command);
    const payload = restored.slice(restored.indexOf("'") + 1, -1);
    expect(JSON.parse(payload)).toEqual(decode(LOGGED_COMMAND_TOON));
    expect(JSON.parse(payload).head).toHaveLength(20);
  });

  it('escapes apostrophes when substituting a shell single-quoted JSON string', () => {
    // A double-quoted source keeps the apostrophes of the TOON payload literal.
    cacheConvertedOutput(APOSTROPHE_TOON, APOSTROPHE_JSON);
    const command = `echo "${APOSTROPHE_TOON}"`;

    const restored = restoreForwardedCommand(command);

    expect(restored).toBe(`echo ${shellSingleQuote(APOSTROPHE_JSON)}`);
    expect(restored).toContain(`O'\\''Brien`);
  });

  it('restores every quoted payload in a command, not only the first', () => {
    cacheConvertedOutput(FORWARDED_TOON, FORWARDED_JSON);
    const command = `diff '${FORWARDED_TOON}' "${FORWARDED_TOON}"`;

    expect(restoreForwardedCommand(command)).toBe(`diff '${FORWARDED_JSON}' '${FORWARDED_JSON}'`);
  });

  it('leaves quoted non-TOON text and plain JSON untouched', () => {
    cacheConvertedOutput(FORWARDED_TOON, FORWARDED_JSON);
    const command = `echo '{"a":1}' "plain text" '${FORWARDED_TOON.slice(0, 40)}'`;

    expect(restoreForwardedCommand(command)).toBe(command);
  });
});

describe('restoreForwardedCommand — heredocs', () => {
  it('replaces the body of a quoted-marker heredoc with the exact cached JSON', () => {
    cacheConvertedOutput(FORWARDED_TOON, FORWARDED_JSON);
    const command = `cat > /tmp/rows.json <<'JSON'\n${FORWARDED_TOON}\nJSON\n`;

    expect(restoreForwardedCommand(command)).toBe(`cat > /tmp/rows.json <<'JSON'\n${FORWARDED_JSON}\nJSON\n`);
  });

  it('supports <<- and a double-quoted marker, falling back to a strict decode', () => {
    const command = `cat <<-"JSON"\n${FORWARDED_TOON}\nJSON\n`;

    expect(restoreForwardedCommand(command)).toBe(`cat <<-"JSON"\n${FORWARDED_JSON}\nJSON\n`);
  });

  it('supports <<- with a tab-indented quoted terminator', () => {
    const command = `cat <<-'JSON'\n${FORWARDED_TOON}\n\tJSON\n`;
    expect(restoreForwardedCommand(command)).toBe(`cat <<-'JSON'\n${FORWARDED_JSON}\n\tJSON\n`);
  });

  it('handles a quoted closing marker at end of input', () => {
    const command = `cat <<'JSON'\n${FORWARDED_TOON}\nJSON`;

    expect(restoreForwardedCommand(command)).toBe(`cat <<'JSON'\n${FORWARDED_JSON}\nJSON`);
  });

  it('leaves an unquoted heredoc untouched because the shell would expand it', () => {
    const command = `cat <<JSON\n${FORWARDED_TOON}\nJSON\n`;
    expect(restoreForwardedCommand(command)).toBe(command);

    const payload = JSON.stringify({ value: 'x$(touch /tmp/pwned)y', path: 'C:\\\\tmp' });
    const quoted = `cat <<'JSON'\n${payload}\nJSON\n`;
    expect(restoreForwardedCommand(quoted)).toBe(quoted);
  });

  it('leaves an edited/invalid heredoc body untouched', () => {
    cacheConvertedOutput(FORWARDED_TOON, FORWARDED_JSON);
    const edited = `${FORWARDED_TOON}\n  8\towner\tlabel-8\tdetail-8`;
    expect(() => decode(edited)).toThrow();
    const command = `cat <<'JSON'\n${edited}\nJSON\n`;

    expect(restoreForwardedCommand(command)).toBe(command);
  });
});

describe('restoreForwardedCommand — scope guards', () => {
  it('leaves an unquoted TOON payload unchanged even when it is cached', () => {
    cacheConvertedOutput(FORWARDED_TOON, FORWARDED_JSON);
    const command = `echo ${FORWARDED_TOON}`;

    expect(restoreForwardedCommand(command)).toBe(command);
  });

  it('leaves plain commands unchanged', () => {
    for (const command of ['', 'pnpm test', 'git status --short', 'echo "hello world"', 'rg -n "execute.before" src']) {
      expect(restoreForwardedCommand(command)).toBe(command);
    }
  });

  it('leaves commands longer than 1 MiB unchanged', () => {
    cacheConvertedOutput(FORWARDED_TOON, FORWARDED_JSON);
    const command = `echo '${FORWARDED_TOON}'${' '.repeat(1_048_576)}`;
    expect(command.length).toBeGreaterThan(1_048_576);

    expect(restoreForwardedCommand(command)).toBe(command);
  });

  it('stays inert on malformed quoting and unterminated heredocs', () => {
    for (const command of [
      "echo 'unterminated",
      'echo "unterminated',
      'cat <<EOF\nbody without a closing marker',
      'echo \\',
      '<<',
    ]) {
      expect(() => restoreForwardedCommand(command)).not.toThrow();
      expect(restoreForwardedCommand(command)).toBe(command);
    }
  });

  it('bounds adversarial heredoc scans with many openers', () => {
    const command = '<<A\n'.repeat(64 * 1024);
    const started = Date.now();

    expect(restoreForwardedCommand(command)).toBe(command);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
