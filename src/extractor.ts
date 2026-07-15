/**
 * Kiro Metrics Extractor - TypeScript 版本
 * 
 * 提取 Kiro 代码生成统计数据
 */

import * as fs from 'fs';
import * as path from 'path';
import * as Diff from 'diff';
import {
  ExecutionResult,
  ToolUse,
  ExecutionLog,
  DailyStats,
  MonthlyStats,
  Summary,
  MetricsExport
} from './types';

/**
 * 计算文本行数
 */
export function countLines(text: string): number {
  if (!text) return 0;
  return text.trim().split('\n').length;
}

/**
 * 计算 strReplace 操作的行数变化
 * 使用与 Python difflib.unified_diff 一致的算法
 */
export function calculateStrReplaceLines(oldStr: string, newStr: string): { added: number; deleted: number } {
  if (!oldStr && !newStr) {
    return { added: 0, deleted: 0 };
  }

  const oldLines = oldStr ? oldStr.split('\n') : [];
  const newLines = newStr ? newStr.split('\n') : [];

  // 使用 diffArrays 进行逐行对比（与 Python unified_diff 行为一致）
  const changes = Diff.diffArrays(oldLines, newLines);
  
  let added = 0;
  let deleted = 0;

  for (const change of changes) {
    if (change.added) {
      added += change.count || 0;
    } else if (change.removed) {
      deleted += change.count || 0;
    }
  }

  return { added, deleted };
}

/**
 * 工具名归一化：兼容 Kiro 旧日志和 Kiro 1.0 ACP JSONL 中的命名。
 */
type NormalizedToolName = 'fsWrite' | 'fsAppend' | 'strReplace';

function normalizeToolName(name: string | undefined): NormalizedToolName | null {
  if (!name) return null;
  if (name === 'fsWrite' || name === 'fs_write' || name === 'create') return 'fsWrite';
  if (name === 'fsAppend' || name === 'fs_append') return 'fsAppend';
  if (name === 'strReplace' || name === 'str_replace' || name === 'write' || name === 'append' || name === 'replace') return 'strReplace';
  return null;
}

function getStringArg(args: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === 'string') {
      return value;
    }
  }
  return '';
}

function normalizeToolArgs(args: Record<string, unknown> | undefined): NonNullable<ToolUse['args']> {
  const raw = args || {};
  return {
    path: getStringArg(raw, ['path', 'file', 'filePath', 'file_path', 'targetFile', 'target_file']),
    text: getStringArg(raw, ['text', 'content', 'modifiedContent', 'modified_content']),
    oldStr: getStringArg(raw, ['oldStr', 'old_str', 'oldText', 'old_text', 'old_string', 'originalContent', 'original_content']),
    newStr: getStringArg(raw, ['newStr', 'new_str', 'newText', 'new_text', 'new_string', 'modifiedContent', 'modified_content'])
  };
}

function hasMetricToolArgs(name: NormalizedToolName, args: NonNullable<ToolUse['args']>): boolean {
  if (name === 'fsWrite' || name === 'fsAppend') {
    return Boolean(args.text);
  }
  return Boolean(args.oldStr || args.newStr);
}

function normalizeToolUse(
  name: string | undefined,
  rawArgs: Record<string, unknown> | undefined
): { name: NormalizedToolName; args: NonNullable<ToolUse['args']> } | null {
  let normalizedName = normalizeToolName(name);
  const raw = rawArgs || {};
  const args = normalizeToolArgs(raw);
  const hasBeforeState = [
    'oldStr',
    'old_str',
    'oldText',
    'old_text',
    'old_string',
    'originalContent',
    'original_content'
  ].some(key => Object.prototype.hasOwnProperty.call(raw, key));

  // Some legacy generic write/append records contain only the written text,
  // while newer records contain complete before/after content. Preserve the
  // operation semantics for the text-only form and use a diff when possible.
  if (name === 'write' && !hasBeforeState && args.text) {
    normalizedName = 'fsWrite';
  } else if (name === 'append' && !hasBeforeState && args.text) {
    normalizedName = 'fsAppend';
  }

  if (!normalizedName || !hasMetricToolArgs(normalizedName, args)) {
    return null;
  }
  return { name: normalizedName, args };
}

