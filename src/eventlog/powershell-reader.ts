/**
 * PowerShell Event Log Reader
 *
 * Executes Get-WinEvent via PowerShell to read Windows Event Logs.
 * Uses fixed script templates with parameter substitution to prevent injection.
 */

import { spawn } from 'child_process';
import {
  type EventRecord,
  type EventLevel,
  type ChannelInfo,
  type AllowedChannel,
  type Config,
  DEFAULT_CONFIG,
} from '../types.js';
import { validateChannel } from '../security/channel-guard.js';
import { validateXPath } from '../security/xpath-validator.js';

/** Raw event data from PowerShell */
interface RawPowerShellEvent {
  RecordId: number;
  Id: number;
  Level: number;
  LevelDisplayName: string;
  TimeCreated: string;
  ProviderName: string;
  Message: string;
  MachineName: string;
  LogName: string;
  UserId?: string;
  Task?: number;
  Opcode?: number;
  Keywords?: string;
}

/** Raw channel info from PowerShell */
interface RawChannelInfo {
  LogName: string;
  IsEnabled: boolean;
  RecordCount: number;
  FileSize?: number;
  OldestRecordTime?: string;
  NewestRecordTime?: string;
}

/**
 * Maps Windows Event Log level numbers to string names.
 */
function mapLevel(level: number, displayName?: string): EventLevel {
  // Use display name if available and recognized
  if (displayName) {
    const normalized = displayName.toLowerCase();
    if (normalized === 'critical') return 'Critical';
    if (normalized === 'error') return 'Error';
    if (normalized === 'warning') return 'Warning';
    if (normalized === 'information' || normalized === 'info') return 'Information';
    if (normalized === 'verbose') return 'Verbose';
  }

  // Fall back to numeric level
  switch (level) {
    case 1:
      return 'Critical';
    case 2:
      return 'Error';
    case 3:
      return 'Warning';
    case 4:
      return 'Information';
    case 5:
      return 'Verbose';
    default:
      return 'Information';
  }
}

/**
 * Parses raw PowerShell event into normalized EventRecord.
 */
function parseEvent(raw: RawPowerShellEvent): EventRecord {
  return {
    recordId: raw.RecordId,
    eventId: raw.Id,
    level: mapLevel(raw.Level, raw.LevelDisplayName),
    timeCreated: raw.TimeCreated,
    provider: raw.ProviderName,
    message: raw.Message || '',
    computer: raw.MachineName,
    channel: raw.LogName,
    userId: raw.UserId,
    task: raw.Task,
    opcode: raw.Opcode,
    keywords: raw.Keywords,
  };
}

/**
 * Executes a PowerShell script and returns the JSON output.
 *
 * @param script - The PowerShell script to execute
 * @param timeoutMs - Timeout in milliseconds
 * @returns Parsed JSON output
 */
async function executePowerShell<T>(script: string, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const ps = spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-Command', script,
    ], {
      windowsHide: true,
      timeout: timeoutMs,
    });

    let stdout = '';
    let stderr = '';

    ps.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    ps.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      ps.kill('SIGTERM');
      reject(new Error(`PowerShell command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    ps.on('close', (code) => {
      clearTimeout(timer);

      if (code !== 0) {
        reject(new Error(`PowerShell exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        // Handle empty output
        if (!stdout.trim()) {
          resolve([] as unknown as T);
          return;
        }

        const parsed = JSON.parse(stdout) as T;
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Failed to parse PowerShell output: ${err}`));
      }
    });

    ps.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn PowerShell: ${err.message}`));
    });
  });
}

/**
 * Escapes a string for safe use in PowerShell single-quoted strings.
 */
