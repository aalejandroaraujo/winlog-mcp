# Permissions Matrix

## Document Information
- **Project**: winlog-mcp
- **Version**: 0.1.0
- **Phase**: 0 (Documentation)
- **Last Updated**: 2025-12-26

---

## 1. Overview

This document defines the explicit permissions model for winlog-mcp, covering:
- Windows Event Log channel access rights
- MCP tool/resource permissions
- File system permissions
- Process execution context

---

## 2. Event Log Channel Permissions

### 2.1 Channel Access Matrix

| Channel | Read | Write | Clear | Subscribe | Status |
|---------|:----:|:-----:|:-----:|:---------:|--------|
| System | ✅ | ❌ | ❌ | ❌ | **ALLOWED** |
| Application | ✅ | ❌ | ❌ | ❌ | **ALLOWED** |
| Security | ❌ | ❌ | ❌ | ❌ | **BLOCKED** |
| Setup | ❌ | ❌ | ❌ | ❌ | **BLOCKED** |
| Forwarded Events | ❌ | ❌ | ❌ | ❌ | **BLOCKED** |
| Microsoft-Windows-* | ❌ | ❌ | ❌ | ❌ | **BLOCKED** |
| Custom/Third-party | ❌ | ❌ | ❌ | ❌ | **BLOCKED** |

### 2.2 Channel Allowlist Implementation

```
ALLOWED_CHANNELS = ["System", "Application"]

validateChannel(channel):
    if channel not in ALLOWED_CHANNELS:
        throw ChannelNotAllowedError
    return true
```

### 2.3 Security Channel Blocking Rationale

| Reason | Description |
|--------|-------------|
| Privilege Requirements | Security log typically requires SeSecurityPrivilege |
| Sensitive Data | Contains authentication, audit, and access control events |
| Compliance Risk | Security log access may trigger compliance requirements |
| Attack Surface | Reading security log could aid reconnaissance |

---

## 3. MCP Interface Permissions

### 3.1 Tool Permissions

| Tool | Allowed Operations | Blocked Operations |
|------|-------------------|-------------------|
| `query_events` | Read events from System/Application | Write events, access other channels |
| `get_crash_events` | Read crash-related events | Modify events, clear logs |
| `get_channel_stats` | Read channel metadata | Modify channel configuration |

### 3.2 Tool Parameter Restrictions

#### `query_events`

| Parameter | Allowed Values | Validation |
|-----------|---------------|------------|
| `channel` | "System", "Application" | Exact string match, case-sensitive |
| `xpath` | Safe XPath subset | Regex validation, complexity limit |
| `startTime` | ISO 8601 timestamp | Must be within 168 hours of now |
| `endTime` | ISO 8601 timestamp | Must be >= startTime |
| `limit` | 1-1000 | Integer, clamped to range |

#### `get_crash_events`

| Parameter | Allowed Values | Validation |
|-----------|---------------|------------|
| `hours` | 1-168 | Integer, default 24 |
| `includeRelated` | true, false | Boolean, default false |

#### `get_channel_stats`

| Parameter | Allowed Values | Validation |
|-----------|---------------|------------|
| `channel` | "System", "Application" | Exact string match |

### 3.3 Resource Permissions

| Resource URI | Access | Description |
|--------------|--------|-------------|
| `winlog://channels` | Read | List allowed channels only |
| `winlog://channels/System` | Read | System channel metadata |
| `winlog://channels/Application` | Read | Application channel metadata |
| `winlog://channels/Security` | ❌ Blocked | Not accessible |
| `winlog://channels/*` | ❌ Blocked | Wildcard not supported |

---

## 4. XPath Filter Permissions

### 4.1 Allowed XPath Constructs

| Construct | Example | Status |
|-----------|---------|--------|
| Event selection | `*[System[...]]` | ✅ Allowed |
| EventID filter | `EventID=1000` | ✅ Allowed |
| Level filter | `Level=2` | ✅ Allowed |
| TimeCreated filter | `TimeCreated[@SystemTime>='...']` | ✅ Allowed |
| Provider filter | `Provider[@Name='...']` | ✅ Allowed |
| Logical AND | `and` | ✅ Allowed |
| Logical OR | `or` | ✅ Allowed |
| Comparison operators | `=`, `!=`, `>`, `<`, `>=`, `<=` | ✅ Allowed |

### 4.2 Blocked XPath Constructs

| Construct | Reason | Status |
|-----------|--------|--------|
| External entity | `document()` | ❌ Blocked (XXE risk) |
| Function calls | `concat()`, `string()`, etc. | ❌ Blocked (complexity) |
| Variable references | `$var` | ❌ Blocked |
| Namespace axis | `namespace::*` | ❌ Blocked |
| Parent axis | `..` | ❌ Blocked |
| Preceding/following | `preceding::`, `following::` | ❌ Blocked |
| Comments | `comment()` | ❌ Blocked |
| Processing instructions | `processing-instruction()` | ❌ Blocked |

### 4.3 XPath Complexity Limits

| Limit | Value | Rationale |
|-------|-------|-----------|
| Maximum length | 500 characters | Prevent buffer issues |
| Maximum depth | 5 levels | Prevent complex queries |
| Maximum predicates | 10 | Prevent combinatorial explosion |

---

## 5. File System Permissions

### 5.1 Required Access

| Path | Permission | Purpose |
|------|------------|---------|
| Installation directory | Read, Execute | Server binaries and dependencies |
| User temp directory | Read, Write | Temporary files during operation |
| Audit log directory | Write, Append | Query audit logging |

### 5.2 Audit Log Location

