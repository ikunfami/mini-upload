// 加载 ci.config.json 并创建 miniprogram-ci Project 实例（upload.ts / preview.ts 共用）
// 由 tsx 运行（npm i -D tsx），不做类型检查，类型标注仅为阅读辅助
import path from 'node:path'
import fs from 'node:fs'
import * as ciModule from 'miniprogram-ci'

// miniprogram-ci 是 CJS 包，默认导出在 tsx/esbuild 互操作下可能取不到，做兜底
const ci: any = (ciModule as any).default || ciModule

// npm scripts 始终在项目根目录运行，用 cwd 作为项目根；
// 不用 import.meta/__dirname，避免小程序项目 tsconfig（module: commonjs）下的类型报错
const ROOT = process.cwd()

export function loadConfig() {
  const configPath = path.join(ROOT, 'ci.config.json')
  if (!fs.existsSync(configPath)) {
    console.error('[mini-ci] 未找到 ci.config.json，请在项目根目录运行，或先按模板创建并配置 appid / privateKeyPath / projectPath')
    process.exit(1)
  }

  let config: any
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch (err: any) {
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

export function createProject(config: any) {
  return new ci.Project({
    appid: config.appid,
    type: config.type || 'miniProgram',
    projectPath: config.projectPath,
    privateKeyPath: config.privateKeyPath,
    ignores: config.ignores || ['node_modules/**/*'],
  })
}

// 解析编译设置：ci.config.json 的 setting 优先，
// 否则自动探测 project.config.json 的 useCompilerPlugins（如 ["typescript", "less"]），
// 保证 miniprogram-ci 启用与开发者工具一致的编译插件。
// 注意：useCompilerPlugins 可能位于 project.config.json 顶层，也可能嵌套在 setting 字段内，两者都要查
export function resolveSetting(config: any) {
  // 仅当 setting 非空对象时短路；空对象（{}）视为未配置，继续自动探测
  if (config.setting && typeof config.setting === 'object' && Object.keys(config.setting).length > 0) {
    return config.setting
  }

  const candidates = [
    path.join(config.projectPath, 'project.config.json'),
    path.join(ROOT, 'project.config.json'),
  ]
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue
    try {
      const projectConfig = JSON.parse(fs.readFileSync(file, 'utf8'))
      const plugins = Array.isArray(projectConfig.useCompilerPlugins)
        ? projectConfig.useCompilerPlugins
        : projectConfig.setting && projectConfig.setting.useCompilerPlugins
      if (Array.isArray(plugins) && plugins.length > 0) {
        console.log(`[mini-ci] 检测到编译插件: ${plugins.join(', ')}（来自 ${path.relative(ROOT, file)}）`)
        return { useCompilerPlugins: plugins }
      }
    } catch (err: any) {
      console.error(`[mini-ci] ${path.relative(ROOT, file)} 解析失败（忽略，继续）:`, err.message)
    }
  }
  return {}
}

export { ROOT, ci }
