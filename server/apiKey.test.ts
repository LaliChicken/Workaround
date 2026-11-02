import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { decodeEnvFile, findApiKey, maskKey, parseEnv } from './apiKey.js';

const KEY = 'sk-ant-api03-abcdefghijklmnop';
const dirs: string[] = [];
function project(files: Record<string, string | Buffer>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-env-'));
  dirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), content);
  }
  return dir;
}
const utf16 = (text: string) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]);
const lookup = (files: Record<string, string | Buffer>, shell: NodeJS.ProcessEnv = {}) => findApiKey(project(files), 'development', shell);

afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('finding the API key', () => {
  it.each([
    ['plain', `ANTHROPIC_API_KEY=${KEY}\n`],
    ['spaces and quotes', `ANTHROPIC_API_KEY = "${KEY}"\r\n`],
    ['UTF-8 with BOM (Windows editors)', `﻿ANTHROPIC_API_KEY=${KEY}\n`],
    ['UTF-16 (PowerShell echo >)', utf16(`ANTHROPIC_API_KEY=${KEY}\r\n`)],
    ['comments and other vars', `# my key\nOTHER=1\nANTHROPIC_API_KEY=${KEY} # personal\n`],
  ])('reads %s', (_, content) => {
    const result = lookup({ '.env.local': content });
    expect(result.key).toBe(KEY);
    expect(result.source).toBe('.env.local');
    expect(result.problems).toEqual([]);
  });

  it('prefers .env.local over the terminal, and says so', () => {
    const result = lookup({ '.env.local': `ANTHROPIC_API_KEY=${KEY}` }, { ANTHROPIC_API_KEY: 'sk-ant-old-shell-key' });
    expect(result.key).toBe(KEY);
    expect(result.problems[0]).toMatch(/terminal also sets/);
  });

  it('ignores an empty terminal variable and falls back to it only when no file has a key', () => {
    expect(lookup({ '.env.local': `ANTHROPIC_API_KEY=${KEY}` }, { ANTHROPIC_API_KEY: '' }).key).toBe(KEY);
    expect(lookup({}, { ANTHROPIC_API_KEY: KEY })).toMatchObject({ key: KEY, source: 'your terminal (ANTHROPIC_API_KEY)' });
  });

  it.each([
    ['no file', {}, /No \.env\.local file found/],
    ['VITE_ prefix', { '.env.local': `VITE_ANTHROPIC_API_KEY=${KEY}` }, /Rename it to ANTHROPIC_API_KEY/],
    ['key on the next line', { '.env.local': `ANTHROPIC_API_KEY=\n${KEY}\n` }, /same line/],
    ['empty value', { '.env.local': 'ANTHROPIC_API_KEY=\n' }, /is empty/],
    ['wrong variable', { '.env.local': `CLAUDE_KEY=${KEY}` }, /doesn’t contain a line/],
    ['hidden .txt ending', { '.env.local.txt': `ANTHROPIC_API_KEY=${KEY}` }, /Rename it to exactly “\.env\.local”/],
    ['wrong folder', { 'src/.env.local': `ANTHROPIC_API_KEY=${KEY}` }, /Move it up to the project folder/],
  ])('explains a missing key: %s', (_, files, message) => {
    const result = lookup(files as Record<string, string>);
    expect(result.key).toBeNull();
    expect(result.problems.join(' ')).toMatch(message);
  });

  it('warns about a key that looks incomplete', () => {
    expect(lookup({ '.env.local': 'ANTHROPIC_API_KEY=abc123' }).problems[0]).toMatch(/doesn’t start with/);
  });
});

describe('helpers', () => {
  it('decodes UTF-16 big-endian and BOM-less UTF-16', () => {
    const be = Buffer.from(`﻿A=1`, 'utf16le').swap16();
    expect(decodeEnvFile(be)).toBe('A=1');
    expect(decodeEnvFile(Buffer.from('A=1', 'utf16le'))).toBe('A=1');
  });
  it('parses export and single quotes', () => {
    expect(parseEnv("export A='x y'\nB=2")).toEqual({ A: 'x y', B: '2' });
  });
  it('never prints a whole key', () => {
    expect(maskKey(KEY)).toBe('sk-ant-…mnop');
  });
});
