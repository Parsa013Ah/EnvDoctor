'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseEnv, analyze, fix } = require('../src/core');

function tmp(files) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'envdoctor-'));
  for (const [f, c] of Object.entries(files)) {
    const p = path.join(d, f);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c);
  }
  return d;
}
const codes = (r, level) => r.issues.filter((i) => !level || i.level === level).map((i) => `${i.code}:${i.name}`).sort();

test('parseEnv handles export, quotes, inline comments', () => {
  const m = parseEnv('export A=1\nB="two words"\nC=3 # note\n# D=4\n');
  assert.equal(m.get('A').value, '1');
  assert.equal(m.get('B').value, 'two words');
  assert.equal(m.get('C').value, '3');
  assert.equal(m.has('D'), false);
});

test('detects missing, undocumented and unused variables', () => {
  const d = tmp({
    'a.js': 'const x = process.env.DB_URL; const { PORT, API_KEY: k } = process.env;',
    'b.py': 'import os\nos.environ["PY_VAR"]; os.getenv("PY_OTHER")',
    '.env': 'DB_URL=1\nOLD=1\nPORT=1\n',
    '.env.example': 'DB_URL=\n',
    '.gitignore': '.env\n',
  });
  const r = analyze({ dir: d });
  assert.deepEqual(codes(r, 'error'), ['missing-in-env:API_KEY', 'missing-in-env:PY_OTHER', 'missing-in-env:PY_VAR']);
  assert.ok(codes(r).includes('unused:OLD'));
  assert.ok(codes(r).includes('undocumented:PORT'));
});

test('builtins and node_modules are ignored', () => {
  const d = tmp({ 'a.js': 'process.env.NODE_ENV; process.env.PATH', 'node_modules/x/i.js': 'process.env.HIDDEN' });
  assert.equal(analyze({ dir: d }).usage.size, 0);
});

test('flags .env missing from .gitignore', () => {
  const d = tmp({ 'a.js': 'process.env.A', '.env': 'A=1', '.gitignore': 'node_modules\n' });
  assert.ok(codes(analyze({ dir: d }), 'error').includes('not-ignored:.env'));
  fs.writeFileSync(path.join(d, '.gitignore'), '.env*\n');
  assert.ok(!codes(analyze({ dir: d }), 'error').includes('not-ignored:.env'));
});

test('flags real-looking secrets in .env.example', () => {
  const fake = 'AKIA' + 'ABCDEFGHIJKLMNOP';
  const d = tmp({ 'a.js': 'process.env.AWS_KEY; process.env.JWT_SECRET', '.env.example': `AWS_KEY=${fake}\nJWT_SECRET=9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c\n` });
  assert.deepEqual(codes(analyze({ dir: d }), 'error'), ['secret-in-example:AWS_KEY', 'secret-in-example:JWT_SECRET']);
});

test('--fix generates .env.example, keeping only safe values', () => {
  const d = tmp({ 'a.js': 'process.env.PORT; process.env.TOKEN', '.env': 'PORT=3000\nTOKEN=abc123' });
  fix(analyze({ dir: d }));
  const out = fs.readFileSync(path.join(d, '.env.example'), 'utf8');
  assert.match(out, /^PORT=3000$/m);
  assert.match(out, /^TOKEN=$/m);
  assert.equal(analyze({ dir: d }).issues.filter((i) => i.code === 'undocumented').length, 0);
});

test('--fix appends only missing variables to an existing example', () => {
  const d = tmp({ 'a.js': 'process.env.A; process.env.B', '.env.example': '# hi\nA=keep\n' });
  fix(analyze({ dir: d }));
  const out = fs.readFileSync(path.join(d, '.env.example'), 'utf8');
  assert.match(out, /^A=keep$/m);
  assert.match(out, /^B=$/m);
});
