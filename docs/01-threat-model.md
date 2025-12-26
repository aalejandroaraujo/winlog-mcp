# Threat Model

## Document Information
- **Project**: winlog-mcp
- **Version**: 0.1.0
- **Phase**: 0 (Documentation)
- **Last Updated**: 2025-12-26
- **Methodology**: STRIDE

---

## 1. System Overview

### 1.1 Architecture Context

```
┌─────────────────┐     stdio (JSON-RPC)     ┌─────────────────┐
│   MCP Client    │◄──────────────────────────►│  winlog-mcp     │
│  (e.g., Claude) │                           │     Server      │
└─────────────────┘                           └────────┬────────┘
                                                       │
                                                       │ Windows API
                                                       ▼
                                              ┌─────────────────┐
                                              │  Windows Event  │
                                              │   Log Service   │
                                              │   (wevtsvc)     │
                                              └─────────────────┘
```

### 1.2 Trust Boundaries

| Boundary | Description |
|----------|-------------|
| TB-1 | Process boundary between MCP client and winlog-mcp server |
| TB-2 | API boundary between Node.js process and Windows Event Log Service |
| TB-3 | User context boundary (server runs as invoking user) |

### 1.3 Assets

| Asset | Sensitivity | Description |
|-------|-------------|-------------|
| A-1: System Event Log | Medium | Hardware, driver, and service information |
| A-2: Application Event Log | Medium | Application crash data, installation info |
| A-3: Security Event Log | High | Authentication, audit events (OUT OF SCOPE) |
| A-4: Query Audit Logs | Low | Record of queries made through MCP |
| A-5: Server Process | Medium | Running server process integrity |

---

## 2. Threat Analysis (STRIDE)

### 2.1 Spoofing

#### T-S1: Malicious MCP Client Impersonation
| Attribute | Value |
|-----------|-------|
| **Threat** | Attacker creates a malicious MCP client that connects to winlog-mcp |
| **Attack Vector** | Direct process spawning with stdio connection |
| **Impact** | Unauthorized access to event log data |
| **Likelihood** | Low (requires local code execution) |
| **Risk Level** | Medium |
| **Mitigation** | M-S1: Server is designed to be spawned by trusted MCP host only. No network listener in Phase 0. Document that server should only be invoked by trusted processes. |

#### T-S2: Process Privilege Escalation Attempt
| Attribute | Value |
|-----------|-------|
| **Threat** | Attacker attempts to run server with elevated privileges to access Security log |
| **Attack Vector** | Social engineering or misconfiguration |
| **Impact** | Access to sensitive audit data |
| **Likelihood** | Low |
| **Risk Level** | Medium |
| **Mitigation** | M-S2: Hardcoded channel allowlist (System, Application only). Security channel blocked regardless of process privileges. Startup warning if running elevated. |

### 2.2 Tampering

#### T-T1: Query Parameter Manipulation
| Attribute | Value |
|-----------|-------|
| **Threat** | Malicious XPath injection to bypass filters or cause DoS |
| **Attack Vector** | Crafted XPath expressions in query_events tool |
| **Impact** | Resource exhaustion, unexpected data access |
| **Likelihood** | Medium |
| **Risk Level** | High |
| **Mitigation** | M-T1: XPath expression validation with allowlist of safe constructs. Reject queries with dangerous patterns. Limit XPath complexity. |

#### T-T2: Channel Name Injection
| Attribute | Value |
|-----------|-------|
| **Threat** | Attacker provides crafted channel name to access unauthorized logs |
| **Attack Vector** | Channel parameter in query_events tool |
| **Impact** | Access to Security log or other restricted channels |
| **Likelihood** | High (easy to attempt) |
| **Risk Level** | Critical |
| **Mitigation** | M-T2: Strict channel allowlist validation. Channel names must exactly match "System" or "Application". Case-sensitive comparison. No path traversal. |

#### T-T3: Time Range Manipulation
| Attribute | Value |
|-----------|-------|
| **Threat** | Extremely wide time ranges to cause resource exhaustion |
| **Attack Vector** | startTime/endTime parameters |
| **Impact** | Server DoS, memory exhaustion |
| **Likelihood** | Medium |
| **Risk Level** | Medium |
| **Mitigation** | M-T3: Maximum time range limit (168 hours / 7 days). Result count caps enforced server-side. Timeout on long-running queries. |

### 2.3 Repudiation

#### T-R1: Untracked Query Activity
| Attribute | Value |
|-----------|-------|
| **Threat** | Queries are made without audit trail |
| **Attack Vector** | Normal operation without logging |
| **Impact** | Cannot determine what data was accessed |
| **Likelihood** | High (if not mitigated) |
| **Risk Level** | Medium |
| **Mitigation** | M-R1: All query operations logged to local audit file. Log includes: timestamp, channel, filter, result count, client identifier (if available). |

