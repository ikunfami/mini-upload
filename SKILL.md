---
name: mini-upload
author: ikunfami
description: "Configure mini-program CI upload for a project: auto-detect uni-app vs native WeChat Mini Program, install the right CI dependency (uni-mini-ci / miniprogram-ci), and generate upload scripts/config. Also runs the upload / preview on request. 为项目配置并执行小程序 CI 上传：自动识别 uniapp / 微信小程序原生项目，安装 uni-mini-ci 或 miniprogram-ci 依赖并生成上传脚本与配置。Use when the user asks to '配置小程序上传 / 小程序 CI / minici / miniprogram-ci / uni-mini-ci / 上传代码到小程序后台 / 上传 / 发布 / 发版 / 生成二维码'."
---

# Mini-Program CI Upload Setup (mini-upload)

This skill sets up CI upload of mini-program code for a project. It picks the right tool based on the project type, installs it into `devDependencies`, and generates the required config / scripts.

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

This path uses the **WeChat DevTools CLI** (`cli.js upload / preview`), driven by Node scripts. Install `miniprogram-ci` as the dev dependency and generate the scripts from the templates in `templates/mp-ci/` of this skill folder.

1. **Install the dependency**:
   ```bash
   npm i -D miniprogram-ci
   ```

2. **Generate the three scripts** into `<project>/scripts/` by copying the templates (do not hardcode machine-specific paths):
   - `scripts/devtools-path.js` — resolves the WeChat DevTools install dir: env var `WX_DEVTOOLS_DIR` first, then common install locations. Tell the user they can set `WX_DEVTOOLS_DIR` if DevTools is installed elsewhere.
   - `scripts/upload.js` — `node scripts/upload.js [版本号] [备注]`, defaults version from `package.json` version.
   - `scripts/preview.js` — generates a preview QR code into `qrcodes/`, timestamped so history is never overwritten.

3. **Add npm scripts to `package.json`** (merge into existing `scripts`):
   ```json
   {
     "scripts": {
       "upload": "node scripts/upload.js",
       "preview": "node scripts/preview.js"
     }
   }
   ```

4. **Tell the user the prerequisites** (they are one-time, manual):
   - 微信开发者工具「设置 → 安全设置 → 服务端口」已开启，且工具已登录。
   - 小程序后台「开发管理 → 开发工具」已开启代码上传；若开启了 IP 白名单，需把本机 IP 加入白名单。

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

- **Native (miniprogram-ci)**: pass fragments as separate args to the upload script — `npm run upload -- 1.0.2 "注册功能"`. The script defaults the version to `package.json` version when only a description is given; with only a version: `npm run upload -- 1.0.2`.
- **uni-app (uni-mini-ci)**: version and desc come from `.minicirc` — before running, **update `.minicirc` 的 `version` / `desc` 字段为用户给出的值**（用户没给的字段保持原样），then run the platform upload command.

**Always check `package.json` first** — read the project's `package.json` `scripts` section before running anything:

- **Native WeChat Mini Program (miniprogram-ci)**:
  - upload → look for the `upload` script; if present run `npm run upload`（可按用户指定追加版本号/备注：`npm run upload -- 1.2.3 备注`）.
  - 生成二维码 → look for the `preview` script; if present run `npm run preview`.
- **uni-app (uni-mini-ci)**:
  - 上传 / 发布 → the platform scripts are `upload:mp-weixin` / `upload:mp-alipay` / `upload:mp-dingtalk`. If only one exists, run it; if several exist and the user didn't specify a platform, **ask which platform** (微信 / 支付宝 / 钉钉) before running; then run e.g. `npm run upload:mp-weixin`.
  - If the user named a platform in their request (e.g. "上传支付宝小程序"), pick the matching script directly.

**If the required script is missing from `package.json`** — do NOT attempt to run anything. Tell the user the command is not configured and ask whether to run this skill's initialization (Step 2A / 2B) first. Proceed with initialization only after the user confirms.

**Before running, also confirm the prerequisites are met** (prompt the user if likely unmet, but don't block on it):
- uni-app: `.minicirc` exists and the private key file it references is present.
- Native: WeChat DevTools installed (or `WX_DEVTOOLS_DIR` set), 服务端口已开启、已登录、后台代码上传已开启。

After a successful run, report the result briefly (version uploaded / QR code path). If the command fails, show the key error output and suggest fixes (missing key, DevTools not reachable, IP whitelist, etc.).

## Verification

- For uni-app: after the user has placed the private key and filled `.minicirc`, suggest running e.g. `npm run upload:mp-weixin` to verify. Do not run it yourself if the key/config is not ready.
- For native projects: run `npm run preview` (or `node scripts/preview.js`) to verify the DevTools CLI is reachable; it should produce a QR code under `qrcodes/`.

## Notes

- Always merge into the existing `package.json` `scripts` — never overwrite unrelated entries.
- `.minicirc` and the private key file must not be committed; suggest adding them to `.gitignore` when missing.
- The generated scripts must stay machine-agnostic (no absolute personal paths). Machine-specific locations go through the `WX_DEVTOOLS_DIR` env variable.
