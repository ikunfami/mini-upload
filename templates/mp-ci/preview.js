// 生成体验版预览二维码（调用微信开发者工具 CLI）
// 用法: node scripts/preview.js
// 前置条件同 upload.js：服务端口已开启、已登录
// 二维码统一输出到项目根目录 qrcodes/ 文件夹，按时间戳命名，历史记录互不覆盖
const path = require('path')
const fs = require('fs')
const { spawnSync } = require('child_process')
const { resolveDevtoolsDir } = require('./devtools-path')

const ROOT = path.resolve(__dirname, '..')
const DEVTOOLS = resolveDevtoolsDir()
if (!DEVTOOLS) {
  console.error('[preview] 未找到微信开发者工具，请设置环境变量 WX_DEVTOOLS_DIR 指向其安装目录')
  process.exit(1)
}

const QR_DIR = path.join(ROOT, 'qrcodes')
fs.mkdirSync(QR_DIR, { recursive: true })

const now = new Date()
const pad = (n) => String(n).padStart(2, '0')
const stamp =
  `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
  `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
const QR_PATH = path.join(QR_DIR, `preview-${stamp}.jpg`)

const result = spawnSync(
  path.join(DEVTOOLS, 'node.exe'),
  [
    path.join(DEVTOOLS, 'cli.js'),
    'preview',
    '--project', ROOT,
    '-f', 'image',
    '-o', QR_PATH,
  ],
  { stdio: 'inherit' }
)

if (result.error) {
  console.error('[preview] 无法启动开发者工具 CLI:', result.error.message)
  process.exit(1)
}
if (result.status === 0) {
  console.log(`[preview] 二维码已生成: ${path.relative(ROOT, QR_PATH)}`)
}
process.exit(result.status === null ? 1 : result.status)
