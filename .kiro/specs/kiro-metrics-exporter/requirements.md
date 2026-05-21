# 需求文档

## 简介

Kiro Metrics Exporter 是一个 VSCode 扩展，用于收集 Kiro IDE 的代码生成使用指标，并将其导出到 AWS S3。该扩展扫描本地 Kiro agent 目录，提取代码生成统计数据（包括新建文件行数、修改行数等），按日期聚合后以 CSV 格式上传到指定的 S3 存储桶。

## 术语表

- **Metrics_Exporter**: 指标导出器，负责收集、处理和上传 Kiro IDE 使用指标的核心系统
- **Execution_Log**: 执行日志，Kiro IDE 生成的 JSON 格式日志文件，记录每次代码生成操作的详细信息
- **Daily_Stats**: 日统计数据，按日期聚合的代码生成指标
- **S3_Uploader**: S3 上传器，负责将 CSV 格式的指标数据上传到 AWS S3
- **Identity_Store_Client**: AWS Identity Store 客户端，用于通过用户名解析 AWS User ID 和 Display Name
- **Config_Panel**: 配置面板，VSCode 侧边栏中的树形视图，用于管理 AWS 配置，分为三个步骤
- **fsWrite_Operation**: 文件写入操作，创建新文件时记录的操作类型
- **strReplace_Operation**: 字符串替换操作，修改现有文件时记录的操作类型
- **Net_Lines**: 净增代码行数，计算公式为 fsWriteLines + strReplaceAdded - strReplaceDeleted
- **User_Info**: 用户信息，包含 userId 和 displayName 两个字段
- **Logger**: 日志记录器，负责将操作日志写入本地文件，按日期分文件存储
- **Log_File**: 日志文件，存储在 ~/.kiro-metrics-exporter/logs/ 目录下，文件名格式为 metrics-exporter-YYYY-MM-DD.log

## 需求

### 需求 1: AWS 配置管理

**用户故事:** 作为用户，我希望通过可视化面板配置 AWS 凭证和设置，以便安全地建立与 AWS 服务的连接。

#### 验收标准

1. 当扩展激活时，Config_Panel 应在侧边栏显示独立的 "Metrics Exporter" 图标入口
2. Config_Panel 应分为四个步骤组织配置项：
   - Step 1: AWS Credentials（Access Key、Secret Key、Identity Store ID、Identity Store Region）
   - Step 2: User Identity（Username、User ID、Display Name）
   - Step 3: S3 Configuration（S3 Prefix、S3 Region）
   - Step 4: Logs & Settings（Open Log File、Open Log Folder、Open Settings）
3. Config_Panel 顶部应显示扩展版本信息（格式：📊 Kiro Metrics Exporter vX.X.X）
3. 当用户点击"Access Key"项时，Metrics_Exporter 应提示输入并安全存储该值
4. 当用户点击"Secret Key"项时，Metrics_Exporter 应提示密码输入并安全存储该值
5. 当用户点击"S3 Prefix"项时，Metrics_Exporter 应验证输入以"s3://"开头并存储该值
6. 当用户点击"S3 Region"项时，Metrics_Exporter 应提示输入 AWS 区域并存储该值（默认 us-east-1）
7. 当用户点击"Identity Store Region"项时，Metrics_Exporter 应提示输入 AWS 区域并存储该值（默认 us-east-1）
8. 当用户点击"Username"项时，Metrics_Exporter 应提示输入用户名并存储该值
9. 当用户点击"Resolve User ID & Display Name"按钮时，Metrics_Exporter 应通过 Identity_Store_Client 解析 Username 为 User ID 和 Display Name
10. 当用户点击"Identity Store ID"项时，Metrics_Exporter 应提示输入 Identity Store ID 并存储该值
11. 当任何配置值更新时，Config_Panel 应刷新以显示新值
12. 当显示敏感值（Access Key、Secret Key）时，Config_Panel 应掩码除最后 4 个字符外的所有字符
13. Settings 页面的配置项应按步骤顺序排列，并带有 [Step N] 前缀标识
14. Username 配置项应包含可点击的链接 "click here to resolve User ID & Display Name"

### 需求 2: 执行日志扫描与解析

**用户故事:** 作为用户，我希望扩展能够扫描和解析 Kiro 执行日志，以便提取代码生成指标。

#### 验收标准

