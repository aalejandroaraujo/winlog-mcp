/**
 * Audit Logger
 *
 * Logs all tool calls and server events for audit purposes.
 * Writes to a local JSON lines file in the user's app data directory.
 */

import { appendFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { type AuditEntry } from '../types.js';

/** Audit logger instance */
let logFilePath: string | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Gets the audit log directory path.
 */
function getAuditLogDir(): string {
  const localAppData = process.env.LOCALAPPDATA || join(process.env.USERPROFILE || '', 'AppData', 'Local');
  return join(localAppData, 'winlog-mcp', 'logs');
}

/**
 * Gets the current audit log file path.
 */
function getLogFilePath(): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return join(getAuditLogDir(), `audit-${date}.jsonl`);
}

/**
 * Initializes the audit logger.
 * Creates the log directory if it doesn't exist.
 */
async function initialize(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const dir = getAuditLogDir();
    await mkdir(dir, { recursive: true });
    logFilePath = getLogFilePath();
  })();

  return initPromise;
}

/**
 * Logs an audit entry.
 *
 * @param entry - The audit entry to log
 */
export async function logAudit(entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
  await initialize();

  // Update log file path in case date changed
  logFilePath = getLogFilePath();

  const fullEntry: AuditEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  const line = JSON.stringify(fullEntry) + '\n';

  try {
    await appendFile(logFilePath!, line, 'utf-8');
  } catch (err) {
    // Log to stderr if file write fails, but don't throw
    console.error('[AUDIT] Failed to write audit log:', err);
  }
}

/**
 * Logs a tool call.
 *
 * @param tool - Tool name
 * @param params - Tool parameters
 */
export async function logToolCall(tool: string, params: Record<string, unknown>): Promise<void> {
  await logAudit({
    event: 'tool_call',
    tool,
    params,
  });
}

/**
 * Logs a successful tool execution.
 *
 * @param tool - Tool name
 * @param resultCount - Number of results returned
 * @param durationMs - Execution duration in milliseconds
 */
export async function logToolSuccess(
  tool: string,
  resultCount: number,
  durationMs: number
): Promise<void> {
  await logAudit({
    event: 'tool_success',
    tool,
    resultCount,
    durationMs,
  });
}

/**
 * Logs a tool execution error.
 *
 * @param tool - Tool name
 * @param error - Error message
 * @param durationMs - Execution duration in milliseconds
 */
export async function logToolError(
  tool: string,
  error: string,
  durationMs: number
): Promise<void> {
  await logAudit({
    event: 'tool_error',
    tool,
    error,
    durationMs,
  });
}

/**
 * Logs server start.
 */
export async function logServerStart(): Promise<void> {
  await logAudit({
    event: 'server_start',
  });
}

/**
 * Logs server stop.
 */
export async function logServerStop(): Promise<void> {
  await logAudit({
    event: 'server_stop',
  });
}

/**
 * Creates an audit wrapper for a tool function.
 * Automatically logs call, success, and errors.
 *
 * @param tool - Tool name
 * @param fn - The function to wrap
 * @returns Wrapped function with audit logging
 */
export function withAudit<T extends Record<string, unknown>, R>(
  tool: string,
  fn: (params: T) => Promise<R>
): (params: T) => Promise<R> {
  return async (params: T): Promise<R> => {
    const startTime = Date.now();

    await logToolCall(tool, params as Record<string, unknown>);

    try {
      const result = await fn(params);
      const durationMs = Date.now() - startTime;

      // Determine result count
      let resultCount = 1;
      if (Array.isArray(result)) {
        resultCount = result.length;
      } else if (result && typeof result === 'object' && 'events' in result) {
        resultCount = (result as { events: unknown[] }).events?.length ?? 0;
      }

      await logToolSuccess(tool, resultCount, durationMs);
      return result;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      await logToolError(tool, errorMessage, durationMs);
      throw err;
    }
  };
}
