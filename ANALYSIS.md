# 📊 Kiro Metrics Exporter 全面技术分析

> 仓库：`liangyimingcom/kiro-metrics-exporter`
> 当前版本：**v1.3.1**（2026-05-19）
> 类型：VSCode / Kiro IDE 扩展
> 协议：MIT

---

## 一、产品定位与核心价值

**Kiro Metrics Exporter** 是一个 VSCode/Kiro IDE 扩展，作用是把本地 Kiro IDE 的 AI 代码生成使用数据（执行次数、新增/修改代码行数）按日聚合为 CSV，并按规范路径上传至 AWS S3，供企业侧分析平台消费。

### 一句话定位
> **把开发者本地的 Kiro AI 编码记录，自动同步到企业 S3 数仓里，做"AI 生产力"统计。**

### 关键设计取舍
| 维度 | 取舍 |
|---|---|
| 数据源 | 不接入 Kiro 后端 API，**直接读本地 `kiro.kiroagent` 目录下的 JSON 执行日志** |
| 数据通道 | 不用自建后端，**直接 S3 PutObject**（路径幂等，每天每用户一个文件） |
| 用户身份 | **AWS Identity Store**（GetUserId + DescribeUser）解析 username 为 userId |
| 触发方式 | 手动 + 定时（默认 8h 自动上传） |

---

## 二、需求模型（Requirements）

`requirements.md` 共定义了 **12 大需求 + 18 条正确性属性（Property）**，可归纳为五个领域：

```mermaid
mindmap
  root((Kiro Metrics<br/>Exporter))
    配置管理
      AWS 凭证
      Identity Store 配置
      S3 配置
      四步骤面板
      敏感值掩码
    数据采集
      平台路径定位
      JSON 日志解析
      执行 ID 去重
      工具 ID 去重
    数据计算
      countLines
      strReplace diff
      Net_Lines = fsWrite + added - deleted
      日/月聚合
    上传与存储
      时间过滤(7天/全量/今天)
      CSV 生成
      S3 路径幂等
      权限预检
    可观测性
      操作日志
      版本展示
      自动上传
```

### 12 项核心需求摘要

| # | 需求 | 关键标的 |
|---|---|---|
| 1 | AWS 配置管理 | 4 步骤侧边栏面板，敏感值掩码，版本横幅 |
| 2 | 执行日志扫描与解析 | 跨平台路径，JSON 解析，executionId 去重 |
| 3 | 代码行数计算 | countLines、Diff、Net_Lines 公式 |
| 4 | 数据聚合 | 按日/按月聚合 |
| 5 | 时间过滤导出 | Today / Last 7 Days / All Till Yesterday |
| 6 | CSV 生成 | UserId, Date(MM-DD-YYYY), Chat_AICodeLines, Chat_MessagesSent |
| 7 | S3 上传 | 路径幂等：`{prefix}/{Y}/{M}/{D}/00/kiro-ide-{userId}.csv` |
| 8 | 用户身份解析 | GetUserId → DescribeUser → DisplayName |
| 9 | 配置验证 | 上传前必填项校验 |
| 10 | 报告生成 | 输出通道展示总体/月/日明细 |
| 11 | S3 权限检查 | 上传 → 删除 测试文件 |
| 12 | 操作日志记录 | `~/.kiro-metrics-exporter/logs/metrics-exporter-YYYY-MM-DD.log` |

---

## 三、系统架构（Design）

### 3.1 分层架构

```mermaid
graph TB
    subgraph 用户层
        U[👤 开发者]
    end

    subgraph 表现层 [VSCode UI 层]
        AB[Activity Bar 图标]
        TV[TreeView<br/>4 步骤配置面板]
        CMD[VSCode 命令<br/>Upload Today / 7d / All]
        SET[Settings 配置页]
        OUT[Output 频道<br/>报告输出]
    end

    subgraph 业务层 [Service Layer]
        EXT[extension.ts<br/>扩展生命周期 + 自动上传定时器]
        SVC[MetricsService<br/>核心服务编排]
        PROV[MetricsExporterProvider<br/>TreeView 数据提供者]
    end

    subgraph 计算层 [Pure Functions]
        EXTR[extractor.ts<br/>扫描 / 解析 / 聚合]
        LOG[logger.ts<br/>日志单例]
        TYP[types.ts<br/>类型定义]
    end

    subgraph 数据源层
        FS[(本地文件<br/>kiro.kiroagent/*.json)]
        S3[(AWS S3<br/>CSV 对象)]
        IS[(AWS Identity Store<br/>用户身份)]
        LF[(本地日志<br/>~/.kiro-metrics-exporter/logs)]
    end

    U --> AB --> TV
    U --> CMD
    TV --> CMD
    CMD --> SVC
    EXT --> SVC
    EXT --> PROV
    PROV -.读配置.-> TV
    SVC --> EXTR
    SVC --> LOG
    SVC --> S3
    SVC --> IS
    EXTR --> FS
    LOG --> LF
    SVC --> OUT
```

