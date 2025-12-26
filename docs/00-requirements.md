# Requirements Specification

## Document Information
- **Project**: winlog-mcp
- **Version**: 0.1.0
- **Phase**: 0 (Documentation)
- **Last Updated**: 2025-12-26

---

## 1. Overview

winlog-mcp is a read-only MCP (Model Context Protocol) server that exposes Windows Event Log data to MCP clients. It enables LLMs to discover event log channels, query events by time range or filter criteria, and identify crash/incident patterns.

---

## 2. Functional Requirements

### 2.1 Channel Discovery

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | The server SHALL enumerate available event log channels | Must |
| FR-02 | The server SHALL return channel metadata (name, provider, record count) | Must |
| FR-03 | The server SHALL support filtering channel list by enabled/disabled status | Should |

### 2.2 Event Querying

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-10 | The server SHALL query events from System channel | Must |
| FR-11 | The server SHALL query events from Application channel | Must |
| FR-12 | The server SHALL support XPath filter expressions for event queries | Must |
| FR-13 | The server SHALL support time-range filtering (start/end timestamps) | Must |
| FR-14 | The server SHALL support limiting result count (default: 100, max: 1000) | Must |
| FR-15 | The server SHALL return events in reverse chronological order (newest first) | Must |
| FR-16 | The server SHALL return structured event data (EventID, Level, TimeCreated, Provider, Message) | Must |

### 2.3 Incident Detection

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-20 | The server SHALL identify application crash events (Event ID 1000, 1001, 1002) | Must |
| FR-21 | The server SHALL identify system crash events (bugcheck, WHEA errors) | Must |
| FR-22 | The server SHALL identify service failure events | Should |
| FR-23 | The server SHALL correlate related events within a configurable time window | Should |

### 2.4 MCP Protocol Compliance

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-30 | The server SHALL implement MCP tool interface for all query operations | Must |
| FR-31 | The server SHALL implement MCP resource interface for channel enumeration | Must |
| FR-32 | The server SHALL support stdio transport (JSON-RPC over stdin/stdout) | Must |
| FR-33 | The server SHALL implement proper MCP error responses | Must |

---

## 3. Non-Functional Requirements

### 3.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-01 | Channel enumeration response time | < 500ms |
| NFR-02 | Event query response time (100 events) | < 2 seconds |
| NFR-03 | Memory usage (idle) | < 50 MB |
| NFR-04 | Memory usage (peak, during query) | < 200 MB |

### 3.2 Security

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-10 | The server SHALL operate in read-only mode (no event log writes) | Must |
| NFR-11 | The server SHALL enforce channel allowlist (System, Application only) | Must |
| NFR-12 | The server SHALL NOT access Security channel | Must |
| NFR-13 | The server SHALL validate and sanitize all XPath filter inputs | Must |
| NFR-14 | The server SHALL run without requiring elevated privileges | Must |
| NFR-15 | The server SHALL log all query operations for audit purposes | Must |
| NFR-16 | The server SHALL enforce query result caps to prevent resource exhaustion | Must |

### 3.3 Reliability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-20 | Graceful handling of inaccessible logs | 100% |
| NFR-21 | Graceful handling of malformed queries | 100% |
| NFR-22 | Process crash on invalid input | 0% |

### 3.4 Compatibility

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-30 | Windows 11 (21H2 and later) | Must |
| NFR-31 | Node.js 18 LTS or later | Must |
| NFR-32 | MCP SDK 1.0.x compatibility | Must |

---

## 4. Supported Event Log Channels

### 4.1 In Scope (Phase 0)

| Channel | Access Level | Use Cases |
|---------|--------------|-----------|
| System | Read | Hardware errors, driver issues, service failures, boot events |
| Application | Read | Application crashes, installation events, application errors |

### 4.2 Explicitly Out of Scope

| Channel | Reason |
|---------|--------|
| Security | Requires elevated privileges; sensitive audit data |
| Setup | Rarely needed for diagnostics |
| Forwarded Events | Requires specific enterprise configuration |
| Custom/3rd-party channels | Deferred to future phases |

---

## 5. MCP Interface Definition

### 5.1 Tools

#### `query_events`
Query events from an allowed channel with optional filters.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| channel | string | Yes | Channel name (System or Application) |
| xpath | string | No | XPath filter expression |
| startTime | string | No | ISO 8601 timestamp for range start |
| endTime | string | No | ISO 8601 timestamp for range end |
| limit | integer | No | Max events to return (1-1000, default 100) |

**Returns:** Array of event objects

#### `get_crash_events`
Retrieve application and system crash events.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| hours | integer | No | Look back N hours (default 24, max 168) |
| includeRelated | boolean | No | Include correlated events (default false) |

**Returns:** Array of crash event objects with severity classification

#### `get_channel_stats`
Get statistics for an allowed channel.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| channel | string | Yes | Channel name (System or Application) |

**Returns:** Object with record count, oldest/newest timestamps, size

### 5.2 Resources

#### `channels`
List available event log channels.

**URI:** `winlog://channels`

**Returns:** Array of channel metadata objects

---

## 6. Non-Goals (Explicit Exclusions)

1. **Write Operations**: No creation, modification, or deletion of events
2. **Security Log Access**: Explicitly excluded due to privilege requirements
3. **Remote Event Logs**: No access to event logs on other machines
4. **Real-time Subscriptions**: No push notifications or event streaming
5. **Event Log Forwarding**: No configuration or management of forwarded events
6. **Custom Channel Configuration**: No runtime addition of channels beyond allowlist
7. **Event Log Backup/Export**: No .evtx file operations
8. **Log Rotation Management**: No clearing or archiving capabilities
9. **Cross-platform Support**: Windows 11 only; no Linux/macOS
10. **HTTP Transport in Phase 0**: stdio only; HTTP deferred to future phases

---

## 7. Assumptions

1. The MCP client is trusted and runs on the same machine as the server
2. The user account running the server has read access to System and Application logs
3. Standard Windows 11 configurations are in place (Event Log service running)
4. Node.js runtime is pre-installed on the target system
5. Network access is not required for core functionality

---

## 8. Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| Node.js | >= 18.0.0 | Runtime environment |
| @modelcontextprotocol/sdk | ^1.0.0 | MCP protocol implementation |
| node-windows-event-log (TBD) | TBD | Windows Event Log API bindings |

---

## 9. Acceptance Criteria

### Phase 0 Complete When:
- [ ] All documentation deliverables created and reviewed
- [ ] Requirements traceable to test cases
- [ ] Threat model reviewed and mitigations defined
- [ ] Architecture diagrams complete
- [ ] No open blockers for Phase 1

### Overall Project Complete When:
- [ ] All functional requirements implemented and tested
- [ ] All non-functional requirements verified
- [ ] Security audit passed
- [ ] Documentation complete
- [ ] Release checklist satisfied
