/**
 * Kiro Metrics 类型定义
 */

/** 文件操作类型 */
export interface FileOperation {
  type: 'fsWrite' | 'fsAppend' | 'strReplace';
  path: string;
  lines?: number;      // fsWrite/fsAppend 时的行数
  added?: number;      // strReplace 时的新增行数
  deleted?: number;    // strReplace 时的删除行数
}

/** 单次执行结果 */
export interface ExecutionResult {
  executionId: string;
  startTime: Date | null;
  endTime: Date | null;
  status: string;
  workflowType: string;
  /** Kiro 用户 turn；内部/子 execution 不计入 Chat_MessagesSent。 */
  isUserTurn?: boolean;
  fsWriteLines: number;
  strReplaceAdded: number;
  strReplaceDeleted: number;
  fileOperations: FileOperation[];
}

/** 日统计 */
export interface DailyStats {
  fsWriteLines: number;
  strReplaceAdded: number;
  strReplaceDeleted: number;
  executionCount: number;
  filesCreated: number;
  filesModified: number;
}

/** 月统计 */
export interface MonthlyStats extends DailyStats {
  netLines: number;
  activeDays: number;
}

/** 总体统计 */
export interface Summary {
  totalExecutions: number;
  totalFsWriteLines: number;
  totalStrReplaceAdded: number;
  totalStrReplaceDeleted: number;
  netLines: number;
}

/** 导出的 JSON 结构 */
export interface MetricsExport {
  generatedAt: string;
  summary: Summary;
  monthlyStats: Record<string, MonthlyStats>;
  dailyStats: Record<string, DailyStats>;
  executions: Array<{
    executionId: string;
    startTime: string | null;
    endTime: string | null;
    status: string;
    workflowType: string;
    fsWriteLines: number;
    strReplaceAdded: number;
    strReplaceDeleted: number;
    fileOperations: FileOperation[];
  }>;
}

/** Tool Use 结构 */
export interface ToolUse {
  id?: string;
  name: string;
  args?: {
    path?: string;
    text?: string;
    oldStr?: string;
    newStr?: string;
  };
  emittedAt?: number;
}

/** 执行日志中的 Action */
export interface ExecutionAction {
  type?: string;
  executionId?: string;
  actionId?: string;
  actionType?: string;
  actionState?: string;
  status?: string;
  state?: string;
  emittedAt?: number;
  input?: {
    [key: string]: unknown;
    path?: string;
    file?: string;
    filePath?: string;
    file_path?: string;
    targetFile?: string;
    target_file?: string;
    text?: string;
    content?: string;
    modifiedContent?: string;
    modified_content?: string;
    originalContent?: string;
    original_content?: string;
    oldStr?: string;
    old_str?: string;
    oldText?: string;
    old_text?: string;
    newStr?: string;
    new_str?: string;
    newText?: string;
    new_text?: string;
  };
}

/** 执行日志文件结构 */
export interface ExecutionLog {
  executionId?: string;
  workflowType?: string;
  status?: string;
  startTime?: number;
  endTime?: number;
  metadata?: {
    endTime?: number;
  };
  actions?: ExecutionAction[];
  context?: {
    messages?: Array<{
      entries?: Array<{
        type?: string;
        name?: string;
        id?: string;
        args?: Record<string, unknown>;
      }>;
    }>;
  };
}
