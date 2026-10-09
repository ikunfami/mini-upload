// 上传小程序代码到微信后台（调用微信开发者工具 CLI，由开发者工具完成 TS/Sass 编译）
// 用法: node scripts/upload.js [版本号] [备注]
//   node scripts/upload.js 1.2.3 修复已知问题   -> 版本 1.2.3，备注「修复已知问题」
//   node scripts/upload.js 修复已知问题          -> 版本取 package.json 的 version，备注「修复已知问题」
//   node scripts/upload.js                       -> 版本取 package.json 的 version，备注 ci upload v<版本>
// 前置条件:
//   1. 开发者工具「设置 → 安全设置 → 服务端口」已开启
//   2. 开发者工具已登录（CLI 会使用当前登录账号的权限）
//   3. 小程序后台「开发管理 → 开发工具」已开启代码上传，且本机 IP 在白名单内（如开启白名单）
const path = require('path')
const { spawnSync } = require('child_process')
const { resolveDevtoolsDir } = require('./devtools-path')

const ROOT = path.resolve(__dirname, '..')
const pkg = require(path.join(ROOT, 'package.json'))

const DEVTOOLS = resolveDevtoolsDir()
if (!DEVTOOLS) {
  console.error('[upload] 未找到微信开发者工具，请设置环境变量 WX_DEVTOOLS_DIR 指向其安装目录')
  process.exit(1)
}

const args = process.argv.slice(2)
const VERSION_RE = /^\d+\.\d+\.\d+(\.\d+)?$/

let version = pkg.version
let desc = `ci upload v${version}`

if (args[0]) {
  if (VERSION_RE.test(args[0])) {
    version = args[0]
    desc = args[1] || `ci upload v${version}`
  } else {
    // 第一个参数不是版本号，则整体视为备注
    desc = args.join(' ')
  }
}

console.log(`[upload] version=${version} desc=${desc}`)

const result = spawnSync(
  path.join(DEVTOOLS, 'node.exe'),
  [
    path.join(DEVTOOLS, 'cli.js'),
    'upload',
    '--project', ROOT,
    '-v', version,
    '-d', desc,
  ],
  { stdio: 'inherit' }
)

if (result.error) {
  console.error('[upload] 无法启动开发者工具 CLI:', result.error.message)
  process.exit(1)
}
process.exit(result.status === null ? 1 : result.status)
