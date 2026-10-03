<div align="center">

![envdoctor demo](assets/demo.gif)

# 🩺 envdoctor

**Your `.env` has problems. Find them in one second.**

Zero dependencies · Node 18+ · JS/TS, Python, Go, Ruby, PHP, Java, Rust, C#

[![CI](https://github.com/Parsa013Ah/EnvDoctor/actions/workflows/ci.yml/badge.svg)](https://github.com/Parsa013Ah/EnvDoctor/actions)
[![npm](https://img.shields.io/npm/v/@parsa013ah/envdoctor)](https://www.npmjs.com/package/@parsa013ah/envdoctor)
![license](https://img.shields.io/badge/license-MIT-green)
![deps](https://img.shields.io/badge/dependencies-0-brightgreen)

</div>

```bash
npx @parsa013ah/envdoctor
```

No config. No install. It reads your code, your `.env` and your `.env.example`, and tells you what's wrong:

```text
envdoctor v1.0.0  scanned 2 files, found 7 variables in code

  ✖ SMTP_PASSWORD      used in src/mailer.py:4 but missing from .env and .env.example
  ✖ STRIPE_SECRET_KEY  used in src/server.js:5 but missing from .env and .env.example
  ✖ REDIS_URL          used in src/server.js:3 but missing from .env and .env.example
  ✖ .env               .env is not in .gitignore — your secrets could be committed
  ✖ JWT_SECRET         .env.example contains a value that looks like a real secret
  ⚠ SMTP_HOST          used in src/mailer.py:3 but not documented in .env.example
  ⚠ APP_NAME           used in src/server.js:7 but not documented in .env.example
  ⚠ OLD_FEATURE_FLAG   defined in .env but never used in code
  ⚠ JWT_SECRET         defined in .env.example but never used in code
  ⚠ LEGACY_API_URL     defined in .env.example but never used in code

  Score 35/100  ▰▰▰▰▱▱▱▱▱▱  5 errors, 5 warnings
```

Then fix the boring part automatically:

```bash
npx @parsa013ah/envdoctor --fix     # creates or updates .env.example from your real code
```

## Why

Every project eventually hits at least one of these:

- 😱 a teammate pulls the repo and the app crashes because nobody told them about the new variable
- 🔑 `.env` gets committed, or a real key ends up inside `.env.example`
- 🧟 `.env` is full of variables nobody has used for a year
- 📄 `.env.example` is two months out of date

`envdoctor` catches all four, in CI or on your machine, in about the time it takes to blink.

## What it checks

| Check | Level |
|---|---|
| Variable used in code but missing from `.env` | ✖ error |
| `.env` / `.env.local` / `.env.production` not in `.gitignore` | ✖ error |
| Real-looking secret in `.env.example` (AWS, GitHub, Stripe, Slack, Google, OpenAI, Telegram, private keys, high-entropy `*_SECRET`/`*_TOKEN`) | ✖ error |
| Variable used in code but not documented in `.env.example` | ⚠ warning |
| Variable defined but never used | ⚠ warning |

It understands `process.env.X`, `process.env["X"]`, `const { X } = process.env`, `import.meta.env.X`, `Deno.env.get`, `os.environ`, `os.getenv`, `os.Getenv`, `ENV["X"]`, `getenv()`, `$_ENV`, `env::var`, `Environment.GetEnvironmentVariable` — and skips `node_modules`, `dist`, `venv` and friends.

## Usage

```text
envdoctor [dir] [options]

  --env <file>       env file to check            (default: .env)
  --example <file>   example file to compare with (default: .env.example / .sample / .template)
  --fix              create or update the example file from variables used in code
  --strict           exit 1 on warnings too
  --json             machine-readable output
  --no-color         disable colors
```

Exit code is `1` when there are errors (or warnings with `--strict`), so it drops straight into CI.

### GitHub Actions

```yaml
- run: npx @parsa013ah/envdoctor --strict --env .env.example
```

### Pre-commit hook

```bash
echo 'npx @parsa013ah/envdoctor' > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

### As a library

```js
const { analyze } = require('@parsa013ah/envdoctor');
const { issues, score } = analyze({ dir: '.' });
```

## `--fix` is safe

- Existing `.env.example`: only **appends** missing variables. Your comments and values are never touched.
- No `.env.example` yet: generates one with every variable, a `# used in file:line` comment above each, and values blanked — except harmless ones like `PORT=3000`.

## Limitations

Detection is regex-based, so dynamic names (`process.env[someVar]`) can't be seen. Variables with defaults (`process.env.PORT || 3000`) are still reported — treat the output as a checklist. Ideas and PRs welcome.

## Roadmap

- [ ] `.envdoctorrc` with ignore lists
- [ ] Docker / docker-compose / GitHub Actions `env:` detection
- [ ] `--format sarif` for code scanning
- [ ] Type hints from usage (`parseInt(process.env.PORT)` → number)

## Contributing

```bash
git clone https://github.com/Parsa013Ah/EnvDoctor && cd EnvDoctor
npm test
```

A new language is usually one regex in `src/core.js` plus one test. 

## License

MIT