function isFailedOperationStatus(status: string | undefined): boolean {
  if (!status) return false;
  return ['failed', 'cancelled', 'canceled', 'rejected', 'denied', 'aborted']
    .includes(status.toLowerCase());
}

function applyToolUse(result: ExecutionResult, toolUse: ToolUse): void {
  const args = toolUse.args || {};
  const normalizedName = toolUse.name as NormalizedToolName;
  if (!hasMetricToolArgs(normalizedName, args)) return;

  if (toolUse.name === 'fsWrite' || toolUse.name === 'fsAppend') {
    const text = args.text || '';
    const lines = countLines(text);
    result.fsWriteLines += lines;
    result.fileOperations.push({
      type: toolUse.name,
      path: args.path || '',
      lines
    });
    return;
  }

  if (toolUse.name === 'strReplace') {
    const { added, deleted } = calculateStrReplaceLines(args.oldStr || '', args.newStr || '');
    result.strReplaceAdded += added;
    result.strReplaceDeleted += deleted;
    result.fileOperations.push({
      type: 'strReplace',
      path: args.path || '',
      added,
      deleted
    });
  }
}

/**
 * 从 messages 中提取 tool use，去重处理
 */
function extractToolUsesFromMessages(
  messages: Array<{ entries?: Array<{ type?: string; name?: string; id?: string; args?: Record<string, unknown> }> }> | undefined,
  seenToolIds: Set<string>
): ToolUse[] {
  const toolUses: ToolUse[] = [];

  if (!Array.isArray(messages)) return toolUses;

  for (const msg of messages) {
    const entries = Array.isArray(msg?.entries) ? msg.entries : [];
    for (const entry of entries) {
      if (entry.type !== 'toolUse') continue;

      const toolId = entry.id;
      const normalized = normalizeToolUse(entry.name, entry.args);
      if (!normalized || (toolId && seenToolIds.has(toolId))) {
        continue;
      }

      if (toolId) {
        seenToolIds.add(toolId);
      }
      toolUses.push({
        id: toolId,
        name: normalized.name,
        args: normalized.args
      });
    }
  }

  return toolUses;
}

/**
 * 从 actions 数组中提取文件操作。
 * 旧版 Kiro 曾经把 create/write/append/replace 记录在 actions 中，
 * 因此这里和 messages 使用同一套工具名及参数归一化逻辑。
 */
function extractToolUsesFromActions(
  actions: ExecutionLog['actions'],
  seenToolIds: Set<string>
): ToolUse[] {
  const toolUses: ToolUse[] = [];

  if (!Array.isArray(actions)) return toolUses;

  for (const action of actions) {
    const actionId = action.actionId;
    const actionStatus = action.actionState || action.status || action.state;
    if (!actionId || seenToolIds.has(actionId) || isFailedOperationStatus(actionStatus)) {
      continue;
    }

    const normalized = normalizeToolUse(
      action.actionType,
      action.input as Record<string, unknown> | undefined
    );
    if (!normalized) {
      continue;
    }

    seenToolIds.add(actionId);
    toolUses.push({
      id: actionId,
      name: normalized.name,
      args: normalized.args,
      emittedAt: action.emittedAt
    });
  }

  return toolUses;
}


/**
 * 处理单个执行日志文件
 */
