# Architecture

## Document Information
- **Project**: winlog-mcp
- **Version**: 0.1.0
- **Phase**: 0 (Documentation)
- **Last Updated**: 2025-12-26

---

## 1. Overview

winlog-mcp is a Model Context Protocol (MCP) server that provides read-only access to Windows Event Logs. The architecture prioritizes security, simplicity, and extensibility.

---

## 2. High-Level Architecture

### 2.1 System Context Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              Host Machine (Windows 11)                    │
│                                                                          │
│  ┌─────────────────────┐         ┌─────────────────────────────────────┐ │
│  │     MCP Client      │         │           winlog-mcp                │ │
│  │  (Claude Desktop,   │  stdio  │                                     │ │
│  │   VS Code, etc.)    │◄───────►│  ┌──────────┐    ┌───────────────┐  │ │
│  │                     │ JSON-RPC│  │   MCP    │    │  Event Log    │  │ │
│  └─────────────────────┘         │  │  Server  │───►│   Reader      │  │ │
│                                  │  └──────────┘    └───────┬───────┘  │ │
│                                  │                          │          │ │
│                                  └──────────────────────────┼──────────┘ │
│                                                             │            │
│                                                             ▼            │
│                                  ┌──────────────────────────────────────┐│
│                                  │      Windows Event Log Service       ││
│                                  │           (wevtsvc.dll)              ││
│                                  │                                      ││
│                                  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ││
│                                  │  │ System  │ │  App    │ │Security │ ││
│                                  │  │   Log   │ │  Log    │ │  Log    │ ││
│                                  │  │   ✅    │ │   ✅    │ │   ❌    │ ││
│                                  │  └─────────┘ └─────────┘ └─────────┘ ││
│                                  └──────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Transport Architecture

#### Phase 0: stdio Transport (Current)

```
┌─────────────┐      stdin       ┌─────────────┐
│  MCP Client │ ───────────────► │  winlog-mcp │
│             │ ◄─────────────── │   (Node.js) │
└─────────────┘      stdout      └─────────────┘
                    JSON-RPC 2.0
```

- Process spawned by MCP client
- Communication via stdin/stdout
- JSON-RPC 2.0 message format
- No network exposure

#### Future: HTTP Transport (Phase 1+)

```
┌─────────────┐      HTTPS       ┌─────────────┐
│  MCP Client │ ───────────────► │  winlog-mcp │
│  (Remote)   │ ◄─────────────── │   (HTTP)    │
└─────────────┘     SSE/JSON     └─────────────┘
                  Port 3000 (default)
```

- HTTP/HTTPS server mode
- Server-Sent Events for streaming
- Bearer token authentication
- TLS required for production

---

## 3. Component Architecture

### 3.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            winlog-mcp Server                            │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        Transport Layer                           │   │
│  │  ┌─────────────────┐              ┌─────────────────┐           │   │
│  │  │  StdioTransport │              │  HttpTransport  │           │   │
│  │  │    (Phase 0)    │              │   (Phase 1+)    │           │   │
│  │  └────────┬────────┘              └────────┬────────┘           │   │
│  └───────────┼────────────────────────────────┼─────────────────────┘   │
│              │                                │                         │
│              └────────────────┬───────────────┘                         │
│                               ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      MCP Protocol Handler                        │   │
│  │                                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │   │
│  │  │ToolRegistry  │  │ResourceRegistry│  │ProtocolNegotiator   │ │   │
│  │  └──────────────┘  └──────────────┘  └────────────────────────┘ │   │
│  └─────────────────────────────┬───────────────────────────────────┘   │
│                                │                                        │
│                                ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                       Security Layer                             │   │
│  │                                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │   │
│  │  │ RateLimiter  │  │ChannelGuard  │  │   XPathValidator      │ │   │
│  │  └──────────────┘  └──────────────┘  └────────────────────────┘ │   │
│  └─────────────────────────────┬───────────────────────────────────┘   │
│                                │                                        │
│                                ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                       Business Logic                             │   │
│  │                                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │   │
│  │  │ QueryService │  │ CrashDetector│  │   ChannelService      │ │   │
│  │  └──────────────┘  └──────────────┘  └────────────────────────┘ │   │
│  └─────────────────────────────┬───────────────────────────────────┘   │
│                                │                                        │
│                                ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Event Log Adapter                            │   │
│  │                                                                  │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │               WindowsEventLogReader                       │   │   │
│  │  │         (Native bindings to Windows API)                  │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────┬───────────────────────────────────┘   │
│                                │                                        │
│  ┌─────────────────────────────┴───────────────────────────────────┐   │
│  │                        Cross-Cutting                             │   │
│  │                                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │   │
│  │  │ AuditLogger  │  │ ErrorHandler │  │   Configuration       │ │   │
│  │  └──────────────┘  └──────────────┘  └────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Descriptions

