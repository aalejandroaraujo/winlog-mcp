#!/usr/bin/env node
/**
 * winlog-mcp - Read-only MCP server for Windows Event Logs
 *
 * Entry point for the MCP server.
 */

import { startServer } from './server/index.js';

// Check if running on Windows
if (process.platform !== 'win32') {
  console.error('Error: winlog-mcp only runs on Windows');
  process.exit(1);
}

// Start the server
startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