export function processExecutionLog(
  filePath: string,
  seenExecutionIds: Set<string>
): ExecutionResult | null {
  let data: ExecutionLog;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    data = JSON.parse(content);
  } catch {
    return null;
  }

  const executionId = data.executionId;
  if (!executionId) {
    return null;
  }

  // 去重：跳过已处理的 execution
  if (seenExecutionIds.has(executionId)) {
    return null;
  }
  seenExecutionIds.add(executionId);

  // 提取时间信息
  let startTime: Date | null = null;
  let endTime: Date | null = null;

  if (data.startTime) {
    startTime = new Date(data.startTime);
  }
  if (data.endTime || data.metadata?.endTime) {
    endTime = new Date(data.endTime || data.metadata!.endTime!);
  }

  const result: ExecutionResult = {
    executionId,
    startTime,
    endTime,
    status: data.status || 'unknown',
    workflowType: data.workflowType || 'unknown',
    isUserTurn: true,
    fsWriteLines: 0,
    strReplaceAdded: 0,
    strReplaceDeleted: 0,
    fileOperations: []
  };

  const seenToolIds = new Set<string>();
  if (Array.isArray(data.actions)) {
    for (const action of data.actions) {
      const actionStatus = action.actionState || action.status || action.state;
      if (action.actionId && isFailedOperationStatus(actionStatus)) {
        // A failed action is authoritative for the matching message/tool ID.
        seenToolIds.add(action.actionId);
      }
    }
  }

  // context.messages 通常保留的参数比 actions 摘要更完整，因此优先采用；
  // 若 message 缺少可计参数，则不会占用 tool ID，actions 仍可回退补充。
  const messagesToolUses = extractToolUsesFromMessages(
    data.context?.messages,
    seenToolIds
  );

  const actionsToolUses = extractToolUsesFromActions(data.actions, seenToolIds);
  const allToolUses = [...messagesToolUses, ...actionsToolUses];

  // 处理 tool uses
  for (const toolUse of allToolUses) {
    applyToolUse(result, toolUse);
  }

  return result;
}

interface KiroSessionPayload {
  type?: string;
  executionId?: string;
  parentExecutionId?: string;
  toolCallId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  status?: string;
  stopReason?: string;
  success?: boolean;
  agentType?: string;
  category?: string;
  context?: {
    executionId?: string;
    status?: string;
  };
  _meta?: {
    kiro?: {
      agentMode?: string;
    };
  };
}

interface KiroSessionEvent {
  id?: string;
  timestamp?: string | number;
  payload?: KiroSessionPayload;
}

interface KiroSessionMetadata {
  agentMode?: string;
}

function parseTimestamp(value: string | number | undefined): Date | null {
  if (value === undefined) return null;
  const milliseconds = typeof value === 'number' ? value : Date.parse(value);
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readSessionMode(messagesFilePath: string): string {
  const metadataPath = path.join(path.dirname(messagesFilePath), 'session.json');
  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')) as KiroSessionMetadata;
    return metadata.agentMode || 'unknown';
  } catch {
    return 'unknown';
  }
}

function createExecutionResult(executionId: string, startTime: Date | null, workflowType: string): ExecutionResult {
  return {
    executionId,
    startTime,
    endTime: null,
    status: 'running',
    workflowType,
    isUserTurn: false,
    fsWriteLines: 0,
    strReplaceAdded: 0,
    strReplaceDeleted: 0,
    fileOperations: []
  };
}

function isSuccessfulToolCall(payload: KiroSessionPayload, resultSuccess: boolean | undefined): boolean {
  const status = payload.status?.toLowerCase();
  if (resultSuccess === false || isFailedOperationStatus(status)) {
    return false;
  }

  return resultSuccess === true || status === 'completed' || status === 'complete' || status === 'succeeded' || status === 'success';
}

interface PendingKiroToolCall {
  executionId: string;
  status?: string;
  toolUse: ToolUse;
}

/**
 * 处理 Kiro 1.0 的单个 messages.jsonl 会话文件。
 * JSONL 可能正在被 Kiro 追加写入，因此损坏或不完整的单行会被忽略。
 */
