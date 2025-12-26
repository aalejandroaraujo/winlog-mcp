# winlog-mcp

Read-only MCP server for Windows 11 Event Logs that lets an LLM (via any MCP client) discover channels, query events, and detect crash/incident signals with strict security controls (allowlists, caps, auditing).

## Features

- **Read-only access** to System and Application event logs
- **Security by design**: Channel allowlist, XPath validation, result caps
- **Crash detection**: Automatically identifies application crashes, system crashes, service failures, and WHEA errors
- **Audit logging**: All tool calls are logged locally for compliance
- **No elevated privileges required**: Runs as a standard user (member of Event Log Readers group)

## Requirements

- Windows 11 (21H2 or later)
- Node.js 20 or later
- User account in the "Event Log Readers" group (for non-admin access)

## Installation

```bash
npm install
npm run build
```

## Quick Start

### 1. Add yourself to Event Log Readers (one-time setup)

Run this in an elevated PowerShell:

```powershell
Add-LocalGroupMember -Group "Event Log Readers" -Member $env:USERNAME
```

Then **sign out and back in** for the group membership to take effect.

### 2. Configure your MCP client

Add to your Claude Desktop configuration (`%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "winlog": {
      "command": "node",
      "args": ["C:/path/to/winlog-mcp/dist/index.js"]
    }
  }
}
```

### 3. Restart Claude Desktop

The winlog tools should now be available.

## Available Tools

### `list_channels`

List available Windows Event Log channels with metadata.

```
No parameters required.
```

Returns:
- Channel names (System, Application)
- Enabled status
- Record counts

### `query_events`

Query events from an allowed channel with optional filters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| channel | string | Yes | "System" or "Application" |
| xpath | string | No | XPath filter (e.g., `*[System[EventID=1000]]`) |
| startTime | string | No | ISO 8601 timestamp |
| endTime | string | No | ISO 8601 timestamp |
| maxEvents | number | No | 1-1000, default 100 |

Example prompts:
- "Show me recent errors from the System log"
- "Find all events from the last hour in Application"
- "Query EventID 1000 from Application log"

### `get_event`

Get a single event by its record ID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| channel | string | Yes | "System" or "Application" |
| recordId | number | Yes | The event record ID |

### `find_crash_signals`

Find crash and error signals in the event logs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| hours | number | No | Look back N hours (1-168, default 24) |

Detects:
- Application crashes (EventID 1000, 1001)
- Application hangs (EventID 1002)
- System crashes (BugCheck, WHEA)
- Service failures (EventID 7031, 7034, 7024)

Example prompts:
- "Have there been any crashes in the last 24 hours?"
- "Find system errors from the past week"
- "What applications have crashed recently?"

## Security Model

### Channel Allowlist

Only these channels are accessible:
- `System`
- `Application`

The `Security` channel and all other channels are **explicitly blocked**.

### XPath Validation

Safe XPath constructs are allowed:
- Event selection: `*[System[...]]`
- Filters: `EventID=`, `Level=`, `Provider[@Name=]`, `TimeCreated`
- Operators: `and`, `or`, `=`, `!=`, `>`, `<`, `>=`, `<=`

Blocked constructs:
- `document()` (XXE risk)
- All function calls (`concat()`, `string()`, etc.)
- Variable references (`$var`)
- Axis traversal (`..`, `preceding::`, etc.)

### Limits

| Limit | Value |
|-------|-------|
| Max events per query | 1000 |
| Max time range | 168 hours (7 days) |
| Query timeout | 30 seconds |
| XPath max length | 500 characters |

### Audit Logging

All tool calls are logged to:
```
%LOCALAPPDATA%\winlog-mcp\logs\audit-YYYY-MM-DD.jsonl
```

Each entry includes timestamp, tool name, parameters, result count, and duration.

## Development

### Running tests

```bash
npm test
```

### Building

```bash
npm run build
```

### Project structure

```
src/
├── index.ts              # Entry point
├── types.ts              # Type definitions
├── server/
│   ├── mcp-server.ts     # MCP server implementation
│   └── tools.ts          # Tool definitions and handlers
├── security/
│   ├── channel-guard.ts  # Channel allowlist enforcement
│   └── xpath-validator.ts # XPath validation
├── eventlog/
│   └── powershell-reader.ts # PowerShell-based event log access
└── audit/
    └── logger.ts         # Audit logging
```

## Troubleshooting

### "Access denied" when querying logs

Ensure your user is in the Event Log Readers group:

```powershell
whoami /groups | findstr "Event Log Readers"
```

If not listed, add yourself and sign out/in.

### PowerShell execution policy errors

The server uses `-ExecutionPolicy Bypass` for its internal scripts. If you see policy errors, check your system-wide policy:

```powershell
Get-ExecutionPolicy -List
```

### No events returned

1. Check that the channel has events: `Get-WinEvent -LogName System -MaxEvents 1`
2. Verify your XPath syntax is correct
3. Check the time range isn't too narrow

## License

MIT
