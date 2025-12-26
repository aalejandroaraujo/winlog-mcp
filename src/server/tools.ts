/**
 * MCP Tool Definitions
 *
 * Defines the four allowed tools for the winlog-mcp server:
 * - list_channels: List available event log channels
 * - query_events: Query events with filters
 * - get_event: Get a single event by ID
 * - find_crash_signals: Find crash/error signals
 */

import { z } from 'zod';
import {
  queryEvents,
  getEvent,
  listChannels,
  findCrashSignals,
} from '../eventlog/index.js';
import { getAllowedChannels, ChannelNotAllowedError } from '../security/index.js';
import { withAudit } from '../audit/index.js';
import { DEFAULT_CONFIG, ALLOWED_CHANNELS } from '../types.js';

/**
 * Tool definitions for MCP registration.
 */
export const TOOL_DEFINITIONS = [
  {
    name: 'list_channels',
    description: 'List available Windows Event Log channels. Returns channel metadata including name, enabled status, and record count.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: 'query_events',
    description: `Query events from a Windows Event Log channel. Allowed channels: ${ALLOWED_CHANNELS.join(', ')}. Returns events in reverse chronological order (newest first).`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        channel: {
          type: 'string',
          description: `Channel name. Must be one of: ${ALLOWED_CHANNELS.join(', ')}`,
          enum: [...ALLOWED_CHANNELS],
        },
        xpath: {
          type: 'string',
          description: 'Optional XPath filter expression (e.g., "*[System[EventID=1000]]")',
        },
        startTime: {
          type: 'string',
          description: 'Optional start time in ISO 8601 format',
        },
        endTime: {
          type: 'string',
          description: 'Optional end time in ISO 8601 format',
        },
        maxEvents: {
          type: 'number',
          description: 'Maximum number of events to return (1-1000, default 100)',
          minimum: 1,
          maximum: 1000,
        },
      },
      required: ['channel'],
    },
  },
  {
    name: 'get_event',
    description: 'Get a single event by its record ID from a specific channel.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        channel: {
          type: 'string',
          description: `Channel name. Must be one of: ${ALLOWED_CHANNELS.join(', ')}`,
          enum: [...ALLOWED_CHANNELS],
        },
        recordId: {
          type: 'number',
          description: 'The record ID of the event to retrieve',
        },
      },
      required: ['channel', 'recordId'],
    },
  },
  {
    name: 'find_crash_signals',
    description: 'Find crash and error signals in the event logs. Detects application crashes, system crashes (BSOD), service failures, and hardware errors (WHEA).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        hours: {
          type: 'number',
          description: 'Number of hours to look back (1-168, default 24)',
          minimum: 1,
          maximum: 168,
        },
      },
      required: [] as string[],
    },
  },
];

/**
 * Input schemas for validation.
 */
const ListChannelsInput = z.object({});

const QueryEventsInput = z.object({
  channel: z.enum(ALLOWED_CHANNELS),
  xpath: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  maxEvents: z.number().min(1).max(1000).optional(),
});

const GetEventInput = z.object({
  channel: z.enum(ALLOWED_CHANNELS),
  recordId: z.number().int().nonnegative(),
});

const FindCrashSignalsInput = z.object({
  hours: z.number().min(1).max(168).optional(),
});

/**
 * Tool handlers with audit logging.
 */
export const toolHandlers = {
  list_channels: withAudit('list_channels', async (_params: Record<string, unknown>) => {
    ListChannelsInput.parse(_params);
    const channels = await listChannels(DEFAULT_CONFIG);
    return {
      channels,
      allowedChannels: getAllowedChannels(),
    };
  }),

  query_events: withAudit('query_events', async (params: Record<string, unknown>) => {
    const validated = QueryEventsInput.parse(params);

    const events = await queryEvents(
      validated.channel,
      {
        xpath: validated.xpath,
        startTime: validated.startTime,
        endTime: validated.endTime,
        maxEvents: validated.maxEvents,
      },
      DEFAULT_CONFIG
    );

    return {
      events,
      count: events.length,
      channel: validated.channel,
      truncated: events.length >= (validated.maxEvents ?? 100),
    };
  }),

  get_event: withAudit('get_event', async (params: Record<string, unknown>) => {
    const validated = GetEventInput.parse(params);

    const event = await getEvent(validated.channel, validated.recordId, DEFAULT_CONFIG);

    if (!event) {
      return {
        found: false,
        channel: validated.channel,
        recordId: validated.recordId,
      };
    }

    return {
      found: true,
      event,
    };
  }),

  find_crash_signals: withAudit('find_crash_signals', async (params: Record<string, unknown>) => {
    const validated = FindCrashSignalsInput.parse(params);

    const crashes = await findCrashSignals(
      {
        hours: validated.hours,
      },
      DEFAULT_CONFIG
    );

    // Group by crash type
    const summary = {
      total: crashes.length,
      byCrashType: {} as Record<string, number>,
      bySeverity: {
        Critical: 0,
        High: 0,
        Medium: 0,
      },
    };

    for (const crash of crashes) {
      summary.byCrashType[crash.crashType] = (summary.byCrashType[crash.crashType] || 0) + 1;
      summary.bySeverity[crash.severity]++;
    }

    return {
      crashes,
      summary,
      hoursSearched: validated.hours ?? 24,
    };
  }),
};

/**
 * Dispatches a tool call to the appropriate handler.
 *
 * @param name - Tool name
 * @param params - Tool parameters
 * @returns Tool result
 */
export async function dispatchTool(
  name: string,
  params: Record<string, unknown>
): Promise<unknown> {
  const handler = toolHandlers[name as keyof typeof toolHandlers];

  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    return await handler(params);
  } catch (err) {
    // Re-throw with appropriate error format
    if (err instanceof z.ZodError) {
      throw new Error(`Invalid parameters: ${err.errors.map((e) => e.message).join(', ')}`);
    }
    if (err instanceof ChannelNotAllowedError) {
      throw err;
    }
    throw err;
  }
}