export function processKiroSessionMessagesFile(filePath: string): ExecutionResult[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  const sessionMode = readSessionMode(filePath);
  const executions = new Map<string, ExecutionResult>();
  const pendingToolCalls = new Map<string, PendingKiroToolCall>();
  const toolResultStatus = new Map<string, boolean>();

  const processLine = (line: string): void => {
    if (!line.trim()) return;

    let event: KiroSessionEvent;
    try {
      event = JSON.parse(line) as KiroSessionEvent;
    } catch {
      // The final line can be incomplete while Kiro is writing the session.
      return;
    }

    const payload = event.payload;
    if (!payload) return;

    if (payload.type === 'tool_result' && payload.toolCallId && typeof payload.success === 'boolean') {
      toolResultStatus.set(payload.toolCallId, payload.success);
    }

    const executionId = payload.executionId || payload.context?.executionId;
    if (!executionId) return;

    const timestamp = parseTimestamp(event.timestamp);
    let result = executions.get(executionId);
    if (!result) {
      result = createExecutionResult(executionId, timestamp, sessionMode);
      executions.set(executionId, result);
    }

    const eventMode = payload._meta?.kiro?.agentMode || payload.agentType;
    if (eventMode && result.workflowType === 'unknown') {
      result.workflowType = eventMode;
    }

    if (payload.type === 'turn_start') {
      if (timestamp) result.startTime = timestamp;
      result.status = 'running';
      result.isUserTurn = true;
      return;
    }

    if (payload.type === 'tool_call') {
      const normalized = normalizeToolUse(payload.toolName, payload.args);
      const toolCallId = payload.toolCallId || event.id;
      if (!normalized || !toolCallId) return;

      pendingToolCalls.set(toolCallId, {
        executionId,
        status: payload.status,
        toolUse: {
          id: toolCallId,
          name: normalized.name,
          args: normalized.args
        }
      });
      return;
    }

    if (payload.type === 'usage_summary') {
      if (timestamp) result.endTime = timestamp;
      result.status = payload.status || result.status;
      return;
    }

    if (payload.type === 'session_event' && payload.category === 'session_pause') {
      if (timestamp) result.endTime = timestamp;
      result.status = payload.context?.status || result.status;
      return;
    }

    if (payload.type === 'turn_end') {
      if (timestamp) result.endTime = timestamp;
      const stopReason = payload.stopReason?.toLowerCase();
      if (stopReason === 'cancelled' || stopReason === 'aborted' || stopReason === 'failed') {
        result.status = stopReason;
      } else if (!['aborted', 'failed', 'cancelled'].includes(result.status.toLowerCase())) {
        result.status = 'completed';
      }
    }
  };

  let lineStart = 0;
  while (lineStart < content.length) {
    const newlineIndex = content.indexOf('\n', lineStart);
    const lineEnd = newlineIndex === -1 ? content.length : newlineIndex;
    const line = content.slice(lineStart, lineEnd).replace(/\r$/, '');
    processLine(line);
    if (newlineIndex === -1) break;
    lineStart = newlineIndex + 1;
  }

  for (const [toolCallId, pending] of pendingToolCalls) {
    if (!isSuccessfulToolCall({ status: pending.status }, toolResultStatus.get(toolCallId))) continue;
    const result = executions.get(pending.executionId);
    if (result) {
      applyToolUse(result, pending.toolUse);
    }
  }

  return Array.from(executions.values())
    .filter(result => result.startTime !== null)
    .sort((a, b) => a.startTime!.getTime() - b.startTime!.getTime());
}

function collectSessionMessageFiles(basePath: string, files: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(basePath, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return;
  }

  for (const entry of entries) {
    const entryPath = path.join(basePath, entry.name);
    if (entry.isDirectory()) {
      collectSessionMessageFiles(entryPath, files);
    } else if (entry.isFile() && entry.name === 'messages.jsonl') {
      files.push(entryPath);
    }
  }
}

function getCodeActivity(result: ExecutionResult): number {
  return result.fsWriteLines + result.strReplaceAdded + result.strReplaceDeleted;
}

function hasCodeActivity(result: ExecutionResult): boolean {
  return getCodeActivity(result) > 0;
}

function isMoreCompleteExecution(candidate: ExecutionResult, existing: ExecutionResult): boolean {
  const candidateActivity = getCodeActivity(candidate);
  const existingActivity = getCodeActivity(existing);
  if (candidateActivity !== existingActivity) {
    return candidateActivity > existingActivity;
  }
  if (candidate.fileOperations.length !== existing.fileOperations.length) {
    return candidate.fileOperations.length > existing.fileOperations.length;
  }
  if (candidate.isUserTurn !== existing.isUserTurn) {
    return candidate.isUserTurn === true;
  }
  return Boolean(candidate.endTime) && !existing.endTime;
}