1. 当扫描 kiro.kiroagent 目录时，Metrics_Exporter 应定位所有包含执行日志的会话文件夹
2. 当解析执行日志文件时，Metrics_Exporter 应提取 executionId、startTime、endTime、status 和 workflowType
3. 当处理工具使用时，Metrics_Exporter 应从 actions 和 context.messages 中识别 fsWrite 和 strReplace 操作
4. 当遇到重复的 executionId 时，Metrics_Exporter 应跳过已处理的执行
5. 当遇到重复的工具使用 ID 时，Metrics_Exporter 应跳过已处理的工具使用
6. 当日志文件是无效 JSON 时，Metrics_Exporter 应跳过该文件并继续处理
7. Metrics_Exporter 应支持平台特定路径：Windows（%APPDATA%）、macOS（~/Library/Application Support）和 Linux（~/.config）

### 需求 3: 代码行数计算

**用户故事:** 作为用户，我希望准确计算生成的代码行数，以便跟踪 AI 辅助代码生成指标。

#### 验收标准

1. 当处理 fsWrite 操作时，Metrics_Exporter 应计算文本内容的行数
2. 当处理 strReplace 操作时，Metrics_Exporter 应使用 diff 算法计算新增和删除的行数
3. 当计算 strReplace diff 时，Metrics_Exporter 应使用与统一 diff 格式一致的逐行比较
4. 当文本为空或 null 时，Metrics_Exporter 应返回 0 作为行数
5. Metrics_Exporter 应按公式计算 Net_Lines：fsWriteLines + strReplaceAdded - strReplaceDeleted

### 需求 4: 数据聚合

**用户故事:** 作为用户，我希望指标按日期和月份聚合，以便分析一段时间内的使用模式。

#### 验收标准

1. 当按日期聚合时，Metrics_Exporter 应按本地日期（YYYY-MM-DD 格式）分组执行结果
2. 当按月份聚合时，Metrics_Exporter 应按本地月份（YYYY-MM 格式）分组执行结果
3. 对于每个日聚合，Metrics_Exporter 应汇总 fsWriteLines、strReplaceAdded、strReplaceDeleted、executionCount、filesCreated 和 filesModified
4. 对于每个月聚合，Metrics_Exporter 应额外计算 netLines 和 activeDays 计数
5. 当生成摘要时，Metrics_Exporter 应计算所有执行的总计

### 需求 5: 时间过滤导出

**用户故事:** 作为用户，我希望导出特定时间范围的指标，以便上传最近数据而不重复历史上传。

#### 验收标准

1. 当用户点击"Upload Last 7 Days"时，Metrics_Exporter 应过滤 T-7 到 T-1（昨天）的数据
2. 当用户点击"Upload All Till Yesterday"时，Metrics_Exporter 应过滤所有可用数据直到 T-1
3. 当按日期范围过滤时，Metrics_Exporter 应包含日期在范围内（含边界）的数据
4. 如果过滤范围内没有数据，则 Metrics_Exporter 应显示警告消息且不继续上传

### 需求 6: CSV 生成

**用户故事:** 作为用户，我希望指标以 CSV 格式导出，以便数据与现有分析系统兼容。

#### 验收标准

1. 当生成 CSV 时，Metrics_Exporter 应包含所有必需列：UserId、Date、Chat_AICodeLines、Chat_MessagesSent 和其他分析列
2. 当在 CSV 中格式化日期时，Metrics_Exporter 应使用 MM-DD-YYYY 格式
3. 当填充 Chat_AICodeLines 时，Metrics_Exporter 应使用 Net_Lines 计算值
4. 当填充 Chat_MessagesSent 时，Metrics_Exporter 应使用 executionCount 值
5. 对于没有数据的列，Metrics_Exporter 应将值设为 0

### 需求 7: S3 上传

**用户故事:** 作为用户，我希望指标上传到 AWS S3，以便数据集中存储用于分析。

#### 验收标准

1. 当上传到 S3 时，S3_Uploader 应生成遵循模式的路径：{prefix}/{year}/{month}/{day}/00/kiro-ide-{userid}.csv
2. 当上传时，S3_Uploader 应将 ContentType 设置为"text/csv"
3. 当上传时，S3_Uploader 应包含元数据：export-time、date、user-id、filter-type
4. 如果 S3 上传失败，则 Metrics_Exporter 应显示包含失败原因的错误消息
5. 当上传成功时，Metrics_Exporter 应显示包含 S3 路径的成功消息
6. S3_Uploader 应执行幂等上传（相同日期/用户组合使用相同路径）

### 需求 8: 用户身份解析

**用户故事:** 作为用户，我希望输入用户名并将其解析为 AWS User ID 和 Display Name，以便无需手动查找用户信息。

#### 验收标准

