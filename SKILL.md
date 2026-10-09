---
name: mini-upload
author: ikunfami
description: "Configure mini-program CI upload for a project: auto-detect uni-app vs native WeChat Mini Program, install the right CI dependency (uni-mini-ci / miniprogram-ci), and generate upload scripts/config. Also runs the upload / preview on request. 为项目配置并执行小程序 CI 上传：自动识别 uniapp / 微信小程序原生项目，安装 uni-mini-ci 或 miniprogram-ci 依赖并生成上传脚本与配置。Use when the user asks to 'mini-upload / 配置小程序上传 / 小程序 CI 上传 / minici / miniprogram-ci / uni-mini-ci / 上传小程序代码 / 小程序发版 / 小程序代码上传 / 生成小程序预览二维码'."
---

# Mini-Program CI Upload Setup (mini-upload)

This skill sets up CI upload of mini-program code for a project. It picks the right tool based on the project type, installs it into `devDependencies`, and generates the required config / scripts.

## Mode decision (先判断模式)

Read the user's intent first, then jump to the matching section — don't read everything before acting:

| 用户意图 | 走哪个部分 |
|---|---|
| 想配置 / 搭建小程序上传（如"配置小程序上传"、"接入 miniprogram-ci"、"初始化 mini-upload"） | Step 1 → Step 2A / 2B（初始化） |
| 想直接上传 / 发版 / 生成预览二维码（如"发版，1.0.2，注册功能"） | Running upload / preview（执行模式） |
| 两者都不是（普通的"发布 npm 包"、"上传图片"等） | 本 skill 不适用，不要触发 |

Ambiguous cases: if the user says a bare word like "发版" / "上传" in a project that is clearly a mini-program project (or already has upload scripts / `.minicirc` / `ci.config.json`), treat it as 执行模式; otherwise ask what they mean before doing anything.

## Step 1 — Detect project type

Inspect the target project (its `package.json`, directory layout) and classify it:

**uni-app project** — any of these signs:
- `package.json` dependencies/devDependencies contain `@dcloudio/*`
- Build scripts contain `uni build` (e.g. `"build:mp-weixin": "uni build -p mp-weixin"`)
- `src/manifest.json` or `src/pages.json` exists

**Native WeChat Mini Program project** — signs:
- `project.config.json` at the root (optionally with a `miniprogramRoot` such as `miniprogram/`)
- `app.json` / `app.js` / `app.wxss` at root or under `miniprogramRoot`
- No `@dcloudio` dependencies

If neither pattern matches, **ask the user which type it is** before proceeding.

## Step 2 common rules (初始化通用规则 — applies to both 2A and 2B)

**Idempotency — initialization must be safe to re-run:**

- **Never overwrite user-edited config.** Before writing `.minicirc` / `ci.config.json`, check whether it already exists:
  - Exists and still has template placeholders → fill in only the missing/placeholder fields, keep everything else.
  - Exists and is fully configured → leave it untouched, tell the user it's already configured.
  - Doesn't exist → create from the template.
- Same for scripts (`scripts/*`): if a script already exists, diff against the template; only rewrite when missing or genuinely broken, and say so.
- **Language mismatch**: if the existing scripts' language (JS vs TS) differs from the project's language, do NOT migrate on your own — a working script is never "broken". Only migrate when the user explicitly asks (e.g. "换成 ts 脚本"): replace the scripts with the matching variant, update the npm scripts accordingly (`node scripts/upload.js` → `tsx scripts/upload.ts`), install `tsx` if switching to TS, and re-run an upload/preview to verify.
- Same for `package.json` `scripts`: only add entries that are missing; never modify or delete existing ones. **Name collisions**: if `upload` / `preview` (or an `upload:mp-*` slot) is already taken by an unrelated script, don't overwrite it — use a suffixed name instead (e.g. `upload:mp` / `preview:mp` for native projects) and tell the user; 执行模式 must look up whatever names were actually registered.
- At the end of initialization, summarize what was created vs. what was kept as-is.

## Step 2A — uni-app project → uni-mini-ci