function addBestExecution(results: Map<string, ExecutionResult>, candidate: ExecutionResult): void {
  const existing = results.get(candidate.executionId);
  if (!existing || isMoreCompleteExecution(candidate, existing)) {
    if (existing?.isUserTurn === true) {
      candidate.isUserTurn = true;
    }
    results.set(candidate.executionId, candidate);
  } else if (candidate.isUserTurn === true) {
    existing.isUserTurn = true;
  }
}

/** 扫描 Kiro 1.0 ~/.kiro/sessions 目录。 */
export function scanKiroSessionDirectory(basePath: string): ExecutionResult[] {
  const messageFiles: string[] = [];
  collectSessionMessageFiles(basePath, messageFiles);

  const results = new Map<string, ExecutionResult>();
  for (const messageFile of messageFiles) {
    for (const result of processKiroSessionMessagesFile(messageFile)) {
      addBestExecution(results, result);
    }
  }

  return Array.from(results.values())
    .sort((a, b) => a.startTime!.getTime() - b.startTime!.getTime());
}

function looksLikeJsonObjectFile(filePath: string): boolean {
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(256);
    const bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, 0);
    return /^[\s\uFEFF]*\{/.test(buffer.toString('utf8', 0, bytesRead));
  } catch {
    return false;
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // Ignore a close failure after a read failure.
      }
    }
  }
}

function collectLegacyExecutionFiles(basePath: string, files: string[], depth = 0): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(basePath, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return;
  }

  for (const entry of entries) {
    const entryPath = path.join(basePath, entry.name);
    // Historical layouts use {workspace}/{storage-key}/{execution-file}.
    // The storage key may change, so inspect every key at that depth while
    // avoiding nested databases and indexes unrelated to execution logs.
    if (entry.isDirectory() && depth < 2) {
      collectLegacyExecutionFiles(entryPath, files, depth + 1);
    } else if (entry.isFile() && looksLikeJsonObjectFile(entryPath)) {
      files.push(entryPath);
    }
  }
}

/**
 * 扫描 Kiro metrics 数据目录。
 * Kiro 1.0 使用 ~/.kiro/sessions；旧版本使用 globalStorage/kiro.kiroagent。
 */
export function scanKiroAgentDirectory(basePath: string): ExecutionResult[] {
  if (path.basename(basePath) === 'sessions') {
    return scanKiroSessionDirectory(basePath);
  }

  // 旧版布局为 {workspace}/{storage-key}/{execution-file}。不同版本的
  // storage key 可能变化，因此扫描该历史布局中的所有 key，而不再硬编码 414d...。
  const executionFiles: string[] = [];
  collectLegacyExecutionFiles(basePath, executionFiles);

  const results = new Map<string, ExecutionResult>();
  for (const executionFile of executionFiles) {
    // 每个文件先独立解析，再按 executionId 选择信息最完整的副本。
    // 这样无操作的索引/快照文件不会遮蔽真正的执行日志。
    const result = processExecutionLog(executionFile, new Set<string>());
    if (!result?.startTime || Number.isNaN(result.startTime.getTime()) || !hasCodeActivity(result)) {
      continue;
    }
    addBestExecution(results, result);
  }

  return Array.from(results.values())
    .sort((a, b) => a.startTime!.getTime() - b.startTime!.getTime());
}

/**
 * 合并多个 Kiro 数据源。路径顺序代表优先级；通常 Kiro 1.0 sessions 在前。
 * 相同 executionId 默认保留高优先级来源；仅当高优先级 modern 记录
 * 完全没有代码操作时才回退到 legacy，避免空迁移记录吞掉历史数据，同时不让
 * legacy 覆盖已有 modern 统计。
 */
