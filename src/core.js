'use strict';
const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit',
  'coverage', 'venv', '.venv', 'env', '__pycache__', 'vendor', 'target', '.idea',
  '.vscode', '.turbo', '.cache',
]);
const EXTS = new Set([
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.vue', '.svelte', '.py', '.go',
  '.rb', '.php', '.java', '.kt', '.rs', '.sh', '.cs',
]);
// Variables that every machine has or that frameworks provide — never worth reporting.
const BUILTIN = new Set([
  'PATH', 'HOME', 'USER', 'USERNAME', 'PWD', 'SHELL', 'TERM', 'LANG', 'TMPDIR',
  'TEMP', 'TMP', 'HOSTNAME', 'CI', 'NODE_ENV', 'MODE', 'DEV', 'PROD', 'SSR', 'BASE_URL',
]);
const EXAMPLE_CANDIDATES = ['.env.example', '.env.sample', '.env.template'];

const Q = String.raw`[\x27"\x60]`;
const N = '([A-Za-z_][A-Za-z0-9_]*)';
const mk = (src) => new RegExp(src, 'g');
const PATTERNS = [
  mk(String.raw`process\.env\.${N}`),
  mk(String.raw`process\.env\[\s*${Q}${N}${Q}\s*\]`),
  mk(String.raw`import\.meta\.env\.${N}`),
  mk(String.raw`Deno\.env\.get\(\s*${Q}${N}${Q}`),
  mk(String.raw`\benviron(?:\.get)?\s*[\[(]\s*${Q}${N}${Q}`),
  mk(String.raw`\bgetenv\s*\(\s*${Q}${N}${Q}`),
  mk(String.raw`os\.(?:Getenv|LookupEnv)\(\s*"${N}"`),
  mk(String.raw`\bENV(?:\.fetch)?\s*[\[(]\s*${Q}${N}${Q}`),
  mk(String.raw`\$_ENV\[\s*${Q}${N}${Q}`),
  mk(String.raw`env::var\(\s*"${N}"`),
  mk(String.raw`Environment\.GetEnvironmentVariable\(\s*"${N}"`),
];
const DESTRUCT = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:process\.env|import\.meta\.env)\b/g;

const SECRET_PATTERNS = [
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['Stripe live key', /\b[sr]k_live_[A-Za-z0-9]{16,}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['OpenAI-style key', /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ['Telegram bot token', /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/],
  ['Private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];
const SECRET_NAME = /(SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|API_?KEY)/i;
const PLACEHOLDER = /(your|xxx|changeme|change_me|replace|example|<|>|\.\.\.|todo|dummy|placeholder)/i;

function parseEnv(text) {
  const out = new Map();
  text.split(/\r?\n/).forEach((line, i) => {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/);
    if (!m) return;
    let v = m[2].trim();
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '');
    out.set(m[1], { value: v, line: i + 1 });
  });
  return out;
}

function* walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!IGNORE_DIRS.has(e.name)) yield* walk(path.join(dir, e.name));
    } else if (e.isFile() && EXTS.has(path.extname(e.name).toLowerCase())) {
      yield path.join(dir, e.name);
    }
  }
}

function scanCode(root) {
  const usage = new Map();
  let files = 0;
  for (const file of walk(root)) {
    let text;
    try {
      if (fs.statSync(file).size > 1_000_000 || file.endsWith('.min.js')) continue;
      text = fs.readFileSync(file, 'utf8');
    } catch { continue; }
    files++;
    const rel = path.relative(root, file).split(path.sep).join('/');
    const add = (name, idx) => {
      if (BUILTIN.has(name)) return;
      const line = text.slice(0, idx).split('\n').length;
      if (!usage.has(name)) usage.set(name, []);
      const arr = usage.get(name);
      if (arr.length < 5 && !arr.some((x) => x.file === rel && x.line === line)) arr.push({ file: rel, line });
    };
    for (const re of PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) add(m[1], m.index);
    }
    DESTRUCT.lastIndex = 0;
    let d;
    while ((d = DESTRUCT.exec(text))) {
      for (const part of d[1].split(',')) {
        const mm = part.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)/);
        if (mm) add(mm[1], d.index);
      }
    }
  }
  return { usage, files };
}

