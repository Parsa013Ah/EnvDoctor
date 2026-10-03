<div align="center" dir="rtl">

# 🩺 envdoctor

**فایل `.env` پروژه‌ت مشکل داره. توی یک ثانیه پیداش کن.**

صفر وابستگی · Node 18+ · JS/TS، Python، Go، Ruby، PHP، Java، Rust، C#

[![CI](https://github.com/Parsa013Ah/EnvDoctor/actions/workflows/ci.yml/badge.svg)](https://github.com/Parsa013Ah/EnvDoctor/actions)
[![npm](https://img.shields.io/npm/v/@parsa013ah/envdoctor)](https://www.npmjs.com/package/@parsa013ah/envdoctor)
![license](https://img.shields.io/badge/license-MIT-green)
![deps](https://img.shields.io/badge/dependencies-0-brightgreen)

</div>

```bash
npx @parsa013ah/envdoctor
```

بدون نصب، بدون تنظیمات. کدت، `.env` و `.env.example` رو می‌خونه و بهت می‌گه چی اشتباهه:

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

بعد قسمت خسته‌کننده رو خودکار درست کن:

```bash
npx @parsa013ah/envdoctor --fix     # .env.example رو از روی کد واقعی می‌سازه یا آپدیت می‌کنه
```

## چرا

هر پروژه‌ای یکی از این چیزها رو تجربه می‌کنه:

- 😱 هم‌تیمی رپو رو pull می‌کنه و اپ کرش می‌کنه چون کسی بهش متغیر جدید رو نگفته
- 🔑 `.env` کامیت می‌شه، یا یه کلید واقعی اشتباهی توی `.env.example` قرار می‌گیره
- 🧟 `.env` پر از متغیرهاییه که یه سال هیچ‌کس استفاده نمی‌کنه
- 📄 `.env.example` دو ماه عقب‌مونده

`envdoctor` هر ۴ تا رو هم‌زمان می‌گیره، توی CI یا روی سیستم خودت، توی چشم‌به‌هم‌زدن.

## چی رو چک می‌کنه

| بررسی | سطح |
|---|---|
| متغیری که توی کد استفاده شده ولی توی `.env` نیست | ✖ خطا |
| `.env` / `.env.local` / `.env.production` توی `.gitignore` نیست | ✖ خطا |
| کلید واقعی توی `.env.example` (AWS، GitHub، Stripe، Slack، Google، OpenAI، Telegram، کلید خصوصی، `*_SECRET`/`*_TOKEN` با آنتروپی بالا) | ✖ خطا |
| متغیری که توی کد استفاده شده ولی توی `.env.example` مستند نشده | ⚠ هشدار |
| متغیری که تعریف شده ولی هیچ‌جا استفاده نمی‌شه | ⚠ هشدار |

`process.env.X`، `process.env["X"]`، `const { X } = process.env`، `import.meta.env.X`، `Deno.env.get`، `os.environ`، `os.getenv`، `os.Getenv`، `ENV["X"]`، `getenv()`، `$_ENV`، `env::var`، `Environment.GetEnvironmentVariable` رو می‌فهمه — و `node_modules`، `dist`، `venv` و بقیه رو رد می‌کنه.

## استفاده

```text
envdoctor [dir] [options]

  --env <file>       فایل env برای بررسی            (پیش‌فرض: .env)
  --example <file>   فایل example برای مقایسه (پیش‌فرض: .env.example / .sample / .template)
  --fix              ساخت یا آپدیت فایل example از متغیرهای استفاده‌شده توی کد
  --strict           با هشدار هم با کد 1 خارج شد (مناسب CI)
  --json             خروجی ماشین‌خوان
  --no-color         غیرفعال‌کردن رنگ‌ها
```

کد خروجی `1` وقتی خطا باشه (یا با `--strict` هشدار هم)، پس مستقیم توی CI قابل استفاده‌ست.

### GitHub Actions

```yaml
- run: npx @parsa013ah/envdoctor --strict --env .env.example
```

### هوک Pre-commit

```bash
echo 'npx @parsa013ah/envdoctor' > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

### به‌عنوان کتابخانه

```js
const { analyze } = require('@parsa013ah/envdoctor');
const { issues, score } = analyze({ dir: '.' });
```

## `--fix` امنه

- اگه `.env.example` موجود باشه: فقط متغیرهای ناقص رو **اضافه** می‌کنه. کامنت‌ها و مقدارهای خودت دست نمی‌خوره.
- اگه `.env.example` نباشه: یکی می‌سازه با همه متغیرها، کامنت `# used in file:line` بالای هر کدوم، و مقدارها خالی — به‌جز موارد بی‌خطر مثل `PORT=3000`.

## محدودیت‌ها

تشخیص با regex انجام می‌شه، پس اسم‌های داینامیک (`process.env[someVar]`) قابل دیدن نیستن. متغیرهای با مقدار پیش‌فرض (`process.env.PORT || 3000`) همچنان گزارش می‌شن — خروجی رو به‌عنوان چک‌لیست بذار. ایده و PR خوش‌آمده.

## نقشه راه

- [ ] `.envdoctorrc` با لیست نادیده‌گرفتن
- [ ] تشخیص Docker / docker-compose / GitHub Actions `env:`
- [ ] `--format sarif` برای اسکن کد
- [ ] راهنمای نوع از استفاده (`parseInt(process.env.PORT)` → number)

## مشارکت

```bash
git clone https://github.com/Parsa013Ah/EnvDoctor && cd EnvDoctor
npm test
```

اضافه‌کردن زبان جدید معمولاً یه regex توی `src/core.js` به‌علاوه یه تست جدیده.

## لایسنس

MIT