export function scanKiroMetricsDirectories(basePaths: string[]): ExecutionResult[] {
  const merged = new Map<string, ExecutionResult>();

  for (const basePath of basePaths) {
    if (!fs.existsSync(basePath)) continue;
    for (const result of scanKiroAgentDirectory(basePath)) {
      const existing = merged.get(result.executionId);
      if (!existing) {
        merged.set(result.executionId, result);
      } else {
        const shouldFallbackToLegacy = existing.fileOperations.length === 0 && hasCodeActivity(result);

        if (shouldFallbackToLegacy) {
          // Keep the modern source's authoritative user-turn classification so
          // a legacy internal execution cannot inflate Chat_MessagesSent.
          if (existing.isUserTurn !== undefined) {
            result.isUserTurn = existing.isUserTurn;
          }
          merged.set(result.executionId, result);
        }
      }
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => a.startTime!.getTime() - b.startTime!.getTime());
}

/**
 * 格式化日期为本地时间字符串 YYYY-MM-DD
 */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化日期为本地时间字符串 YYYY-MM
 */
function formatLocalMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * 格式化日期为本地 ISO 格式字符串
 */
function formatLocalISOString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * 按日期聚合统计
 */
export function aggregateByDate(results: ExecutionResult[]): Record<string, DailyStats> {
  const dailyStats: Record<string, DailyStats> = {};

  for (const r of results) {
    if (!r.startTime) continue;

    const dateKey = formatLocalDate(r.startTime);

    if (!dailyStats[dateKey]) {
      dailyStats[dateKey] = {
        fsWriteLines: 0,
        strReplaceAdded: 0,
        strReplaceDeleted: 0,
        executionCount: 0,
        filesCreated: 0,
        filesModified: 0
      };
    }

    dailyStats[dateKey].fsWriteLines += r.fsWriteLines;
    dailyStats[dateKey].strReplaceAdded += r.strReplaceAdded;
    dailyStats[dateKey].strReplaceDeleted += r.strReplaceDeleted;
    dailyStats[dateKey].executionCount += r.isUserTurn === false ? 0 : 1;

    for (const op of r.fileOperations) {
      if (op.type === 'fsWrite') {
        dailyStats[dateKey].filesCreated += 1;
      } else {
        dailyStats[dateKey].filesModified += 1;
      }
    }
  }

  return dailyStats;
}

/**
 * 按月份聚合统计
 */
export function aggregateByMonth(results: ExecutionResult[]): Record<string, MonthlyStats> {
  const monthlyData: Record<string, {
    fsWriteLines: number;
    strReplaceAdded: number;
    strReplaceDeleted: number;
    executionCount: number;
    filesCreated: number;
    filesModified: number;
    activeDays: Set<string>;
  }> = {};

  for (const r of results) {
    if (!r.startTime) continue;

    const monthKey = formatLocalMonth(r.startTime);
    const dateKey = formatLocalDate(r.startTime);

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        fsWriteLines: 0,
        strReplaceAdded: 0,
        strReplaceDeleted: 0,
        executionCount: 0,
        filesCreated: 0,
        filesModified: 0,
        activeDays: new Set()
      };
    }

    monthlyData[monthKey].fsWriteLines += r.fsWriteLines;
    monthlyData[monthKey].strReplaceAdded += r.strReplaceAdded;
    monthlyData[monthKey].strReplaceDeleted += r.strReplaceDeleted;
    monthlyData[monthKey].executionCount += r.isUserTurn === false ? 0 : 1;
    monthlyData[monthKey].activeDays.add(dateKey);

    for (const op of r.fileOperations) {
      if (op.type === 'fsWrite') {
        monthlyData[monthKey].filesCreated += 1;
      } else {
        monthlyData[monthKey].filesModified += 1;
      }
    }
  }

  // 转换为最终格式
  const monthlyStats: Record<string, MonthlyStats> = {};
  for (const [month, stats] of Object.entries(monthlyData)) {
    monthlyStats[month] = {
      fsWriteLines: stats.fsWriteLines,
      strReplaceAdded: stats.strReplaceAdded,
      strReplaceDeleted: stats.strReplaceDeleted,
      netLines: stats.fsWriteLines + stats.strReplaceAdded - stats.strReplaceDeleted,
      executionCount: stats.executionCount,
      filesCreated: stats.filesCreated,
      filesModified: stats.filesModified,
      activeDays: stats.activeDays.size
    };
  }

  return monthlyStats;
}

/**
 * 生成统计摘要
 */
