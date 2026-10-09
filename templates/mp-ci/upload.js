// 上传小程序代码到微信后台（miniprogram-ci SDK 无头上传，无需开发者工具 / 服务端口）
// 用法: node mini-scripts/upload.js [版本号] [备注]
//   node mini-scripts/upload.js 1.2.3 修复已知问题   -> 版本 1.2.3，备注「修复已知问题」
//   node mini-scripts/upload.js 修复已知问题          -> 版本取 ci.config.json 的 version，备注「修复已知问题」
//   node mini-scripts/upload.js                       -> 版本/备注取 ci.config.json 中的配置
// 前置条件:
//   1. ci.config.json 已配置 appid / privateKeyPath / projectPath
//   2. 上传密钥已从 https://mp.weixin.qq.com/ 小程序后台下载并放到项目根目录
//   3. 小程序后台「开发管理 → 开发工具」已开启代码上传，且本机 IP 在白名单内（如开启白名单）
const { ROOT, ci, loadConfig, createProject, resolveSetting } = require('./ci-project')

const pkg = require(require('path').join(ROOT, 'package.json'))
const config = loadConfig()

const args = process.argv.slice(2)
const VERSION_RE = /^\d+\.\d+\.\d+(\.\d+)?$/

let version = config.version || pkg.version
let desc = config.desc || `ci upload v${version}`

if (args[0]) {
  if (VERSION_RE.test(args[0])) {
    version = args[0]
    desc = args.slice(1).join(' ') || `ci upload v${version}`
  } else {
    // 第一个参数不是版本号，则整体视为备注
    desc = args.join(' ')
  }
}

async function main() {
  const project = createProject(config)
  console.log(`[upload] appid=${config.appid} version=${version} desc=${desc}`)
  const result = await ci.upload({ project, version, desc, setting: resolveSetting(config) })
  console.log('[upload] 上传成功:', JSON.stringify(result))
}

main().catch((err) => {
  console.error('[upload] 上传失败:', err.message || err)
  process.exit(1)
})