#### T-R2: Log Tampering
| Attribute | Value |
|-----------|-------|
| **Threat** | Attacker modifies audit logs to hide activity |
| **Attack Vector** | File system access to audit log |
| **Impact** | Loss of audit trail integrity |
| **Likelihood** | Low (requires file system access) |
| **Risk Level** | Low |
| **Mitigation** | M-R2: Audit logs written with append-only pattern. Consider Windows Event Log for audit output (future). File ACLs restrict modification. |

### 2.4 Information Disclosure

#### T-I1: Event Log Data Exposure
| Attribute | Value |
|-----------|-------|
| **Threat** | Sensitive information in event logs exposed to LLM |
| **Attack Vector** | Normal query operations |
| **Impact** | PII, system details, application data leaked |
| **Likelihood** | High (by design) |
| **Risk Level** | Medium |
| **Mitigation** | M-I1: This is intended functionality. Document that System/Application logs may contain sensitive data. User accepts risk when enabling server. Result summarization option for future phases. |

#### T-I2: Error Message Information Leakage
| Attribute | Value |
|-----------|-------|
| **Threat** | Verbose error messages reveal system internals |
| **Attack Vector** | Triggering error conditions |
| **Impact** | System enumeration, attack surface discovery |
| **Likelihood** | Medium |
| **Risk Level** | Low |
| **Mitigation** | M-I2: Generic error messages to client. Detailed errors logged locally only. No stack traces in MCP responses. |

#### T-I3: Timing Side Channels
| Attribute | Value |
|-----------|-------|
| **Threat** | Query timing reveals information about log contents |
| **Attack Vector** | Measuring response times |
| **Impact** | Infer event counts or patterns |
| **Likelihood** | Low |
| **Risk Level** | Low |
| **Mitigation** | M-I3: Accepted risk for Phase 0. Low impact given read-only nature. |

### 2.5 Denial of Service

#### T-D1: Resource Exhaustion via Large Queries
| Attribute | Value |
|-----------|-------|
| **Threat** | Queries that return massive result sets |
| **Attack Vector** | Wide filters, no limit, large time ranges |
| **Impact** | Memory exhaustion, server crash |
| **Likelihood** | High (easy to trigger) |
| **Risk Level** | High |
| **Mitigation** | M-D1: Hard limit of 1000 events per query. Memory monitoring with early termination. Query timeout of 30 seconds. |

#### T-D2: Query Flooding
| Attribute | Value |
|-----------|-------|
| **Threat** | Rapid succession of queries to exhaust resources |
| **Attack Vector** | Automated query spam |
| **Impact** | Server unresponsive, resource starvation |
| **Likelihood** | Medium |
| **Risk Level** | Medium |
| **Mitigation** | M-D2: Rate limiting (10 queries per second max). Queue depth limit. Reject when overloaded. |

#### T-D3: Malformed Input Crash
| Attribute | Value |
|-----------|-------|
| **Threat** | Crafted input causes server process crash |
| **Attack Vector** | Invalid JSON, buffer overflow attempts |
| **Impact** | Server availability loss |
| **Likelihood** | Low (Node.js memory safety) |
| **Risk Level** | Medium |
| **Mitigation** | M-D3: Input validation at all entry points. Try-catch around all operations. Graceful error handling. Process supervision recommended. |

### 2.6 Elevation of Privilege

#### T-E1: Escape from Allowlist
| Attribute | Value |
|-----------|-------|
| **Threat** | Bypass channel allowlist to access Security log |
| **Attack Vector** | Unicode tricks, path traversal, API quirks |
| **Impact** | Access to sensitive audit data |
| **Likelihood** | Low |
| **Risk Level** | Critical |
| **Mitigation** | M-E1: Channel validation uses exact string match. Normalize input before comparison. Block any channel not in explicit allowlist. Test with known bypass patterns. |

#### T-E2: Native Code Exploitation
| Attribute | Value |
|-----------|-------|
| **Threat** | Vulnerability in native Event Log bindings |
| **Attack Vector** | Crafted input to native addon |
| **Impact** | Arbitrary code execution |
| **Likelihood** | Low |
| **Risk Level** | Critical |
| **Mitigation** | M-E2: Use well-maintained native bindings. Regular dependency updates. Consider pure JavaScript alternatives where possible. Fuzz testing of input handling. |

---

## 3. Threat Summary Matrix