### 3.2 模块依赖图

```mermaid
graph LR
    extension.ts --> metricsService.ts
    extension.ts --> metricsExporterProvider.ts
    extension.ts --> logger.ts
    metricsService.ts --> extractor.ts
    metricsService.ts --> logger.ts
    metricsService.ts --> types.ts
    metricsExporterProvider.ts --> metricsService.ts
    extractor.ts --> types.ts
    extractor.ts --> diff[npm: diff]
    metricsService.ts --> s3sdk[npm: @aws-sdk/client-s3]
    metricsService.ts --> issdk[npm: @aws-sdk/client-identitystore]
```

### 3.3 模块职责矩阵

| 模块 | 行数 | 职责 | 是否纯函数 |
|---|---|---|---|
| `extension.ts` | 126 | 激活/停用、自动上传定时器、配置变更监听 | ❌ 副作用 |
| `types.ts` | 120 | 全部 TypeScript 类型/接口定义 | ✅ 纯类型 |
| `extractor.ts` | 530 | 扫描目录、解析 JSON、行数计算、日/月聚合、生成报告 | ✅ 大部分纯函数 |
| `metricsService.ts` | 885 | 命令注册、AWS SDK 调用、CSV 生成、S3 上传、日期过滤 | ❌ 强副作用 |
| `metricsExporterProvider.ts` | 196 | TreeView 4 级数据提供 | 半纯（读配置） |
| `logger.ts` | 66 | 单例日志器，按日期分文件 | ❌ 文件副作用 |

---

## 四、关键工作流（端到端）

### 4.1 扩展激活流程

```mermaid
sequenceDiagram
    participant VS as VSCode
    participant Ext as extension.ts
    participant Svc as MetricsService
    participant Prov as TreeViewProvider
    participant Cfg as 配置中心

    VS->>Ext: activate(context)
    Ext->>Svc: new MetricsService()
    Svc->>Svc: registerCommands()<br/>(15+ 个命令)
    Ext->>Prov: new MetricsExporterProvider()
    Ext->>VS: registerTreeDataProvider('metricsExporter')
    Ext->>Cfg: onDidChangeConfiguration(监听)
    Note over Ext: 监听 username/<br/>autoUpload 变更
    Ext->>Ext: startAutoUploadTimer()
    alt autoUpload.enabled = true
        Ext->>Svc: setTimeout 5s<br/>立即上传 lastWeek
        Ext->>Ext: setInterval(intervalHours)
    end
```

### 4.2 上传指标主流程（以 Upload Last 7 Days 为例）

```mermaid
flowchart TD
    A[用户点击 Upload Last 7 Days] --> B[exportMetricsWithTimeFilter<br/>'lastWeek']
    B --> C{initializeS3<br/>配置校验}
    C -->|失败| D[显示错误 + 中止]
    C -->|成功| E[getKiroAgentPath<br/>跨平台]
    E --> F{目录存在?}
    F -->|否| D
    F -->|是| G[scanKiroAgentDirectory]
    G --> H{有记录?}
    H -->|否| I[Warn 警告 + 中止]
    H -->|是| J[exportToJson<br/>聚合]
    J --> K[getDateRange<br/>T-7 ~ T-1]
    K --> L[filterDailyStatsByDateRange]
    L --> M{过滤后有数据?}
    M -->|否| I
    M -->|是| N[遍历每一天]
    N --> O[convertDayMetricsToCSV]
    O --> P[generateS3Path<br/>幂等路径]
    P --> Q[uploadDayCSVToS3<br/>PutObject]
    Q --> R{还有日期?}
    R -->|是| N
    R -->|否| S[generateReport<br/>输出 OutputChannel]
    S --> T[Logger 全程记录<br/>日志文件]
    T --> U[显示成功消息]
```