| Component | Responsibility | Dependencies |
|-----------|---------------|--------------|
| **StdioTransport** | Handle stdin/stdout communication | MCP SDK |
| **HttpTransport** | Handle HTTP/SSE communication (future) | Express, MCP SDK |
| **ToolRegistry** | Register and dispatch MCP tools | MCP SDK |
| **ResourceRegistry** | Register and serve MCP resources | MCP SDK |
| **RateLimiter** | Enforce query rate limits | None |
| **ChannelGuard** | Validate channel access | Configuration |
| **XPathValidator** | Validate and sanitize XPath queries | None |
| **QueryService** | Execute event log queries | EventLogReader |
| **CrashDetector** | Identify crash/incident patterns | QueryService |
| **ChannelService** | Enumerate and describe channels | EventLogReader |
| **WindowsEventLogReader** | Native Windows API access | Node native addon |
| **AuditLogger** | Record all operations | File system |
| **ErrorHandler** | Consistent error handling | None |
| **Configuration** | Manage runtime settings | Environment |

---

## 4. Data Flow

### 4.1 Query Events Flow

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  MCP    │    │  MCP    │    │Security │    │ Query   │    │EventLog │
│ Client  │    │Protocol │    │ Layer   │    │Service  │    │ Reader  │
└────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘
     │              │              │              │              │
     │ query_events │              │              │              │
     │─────────────►│              │              │              │
     │              │              │              │              │
     │              │ validate     │              │              │
     │              │─────────────►│              │              │
     │              │              │              │              │
     │              │              │ check rate   │              │
     │              │              │────┐         │              │
     │              │              │    │         │              │
     │              │              │◄───┘         │              │
     │              │              │              │              │
     │              │              │ check channel│              │
     │              │              │────┐         │              │
     │              │              │    │         │              │
     │              │              │◄───┘         │              │
     │              │              │              │              │
     │              │              │ validate xpath              │
     │              │              │────┐         │              │
     │              │              │    │         │              │
     │              │              │◄───┘         │              │
     │              │              │              │              │
     │              │              │ execute      │              │
     │              │              │─────────────►│              │
     │              │              │              │              │
     │              │              │              │ read events  │
     │              │              │              │─────────────►│
     │              │              │              │              │
     │              │              │              │    events    │
     │              │              │              │◄─────────────│
     │              │              │              │              │
     │              │              │   results    │              │
     │              │              │◄─────────────│              │
     │              │              │              │              │
     │              │   results    │              │              │
     │              │◄─────────────│              │              │
     │              │              │              │              │
     │   response   │              │              │              │
     │◄─────────────│              │              │              │
     │              │              │              │              │
```

### 4.2 Error Handling Flow

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  MCP    │    │  MCP    │    │Security │    │  Error  │
│ Client  │    │Protocol │    │ Layer   │    │ Handler │
└────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘
     │              │              │              │
     │ query_events │              │              │
     │ (Security ch)│              │              │
     │─────────────►│              │              │
     │              │              │              │
     │              │ validate     │              │
     │              │─────────────►│              │
     │              │              │              │
     │              │              │ channel blocked
     │              │              │─────────────►│
     │              │              │              │
     │              │              │  error obj   │
     │              │              │◄─────────────│
     │              │              │              │
     │              │ MCP error    │              │
     │              │◄─────────────│              │
     │              │              │              │
     │   error      │              │              │
     │   response   │              │              │
     │◄─────────────│              │              │
     │              │              │              │
```

