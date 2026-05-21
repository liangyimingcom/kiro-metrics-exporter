# 项目结构

```
kiro-metrics-exporter/
├── src/                          # 源代码目录
│   ├── extension.ts              # 扩展入口，激活/停用逻辑
│   ├── types.ts                  # TypeScript 类型定义
│   ├── extractor.ts              # 指标提取核心逻辑
│   ├── metricsService.ts         # AWS 服务交互、命令注册
│   └── metricsExporterProvider.ts # TreeView UI 提供者
├── out/                          # 编译输出目录
├── package.json                  # 扩展清单和配置
├── tsconfig.json                 # TypeScript 配置
└── README.md                     # 使用文档
```

## 模块职责

| 文件 | 职责 |
|------|------|
| `extension.ts` | 扩展生命周期管理，注册 Provider 和命令 |
| `types.ts` | 所有数据结构的类型定义 |
| `extractor.ts` | 扫描 Kiro agent 目录，解析执行日志，计算统计数据 |
| `metricsService.ts` | AWS 凭证管理、S3 上传、Identity Store 查询、命令实现 |
| `metricsExporterProvider.ts` | Explorer 侧边栏 TreeView 配置界面 |

## 数据流
1. `extractor.ts` 扫描本地 Kiro agent 目录
2. 解析 JSON 执行日志，提取 `fsWrite`/`strReplace` 操作
3. 聚合为日/月统计数据
4. `metricsService.ts` 转换为 CSV 并上传到 S3

## Kiro Agent 数据路径
- Windows: `%APPDATA%\Kiro\User\globalStorage\kiro.kiroagent`
- macOS: `~/Library/Application Support/Kiro/User/globalStorage/kiro.kiroagent`
- Linux: `~/.config/Kiro/User/globalStorage/kiro.kiroagent`
