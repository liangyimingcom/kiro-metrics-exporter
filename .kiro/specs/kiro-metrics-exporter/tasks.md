# Implementation Plan: Kiro Metrics Exporter

## Overview

本实现计划基于现有代码库，主要任务是添加测试覆盖和验证现有实现的正确性。核心功能已经实现完成，重点放在属性测试和单元测试上，确保代码符合设计文档中定义的正确性属性。

## 实现状态

以下核心模块已完成实现：
- ✅ extension.ts - 扩展入口，注册命令和视图
- ✅ types.ts - TypeScript 类型定义
- ✅ extractor.ts - 日志解析、行数计算、数据聚合
- ✅ metricsService.ts - AWS 服务交互、CSV 生成、S3 上传、用户身份解析、S3 权限检查
- ✅ metricsExporterProvider.ts - TreeView 配置面板（四步骤分组）
- ✅ logger.ts - 操作日志记录，按日期分文件存储
- ✅ package.json - 配置项定义（带 Step 标识和 order 排序）

## 版本更新记录

### v1.1.0 - v1.1.4 已完成功能
- ✅ Logger 模块实现（按日期分文件记录）
- ✅ Step 4: Logs & Settings（Open Log File、Open Log Folder、Open Settings）
- ✅ TreeView 顶部显示扩展版本信息
- ✅ 上传操作详细日志记录（扫描、过滤、上传进度）
- ✅ 日志文件存储路径：~/.kiro-metrics-exporter/logs/

### v1.0.1 - v1.0.6 已完成功能
- ✅ 侧边栏独立图标入口（viewsContainers.activitybar）
- ✅ 配置面板三步骤分组（Step 1/2/3）
- ✅ Username 与 User ID 分离，支持手动触发解析
- ✅ Display Name 自动解析（DescribeUser API）
- ✅ 解析失败时清空 User ID 和 Display Name
- ✅ Settings 页面配置项排序（order 属性）
- ✅ Settings 页面可点击链接（markdownDescription）
- ✅ S3 权限检查功能（checkS3WritePermission）
- ✅ 配置变更自动解析（onDidChangeConfiguration 监听）

## Tasks

- [x] 1. 侧边栏独立图标入口
  - 添加 viewsContainers.activitybar 配置
  - 将 views 注册到自定义容器
  - _Requirements: 1.1_

- [x] 2. 配置面板三步骤分组
  - 修改 TreeView 结构为三级：Step 1/2/3 → 配置项
  - Step 1: AWS Credentials
  - Step 2: User Identity
  - Step 3: S3 Configuration
  - _Requirements: 1.2_

- [x] 3. 用户身份解析优化
  - [ ] 3.1 分离 Username 输入和 User ID 解析
    - 添加 setUsername 命令（仅保存）
    - 添加 resolveUserId 命令（触发解析）
    - _Requirements: 1.8, 1.9_

  - [ ] 3.2 添加 Display Name 解析
    - 修改 getUserIdByUsername 为 getUserInfoByUsername
    - 调用 DescribeUser API 获取 DisplayName
    - 添加 displayName 配置项
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ] 3.3 解析失败时清空用户信息
    - 捕获解析错误后清空 userId 和 displayName
    - 显示具体错误信息
    - _Requirements: 8.4, 8.8_

- [x] 4. Settings 页面优化
  - [ ] 4.1 配置项排序
    - 添加 order 属性到所有配置项
    - 按 Step 1 → Step 2 → Step 3 顺序排列
    - _Requirements: 1.13_

  - [ ] 4.2 添加可点击链接
    - Username: "click here to resolve User ID & Display Name"
    - S3 Prefix: "click here to check S3 write permission"
    - _Requirements: 1.14, 11.8_

- [x] 5. S3 权限检查功能
  - [ ] 5.1 实现 checkS3WritePermission 方法
    - 上传测试文件验证写入权限
    - 成功后删除测试文件
    - _Requirements: 11.1, 11.7_

  - [ ] 5.2 错误处理
    - AccessDenied → 权限不足提示
    - NoSuchBucket → 存储桶不存在提示
    - InvalidAccessKeyId → Access Key 无效提示
    - SignatureDoesNotMatch → Secret Key 无效提示
    - _Requirements: 11.3, 11.4, 11.5, 11.6_

