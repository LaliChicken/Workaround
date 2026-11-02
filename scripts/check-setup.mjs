// Runs before `npm run dev` / `npm run preview` (npm "pre" scripts) and stops
// with a plain-language message instead of a wall of bundler errors when the
// computer isn't ready: Node too old, or packages added since the last install.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const problems = [];

// Vite 8 needs Node ^20.19.0 || >=22.12.0.
const [major, minor] = process.versions.node.split('.').map(Number);
const nodeOk = (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major >= 23;
if (!nodeOk) {
  problems.push(`Node ${process.versions.node} is too old for this project. Install Node 22 LTS from nodejs.org, then run "npm install" again.`);
}

const missing = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter(
  (name) => !fs.existsSync(path.join(root, 'node_modules', name, 'package.json')),
);
if (missing.length) {
  problems.push(`Some packages aren't installed yet (${missing.join(', ')}). Run "npm install"; new packages were added since you last installed.`);
}

if (problems.length) {
  console.error(`\n  \x1b[33m✗ Can't start yet:\x1b[0m\n${problems.map((p) => `    • ${p}`).join('\n')}\n`);
  process.exit(1);
}
