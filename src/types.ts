/**
 * Core types for winlog-mcp
 */

/** Allowed event log channels */
export const ALLOWED_CHANNELS = ['System', 'Application'] as const;
export type AllowedChannel = (typeof ALLOWED_CHANNELS)[number];

/** Event severity levels */
export type EventLevel = 'Critical' | 'Error' | 'Warning' | 'Information' | 'Verbose';

/** Normalized event record */
export interface EventRecord {
  /** Unique record ID within the channel */
  recordId: number;
  /** Event ID */
  eventId: number;
  /** Severity level */
  level: EventLevel;
  /** ISO 8601 timestamp */
  timeCreated: string;
  /** Provider/source name */
  provider: string;
  /** Human-readable message */
  message: string;
  /** Computer name */
  computer: string;
  /** Source channel */
  channel: string;
  /** User SID if available */
  userId?: string;
  /** Task category */
  task?: number;
  /** Opcode */
  opcode?: number;
  /** Keywords */
  keywords?: string;
}

/** Crash signal with classification */
export interface CrashSignal {
  /** The event that indicates a crash */
  event: EventRecord;
  /** Classification of crash type */
  crashType: 'ApplicationCrash' | 'ApplicationHang' | 'SystemCrash' | 'ServiceFailure' | 'WHEA';
  /** Severity rating */
  severity: 'Critical' | 'High' | 'Medium';
  /** Faulting application name if available */
  faultingApplication?: string;
  /** Faulting module if available */
  faultingModule?: string;
  /** Exception code if available */
  exceptionCode?: string;
}

/** Channel information */
export interface ChannelInfo {
  /** Channel name */
  name: string;
  /** Whether the channel is enabled */
  enabled: boolean;
  /** Number of records in the log */
  recordCount: number;
  /** Log file size in bytes */
  fileSizeBytes?: number;
  /** Oldest event timestamp */
  oldestRecordTime?: string;
  /** Newest event timestamp */
  newestRecordTime?: string;
}

/** Audit log entry */
export interface AuditEntry {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Event type */
  event: 'tool_call' | 'tool_success' | 'tool_error' | 'server_start' | 'server_stop';
  /** Tool name if applicable */
  tool?: string;
  /** Parameters passed to tool */
  params?: Record<string, unknown>;
  /** Result count if applicable */
  resultCount?: number;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Error message if failed */
  error?: string;
}

/** Configuration limits */
export interface Config {
  /** Maximum events per query (1-1000) */
  maxEventsPerQuery: number;
  /** Maximum time range in hours (1-168) */
  maxTimeRangeHours: number;
  /** Query timeout in milliseconds */
  queryTimeoutMs: number;
  /** XPath maximum length */
  xpathMaxLength: number;
}

/** Default configuration */
export const DEFAULT_CONFIG: Config = {
  maxEventsPerQuery: 1000,
  maxTimeRangeHours: 168,
  queryTimeoutMs: 30000,
  xpathMaxLength: 500,
};