- [x] 6. 配置变更自动解析
  - 添加 onDidChangeConfiguration 监听器
  - Username 变更时自动触发解析（如果前置条件满足）
  - _Requirements: 8.6_

- [x] 6.5. Logger 模块实现
  - 实现 Logger 单例类
  - 按日期分文件存储日志（~/.kiro-metrics-exporter/logs/）
  - 支持 INFO/WARN/ERROR 日志级别
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 6.6. Step 4: Logs & Settings
  - 添加 Open Log File 命令和 TreeView 项
  - 添加 Open Log Folder 命令和 TreeView 项
  - 添加 Open Settings 命令和 TreeView 项
  - _Requirements: 12.5, 12.6, 12.7_

- [x] 6.7. 上传操作日志记录
  - 记录操作开始/结束标记
  - 记录用户信息和 S3 配置
  - 记录扫描、过滤、上传进度
  - 记录操作耗时统计
  - _Requirements: 12.8, 12.9, 12.10_

- [x] 6.8. TreeView 版本信息显示
  - 在 TreeView 顶部显示扩展版本号
  - 格式：📊 Kiro Metrics Exporter vX.X.X
  - _Requirements: 1.3_

- [ ] 7. 设置测试框架
  - 安装 Mocha、Chai 和 fast-check 依赖
  - 配置 TypeScript 测试环境
  - 创建测试目录结构 `src/test/`
  - 添加测试脚本到 package.json
  - _Requirements: 测试策略_

- [ ] 8. Extractor 模块测试
  - [ ] 8.1 实现 countLines 函数的单元测试
    - 测试空字符串、单行、多行文本
    - 测试包含空白行的文本
    - _Requirements: 3.1, 3.4_

  - [ ]* 8.2 编写 countLines 属性测试
    - **Property 5: 行数计算一致性**
    - **Validates: Requirements 3.1**

  - [ ] 8.3 实现 calculateStrReplaceLines 函数的单元测试
    - 测试相同字符串、完全不同字符串
    - 测试添加行、删除行、修改行的场景
    - _Requirements: 3.2, 3.3_

  - [ ]* 8.4 编写 calculateStrReplaceLines 属性测试
    - **Property 6: strReplace Diff 计算**
    - **Validates: Requirements 3.2, 3.3**

  - [ ] 8.5 实现 processExecutionLog 函数的单元测试
    - 测试有效 JSON 解析
    - 测试无效 JSON 处理
    - 测试去重逻辑
    - _Requirements: 2.2, 2.4, 2.5, 2.6_

  - [ ]* 8.6 编写执行 ID 去重属性测试
    - **Property 3: 执行 ID 去重**
    - **Validates: Requirements 2.4**

  - [ ]* 8.7 编写工具使用 ID 去重属性测试
    - **Property 4: 工具使用 ID 去重**
    - **Validates: Requirements 2.5**

- [ ] 9. 检查点 - 确保 Extractor 测试通过
  - 确保所有测试通过，如有问题请询问用户

- [ ] 10. 数据聚合测试
  - [ ] 10.1 实现 aggregateByDate 函数的单元测试
    - 测试单日数据聚合
    - 测试多日数据聚合
    - 测试空数据集
    - _Requirements: 4.1, 4.3_

  - [ ]* 10.2 编写日期聚合属性测试
    - **Property 8: 日期聚合完整性**
    - **Validates: Requirements 4.1, 4.3**

  - [ ] 10.3 实现 aggregateByMonth 函数的单元测试
    - 测试单月数据聚合
    - 测试跨月数据聚合
    - 测试 activeDays 计算
    - _Requirements: 4.2, 4.4_

  - [ ]* 10.4 编写月份聚合属性测试
    - **Property 9: 月份聚合完整性**
    - **Validates: Requirements 4.2, 4.4**

  - [ ]* 10.5 编写净行数计算属性测试
    - **Property 7: 净行数计算公式**
    - **Validates: Requirements 3.5**

