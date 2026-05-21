# 技术栈

## 核心技术
- **语言**: TypeScript 5.9+
- **运行时**: Node.js
- **平台**: VSCode Extension API (^1.103.0)
- **模块系统**: CommonJS
- **编译目标**: ES2020

## 主要依赖
- `@aws-sdk/client-s3`: AWS S3 文件上传
- `@aws-sdk/client-identitystore`: AWS Identity Store 用户查询
- `diff`: 文本差异计算（用于 strReplace 行数统计）

## 开发依赖
- `typescript`: TypeScript 编译器
- `@types/vscode`: VSCode API 类型定义
- `@types/node`: Node.js 类型定义
- `@vscode/test-cli` / `@vscode/test-electron`: 扩展测试框架

## 常用命令

```bash
# 安装依赖
npm install

# 编译 TypeScript
npm run compile

# 监听模式编译
npm run watch

# 打包发布
npm run vscode:prepublish
```

## 调试方式
按 `F5` 启动 Extension Development Host 窗口进行调试测试。

## 编译配置
- 严格模式 (`strict: true`)
- 源码目录: `src/`
- 输出目录: `out/`
- 生成 Source Map