### 4.3 用户身份解析流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant TV as TreeView
    participant Cmd as resolveUserId
    participant ISC as IdentityStoreClient
    participant Cfg as 配置

    U->>TV: 点击 "🔄 Resolve User ID & Display Name"
    TV->>Cmd: 触发命令
    Cmd->>Cfg: 读 username/AK/SK/storeId
    alt 缺前置
        Cmd-->>U: ❌ 提示缺什么
    else 完整
        Cmd->>ISC: GetUserIdCommand<br/>(userName=...)
        ISC-->>Cmd: { UserId }
        Cmd->>ISC: DescribeUserCommand<br/>(UserId)
        ISC-->>Cmd: { DisplayName }
        Cmd->>Cfg: 写 userId / displayName
        Cmd-->>U: ✅ Resolved
    end
    Note over Cmd: 失败时清空 userId 与<br/>displayName 防止脏数据
```

### 4.4 配置变更自动解析（防抖 500ms）

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Detected: onDidChangeConfiguration<br/>(username 变化)
    Detected --> Debouncing: 设置 500ms timeout
    Debouncing --> Debouncing: 又有变更<br/>清旧 timeout 重设
    Debouncing --> Resolving: 500ms 到时
    Resolving --> Idle: 调用 resolveUserId
```

---

## 五、核心算法解析

### 5.1 行数计算公式（Net_Lines）

```
Net_Lines = fsWriteLines + strReplaceAdded - strReplaceDeleted
```

- **fsWrite**：新建文件 → 行数 = `text.trim().split('\n').length`
- **strReplace**：使用 `diff` 库的 `diffArrays` 逐行对比
  - `change.added` 累计 → `strReplaceAdded`
  - `change.removed` 累计 → `strReplaceDeleted`

### 5.2 工具名归一化（v1.3.1 核心修复）⭐

```mermaid
flowchart LR
    A[原始 entry.name] --> B{normalizeToolName}
    B -->|fsWrite 或 fs_write| C[返回 'fsWrite']
    B -->|strReplace 或 str_replace| D[返回 'strReplace']
    B -->|其他| E[返回 null<br/>跳过]
```

**这是 v1.3.1 的关键修复**：Kiro 在 2026-05-07 把日志里的工具名从 camelCase 改为 snake_case，旧版扩展会因为名称对不上而把统计数据降为 0。

### 5.3 双源 ToolUse 提取与去重

执行日志中存在两个数据来源：
- `data.actions[]` —— 结构化的动作数组
- `data.context.messages[].entries[]` —— 对话消息中的 toolUse 条目

```mermaid
flowchart TD
    Log[ExecutionLog JSON] --> A[extractToolUsesFromActions]
    Log --> M[extractToolUsesFromMessages]
    A --> SS[(seenToolIds Set)]
    M --> SS
    SS -.去重.-> Merge[合并 ToolUse 列表]
    Merge --> Process[逐条处理]
    Process --> FW{name?}
    FW -->|fsWrite| C1[countLines + 累加]
    FW -->|strReplace| C2[diff + 累加]
```

去重维度有两层：
1. **executionId 级**：跨文件去重（`seenExecutionIds`）
2. **toolUseId 级**：单 execution 内去重（`seenToolIds`）

### 5.4 S3 路径生成（幂等）

```
s3://{bucket}/{basePath}/{YYYY}/{MM}/{DD}/00/kiro-ide-{userId}.csv
```

**幂等性保证**：同一 (date, userId) 组合永远生成相同的 key，重复上传只会覆盖，不会产生重复记录。

### 5.5 时间过滤范围

| filterType | startDate | endDate |
|---|---|---|
| `today` | 今天 00:00:00 | 今天 23:59:59 |
| `lastWeek` | T-7 天 00:00:00 | 昨天 23:59:59 |
| `allTillYesterday` | 2020-01-01 00:00:00 | 昨天 23:59:59 |

---

## 六、模块实现详解

### 6.1 `types.ts` —— 数据契约

