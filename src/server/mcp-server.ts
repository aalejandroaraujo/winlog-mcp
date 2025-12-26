/**
 * MCP Server Implementation
 *
 * Implements the Model Context Protocol server for winlog-mcp.
 * Uses stdio transport for local communication.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TOOL_DEFINITIONS, dispatchTool } from './tools.js';
import { listChannels } from '../eventlog/index.js';
import { getAllowedChannels } from '../security/index.js';
import { logServerStart, logServerStop } from '../audit/index.js';
import { DEFAULT_CONFIG, ALLOWED_CHANNELS } from '../types.js';

/**
 * Creates and configures the MCP server.
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: 'winlog-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Register tool listing handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOL_DEFINITIONS,
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await dispatchTool(name, (args ?? {}) as Record<string, unknown>);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: message }),
          },
        ],
        isError: true,
      };
    }
  });

  // Register resource listing handler
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'winlog://channels',
          name: 'Event Log Channels',
          description: `Available Windows Event Log channels. Allowed: ${ALLOWED_CHANNELS.join(', ')}`,
          mimeType: 'application/json',
        },
      ],
    };
  });

  // Register resource read handler
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (uri === 'winlog://channels') {
      const channels = await listChannels(DEFAULT_CONFIG);

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                channels,
                allowedChannels: getAllowedChannels(),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  });

  return server;
}

/**
 * Starts the MCP server with stdio transport.
 */
export async function startServer(): Promise<void> {
  await logServerStart();

  const server = createServer();
  const transport = new StdioServerTransport();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await logServerStop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await logServerStop();
    process.exit(0);
  });

  await server.connect(transport);
}
