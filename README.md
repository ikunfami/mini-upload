# mini-upload

Mini-program CI upload skill for AI coding agents（小程序 CI 上传 Skill）：自动识别项目类型（uni-app / 微信小程序原生），安装对应的 CI 依赖并生成上传配置与脚本，同时支持按用户指令直接执行上传 / 预览。

仓库地址：https://github.com/ikunfami/mini-upload.git

## 功能

### 1. 初始化（配置 CI 上传）

根据项目类型自动选择工具：

| 项目类型 | 工具 | 说明 |
|---|---|---|
| uni-app 项目 | `uni-mini-ci` | 生成 `.minicirc` 配置 + `upload:mp-*` npm 脚本 |
| 微信小程序原生项目 | `miniprogram-ci` | 生成 `ci.config.json` + 按项目语言（TS/JS/ESM）生成 `scripts/` 上传与预览脚本（SDK 无头上传） |

**识别规则**

- uni-app：`package.json` 含 `@dcloudio/*` 依赖、含 `uni build` 脚本、或存在 `src/manifest.json` / `src/pages.json`
- 原生微信小程序：根目录存在 `project.config.json`（可含 `miniprogramRoot`）、`app.json` 等，且无 `@dcloudio` 依赖
- 无法识别时询问用户

### 2. 执行（上传 / 发版 / 生成二维码）

用户输入触发词后直接执行对应命令：

| 用户提示词 | 动作 |
|---|---|
| 上传 / 发布 / 发版 | 执行 upload |
| 生成二维码 / 预览 | 执行 preview（仅原生项目；uni-app 项目提示改为传体验版） |

**发版描述解析**：触发词之后的文本按 `，` `,` 空格切分，形如 `x.y.z` 的片段识别为版本号，其余为描述。例如：

- `发版，修复已知问题` → 描述「修复已知问题」
- `发版，1.0.2，注册功能` → 版本 1.0.2，描述「注册功能」

执行前会检查 `package.json` 中是否存在对应命令：不存在则提醒用户先初始化，不会擅自执行。

## 目录结构

```
mini-upload/
├── SKILL.md                  # Skill 主文档（识别规则 + 初始化 + 执行模式）
├── README.md
└── templates/
    ├── uni/
    │   └── .minicirc         # uni-mini-ci 配置模板（weixin / alipay / dd）
    ├── mp-ci/                # 原生微信小程序 JS 模板（CommonJS）
    │   ├── ci.config.json    # miniprogram-ci 配置模板（appid / privateKeyPath / projectPath）
    │   ├── ci-project.js     # 共享辅助：加载配置并创建 miniprogram-ci Project 实例
    │   ├── upload.js         # 上传脚本：node scripts/upload.js [版本号] [备注]
    │   └── preview.js        # 预览二维码脚本：输出到 qrcodes/，按时间戳命名
    └── mp-ci-ts/             # 原生微信小程序 TS 模板（tsx 运行，ESM 风格）
        ├── ci-project.ts
        ├── upload.ts
        └── preview.ts
```

## 安装（作为 Agent Skill）

将整个目录复制到 skills 目录即可，例如：

```bash
cp -r mini-upload ~/.agents/skills/
```

## 各项目类型的详细流程

### uni-app → uni-mini-ci

1. 安装依赖：`npm i -D uni-mini-ci`（或 pnpm / yarn）
2. 复制 `templates/uni/.minicirc` 到项目根目录，按实际产物目录调整 `projectPath`
3. 用户前往 https://mp.weixin.qq.com/ → 管理 → 开发管理 → 小程序代码上传，下载上传密钥放入项目根目录，并修改 `.minicirc` 的 `privateKeyPath`（密钥文件不要提交 git）
4. 在 `package.json` 的 `scripts` 中合并：

```json
{
  "upload:mp-weixin": "uni build -p mp-weixin && minici --platform weixin",
  "upload:mp-alipay": "uni build -p mp-alipay && minici --platform alipay",
  "upload:mp-dingtalk": "uni build -p mp-dingtalk && minici --platform dd"
}
```

### 原生微信小程序 → miniprogram-ci（SDK 无头上传）

无需安装/登录微信开发者工具，无需开启服务端口，可在纯 CI 环境运行。

**按项目语言选择模板**：

| 项目情况 | 模板 | 依赖 | npm scripts |
|---|---|---|---|
| TypeScript 项目（含 `typescript` 依赖或 `tsconfig.json`） | `templates/mp-ci-ts/` | `npm i -D miniprogram-ci tsx` | `tsx scripts/upload.ts` / `tsx scripts/preview.ts` |
| JS + `"type": "module"` | `templates/mp-ci/` 改名 `.cjs` | `npm i -D miniprogram-ci` | `node scripts/upload.cjs` |
| JS CommonJS（默认） | `templates/mp-ci/` 原样 | `npm i -D miniprogram-ci` | `node scripts/upload.js` |

**配置流程**：

1. 复制 `templates/mp-ci/ci.config.json` 到项目根目录，填写：
   - `appid`：取自 `project.config.json`
   - `projectPath`：含 `app.json` 的代码目录（通常即 `project.config.json` 的 `miniprogramRoot`，根目录项目填 `.`）
   - `privateKeyPath`：先留占位，见第 3 步
2. 按上表复制对应语言的三个脚本到项目 `scripts/` 目录
3. 用户前往 https://mp.weixin.qq.com/ → 管理 → 开发管理 → 小程序代码上传，下载上传密钥放入项目根目录，并修改 `ci.config.json` 的 `privateKeyPath`（密钥文件不要提交 git）
4. 在 `package.json` 的 `scripts` 中合并对应语言的命令（上表）

**前置条件**（一次性、手动）：小程序后台「开发管理 → 开发工具」已开启代码上传；若开启 IP 白名单需加入本机 IP。

> TS / Less / Sass 项目无需额外配置：脚本会自动读取 `project.config.json` 的 `useCompilerPlugins` 并传给 miniprogram-ci。

## 备注

- 所有脚本保持机器无关：机器相关配置（appid、密钥路径、代码目录）全部放在 `ci.config.json` / `.minicirc` 中，脚本内不写死任何路径
- `package.json` 的 `scripts` 只合并、不覆盖已有条目
- `.minicirc`、`ci.config.json` 与私钥文件属于敏感信息，建议加入 `.gitignore`；`qrcodes/` 也建议忽略