1. 当用户点击"Resolve User ID & Display Name"时，Identity_Store_Client 应使用用户名调用 GetUserId API 获取 User ID
2. 当获取到 User ID 后，Identity_Store_Client 应调用 DescribeUser API 获取 Display Name
3. 当找到用户时，Metrics_Exporter 应将解析的 User ID 和 Display Name 存储在配置中
4. 如果未找到用户，则 Metrics_Exporter 应显示指示用户未找到的错误消息，并清空 User ID 和 Display Name
5. 如果 Identity Store 凭证无效，则 Metrics_Exporter 应显示适当的错误消息
6. 当 Username 在 Settings 页面变更时，如果所有前置条件满足，应自动触发解析
7. 解析成功时应显示 "✅ Resolved - User ID: xxx, Display Name: xxx"
8. 解析失败时应显示 "❌ Failed to resolve: 具体错误原因" 并清空已有的 User ID 和 Display Name

### 需求 9: 配置验证

**用户故事:** 作为用户，我希望系统在导出前验证配置，以便在上传过程中不会遇到错误。

#### 验收标准

1. 当启动导出时，Metrics_Exporter 应验证 Access Key 已配置
2. 当启动导出时，Metrics_Exporter 应验证 Secret Key 已配置
3. 当启动导出时，Metrics_Exporter 应验证 S3 Prefix 已配置
4. 当启动导出时，Metrics_Exporter 应验证 User ID 已配置
5. 当启动导出时，Metrics_Exporter 应验证 Identity Store ID 已配置
6. 如果缺少任何必需配置，则 Metrics_Exporter 应显示具体错误消息并中止导出

### 需求 10: 报告生成

**用户故事:** 作为用户，我希望看到指标的摘要报告，以便了解我的代码生成活动。

#### 验收标准

1. 当导出完成时，Metrics_Exporter 应在输出通道生成文本报告
2. 报告应包含总体统计：totalExecutions、totalFsWriteLines、totalStrReplaceAdded、totalStrReplaceDeleted、netLines
3. 报告应包含月度明细，列包括：month、fsWriteLines、strReplaceAdded、strReplaceDeleted、netLines、executionCount
4. 报告应包含日期明细，列包括：date、fsWriteLines、strReplaceAdded、strReplaceDeleted、executionCount
5. 如果未找到记录，则 Metrics_Exporter 应显示"没有找到任何代码生成记录。"

### 需求 11: S3 权限检查

**用户故事:** 作为用户，我希望在配置 S3 后能够验证写入权限，以便在导出前确认配置正确。

#### 验收标准

1. 当用户点击"Check S3 Write Permission"按钮时，Metrics_Exporter 应尝试上传测试文件到配置的 S3 路径
2. 如果上传成功，Metrics_Exporter 应显示 "✅ S3 write permission confirmed! Bucket: xxx, Path: xxx/"
3. 如果权限不足（AccessDenied），Metrics_Exporter 应显示 "❌ No write permission to S3 bucket: xxx. Please check IAM policy."
4. 如果存储桶不存在（NoSuchBucket），Metrics_Exporter 应显示 "❌ S3 bucket not found: xxx. Please check bucket name."
5. 如果 Access Key 无效，Metrics_Exporter 应显示 "❌ Invalid AWS Access Key. Please check your credentials."
6. 如果 Secret Key 无效，Metrics_Exporter 应显示 "❌ Invalid AWS Secret Key. Please check your credentials."
7. 测试文件上传成功后应自动删除（清理）
8. S3 Prefix 配置项应包含可点击的链接 "click here to check S3 write permission"

### 需求 12: 操作日志记录

**用户故事:** 作为用户，我希望能够查看操作日志，以便追踪和排查导出过程中的问题。

#### 验收标准

1. 当执行上传操作时，Logger 应将详细日志写入 Log_File
2. Log_File 应存储在 ~/.kiro-metrics-exporter/logs/ 目录下
3. Log_File 文件名应遵循格式：metrics-exporter-YYYY-MM-DD.log
4. 日志条目应包含时间戳、日志级别（INFO/WARN/ERROR）、上下文和消息
5. 当用户点击"Open Log File"时，Metrics_Exporter 应在编辑器中打开当天的日志文件
6. 当用户点击"Open Log Folder"时，Metrics_Exporter 应在系统文件管理器中打开日志目录
7. 当用户点击"Open Settings"时，Metrics_Exporter 应打开扩展的设置页面
8. 上传操作日志应包含：操作开始/结束标记、用户信息、S3 配置、扫描结果、过滤结果、上传进度和结果
9. 日志应记录每个文件的上传路径（格式：[Upload] N/M - date -> s3://bucket/key）
10. 日志应记录操作耗时（扫描时间、上传时间、总时间）