function readEnvFile(p) {
  try { return parseEnv(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function isGitignored(root, file) {
  let text;
  try { text = fs.readFileSync(path.join(root, '.gitignore'), 'utf8'); } catch { return false; }
  let ignored = false;
  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    const neg = line.startsWith('!');
    if (neg) line = line.slice(1);
    line = line.replace(/^\*\*\//, '').replace(/^\//, '').replace(/\/$/, '');
    const re = new RegExp('^' + line.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$');
    if (re.test(file)) ignored = !neg;
  }
  return ignored;
}

function findSecrets(map) {
  const found = [];
  for (const [name, { value }] of map) {
    if (!value) continue;
    const hit = SECRET_PATTERNS.find(([, re]) => re.test(value));
    if (hit) { found.push({ name, kind: hit[0] }); continue; }
    if (SECRET_NAME.test(name) && value.length >= 20 && !PLACEHOLDER.test(value) && /[A-Za-z]/.test(value) && /\d/.test(value)) {
      found.push({ name, kind: 'looks like a real secret' });
    }
  }
  return found;
}

function analyze(opts = {}) {
  const root = path.resolve(opts.dir || '.');
  const { usage, files } = scanCode(root);
  const envName = opts.env || '.env';
  const env = readEnvFile(path.join(root, envName));

  let exName = opts.example;
  if (!exName) exName = EXAMPLE_CANDIDATES.find((c) => fs.existsSync(path.join(root, c)));
  const example = exName ? readEnvFile(path.join(root, exName)) : null;

  const issues = [];
  const push = (level, code, name, message) => issues.push({ level, code, name, message });
  const where = (n) => { const u = usage.get(n); return u && u[0] ? `${u[0].file}:${u[0].line}` : null; };

  if (env) {
    for (const name of usage.keys()) {
      if (env.has(name)) continue;
      const alsoUndoc = example && !example.has(name);
      push('error', 'missing-in-env', name, `used in ${where(name)} but missing from ${envName}${alsoUndoc ? ' and ' + exName : ''}`);
    }
  }
  if (example) {
    for (const name of usage.keys()) {
      if (env && !env.has(name)) continue; // already reported as missing
      if (!example.has(name)) push('warn', 'undocumented', name, `used in ${where(name)} but not documented in ${exName}`);
    }
  } else if (usage.size > 0) {
    push('info', 'no-example', '', 'no .env.example found — run `envdoctor --fix` to generate one');
  }
  if (files > 0) {
    const defined = new Map();
    if (env) for (const k of env.keys()) defined.set(k, [envName]);
    if (example) for (const k of example.keys()) defined.set(k, [...(defined.get(k) || []), exName]);
    for (const [name, where_] of defined) {
      if (!usage.has(name) && !BUILTIN.has(name)) push('warn', 'unused', name, `defined in ${where_.join(', ')} but never used in code`);
    }
  }
  if (env) {
    const dotEnvFiles = fs.readdirSync(root).filter((f) => /^\.env(\..+)?$/.test(f) && !EXAMPLE_CANDIDATES.includes(f));
    for (const f of dotEnvFiles) {
      if (!isGitignored(root, f)) push('error', 'not-ignored', f, `${f} is not in .gitignore — your secrets could be committed`);
    }
  }
  if (example) {
    for (const s of findSecrets(example)) push('error', 'secret-in-example', s.name, `${exName} contains a value that ${s.kind === 'looks like a real secret' ? s.kind : 'is a ' + s.kind}`);
  }

  const errors = issues.filter((i) => i.level === 'error').length;
  const warnings = issues.filter((i) => i.level === 'warn').length;
  const score = Math.max(0, 100 - errors * 10 - warnings * 3);
  return { root, files, usage, env, example, envName, exName, issues, errors, warnings, score };
}

const SAFE_VALUE = /^(\d{1,5}|true|false|development|production|test|localhost.*|https?:\/\/localhost.*)$/i;

function fix(res) {
  const exName = res.exName || '.env.example';
  const target = path.join(res.root, exName);
  const used = [...res.usage.keys()].sort();
  const loc = (n) => `${res.usage.get(n)[0].file}:${res.usage.get(n)[0].line}`;

  if (res.example) {
    const missing = used.filter((n) => !res.example.has(n));
    if (!missing.length) return { path: target, added: [] };
    let text = fs.readFileSync(target, 'utf8');
    if (!text.endsWith('\n')) text += '\n';
    text += '\n# --- added by envdoctor ---\n' + missing.map((n) => `# used in ${loc(n)}\n${n}=\n`).join('\n');
    fs.writeFileSync(target, text);
    return { path: target, added: missing };
  }
  const body = used.map((n) => {
    const v = res.env && res.env.has(n) && SAFE_VALUE.test(res.env.get(n).value) ? res.env.get(n).value : '';
    return `# used in ${loc(n)}\n${n}=${v}\n`;
  }).join('\n');
  fs.writeFileSync(target, `# Generated by envdoctor — copy to .env and fill in the values.\n\n${body}`);
  return { path: target, added: used };
}

module.exports = { parseEnv, analyze, fix, scanCode, findSecrets, isGitignored };