```mermaid
classDiagram
    class FileOperation {
        +'fsWrite'|'strReplace' type
        +string path
        +number lines?
        +number added?
        +number deleted?
    }
    class ExecutionResult {
        +string executionId
        +Date startTime
        +Date endTime
        +string status
        +string workflowType
        +number fsWriteLines
        +number strReplaceAdded
        +number strReplaceDeleted
        +FileOperation[] fileOperations
    }
    class DailyStats {
        +number fsWriteLines
        +number strReplaceAdded
        +number strReplaceDeleted
        +number executionCount
        +number filesCreated
        +number filesModified
    }
    class MonthlyStats {
        +number netLines
        +number activeDays
    }
    class Summary {
        +number totalExecutions
        +number totalFsWriteLines
        +number totalStrReplaceAdded
        +number totalStrReplaceDeleted
        +number netLines
    }
    class MetricsExport {
        +string generatedAt
        +Summary summary
        +Map~string,MonthlyStats~ monthlyStats
        +Map~string,DailyStats~ dailyStats
        +ExecutionResult[] executions
    }
    ExecutionResult --> FileOperation
    MonthlyStats --|> DailyStats
    MetricsExport --> Summary
    MetricsExport --> MonthlyStats
    MetricsExport --> DailyStats
    MetricsExport --> ExecutionResult
```

### 6.2 `extractor.ts` —— 数据计算引擎

| 函数 | 输入 | 输出 | 备注 |
|---|---|---|---|
| `countLines(text)` | string | number | 空 → 0；trim + split('\n') |
| `calculateStrReplaceLines(old, new)` | (string, string) | `{added, deleted}` | 用 `diff.diffArrays` |
| `normalizeToolName(name)` | string \| undefined | `'fsWrite' \| 'strReplace' \| null` | **v1.3.1 新增**，兼容大小写蛇形 |
| `processExecutionLog(path, seenIds)` | (路径, Set) | ExecutionResult \| null | 单文件处理，自带去重 |
| `scanKiroAgentDirectory(base)` | string | ExecutionResult[] | 扫描两级目录 |
| `aggregateByDate(results)` | ExecutionResult[] | Record<date, DailyStats> | 按本地日期分组 |
| `aggregateByMonth(results)` | ExecutionResult[] | Record<month, MonthlyStats> | 含 activeDays 集合 |
| `generateSummary(results)` | ExecutionResult[] | Summary | 总计 |
| `exportToJson(results)` | ExecutionResult[] | MetricsExport | 完整导出 |
| `generateReport(results)` | ExecutionResult[] | string | 文本报告 |

**目录结构假设**：

```
kiro.kiroagent/
└── {sessionHash}/
    └── 414d1636299d2b9e4ce7e17fb11f63e9/   ← 固定常量目录
        └── *.json                           ← 执行日志
```

> 注：`414d1636299d2b9e4ce7e17fb11f63e9` 是一个硬编码常量目录名，可能是 Kiro IDE 的固定子模块标识。

### 6.3 `metricsService.ts` —— 编排核心（885 行）

这是最大的模块，承担所有"脏活"。结构如下：

```mermaid
graph TB
    subgraph Commands [VSCode 命令注册]
        C1[setAccessKey/SecretKey/...]
        C2[setUsername / resolveUserId]
        C3[checkS3Permission]
        C4[openLog / openLogFolder / openSettings]
        C5[uploadToday / uploadLastWeek / uploadAllTillYesterday]
    end

    subgraph Internal [内部方法]
        I1[initializeS3<br/>必填校验 + 创建 SDK]
        I2[getUserInfoByUsername<br/>GetUserId+DescribeUser]
        I3[checkS3WritePermission<br/>Put + Delete 测试文件]
        I4[getDateRange<br/>计算时间范围]
        I5[filterDailyStatsByDateRange]
        I6[convertDayMetricsToCSV<br/>45 列固定 schema]
        I7[generateS3Path<br/>路径解析]
        I8[formatDateForCSV<br/>MM-DD-YYYY]
        I9[getKiroAgentPath<br/>跨平台]
        I10[uploadDayCSVToS3<br/>PutObject]
        I11[showReportInOutput]
    end

    C5 --> exportMetricsWithTimeFilter
    exportMetricsWithTimeFilter --> I1
    exportMetricsWithTimeFilter --> I9
    exportMetricsWithTimeFilter --> I4
    exportMetricsWithTimeFilter --> I5
    exportMetricsWithTimeFilter --> I6
    exportMetricsWithTimeFilter --> I7
    exportMetricsWithTimeFilter --> I10
    C2 --> I2
    C3 --> I3
```

**CSV 字段映射**：CSV 输出固定 **45 列**（与企业 BI 兼容），但只有 3 列有真实值，其余全为 `0`：

