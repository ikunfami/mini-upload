// 加载 ci.config.json 并创建 miniprogram-ci Project 实例（upload.js / preview.js 共用）
const path = require('path')
const fs = require('fs')
const ci = require('miniprogram-ci')
const ROOT = path.resolve(__dirname, '..')

function loadConfig() {
  const configPath = path.join(ROOT, 'ci.config.json')
  if (!fs.existsSync(configPath)) {
    console.error('[mini-ci] 未找到 ci.config.json，请先按模板创建并配置 appid / privateKeyPath / projectPath')
    process.exit(1)
  }

  let config
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch (err) {
    console.error('[mini-ci] ci.config.json 解析失败:', err.message)
    process.exit(1)
  }

  for (const field of ['appid', 'privateKeyPath', 'projectPath']) {
    if (!config[field] || String(config[field]).includes('你的')) {
      console.error(`[mini-ci] ci.config.json 的 ${field} 尚未配置（仍是占位符）`)
      process.exit(1)
    }
  }

  config.projectPath = path.resolve(ROOT, config.projectPath)
  config.privateKeyPath = path.resolve(ROOT, config.privateKeyPath)

  if (!fs.existsSync(config.projectPath)) {
    console.error(`[mini-ci] 小程序代码目录不存在: ${config.projectPath}`)
    process.exit(1)
  }
  if (!fs.existsSync(config.privateKeyPath)) {
    console.error(`[mini-ci] 未找到上传密钥文件: ${config.privateKeyPath}`)
    console.error('[mini-ci] 请前往 https://mp.weixin.qq.com/ -> 管理/开发管理/小程序代码上传/小程序代码上传密钥 下载，放到项目根目录后修改 ci.config.json 的 privateKeyPath')
    process.exit(1)
  }

  return config
}

function createProject(config) {
  return new ci.Project({
    appid: config.appid,
    type: config.type || 'miniProgram',
    projectPath: config.projectPath,
    privateKeyPath: config.privateKeyPath,
    ignores: config.ignores || ['node_modules/**/*'],
  })
}

module.exports = { ROOT, ci, loadConfig, createProject }