---

## 5. Module Structure

### 5.1 Directory Layout

```
winlog-mcp/
├── docs/                          # Documentation (Phase 0)
│   ├── 00-requirements.md
│   ├── 01-threat-model.md
│   ├── 02-permissions-matrix.md
│   ├── 03-architecture.md
│   ├── 04-test-plan.md
│   └── 05-release-checklist.md
├── src/
│   ├── index.ts                   # Entry point
│   ├── server.ts                  # MCP server setup
│   ├── transport/
│   │   ├── stdio.ts               # stdio transport (Phase 0)
│   │   └── http.ts                # HTTP transport (Phase 1+)
│   ├── protocol/
│   │   ├── tools.ts               # MCP tool definitions
│   │   └── resources.ts           # MCP resource definitions
│   ├── security/
│   │   ├── rate-limiter.ts        # Rate limiting
│   │   ├── channel-guard.ts       # Channel allowlist
│   │   └── xpath-validator.ts     # XPath validation
│   ├── services/
│   │   ├── query-service.ts       # Event query logic
│   │   ├── crash-detector.ts      # Crash detection
│   │   └── channel-service.ts     # Channel enumeration
│   ├── adapters/
│   │   └── event-log-reader.ts    # Windows API adapter
│   ├── utils/
│   │   ├── audit-logger.ts        # Audit logging
│   │   ├── error-handler.ts       # Error handling
│   │   └── config.ts              # Configuration
│   └── types/
│       └── index.ts               # TypeScript types
├── native/                        # Native addon (if needed)
│   ├── binding.gyp
│   └── src/
│       └── event-log.cc
├── test/
│   ├── unit/
│   ├── integration/
│   └── security/
├── package.json
├── tsconfig.json
└── README.md
```

### 5.2 Module Dependencies

```
                    ┌───────────────┐
                    │    index.ts   │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   server.ts   │
                    └───────┬───────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
    ┌───────────────┐ ┌───────────┐ ┌───────────────┐
    │   transport/  │ │ protocol/ │ │   security/   │
    │   stdio.ts    │ │ tools.ts  │ │rate-limiter.ts│
    └───────────────┘ │resources.ts│ │channel-guard.ts│
                      └─────┬─────┘ │xpath-validator│
                            │       └───────┬───────┘
                            │               │
                            └───────┬───────┘
                                    │
                                    ▼
                            ┌───────────────┐
                            │   services/   │
                            │query-service.ts│
                            │crash-detector.ts│
                            │channel-service.ts│
                            └───────┬───────┘
                                    │
                                    ▼
                            ┌───────────────┐
                            │   adapters/   │
                            │event-log-reader│
                            └───────────────┘
```

---

## 6. Interface Definitions

### 6.1 MCP Tools

#### query_events

```typescript
interface QueryEventsParams {
  channel: "System" | "Application";
  xpath?: string;
  startTime?: string;  // ISO 8601
  endTime?: string;    // ISO 8601
  limit?: number;      // 1-1000, default 100
}

interface EventRecord {
  eventId: number;
  level: "Critical" | "Error" | "Warning" | "Information" | "Verbose";
  timeCreated: string;  // ISO 8601
  provider: string;
  message: string;
  recordId: number;
  computer: string;
  rawXml?: string;
}

interface QueryEventsResult {
  events: EventRecord[];
  totalMatched: number;
  truncated: boolean;
}
```

#### get_crash_events

