#!/usr/bin/env node
'use strict';
const path = require('path');
const { analyze, fix } = require('../src/core');
const pkg = require('../package.json');

const HELP = `envdoctor v${pkg.version} — health check for your environment variables

Usage: envdoctor [dir] [options]

  --env <file>       env file to check            (default: .env)
  --example <file>   example file to compare with (default: .env.example / .sample / .template)
  --fix              create or update the example file from variables used in code
  --strict           exit with code 1 on warnings too (great for CI)
  --json             machine-readable output
  --no-color         disable colors
  -v, --version      print version
  -h, --help         show this help

Detects: missing vars, undocumented vars, unused vars, .env not in .gitignore,
and real-looking secrets sitting in .env.example.`;

const args = process.argv.slice(2);
const o = { dir: '.' };
let strict = false, json = false, doFix = false, noColor = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '-h' || a === '--help') { console.log(HELP); process.exit(0); }
  else if (a === '-v' || a === '--version') { console.log(pkg.version); process.exit(0); }
  else if (a === '--env') o.env = args[++i];
  else if (a === '--example') o.example = args[++i];
  else if (a === '--fix') doFix = true;
  else if (a === '--strict') strict = true;
  else if (a === '--json') json = true;
  else if (a === '--no-color') noColor = true;
  else if (a.startsWith('-')) { console.error(`Unknown option: ${a}\n\n${HELP}`); process.exit(2); }
  else o.dir = a;
}

const color = !noColor && !process.env.NO_COLOR && process.stdout.isTTY;
const paint = (code) => (s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = paint(31), yellow = paint(33), green = paint(32), dim = paint(2), bold = paint(1);

let res = analyze(o);
let fixed = null;
if (doFix) { fixed = fix(res); res = analyze({ ...o, example: o.example || res.exName || undefined }); }

if (json) {
  console.log(JSON.stringify({ files: res.files, variables: [...res.usage.keys()], issues: res.issues, score: res.score }, null, 2));
} else {
  console.log(`\n${bold('envdoctor')} ${dim(`v${pkg.version}`)}  scanned ${res.files} files, found ${res.usage.size} variables in code\n`);
  if (fixed) {
    const rel = path.relative(process.cwd(), fixed.path) || fixed.path;
    console.log(fixed.added.length ? green(`  ✔ updated ${rel} (+${fixed.added.length} variables)\n`) : dim(`  ${rel} already up to date\n`));
  }
  const icon = { error: red('✖'), warn: yellow('⚠'), info: dim('ℹ') };
  const order = { error: 0, warn: 1, info: 2 };
  const issues = [...res.issues].sort((a, b) => order[a.level] - order[b.level]);
  const pad = Math.min(30, Math.max(8, ...issues.map((i) => i.name.length)));
  if (!issues.length) console.log(green('  ✔ All good — your environment looks healthy'));
  for (const i of issues) console.log(`  ${icon[i.level]} ${i.name ? bold(i.name.padEnd(pad)) + '  ' : ''}${i.message}`);
  const filled = Math.round(res.score / 10);
  const bar = '▰'.repeat(filled) + '▱'.repeat(10 - filled);
  const tone = res.score >= 90 ? green : res.score >= 60 ? yellow : red;
  console.log(`\n  Score ${tone(`${res.score}/100`)}  ${tone(bar)}  ${dim(`${res.errors} errors, ${res.warnings} warnings`)}`);
  if (issues.length && !doFix) console.log(dim('\n  Tip: run `envdoctor --fix` to sync your .env.example automatically'));
  console.log('');
}
process.exit(res.errors > 0 || (strict && res.warnings > 0) ? 1 : 0);
