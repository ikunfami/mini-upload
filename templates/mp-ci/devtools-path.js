// 解析微信开发者工具安装目录
// 优先级：环境变量 WX_DEVTOOLS_DIR > 常见安装路径自动探测
const fs = require('fs')
const path = require('path')

const CANDIDATES = [
  'C:\\Program Files (x86)\\Tencent\\微信web开发者工具',
  'C:\\Program Files\\Tencent\\微信web开发者工具',
  'D:\\Program Files (x86)\\Tencent\\微信web开发者工具',
  'D:\\Program Files\\Tencent\\微信web开发者工具',
]

function resolveDevtoolsDir() {
  const candidates = []
  if (process.env.WX_DEVTOOLS_DIR) {
    candidates.push(process.env.WX_DEVTOOLS_DIR)
  }
  candidates.push(...CANDIDATES)

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'cli.js'))) {
      return dir
    }
  }
  return null
}

module.exports = { resolveDevtoolsDir }