- [ ] 11. 检查点 - 确保聚合测试通过
  - 确保所有测试通过，如有问题请询问用户

- [ ] 12. MetricsService 测试
  - [ ] 12.1 实现日期范围过滤的单元测试
    - 测试 lastWeek 过滤（T-7 到 T-1）
    - 测试 allTillYesterday 过滤
    - 测试边界日期处理
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 12.2 编写日期范围过滤属性测试
    - **Property 10: 日期范围过滤**
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [ ] 12.3 实现 CSV 生成的单元测试
    - 测试 CSV 列结构
    - 测试日期格式转换
    - 测试字段映射
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 12.4 编写 CSV 日期格式转换属性测试
    - **Property 11: CSV 日期格式转换**
    - **Validates: Requirements 6.2**

  - [ ]* 12.5 编写 CSV 字段映射属性测试
    - **Property 12: CSV 字段映射**
    - **Validates: Requirements 6.3, 6.4**

  - [ ] 12.6 实现 S3 路径生成的单元测试
    - 测试路径格式正确性
    - 测试不同日期的路径生成
    - 测试无效前缀处理
    - _Requirements: 7.1_

  - [ ]* 12.7 编写 S3 路径生成属性测试
    - **Property 13: S3 路径生成**
    - **Validates: Requirements 7.1**

  - [ ]* 12.8 编写 S3 上传幂等性属性测试
    - **Property 14: S3 上传幂等性**
    - **Validates: Requirements 7.6**

  - [ ] 12.9 实现用户身份解析的单元测试
    - 测试成功解析返回 UserInfo
    - 测试用户不存在时的错误处理
    - 测试凭证无效时的错误处理
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 12.10 编写用户身份解析属性测试
    - **Property 16: 用户身份解析完整性**
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [ ]* 12.11 编写解析失败清空属性测试
    - **Property 17: 解析失败时清空用户信息**
    - **Validates: Requirements 8.4, 8.8**

- [ ] 13. 检查点 - 确保 MetricsService 测试通过
  - 确保所有测试通过，如有问题请询问用户

- [ ] 14. 配置验证测试
  - [ ] 14.1 实现 S3 前缀验证的单元测试
    - 测试有效前缀（以 s3:// 开头）
    - 测试无效前缀
    - _Requirements: 1.5_

  - [ ]* 14.2 编写 S3 前缀验证属性测试
    - **Property 1: S3 前缀验证**
    - **Validates: Requirements 1.5**

  - [ ] 14.3 实现敏感值掩码的单元测试
    - 测试长字符串掩码
    - 测试短字符串处理
    - _Requirements: 1.12_

  - [ ]* 14.4 编写敏感值掩码属性测试
    - **Property 2: 敏感值掩码**
    - **Validates: Requirements 1.12**

  - [ ] 14.5 实现配置完整性验证的单元测试
    - 测试所有配置项存在时的行为
    - 测试各配置项缺失时的行为
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 14.6 编写配置验证完整性属性测试
    - **Property 15: 配置验证完整性**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**

  - [ ] 14.7 实现 S3 权限检查的单元测试
    - 测试成功上传测试文件
    - 测试各种错误场景的处理
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [ ]* 14.8 编写 S3 权限检查属性测试
    - **Property 18: S3 权限检查结果一致性**
    - **Validates: Requirements 11.2, 11.3, 11.4, 11.5, 11.6**

- [ ] 15. 最终检查点 - 确保所有测试通过
  - 运行完整测试套件
  - 确保所有测试通过，如有问题请询问用户

## Notes

- 标记为 `*` 的任务是可选的属性测试任务，可以跳过以加快 MVP 开发
- 标记为 `[x]` 的任务已在 v1.0.1 - v1.1.4 版本中完成实现
- 每个任务都引用了具体的需求以确保可追溯性
- 检查点确保增量验证
- 属性测试验证通用的正确性属性
- 单元测试验证具体的示例和边界情况
- 测试框架使用 Mocha + Chai + fast-check
- 核心功能代码已全部实现，当前任务聚焦于测试覆盖
- Logger 模块已实现，支持操作日志记录和查看