```typescript
interface GetCrashEventsParams {
  hours?: number;         // 1-168, default 24
  includeRelated?: boolean;  // default false
}

interface CrashEvent extends EventRecord {
  crashType: "Application" | "System" | "Service";
  severity: "Critical" | "High" | "Medium";
  faultingApplication?: string;
  faultingModule?: string;
  relatedEvents?: EventRecord[];
}

interface GetCrashEventsResult {
  crashes: CrashEvent[];
  summary: {
    total: number;
    byCrashType: Record<string, number>;
    bySeverity: Record<string, number>;
  };
}
```

#### get_channel_stats

```typescript
interface GetChannelStatsParams {
  channel: "System" | "Application";
}

interface ChannelStats {
  channel: string;
  recordCount: number;
  oldestRecord: string;  // ISO 8601
  newestRecord: string;  // ISO 8601
  sizeBytes: number;
  enabled: boolean;
}
```

### 6.2 MCP Resources

#### channels

```typescript
interface ChannelResource {
  uri: string;  // "winlog://channels"
  name: string;
  description: string;
  channels: ChannelInfo[];
}

interface ChannelInfo {
  name: string;
  provider: string;
  enabled: boolean;
  recordCount: number;
}
```

### 6.3 Internal Interfaces

#### EventLogReader

```typescript
interface IEventLogReader {
  queryEvents(
    channel: string,
    xpath: string,
    options: QueryOptions
  ): Promise<EventRecord[]>;

  getChannelInfo(channel: string): Promise<ChannelInfo>;

  listChannels(): Promise<ChannelInfo[]>;
}

interface QueryOptions {
  maxEvents: number;
  direction: "forward" | "reverse";
  timeout: number;
}
```

#### SecurityLayer

```typescript
interface IChannelGuard {
  isAllowed(channel: string): boolean;
  getAllowedChannels(): string[];
}

interface IXPathValidator {
  validate(xpath: string): ValidationResult;
  sanitize(xpath: string): string;
}

interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

interface IRateLimiter {
  acquire(clientId: string): Promise<boolean>;
  release(clientId: string): void;
  getStatus(clientId: string): RateLimitStatus;
}
```

---

## 7. Technology Stack

### 7.1 Runtime Dependencies

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Runtime | Node.js | >= 18.0.0 | JavaScript execution |
| MCP SDK | @modelcontextprotocol/sdk | ^1.0.0 | MCP protocol implementation |
| Event Log | windows-event-log (TBD) | TBD | Native Windows API bindings |
| Validation | zod | ^3.22.0 | Schema validation |
| Logging | pino | ^8.0.0 | Structured logging |

### 7.2 Development Dependencies

| Component | Technology | Purpose |
|-----------|------------|---------|
| Language | TypeScript 5.x | Type safety |
| Build | tsup or esbuild | Fast bundling |
| Testing | Vitest | Unit/integration testing |
| Linting | ESLint + Prettier | Code quality |

### 7.3 Native Bindings Strategy

**Option A: Existing Package**
- Use existing npm package with Windows Event Log bindings
- Pros: Faster development, community maintained
- Cons: May not have all required features

**Option B: Custom Native Addon**
- Build custom N-API addon using Windows Event Log API
- Pros: Full control, optimized for use case
- Cons: Development overhead, maintenance burden

**Option C: PowerShell Bridge**
- Execute PowerShell commands via child process
- Pros: No native compilation, easy implementation
- Cons: Performance overhead, parsing complexity

**Recommended**: Start with Option A or C for Phase 1, migrate to Option B if performance is insufficient.

---

## 8. Deployment Architecture

### 8.1 stdio Mode (Phase 0)