export function generateSummary(results: ExecutionResult[]): Summary {
  const totalFsWriteLines = results.reduce((sum, r) => sum + r.fsWriteLines, 0);
  const totalStrReplaceAdded = results.reduce((sum, r) => sum + r.strReplaceAdded, 0);
  const totalStrReplaceDeleted = results.reduce((sum, r) => sum + r.strReplaceDeleted, 0);

  return {
    totalExecutions: results.filter(r => r.isUserTurn !== false).length,
    totalFsWriteLines,
    totalStrReplaceAdded,
    totalStrReplaceDeleted,
    netLines: totalFsWriteLines + totalStrReplaceAdded - totalStrReplaceDeleted
  };
}

/**
 * 导出为 JSON 格式
 */
export function exportToJson(results: ExecutionResult[]): MetricsExport {
  return {
    generatedAt: formatLocalISOString(new Date()),
    summary: generateSummary(results),
    monthlyStats: aggregateByMonth(results),
    dailyStats: aggregateByDate(results),
    executions: results.map(r => ({
      executionId: r.executionId,
      startTime: r.startTime ? formatLocalISOString(r.startTime) : null,
      endTime: r.endTime ? formatLocalISOString(r.endTime) : null,
      status: r.status,
      workflowType: r.workflowType,
      fsWriteLines: r.fsWriteLines,
      strReplaceAdded: r.strReplaceAdded,
      strReplaceDeleted: r.strReplaceDeleted,
      fileOperations: r.fileOperations
    }))
  };
}

/**
 * 生成文本报告
 */
export function generateReport(results: ExecutionResult[]): string {
  if (results.length === 0) {
    return '没有找到任何代码生成记录。';
  }

  const summary = generateSummary(results);
  const monthlyStats = aggregateByMonth(results);
  const dailyStats = aggregateByDate(results);

  const lines: string[] = [];

  lines.push('='.repeat(70));
  lines.push('Kiro 代码生成统计报告');
  lines.push('='.repeat(70));
  lines.push('');
  lines.push('## 总体统计');
  lines.push(`- 总执行次数: ${summary.totalExecutions}`);
  lines.push(`- fsWrite 新建文件总行数: ${summary.totalFsWriteLines}`);
  lines.push(`- strReplace 新增行数: ${summary.totalStrReplaceAdded}`);
  lines.push(`- strReplace 删除行数: ${summary.totalStrReplaceDeleted}`);
  lines.push(`- 净增代码行数: ${summary.netLines}`);
  lines.push('');

  // 按月统计
  lines.push('## 按月统计');
  lines.push('-'.repeat(70));
  lines.push(`${'月份'.padEnd(10)} ${'新建行数'.padEnd(10)} ${'修改+行'.padEnd(10)} ${'修改-行'.padEnd(10)} ${'净增行数'.padEnd(10)} ${'执行次数'.padEnd(8)}`);
  lines.push('-'.repeat(70));

  const sortedMonths = Object.keys(monthlyStats).sort();
  for (const month of sortedMonths) {
    const stats = monthlyStats[month];
    lines.push(
      `${month.padEnd(10)} ${String(stats.fsWriteLines).padEnd(10)} ` +
      `${String(stats.strReplaceAdded).padEnd(10)} ${String(stats.strReplaceDeleted).padEnd(10)} ` +
      `${String(stats.netLines).padEnd(10)} ${String(stats.executionCount).padEnd(8)}`
    );
  }
  lines.push('-'.repeat(70));
  lines.push('');

  // 按日期统计
  lines.push('## 按日期统计');
  lines.push('-'.repeat(70));
  lines.push(`${'日期'.padEnd(12)} ${'新建行数'.padEnd(10)} ${'修改+行'.padEnd(10)} ${'修改-行'.padEnd(10)} ${'执行次数'.padEnd(8)}`);
  lines.push('-'.repeat(70));

  const sortedDates = Object.keys(dailyStats).sort();
  for (const date of sortedDates) {
    const stats = dailyStats[date];
    lines.push(
      `${date.padEnd(12)} ${String(stats.fsWriteLines).padEnd(10)} ` +
      `${String(stats.strReplaceAdded).padEnd(10)} ${String(stats.strReplaceDeleted).padEnd(10)} ` +
      `${String(stats.executionCount).padEnd(8)}`
    );
  }
  lines.push('-'.repeat(70));

  return lines.join('\n');
}