| Platform | Default Path |
|----------|--------------|
| Windows | `%LOCALAPPDATA%\winlog-mcp\logs\` |

### 5.3 Audit Log Permissions

| Principal | Permission |
|-----------|------------|
| Server process | Write, Append |
| Administrators | Full Control |
| Users | Read (optional) |

---

## 6. Process Execution Context

### 6.1 Required Privileges

| Privilege | Required | Reason |
|-----------|----------|--------|
| SeSecurityPrivilege | ❌ No | Security log not accessed |
| SeBackupPrivilege | ❌ No | No backup operations |
| SeDebugPrivilege | ❌ No | No debugging operations |
| Standard User | ✅ Yes | Sufficient for System/Application logs |

### 6.2 Execution Context Matrix

| Context | System Log | Application Log | Security Log | Recommendation |
|---------|:----------:|:---------------:|:------------:|----------------|
| Standard User | ✅ | ✅ | ❌ | **Recommended** |
| Administrator | ✅ | ✅ | ❌ (Blocked) | Unnecessary |
| SYSTEM | ✅ | ✅ | ❌ (Blocked) | Unnecessary |
| Service Account | ✅ | ✅ | ❌ (Blocked) | For unattended |

### 6.3 Elevation Detection

The server SHALL detect and warn when running with elevated privileges:

```
if (isElevated()):
    log.warn("Running with elevated privileges is unnecessary")
    log.warn("winlog-mcp is designed to run as standard user")
```

---

## 7. Rate Limits and Quotas

### 7.1 Query Rate Limits

| Limit Type | Value | Scope |
|------------|-------|-------|
| Queries per second | 10 | Per connection |
| Concurrent queries | 3 | Per connection |
| Queue depth | 10 | Per connection |

### 7.2 Result Limits

| Limit Type | Value | Configurable |
|------------|-------|--------------|
| Events per query | 1000 max | Yes (can lower) |
| Default events | 100 | Yes |
| Time range | 168 hours | Yes (can lower) |
| Response size | 10 MB | No |

### 7.3 Resource Limits

| Resource | Limit | Action on Exceed |
|----------|-------|------------------|
| Memory | 200 MB | Reject new queries |
| Query duration | 30 seconds | Timeout and cancel |
| XPath complexity | See §4.3 | Reject query |

---

## 8. Audit Requirements

### 8.1 Logged Events

| Event | Logged Data | Retention |
|-------|-------------|-----------|
| Query executed | Timestamp, channel, filter, result count | 30 days |
| Query rejected | Timestamp, reason, attempted parameters | 30 days |
| Rate limit hit | Timestamp, client info | 30 days |
| Server start | Timestamp, version, user context | 30 days |
| Server stop | Timestamp, reason | 30 days |

### 8.2 Audit Log Format

```json
{
    "timestamp": "2025-12-26T10:30:00.000Z",
    "event": "query_executed",
    "channel": "System",
    "filter": "*[System[EventID=1000]]",
    "resultCount": 42,
    "durationMs": 150,
    "clientId": "mcp-client-1"
}
```

---

## 9. Permission Enforcement Points

### 9.1 Enforcement Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        MCP Request                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Input Validation                                  │
│  - JSON schema validation                                   │
│  - Type checking                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Rate Limiting                                     │
│  - Queries per second                                       │
│  - Queue depth                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Channel Allowlist                                 │
│  - Exact match against ["System", "Application"]            │
│  - Case-sensitive comparison                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: XPath Validation                                  │
│  - Construct allowlist                                      │
│  - Complexity limits                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 5: Result Limiting                                   │
│  - Event count cap                                          │
│  - Response size limit                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 6: Audit Logging                                     │
│  - Log all operations                                       │
│  - Log rejections                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Permission Errors

### 10.1 Error Codes

| Code | Name | Description |
|------|------|-------------|
| CHANNEL_NOT_ALLOWED | ChannelNotAllowedError | Requested channel not in allowlist |
| XPATH_INVALID | XPathValidationError | XPath failed validation |
| XPATH_TOO_COMPLEX | XPathComplexityError | XPath exceeds complexity limits |
| RATE_LIMITED | RateLimitError | Too many requests |
| QUERY_TIMEOUT | QueryTimeoutError | Query exceeded time limit |
| RESULT_TOO_LARGE | ResultSizeError | Result exceeds size limit |

### 10.2 Error Response Format

```json
{
    "error": {
        "code": "CHANNEL_NOT_ALLOWED",
        "message": "Channel 'Security' is not in the allowed list",
        "allowed": ["System", "Application"]
    }
}
```

---

## 11. Configuration

### 11.1 Configurable Limits

| Setting | Default | Min | Max | Environment Variable |
|---------|---------|-----|-----|---------------------|
| `maxEventsPerQuery` | 100 | 1 | 1000 | `WINLOG_MAX_EVENTS` |
| `maxTimeRangeHours` | 24 | 1 | 168 | `WINLOG_MAX_HOURS` |
| `queryTimeoutMs` | 30000 | 1000 | 60000 | `WINLOG_TIMEOUT` |
| `rateLimit` | 10 | 1 | 100 | `WINLOG_RATE_LIMIT` |

### 11.2 Non-Configurable Settings

| Setting | Value | Reason |
|---------|-------|--------|
| Allowed channels | System, Application | Security requirement |
| Security log access | Blocked | Security requirement |
| Write operations | Disabled | Read-only by design |
| Maximum events cap | 1000 | Prevent DoS |

---

## 12. Non-Goals

1. **Dynamic Channel Configuration**: Channels cannot be added at runtime
2. **Per-User Permissions**: All users have same access within allowed channels
3. **Fine-grained Event Filtering**: No per-EventID blocking
4. **Write Permissions**: No event creation, modification, or deletion
5. **Administrative Operations**: No log clearing, backup, or configuration