```
┌─────────────────────────────────────────────────────────────┐
│                     Host Machine                            │
│                                                             │
│  ┌──────────────────┐        ┌────────────────────────────┐ │
│  │   MCP Client     │        │       winlog-mcp           │ │
│  │ (Claude Desktop) │        │                            │ │
│  │                  │        │  ┌────────────────────────┐│ │
│  │  config.json:    │        │  │      node.exe          ││ │
│  │  {               │ spawn  │  │                        ││ │
│  │    "mcpServers": │───────►│  │  dist/index.js         ││ │
│  │    {             │        │  │                        ││ │
│  │      "winlog":   │ stdio  │  └────────────────────────┘│ │
│  │      {...}       │◄──────►│                            │ │
│  │    }             │        │  Audit logs:               │ │
│  │  }               │        │  %LOCALAPPDATA%/winlog-mcp/│ │
│  └──────────────────┘        └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 MCP Client Configuration

```json
{
  "mcpServers": {
    "winlog": {
      "command": "node",
      "args": ["C:/path/to/winlog-mcp/dist/index.js"],
      "env": {
        "WINLOG_MAX_EVENTS": "100",
        "WINLOG_MAX_HOURS": "24"
      }
    }
  }
}
```

### 8.3 HTTP Mode (Phase 1+ - Future)

```
┌─────────────────────────────────────────────────────────────┐
│                     Host Machine                            │
│                                                             │
│  ┌──────────────────┐        ┌────────────────────────────┐ │
│  │   MCP Client     │        │       winlog-mcp           │ │
│  │   (Remote)       │        │                            │ │
│  │                  │  HTTPS │  ┌────────────────────────┐│ │
│  │                  │───────►│  │    HTTP Server         ││ │
│  │                  │  :3000 │  │    (Express)           ││ │
│  │                  │◄───────│  │                        ││ │
│  │                  │  SSE   │  └────────────────────────┘│ │
│  └──────────────────┘        │                            │ │
│                              │  TLS Certificate required   │ │
│                              │  Bearer token auth          │ │
│                              └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Error Handling Strategy

### 9.1 Error Categories

| Category | HTTP Equivalent | Example |
|----------|-----------------|---------|
| Validation | 400 | Invalid XPath, bad channel |
| Not Found | 404 | Channel doesn't exist |
| Rate Limited | 429 | Too many requests |
| Internal | 500 | Event Log API failure |
| Timeout | 504 | Query took too long |

### 9.2 MCP Error Response Format

```typescript
interface McpError {
  code: number;
  message: string;
  data?: {
    errorCode: string;
    details?: unknown;
  };
}
```

### 9.3 Error Mapping

| Internal Code | MCP Code | Message Template |
|---------------|----------|------------------|
| CHANNEL_NOT_ALLOWED | -32602 | "Channel '{channel}' is not allowed" |
| XPATH_INVALID | -32602 | "Invalid XPath expression" |
| RATE_LIMITED | -32000 | "Rate limit exceeded" |
| QUERY_TIMEOUT | -32000 | "Query timed out" |
| EVENT_LOG_ERROR | -32603 | "Event log access failed" |

---

## 10. Performance Considerations

### 10.1 Caching Strategy

| Data | Cache TTL | Invalidation |
|------|-----------|--------------|
| Channel list | 5 minutes | Manual refresh |
| Channel stats | 1 minute | On query |
| Query results | No caching | N/A |

### 10.2 Resource Limits

| Resource | Limit | Enforcement |
|----------|-------|-------------|
| Memory | 200 MB | Process monitoring |
| Query time | 30 seconds | Async timeout |
| Result size | 10 MB | Truncation |
| Concurrent queries | 3 | Semaphore |

---

## 11. Non-Goals (Architecture Scope)

1. **Multi-machine deployment**: Server runs on single Windows machine
2. **Database persistence**: No local database; direct Event Log access
3. **Clustering/HA**: Single instance only
4. **Event streaming**: No real-time push (Phase 1+ consideration)
5. **Plugin architecture**: No runtime extensibility
6. **GUI**: Command-line and MCP interface only
7. **Cross-platform**: Windows 11 only

---

## 12. Future Considerations

### 12.1 HTTP Transport (Phase 1)

- Express.js or Fastify server
- Server-Sent Events for streaming
- Bearer token authentication
- TLS/HTTPS required
- CORS configuration

### 12.2 Additional Channels (Phase 2+)

- Configurable channel allowlist
- Per-channel permissions
- Admin-only channels

### 12.3 Event Subscriptions (Phase 3+)

- Real-time event notifications
- Webhook callbacks
- WebSocket support