| 列 | 含义 | 来源 |
|---|---|---|
| `UserId` | AWS Identity Center User ID | 配置 `aws.userId` |
| `Date` | MM-DD-YYYY | 由 YYYY-MM-DD 转换 |
| `Chat_AICodeLines` | **AI 净增代码行** | `fsWriteLines + strReplaceAdded - strReplaceDeleted` |
| `Chat_MessagesSent` | 执行次数 | `dailyStats.executionCount` |
| 其他 42 列 | InlineChat / CodeFix / TestGeneration ... | 全部 0 |

### 6.4 `metricsExporterProvider.ts` —— TreeView UI

```mermaid
graph TB
    Root[Root]
    Root --> V[📊 Kiro Metrics Exporter v1.3.1]
    Root --> S1[📋 Step 1: AWS Credentials]
    Root --> S2[👤 Step 2: User Identity]
    Root --> S3[📦 Step 3: S3 Configuration]
    Root --> S4[📝 Step 4: Logs & Settings]

    S1 --> S1a[Access Key ***xxxx]
    S1 --> S1b[Secret Key ***xxxx]
    S1 --> S1c[Identity Store ID]
    S1 --> S1d[Identity Store Region]

    S2 --> S2a[Username]
    S2 --> S2b[🔄 Resolve User ID & Display Name]
    S2 --> S2c[User ID auto]
    S2 --> S2d[Display Name auto]

    S3 --> S3a[S3 Prefix]
    S3 --> S3b[S3 Region]
    S3 --> S3c[🔍 Check S3 Write Permission]

    S4 --> S4a[📄 Open Log File]
    S4 --> S4b[📂 Open Log Folder]
    S4 --> S4c[⚙️ Open Settings]
```

实现要点：
- 实现 `vscode.TreeDataProvider<ConfigItem>`
- 通过 `_onDidChangeTreeData` EventEmitter 触发刷新
- 敏感值掩码：`'***' + key.slice(-4)`
- 每个叶子节点绑定 `vscode.Command`，点击即触发命令

### 6.5 `logger.ts` —— 单例日志器

```mermaid
classDiagram
    class Logger {
        -static instance Logger
        -string logDir
        -constructor()
        +static getInstance() Logger
        -ensureLogDir()
        -getLogFilePath() string
        -formatMessage(level, ctx, msg) string
        +log(level, ctx, msg)
        +info(ctx, msg)
        +warn(ctx, msg)
        +error(ctx, msg)
        +getLogDir() string
        +getCurrentLogFile() string
    }
    note for Logger "单例模式<br/>位置: ~/.kiro-metrics-exporter/logs/<br/>文件名: metrics-exporter-YYYY-MM-DD.log"
```

**日志格式**：
```
[ISO时间戳] [INFO|WARN|ERROR] [上下文] 消息内容
```

**典型日志片段**（v1.3.0 起内置）：
```
[2026-05-28T03:00:00.000Z] [INFO] [Upload Last 7 Days] ========== Operation Started ==========
[2026-05-28T03:00:00.001Z] [INFO] [Upload Last 7 Days] User: john.doe, UserId: xxx-xxx
[2026-05-28T03:00:00.500Z] [INFO] [Upload Last 7 Days] [Scanning] Completed in 0.50s - Found 50 execution records
[2026-05-28T03:00:01.000Z] [INFO] [Upload Last 7 Days] [Filter] Found 7 days of data to upload
[2026-05-28T03:00:02.000Z] [INFO] [Upload Last 7 Days] [Upload] 1/7 - 2026-05-21 -> s3://bucket/.../kiro-ide-xxx.csv
...
[2026-05-28T03:00:08.000Z] [INFO] [Upload Last 7 Days] Total Time: 8.00s (Scan: 0.50s, Upload: 7.50s)
```

### 6.6 `extension.ts` —— 自动上传调度器

```mermaid
stateDiagram-v2
    [*] --> Activate: VSCode 启动
    Activate --> RegisterAll: 注册 Provider/命令/监听
    RegisterAll --> CheckEnabled: startAutoUploadTimer
    CheckEnabled --> Disabled: enabled=false
    CheckEnabled --> Initial: enabled=true
    Initial --> WaitInit: setTimeout 5s
    WaitInit --> InitialUpload: 立即上传 lastWeek
    InitialUpload --> Recurring: setInterval(intervalHours)
    Recurring --> Recurring: 每 N 小时上传一次
    Recurring --> Restart: 配置变更
    Restart --> CheckEnabled: 重启 timer
    Disabled --> Restart: 配置变更
    Activate --> Deactivate: VSCode 退出
    Deactivate --> [*]: stopAutoUploadTimer
```

