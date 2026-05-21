# Kiro Metrics Exporter

## 产品概述
Kiro Metrics Exporter 是一个 VSCode/Kiro IDE 扩展，用于收集和导出 Kiro IDE 的使用指标数据到 AWS S3。

## 核心功能
- 扫描 Kiro agent 目录，提取代码生成统计数据
- 支持按时间范围导出（最近7天 / 全部历史数据）
- 将指标数据以 CSV 格式上传到 AWS S3
- 通过 AWS Identity Store 解析用户身份
- 提供 Explorer 侧边栏配置面板

## 指标数据
- `fsWrite` 操作：新建文件的代码行数
- `strReplace` 操作：修改文件的新增/删除行数
- 执行次数统计
- 按日/月聚合的统计数据

## 目标用户
需要追踪和分析 Kiro IDE AI 代码生成效率的团队和组织。