function escapePowerShellString(str: string): string {
  // In single-quoted strings, only single quotes need escaping (doubled)
  return str.replace(/'/g, "''");
}

/**
 * Queries events from an allowed channel.
 *
 * @param channel - The channel to query (will be validated)
 * @param options - Query options
 * @param config - Configuration limits
 * @returns Array of normalized event records
 */
export async function queryEvents(
  channel: string,
  options: {
    xpath?: string;
    startTime?: string;
    endTime?: string;
    maxEvents?: number;
  } = {},
  config: Config = DEFAULT_CONFIG
): Promise<EventRecord[]> {
  // Validate channel (throws if not allowed)
  const validChannel = validateChannel(channel);

  // Validate and sanitize XPath
  const validXPath = validateXPath(options.xpath, config);

  // Clamp maxEvents to allowed range
  const maxEvents = Math.min(
    Math.max(1, options.maxEvents ?? 100),
    config.maxEventsPerQuery
  );

  // Build the PowerShell script using fixed template
  const scriptParts: string[] = [
    '$ErrorActionPreference = "Stop"',
    `$logName = '${escapePowerShellString(validChannel)}'`,
    `$maxEvents = ${maxEvents}`,
  ];

  // Build filter hash table
  if (validXPath) {
    scriptParts.push(`$filterXPath = '${escapePowerShellString(validXPath)}'`);
    scriptParts.push(`$filter = @{ LogName = $logName; FilterXPath = $filterXPath }`);
  } else {
    scriptParts.push(`$filter = @{ LogName = $logName }`);
  }

  // Add time filters if provided
  if (options.startTime) {
    const startDate = new Date(options.startTime);
    if (isNaN(startDate.getTime())) {
      throw new Error('Invalid startTime format');
    }
    scriptParts.push(`$filter['StartTime'] = [DateTime]'${startDate.toISOString()}'`);
  }

  if (options.endTime) {
    const endDate = new Date(options.endTime);
    if (isNaN(endDate.getTime())) {
      throw new Error('Invalid endTime format');
    }
    scriptParts.push(`$filter['EndTime'] = [DateTime]'${endDate.toISOString()}'`);
  }

  // Query and format output
  scriptParts.push(`
try {
  $events = Get-WinEvent -FilterHashtable $filter -MaxEvents $maxEvents -ErrorAction Stop
  $events | ForEach-Object {
    [PSCustomObject]@{
      RecordId = $_.RecordId
      Id = $_.Id
      Level = $_.Level
      LevelDisplayName = $_.LevelDisplayName
      TimeCreated = $_.TimeCreated.ToString('o')
      ProviderName = $_.ProviderName
      Message = $_.Message
      MachineName = $_.MachineName
      LogName = $_.LogName
      UserId = if ($_.UserId) { $_.UserId.ToString() } else { $null }
      Task = $_.Task
      Opcode = $_.Opcode
      Keywords = $_.KeywordsDisplayNames -join ', '
    }
  } | ConvertTo-Json -Depth 3 -Compress
} catch [System.Exception] {
  if ($_.Exception.Message -match 'No events were found') {
    Write-Output '[]'
  } else {
    throw
  }
}
`);

  const script = scriptParts.join('\n');

  const rawEvents = await executePowerShell<RawPowerShellEvent | RawPowerShellEvent[]>(
    script,
    config.queryTimeoutMs
  );

  // PowerShell returns single object if only one result, array otherwise
  const eventsArray = Array.isArray(rawEvents) ? rawEvents : (rawEvents ? [rawEvents] : []);

  return eventsArray.map(parseEvent);
}

/**
 * Gets a single event by record ID.
 *
 * @param channel - The channel to query
 * @param recordId - The record ID to fetch
 * @param config - Configuration limits
 * @returns The event record or undefined if not found
 */
export async function getEvent(
  channel: string,
  recordId: number,
  config: Config = DEFAULT_CONFIG
): Promise<EventRecord | undefined> {
  const validChannel = validateChannel(channel);

  if (!Number.isInteger(recordId) || recordId < 0) {
    throw new Error('recordId must be a non-negative integer');
  }

  const script = `
$ErrorActionPreference = "Stop"
try {
  $event = Get-WinEvent -FilterHashtable @{
    LogName = '${escapePowerShellString(validChannel)}'
  } -MaxEvents 1000 | Where-Object { $_.RecordId -eq ${recordId} } | Select-Object -First 1

  if ($event) {
    [PSCustomObject]@{
      RecordId = $event.RecordId
      Id = $event.Id
      Level = $event.Level
      LevelDisplayName = $event.LevelDisplayName
      TimeCreated = $event.TimeCreated.ToString('o')
      ProviderName = $event.ProviderName
      Message = $event.Message
      MachineName = $event.MachineName
      LogName = $event.LogName
      UserId = if ($event.UserId) { $event.UserId.ToString() } else { $null }
      Task = $event.Task
      Opcode = $event.Opcode
      Keywords = $event.KeywordsDisplayNames -join ', '
    } | ConvertTo-Json -Depth 3 -Compress
  } else {
    Write-Output 'null'
  }
} catch {
  Write-Output 'null'
}
`;

  const raw = await executePowerShell<RawPowerShellEvent | null>(script, config.queryTimeoutMs);

  if (!raw) {
    return undefined;
  }

  return parseEvent(raw);
}

/**
 * Gets channel information.
 *
 * @param channel - The channel to query
 * @param config - Configuration limits
 * @returns Channel information
 */
export async function getChannelInfo(
  channel: string,
  config: Config = DEFAULT_CONFIG
): Promise<ChannelInfo> {
  const validChannel = validateChannel(channel);

  const script = `
$ErrorActionPreference = "Stop"
$log = Get-WinEvent -ListLog '${escapePowerShellString(validChannel)}' -ErrorAction Stop

# Get oldest and newest record times
$oldest = $null
$newest = $null

try {
  $oldestEvent = Get-WinEvent -FilterHashtable @{ LogName = '${escapePowerShellString(validChannel)}' } -MaxEvents 1 -Oldest -ErrorAction SilentlyContinue
  if ($oldestEvent) { $oldest = $oldestEvent.TimeCreated.ToString('o') }

  $newestEvent = Get-WinEvent -FilterHashtable @{ LogName = '${escapePowerShellString(validChannel)}' } -MaxEvents 1 -ErrorAction SilentlyContinue
  if ($newestEvent) { $newest = $newestEvent.TimeCreated.ToString('o') }
} catch { }

[PSCustomObject]@{
  LogName = $log.LogName
  IsEnabled = $log.IsEnabled
  RecordCount = $log.RecordCount
  FileSize = $log.FileSize
  OldestRecordTime = $oldest
  NewestRecordTime = $newest
} | ConvertTo-Json -Compress
`;

  const raw = await executePowerShell<RawChannelInfo>(script, config.queryTimeoutMs);

  return {
    name: raw.LogName,
    enabled: raw.IsEnabled,
    recordCount: raw.RecordCount ?? 0,
    fileSizeBytes: raw.FileSize,
    oldestRecordTime: raw.OldestRecordTime,
    newestRecordTime: raw.NewestRecordTime,
  };
}

/**
 * Lists all allowed channels with their information.
 *
 * @param config - Configuration limits
 * @returns Array of channel information
 */
export async function listChannels(
  config: Config = DEFAULT_CONFIG
): Promise<ChannelInfo[]> {
  const channels: ChannelInfo[] = [];

  for (const channel of ['System', 'Application'] as const) {
    try {
      const info = await getChannelInfo(channel, config);
      channels.push(info);
    } catch {
      // If we can't read a channel, include it with minimal info
      channels.push({
        name: channel,
        enabled: false,
        recordCount: 0,
      });
    }
  }

  return channels;
}

/**
 * Crash signal detection patterns.
 */
const CRASH_PATTERNS: Record<string, { providers: string[]; eventIds: number[] }> = {
  ApplicationCrash: {
    providers: ['Application Error', 'Windows Error Reporting'],
    eventIds: [1000, 1001],
  },
  ApplicationHang: {
    providers: ['Application Hang'],
    eventIds: [1002],
  },
  SystemCrash: {
    providers: ['Microsoft-Windows-WER-SystemErrorReporting', 'BugCheck'],
    eventIds: [1001, 1],
  },
  ServiceFailure: {
    providers: ['Service Control Manager'],
    eventIds: [7031, 7034, 7024],
  },
  WHEA: {
    providers: ['Microsoft-Windows-WHEA-Logger'],
    eventIds: [17, 18, 19, 47],
  },
};

/**
 * Finds crash signals in the event logs.
 *
 * @param options - Query options
 * @param config - Configuration limits
 * @returns Array of crash signals
 */
export async function findCrashSignals(
  options: {
    hours?: number;
    channels?: AllowedChannel[];
  } = {},
  config: Config = DEFAULT_CONFIG
): Promise<{
  event: EventRecord;
  crashType: string;
  severity: 'Critical' | 'High' | 'Medium';
  faultingApplication?: string;
  faultingModule?: string;
}[]> {
  const hours = Math.min(Math.max(1, options.hours ?? 24), config.maxTimeRangeHours);
  const channels = options.channels ?? (['System', 'Application'] as const);

  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const crashes: {
    event: EventRecord;
    crashType: string;
    severity: 'Critical' | 'High' | 'Medium';
    faultingApplication?: string;
    faultingModule?: string;
  }[] = [];

  for (const channel of channels) {
    // Validate each channel
    validateChannel(channel);

    // Build XPath to find crash-related events
    const eventIdFilters: string[] = [];
    for (const [, pattern] of Object.entries(CRASH_PATTERNS)) {
      for (const eventId of pattern.eventIds) {
        eventIdFilters.push(`EventID=${eventId}`);
      }
    }

    const xpath = `*[System[(${eventIdFilters.join(' or ')}) and TimeCreated[@SystemTime>='${startTime}']]]`;

    try {
      const events = await queryEvents(channel, { xpath, maxEvents: 200 }, config);

      for (const event of events) {
        // Match to crash pattern
        for (const [crashType, pattern] of Object.entries(CRASH_PATTERNS)) {
          const providerMatch = pattern.providers.some(
            (p) => event.provider.toLowerCase().includes(p.toLowerCase())
          );
          const eventIdMatch = pattern.eventIds.includes(event.eventId);

          if (providerMatch || eventIdMatch) {
            // Determine severity
            let severity: 'Critical' | 'High' | 'Medium' = 'Medium';
            if (crashType === 'SystemCrash' || crashType === 'WHEA') {
              severity = 'Critical';
            } else if (crashType === 'ApplicationCrash' || crashType === 'ServiceFailure') {
              severity = 'High';
            }

            // Try to extract faulting application from message
            let faultingApplication: string | undefined;
            let faultingModule: string | undefined;

            const appMatch = event.message.match(/Faulting application name:\s*([^\r\n,]+)/i);
            if (appMatch) {
              faultingApplication = appMatch[1].trim();
            }

            const moduleMatch = event.message.match(/Faulting module name:\s*([^\r\n,]+)/i);
            if (moduleMatch) {
              faultingModule = moduleMatch[1].trim();
            }

            crashes.push({
              event,
              crashType: crashType as keyof typeof CRASH_PATTERNS,
              severity,
              faultingApplication,
              faultingModule,
            });

            break; // Don't double-count
          }
        }
      }
    } catch {
      // Skip channel if inaccessible
    }
  }

  // Sort by time, newest first
  crashes.sort((a, b) =>
    new Date(b.event.timeCreated).getTime() - new Date(a.event.timeCreated).getTime()
  );

  return crashes;
}