---

## 七、AWS 集成详解

### 7.1 IAM 权限矩阵

| 服务 | 权限 | 用途 |
|---|---|---|
| `s3:PutObject` | 必须 | 上传 CSV |
| `s3:DeleteObject` | 必须 | 权限检查后清理测试文件 |
| `identitystore:GetUserId` | 必须 | username → userId |
| `identitystore:DescribeUser` | 必须 | userId → displayName |

### 7.2 跨平台路径

```mermaid
flowchart LR
    P[os.platform&#40;&#41;] --> W{win32?}
    W -->|是| WP["%APPDATA%\\Kiro\\User\\<br/>globalStorage\\kiro.kiroagent"]
    W -->|否| D{darwin?}
    D -->|是| DP["~/Library/Application Support/<br/>Kiro/User/globalStorage/kiro.kiroagent"]
    D -->|否| L{linux?}
    L -->|是| LP["~/.config/Kiro/User/<br/>globalStorage/kiro.kiroagent"]
    L -->|否| ERR[抛错: Unsupported platform]
```

---

## 八、版本演进历史 ⏱️

```mermaid
timeline
    title Kiro Metrics Exporter 版本演进
    section 2024
        2024-12-24 v1.0.0 : 基础指标采集 : S3 上传 : Identity Store 集成 : Explorer 侧边栏
    section 2025
        2025-01-04 v1.1.0 : 独立 Activity Bar 图标 : 4 步骤配置面板 : Username 自动解析 : S3 权限预检 : 操作日志（按日分文件） : 版本横幅展示
    section 2026
        2026-03-17 v1.2.0 : 自动上传功能 : intervalHours 1~168 可配 : 启动延迟 5s 立即跑一次 : 修正 publisher
        2026-03-19 v1.3.0 : Upload Today 命令 : 工具栏左侧最显眼按钮 : 自动上传默认 ON
        2026-05-19 v1.3.1 : ⭐ 修复 5/7 数据降零 : 兼容 fs_write/str_replace 蛇形命名
```

### 8.1 各版本核心变更对比

| 版本 | 类型 | 关键变更 | 影响面 |
|---|---|---|---|
| **1.0.0** | 🚀 初版 | 基础采集 + S3 上传 + 用户查找 | 全功能 |
| **1.1.0** | 🎨 UX 大改版 | Activity Bar、4 步配置、自动解析、权限检查、日志 | 全 UI + 可观测性 |
| **1.2.0** | ⏰ 自动化 | 自动上传 + 间隔配置 + publisher 修正 | 调度 |
| **1.3.0** | 🔘 易用性 | Upload Today 按钮 + 自动上传默认 ON | UX |
| **1.3.1** | 🐛 关键修复 | 兼容 Kiro 5/7 工具名变更 | 数据正确性 |

### 8.2 v1.3.1 关键修复深度剖析 ⭐

#### 问题现象
2026-05-07 之后，所有用户的统计数据**突然降为 0**。

#### 根因
Kiro IDE 在 5 月 7 日左右将其执行日志里的工具名从 **camelCase** 改成了 **snake_case**：

| 旧（≤ 5/6） | 新（≥ 5/7） |
|---|---|
| `fsWrite` | `fs_write` |
| `strReplace` | `str_replace` |

旧版扩展使用严格字符串匹配（`if (toolName === 'fsWrite')`），导致新格式的所有工具调用被丢弃。

#### 修复
新增工具名归一化函数 `normalizeToolName()`：

```typescript
function normalizeToolName(name: string | undefined): 'fsWrite' | 'strReplace' | null {
  if (!name) return null;
  if (name === 'fsWrite' || name === 'fs_write') return 'fsWrite';
  if (name === 'strReplace' || name === 'str_replace') return 'strReplace';
  return null;
}
```

#### 修复策略亮点
- **向后兼容**：保留 camelCase 处理旧日志
- **统一对内表示**：内部仍用 camelCase，避免代码大改
- **单点改造**：仅在 `extractToolUsesFromMessages` 入口处归一化，下游计算逻辑零改动