1. **Install the dependency** (match the project's package manager):
   ```bash
   npm i -D uni-mini-ci
   # or: pnpm add -D uni-mini-ci / yarn add -D uni-mini-ci
   ```

2. **Create `.minicirc` in the project root** with the content from `templates/uni/.minicirc` in this skill folder (copy it verbatim). It contains placeholders for weixin / alipay / dd platforms, `version`, and `desc`. Adjust `projectPath` values to the actual output directories if the project differs from the defaults (`dist/build/mp-weixin`, `dist/build/mp-alipay`, `dist/build/mp-dingtalk`).

3. **Tell the user to obtain the upload key** (this cannot be automated):
   - WeChat: open https://mp.weixin.qq.com/ → 管理 → 开发管理 → 小程序代码上传 → 小程序代码上传密钥，下载密钥文件，放在项目根目录，然后修改 `.minicirc` 中 `weixin.privateKeyPath` 指向该文件。
   - Alipay / DingTalk: configure `appid` / `toolId` / `token` and their key paths in `.minicirc` accordingly.
   - ⚠️ Remind the user: the private key is a secret — never commit it to git (suggest adding it to `.gitignore`).

4. **Add npm scripts to `package.json`** (merge into existing `scripts`, keep existing entries):
   ```json
   {
     "scripts": {
       "upload:mp-weixin": "uni build -p mp-weixin && minici --platform weixin",
       "upload:mp-alipay": "uni build -p mp-alipay && minici --platform alipay",
       "upload:mp-dingtalk": "uni build -p mp-dingtalk && minici --platform dd"
     }
   }
   ```

## Step 2B — native WeChat Mini Program project → miniprogram-ci

This path uses the **`miniprogram-ci` SDK** (headless upload via WeChat's upload API — no DevTools, no service port, works on CI machines). Templates live in `templates/mp-ci/` (JavaScript) and `templates/mp-ci-ts/` (TypeScript) of this skill folder.

1. **Detect the project's script language**, then install dependencies accordingly:
   - **TypeScript project** — `typescript` in dependencies/devDependencies, or a `tsconfig.json` at the root → use the `templates/mp-ci-ts/` templates and install both packages:
     ```bash
     npm i -D miniprogram-ci tsx
     ```
   - **JavaScript project, `"type": "module"`** — the CJS-style `.js` templates would break (no `require`); copy the JS templates but rename them to `.cjs` (`scripts/ci-project.cjs`, `scripts/upload.cjs`, `scripts/preview.cjs`) and point the npm scripts at the `.cjs` files.
   - **JavaScript project, CommonJS (default)** — use `templates/mp-ci/` as-is:
     ```bash
     npm i -D miniprogram-ci
     ```

2. **Create `ci.config.json` in the project root** from `templates/mp-ci/ci.config.json` (copy it verbatim, then fill in):
   - `appid` — read it from the project's `project.config.json` (`appid` field).
   - `projectPath` — the directory **containing `project.config.json`** (usually the project root — just use `.`). `miniprogram-ci` reads `miniprogramRoot` (the actual code dir) and `setting.useCompilerPlugins` from it. Do NOT point this at the `miniprogramRoot` subdir itself: the file-existence checks and TS/Less plugin detection would then fall back to defaults and fail (e.g. `could not find pages/xxx/xxx.js` in TS projects).
   - `privateKeyPath` — placeholder for now, see step 5.
   - Optional `setting` — compile options passed to `ci.upload` / `ci.preview` (e.g. `{ "es6": true }`). You usually don't need it: if absent, the scripts auto-detect `useCompilerPlugins` from `project.config.json`, so TS / Less / Sass projects work out of the box.

3. **Compiler plugins (TS / Less / Sass projects)**: `miniprogram-ci` does NOT auto-enable the `useCompilerPlugins` from `project.config.json` — it must be passed via the `setting` option. The generated scripts handle this automatically (they read `project.config.json` from `projectPath` or the project root and pass `useCompilerPlugins` through). Only if detection fails should you add an explicit `setting` to `ci.config.json`.

4. **Generate the three scripts** into `<project>/scripts/` from the language-matched templates (step 1):
   - TS variant: `ci-project.ts` / `upload.ts` / `preview.ts`, run with `tsx`.
   - JS variant: `ci-project.js` / `upload.js` / `preview.js`, run with `node` (or `.cjs` for ESM projects).
   - `scripts/ci-project.*` — shared helper: loads `ci.config.json` (with clear error messages for missing/placeholder values), creates the `miniprogram-ci` Project instance, and resolves the compile `setting` (step 3). The TS variant uses `process.cwd()` as the project root (npm scripts always run from the root) instead of `import.meta.url`, so it type-checks cleanly under a mini-program tsconfig (`module: commonjs`) — no `import.meta` errors in the editor.
   - `upload.*` — `[版本号] [备注]` args; version/desc default to `ci.config.json`, then `package.json` version. First arg matching `x.y.z` is the version, everything after is the desc; a single non-version arg is the desc.
   - `preview.*` — generates a preview QR code into `qrcodes/`, timestamped so history is never overwritten.

5. **Tell the user to obtain the upload key** (same key as the uni-app WeChat path):
   - Open https://mp.weixin.qq.com/ → 管理 → 开发管理 → 小程序代码上传 → 小程序代码上传密钥，下载密钥文件，放在项目根目录，然后修改 `ci.config.json` 中 `privateKeyPath` 指向该文件。
   - ⚠️ Remind the user: the private key is a secret — never commit it to git (suggest adding it to `.gitignore`).

6. **Add npm scripts to `package.json`** (merge into existing `scripts`; match the file extensions from step 4):
   ```json
   {
     "scripts": {
       "upload": "node scripts/upload.js",
       "preview": "node scripts/preview.js"
     }
   }
   ```
   For the TS variant use `"upload": "tsx scripts/upload.ts"` / `"preview": "tsx scripts/preview.ts"`; for the ESM-JS variant use the `.cjs` file names.

7. **Tell the user the prerequisites** (they are one-time, manual):
   - 小程序后台「开发管理 → 开发工具」已开启代码上传；若开启了 IP 白名单，需把本机 IP 加入白名单。
   - 无需微信开发者工具、无需登录、无需开启服务端口（这是 SDK 方案与开发者工具 CLI 方案的区别）。

## Running upload / preview (执行模式)

When the user says **上传 / 发布 / 发版 / 生成二维码** (upload / publish / release / generate QR code) in a project — and is not asking to set things up — execute the corresponding command. The trigger words map to actions:

| 用户提示词 | 动作 |
|---|---|
| 上传 / 发布 / 发版 | upload |
| 生成二维码 / 预览 / 预览二维码 | preview（仅原生微信小程序项目支持；uni-app 项目提示不支持，可建议改为上传体验版） |

### Parsing the release description (发版描述)

The user's input may carry a version number and/or a release note after the trigger word, separated by `，` `,` or whitespace. Split the text after the trigger word into fragments by `，` / `,` / whitespace, then classify each fragment:

- A fragment matching `x.y.z` or `x.y.z.w` (e.g. `1.0.2`) = **version number** (版本号).
- All remaining text (one or more fragments, joined as-is) = **release description** (备注 / desc). Keep it verbatim, don't invent one.
- If no version fragment is given, the version defaults to `package.json` version (native) or the `.minicirc` `version` field (uni-app). If no description is given, use the tool's default (see below).

Examples:

| 用户输入 | 版本号 | 描述 |
|---|---|---|
| `发版，修复已知问题` | （默认） | 修复已知问题 |
| `发版，1.0.2，注册功能` | 1.0.2 | 注册功能 |
| `发版 1.0.2` | 1.0.2 | （默认） |
| `发版` | （默认） | （默认） |

How the description is passed depends on the project type:

- **Native (miniprogram-ci)**: pass fragments as separate args to the upload script — `npm run upload -- 1.0.2 "注册功能"`. The script defaults version/desc to `ci.config.json`（version 缺失时回退到 `package.json` version）when not given on the command line.
- **uni-app (uni-mini-ci)**: version and desc come from `.minicirc` — before running, **update `.minicirc` 的 `version` / `desc` 字段为用户给出的值**（用户没给的字段保持原样），then run the platform upload command.

**Always check `package.json` first** — read the project's `package.json` `scripts` section before running anything:

- **Native WeChat Mini Program (miniprogram-ci)**:
  - upload → look for the `upload` script; if present run `npm run upload`（可按用户指定追加版本号/备注：`npm run upload -- 1.2.3 备注`）.
  - 生成二维码 → look for the `preview` script; if present run `npm run preview`.
- **uni-app (uni-mini-ci)**:
  - 上传 / 发布 → the platform scripts are `upload:mp-weixin` / `upload:mp-alipay` / `upload:mp-dingtalk`. If only one exists, run it; if several exist and the user didn't specify a platform, **narrow down by config first**: read `.minicirc` and only consider platforms actually configured there (a platform whose block is missing / still has placeholder appid doesn't count). If exactly one configured platform remains, run it; if several remain, **ask which platform** (微信 / 支付宝 / 钉钉) before running; then run e.g. `npm run upload:mp-weixin`.
  - If the user named a platform in their request (e.g. "上传支付宝小程序"), pick the matching script directly.

**If the required script is missing from `package.json`** — do NOT attempt to run anything. Tell the user the command is not configured and ask whether to run this skill's initialization (Step 2A / 2B) first. Proceed with initialization only after the user confirms.

**Before running, also confirm the prerequisites are met** (prompt the user if likely unmet, but don't block on it):
- uni-app: `.minicirc` exists and the private key file it references is present.
- Native: `ci.config.json` exists, its `privateKeyPath` file is present, and 小程序后台代码上传已开启（IP 白名单含本机）。

After a successful run, report the result briefly (version uploaded / QR code path). If the command fails, show the key error output and suggest fixes (missing key, DevTools not reachable, IP whitelist, etc.).

## Verification

- For uni-app: after the user has placed the private key and filled `.minicirc`, suggest running e.g. `npm run upload:mp-weixin` to verify. Do not run it yourself if the key/config is not ready.
- For native projects: run `npm run preview` (or `node scripts/preview.js`) to verify; it should produce a QR code under `qrcodes/`. The scripts exit with clear messages if `ci.config.json` or the private key is missing.

## Notes

- Always merge into the existing `package.json` `scripts` — never overwrite unrelated entries.
- `.minicirc`, `ci.config.json` and the private key file must not be committed; suggest adding them to `.gitignore` when missing. Also suggest ignoring `qrcodes/`.
- The generated scripts stay machine-agnostic: everything machine-specific (appid, key path, code path) lives in `ci.config.json` / `.minicirc`, never in the scripts.
