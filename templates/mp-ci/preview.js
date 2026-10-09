// 生成体验版预览二维码（miniprogram-ci SDK，无需开发者工具 / 服务端口）
// 用法: node scripts/preview.js
// 二维码统一输出到项目根目录 qrcodes/ 文件夹，按时间戳命名，历史记录互不覆盖
// 前置条件同 upload.js：ci.config.json 已配置、上传密钥已就位
const path = require('path')
const fs = require('fs')
const { ROOT, ci, loadConfig, createProject, resolveSetting } = require('./ci-project')

const config = loadConfig()

const QR_DIR = path.join(ROOT, 'qrcodes')
fs.mkdirSync(QR_DIR, { recursive: true })

const now = new Date()
const pad = (n) => String(n).padStart(2, '0')
const stamp =
  `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
  `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
const QR_PATH = path.join(QR_DIR, `preview-${stamp}.jpg`)

async function main() {
  const project = createProject(config)
  await ci.preview({ project, setting: resolveSetting(config), qrcodeFormat: 'image', qrcodeOutputDest: QR_PATH })
  console.log(`[preview] 二维码已生成: ${path.relative(ROOT, QR_PATH)}`)
}

main().catch((err) => {
  console.error('[preview] 生成预览失败:', err.message || err)
  process.exit(1)
})