```mermaid
flowchart LR
    OLD[旧日志<br/>fsWrite/strReplace] --> NORM
    NEW[新日志<br/>fs_write/str_replace] --> NORM
    NORM[normalizeToolName<br/>归一化为 fsWrite/strReplace] --> CORE[原有计算逻辑<br/>不变]
```

---

## 九、设计亮点与可改进点

### ✨ 亮点

1. **Spec-Driven 工程化** —— `.kiro/specs/` 中完整保留 requirements / design / tasks，连 18 条 Property 都有形式化描述
2. **路径幂等设计** —— 重复执行不产生脏数据
3. **可观测性强** —— 全程 Logger 记录，时间分段（Scanning/Filter/Upload），便于排查
4. **防御式 UI** —— 解析失败时主动清空 userId/displayName 防止脏数据残留
5. **跨平台抽象干净** —— `getKiroAgentPath()` 单点处理三平台
6. **配置驱动**——所有敏感值通过 VSCode Configuration API 管理，自带 sync 和加密能力

### ⚠️ 可改进点

1. **测试覆盖空缺** —— `tasks.md` 标注 `[x]` 的测试任务仅是规划，实际仓库无 `src/test/` 目录、无单测
2. **`exportMetrics` 旧方法** —— `metricsService.ts` 末尾仍保留无时间过滤的全量上传方法，但已无入口调用，可删
3. **`activate` 中 `console.log`** —— 与 Logger 不统一
4. **错误码识别用字符串匹配** —— `errorMsg.includes('AccessDenied')` 不如检查 `error.name === 'AccessDenied'` 稳定
5. **`414d1636299d2b9e4ce7e17fb11f63e9`** —— 魔法常量目录名应抽成命名常量并加注释
6. **CSV 列定义硬编码** —— 45 列写在数组字面量里，建议提到独立 schema 文件
7. **`@types/node` 25.x** —— 比 VSCode 1.103 实际运行时 Node 18 高很多，类型可能与 runtime 偏移

---

## 十、一图总览（架构 + 数据流）

```mermaid
flowchart TB
    subgraph Local [本地环境]
        Kiro[Kiro IDE 使用]
        Kiro -.写入.-> Agent[(kiro.kiroagent/<br/>session/.../*.json)]
    end

    subgraph Extension [VSCode 扩展]
        UI[4 步骤<br/>TreeView 面板]
        Cmds[8+ 命令]
        Auto[自动上传<br/>定时器]
        Svc[MetricsService]
        Extr[extractor]
        Log[Logger]
        UI --> Cmds --> Svc
        Auto --> Svc
        Svc --> Extr
        Svc --> Log
        Extr -.读取.-> Agent
        Log -.写入.-> LogFile[(~/.kiro-metrics-<br/>exporter/logs/)]
    end

    subgraph AWS [AWS Cloud]
        IS[Identity Store]
        S3[(S3 Bucket)]
    end

    Svc -.GetUserId<br/>DescribeUser.-> IS
    Svc -.PutObject<br/>幂等路径.-> S3

    subgraph Downstream [企业下游]
        S3 --> Athena[Athena/Glue]
        Athena --> Dashboard[BI 看板]
    end

    style Kiro fill:#e1f5ff
    style Agent fill:#fff4e1
    style Svc fill:#e8f5e9
    style S3 fill:#f3e5f5
    style Dashboard fill:#fce4ec
```

---

## 十一、总结

**Kiro Metrics Exporter** 是一个工程化非常好的小型 VSCode 扩展示范项目：

| 维度 | 评价 |
|---|---|
| 需求清晰度 | ⭐⭐⭐⭐⭐ 12 大需求 + 18 Property |
| 架构合理性 | ⭐⭐⭐⭐ 分层干净，纯函数与副作用分离良好 |
| 可观测性 | ⭐⭐⭐⭐⭐ Logger 全链路记录 |
| 可维护性 | ⭐⭐⭐⭐ 模块小、职责单一；测试缺失是唯一短板 |
| 容错与防御 | ⭐⭐⭐⭐⭐ 多层去重、配置校验、解析失败清空 |
| 文档完整度 | ⭐⭐⭐⭐⭐ README/CHANGELOG/specs/steering 齐备 |

**最新 v1.3.1 是一次教科书级的"上游协议变更"应急响应**：发现问题 → 单点归一化兼容 → 不破坏既有逻辑 → 一行注释清晰说明根因。整个修复在 `extractor.ts` 中只新增了 ~10 行代码，但拯救了所有用户从 5/7 之后的统计数据。