| ID | Threat | STRIDE | Risk | Mitigation |
|----|--------|--------|------|------------|
| T-S1 | Malicious client | Spoofing | Medium | M-S1: stdio-only, trusted host |
| T-S2 | Privilege escalation | Spoofing | Medium | M-S2: Hardcoded allowlist |
| T-T1 | XPath injection | Tampering | High | M-T1: XPath validation |
| T-T2 | Channel injection | Tampering | Critical | M-T2: Strict allowlist |
| T-T3 | Time range abuse | Tampering | Medium | M-T3: Range limits |
| T-R1 | No audit trail | Repudiation | Medium | M-R1: Query logging |
| T-R2 | Log tampering | Repudiation | Low | M-R2: Append-only logs |
| T-I1 | Data exposure | Info Disclosure | Medium | M-I1: User acceptance |
| T-I2 | Error leakage | Info Disclosure | Low | M-I2: Generic errors |
| T-I3 | Timing channels | Info Disclosure | Low | M-I3: Accepted risk |
| T-D1 | Large queries | DoS | High | M-D1: Result caps |
| T-D2 | Query flooding | DoS | Medium | M-D2: Rate limiting |
| T-D3 | Crash via input | DoS | Medium | M-D3: Input validation |
| T-E1 | Allowlist bypass | EoP | Critical | M-E1: Strict validation |
| T-E2 | Native exploit | EoP | Critical | M-E2: Secure dependencies |

---

## 4. Security Controls Summary

### 4.1 Preventive Controls

| Control | Implementation | Threats Addressed |
|---------|----------------|-------------------|
| Channel Allowlist | Hardcoded list: System, Application | T-T2, T-E1 |
| XPath Validation | Regex + complexity limits | T-T1 |
| Result Caps | Max 1000 events per query | T-D1 |
| Rate Limiting | 10 queries/second | T-D2 |
| Input Validation | Schema validation on all inputs | T-D3 |
| Query Timeout | 30 second maximum | T-D1, T-T3 |

### 4.2 Detective Controls

| Control | Implementation | Threats Addressed |
|---------|----------------|-------------------|
| Audit Logging | All queries logged with metadata | T-R1 |
| Elevation Warning | Log warning if running as admin | T-S2 |
| Error Logging | Detailed local logs | T-I2, T-D3 |

### 4.3 Corrective Controls

| Control | Implementation | Threats Addressed |
|---------|----------------|-------------------|
| Graceful Degradation | Return error, don't crash | T-D3 |
| Query Cancellation | Timeout terminates query | T-D1 |

---

## 5. Attack Trees

### 5.1 Access Security Log

```
Access Security Log [GOAL]
├── Bypass Channel Allowlist
│   ├── Unicode normalization attack [BLOCKED: exact match]
│   ├── Case manipulation [BLOCKED: case-sensitive]
│   ├── Path traversal ("../Security") [BLOCKED: no path parsing]
│   └── API-level bypass [BLOCKED: allowlist at API call]
├── Escalate Process Privileges
│   ├── Social engineer user to run as admin [PARTIAL: still blocked by allowlist]
│   └── Exploit vulnerability for privilege escalation [BLOCKED: no write operations]
└── Compromise Native Bindings
    └── Memory corruption in Event Log API [MITIGATED: input validation, fuzzing]
```

### 5.2 Denial of Service

```
Denial of Service [GOAL]
├── Resource Exhaustion
│   ├── Large query results [BLOCKED: 1000 event cap]
│   ├── Memory exhaustion [BLOCKED: caps + monitoring]
│   └── CPU exhaustion [BLOCKED: query timeout]
├── Query Flooding
│   ├── Rapid queries [BLOCKED: rate limiting]
│   └── Concurrent queries [BLOCKED: queue limits]
└── Crash Server
    ├── Malformed JSON [BLOCKED: schema validation]
    ├── Invalid XPath [BLOCKED: validation + try-catch]
    └── Native binding crash [MITIGATED: maintained deps]
```

---

## 6. Risk Acceptance

The following risks are accepted for Phase 0:

| Risk | Reason for Acceptance |
|------|----------------------|
| Event log data exposure to LLM | Core functionality; user opt-in |
| Timing side channels | Low impact for read-only system |
| Local file audit log tampering | Requires existing local access |

---

## 7. Security Testing Requirements

| Test Category | Coverage |
|---------------|----------|
| Channel allowlist bypass | 100% of known techniques |
| XPath injection | OWASP XPath Injection patterns |
| Input fuzzing | All MCP tool parameters |
| DoS resistance | Rate limit and cap verification |
| Error handling | All error paths return safe messages |

---

## 8. Future Considerations (Phase 1+)

1. **HTTP Transport**: Additional network-layer threats (T-N*)
2. **Authentication**: Client identity verification for HTTP
3. **TLS**: Encryption for HTTP transport
4. **Additional Channels**: Per-channel permission model
5. **Remote Logs**: Network-based access controls
