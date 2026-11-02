import fs from 'node:fs';
import path from 'node:path';

/*
 * Finds ANTHROPIC_API_KEY for the local schedule reader and explains, in plain
 * language, why it couldn't when something is off. Vite's own env loader
 * silently skips files saved as UTF-16 (Windows PowerShell `echo >`) or with a
 * UTF-8 byte-order mark (some Windows editors), so this reads them itself.
 */

export interface KeyLookup {
  key: string | null;
  /** Where the key came from, e.g. ".env.local". */
  source: string | null;
  /** Human-readable problems or warnings, most important first. */
  problems: string[];
}

/** Decodes UTF-8 (with or without BOM) and UTF-16 LE/BE text. */
export function decodeEnvFile(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le');
  if (buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.from(buf.subarray(2));
    swapped.swap16();
    return swapped.toString('utf16le');
  }
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString('utf8');
  // UTF-16 without a BOM shows up as every other byte being zero.
  if (buf.length >= 4 && buf[1] === 0 && buf[3] === 0) return buf.toString('utf16le');
  return buf.toString('utf8');
}

/** Minimal dotenv parser: KEY=value, optional `export`, quotes and comments. */
export function parseEnv(text: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^﻿/, '').trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2].trim();
    if (/^(['"`]).*\1$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '');
    vars[m[1]] = value.trim();
  }
  return vars;
}

const MISNAMED = ['.env.local.txt', 'env.local', '.env.local.env', '.env.txt', 'env.txt', '.env.local.local'];

export function findApiKey(root: string, mode: string, shellEnv: NodeJS.ProcessEnv = process.env): KeyLookup {
  const problems: string[] = [];
  const shellKey = shellEnv.ANTHROPIC_API_KEY?.trim() || null;

  // Same files and priority as Vite: mode-specific local first.
  for (const name of [`.env.${mode}.local`, '.env.local', `.env.${mode}`, '.env']) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    const text = decodeEnvFile(fs.readFileSync(file));
    const vars = parseEnv(text);
    const key = vars.ANTHROPIC_API_KEY;
    if (key) {
      if (!key.startsWith('sk-ant-')) problems.push(`The key in ${name} doesn’t start with “sk-ant-”. Check you copied the whole key.`);
      if (shellKey && shellKey !== key) problems.push(`Your terminal also sets ANTHROPIC_API_KEY; using the one in ${name}.`);
      return { key, source: name, problems };
    }
    if (vars.VITE_ANTHROPIC_API_KEY) {
      problems.push(`${name} uses VITE_ANTHROPIC_API_KEY. Rename it to ANTHROPIC_API_KEY (VITE_ variables can be exposed to the browser).`);
    } else if ('ANTHROPIC_API_KEY' in vars) {
      problems.push(
        /sk-ant-/.test(text)
          ? `In ${name}, put the key on the same line, with no spaces: ANTHROPIC_API_KEY=sk-ant-…`
          : `ANTHROPIC_API_KEY in ${name} is empty. Paste your key after the = sign.`,
      );
    } else if (name === '.env.local') {
      problems.push('.env.local doesn’t contain a line starting with ANTHROPIC_API_KEY=');
    }
  }

  for (const wrong of MISNAMED) {
    if (fs.existsSync(path.join(root, wrong))) problems.push(`Found a file named “${wrong}”. Rename it to exactly “.env.local” (Windows may hide a .txt ending).`);
  }
  for (const folder of ['src', 'server', 'public']) {
    if (fs.existsSync(path.join(root, folder, '.env.local'))) problems.push(`Found ${folder}/.env.local. Move it up to the project folder, next to package.json.`);
  }

  if (shellKey) return { key: shellKey, source: 'your terminal (ANTHROPIC_API_KEY)', problems };
  if (problems.length === 0) problems.push('No .env.local file found next to package.json.');
  return { key: null, source: null, problems };
}

/** "sk-ant-…a1b2" for logs; never prints the whole key. */
export const maskKey = (key: string) => (key.length > 12 ? `${key.slice(0, 7)}…${key.slice(-4)}` : '…');
