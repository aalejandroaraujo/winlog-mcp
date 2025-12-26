# Test Plan

## Document Information
- **Project**: winlog-mcp
- **Version**: 0.1.0
- **Phase**: 0 (Documentation)
- **Last Updated**: 2025-12-26

---

## 1. Overview

This document defines the testing strategy for winlog-mcp, covering unit tests, integration tests, security tests, and performance tests.

---

## 2. Test Strategy

### 2.1 Testing Pyramid

```
                    ┌───────────────┐
                    │   E2E Tests   │  (Few, slow, high confidence)
                    │    Manual     │
                    └───────────────┘
                  ┌───────────────────┐
                  │ Integration Tests │  (Medium, with real Event Log)
                  │    Automated      │
                  └───────────────────┘
              ┌───────────────────────────┐
              │       Security Tests       │  (Automated + Manual)
              │   Fuzzing, Penetration     │
              └───────────────────────────┘
          ┌───────────────────────────────────┐
          │           Unit Tests              │  (Many, fast, isolated)
          │          Automated                │
          └───────────────────────────────────┘
```

### 2.2 Test Coverage Requirements

| Component | Minimum Coverage | Target Coverage |
|-----------|------------------|-----------------|
| Security Layer | 95% | 100% |
| Business Logic | 80% | 90% |
| Protocol Handlers | 80% | 90% |
| Adapters | 70% | 80% |
| Utilities | 70% | 80% |

---

## 3. Unit Tests

### 3.1 Channel Guard Tests

| Test ID | Test Case | Input | Expected Output |
|---------|-----------|-------|-----------------|
| CG-001 | Allow System channel | `"System"` | `true` |
| CG-002 | Allow Application channel | `"Application"` | `true` |
| CG-003 | Block Security channel | `"Security"` | `false` |
| CG-004 | Block Setup channel | `"Setup"` | `false` |
| CG-005 | Block empty string | `""` | `false` |
| CG-006 | Block null | `null` | `false` |
| CG-007 | Block undefined | `undefined` | `false` |
| CG-008 | Case sensitivity - lowercase | `"system"` | `false` |
| CG-009 | Case sensitivity - uppercase | `"SYSTEM"` | `false` |
| CG-010 | Case sensitivity - mixed | `"SyStEm"` | `false` |
| CG-011 | Block path traversal | `"../Security"` | `false` |
| CG-012 | Block unicode tricks | `"Ｓystem"` (fullwidth S) | `false` |
| CG-013 | Block with whitespace prefix | `" System"` | `false` |
| CG-014 | Block with whitespace suffix | `"System "` | `false` |
| CG-015 | Block with null byte | `"System\x00"` | `false` |

### 3.2 XPath Validator Tests

| Test ID | Test Case | Input | Expected |
|---------|-----------|-------|----------|
| XV-001 | Valid EventID filter | `*[System[EventID=1000]]` | Valid |
| XV-002 | Valid Level filter | `*[System[Level=2]]` | Valid |
| XV-003 | Valid TimeCreated filter | `*[System[TimeCreated[@SystemTime>='2025-01-01']]]` | Valid |
| XV-004 | Valid Provider filter | `*[System[Provider[@Name='Application Error']]]` | Valid |
| XV-005 | Valid AND expression | `*[System[EventID=1000 and Level=2]]` | Valid |
| XV-006 | Valid OR expression | `*[System[EventID=1000 or EventID=1001]]` | Valid |
| XV-007 | Block document() function | `document('evil.xml')` | Invalid |
| XV-008 | Block external entity | `*[contains(text(), $var)]` | Invalid |
| XV-009 | Block parent axis | `../System` | Invalid |
| XV-010 | Block namespace axis | `namespace::*` | Invalid |
| XV-011 | Block concat function | `concat('a', 'b')` | Invalid |
| XV-012 | Reject exceeds max length | `*[System[...500+ chars...]]` | Invalid |
| XV-013 | Reject exceeds depth | `*[*[*[*[*[*[deep]]]]]]` | Invalid |
| XV-014 | Reject too many predicates | `*[a][b][c][d][e][f][g][h][i][j][k]` | Invalid |
| XV-015 | Handle empty string | `""` | Valid (no filter) |
| XV-016 | Handle null | `null` | Valid (no filter) |

### 3.3 Rate Limiter Tests

| Test ID | Test Case | Setup | Action | Expected |
|---------|-----------|-------|--------|----------|
| RL-001 | First request allowed | Fresh limiter | acquire() | `true` |
| RL-002 | Within rate limit | 5 requests | acquire() 5x | All `true` |
| RL-003 | At rate limit | 10 requests | acquire() 10x | All `true` |
| RL-004 | Exceed rate limit | 11 requests immediately | acquire() 11x | 11th is `false` |
| RL-005 | Reset after window | 10 requests, wait 1s | acquire() | `true` |
| RL-006 | Different clients | Client A at limit | Client B acquire() | `true` |
| RL-007 | Concurrent requests | 10 parallel | await all | Exactly 10 succeed |

### 3.4 Query Service Tests

| Test ID | Test Case | Input | Expected |
|---------|-----------|-------|----------|
| QS-001 | Query with valid params | `{channel: "System", limit: 10}` | Array of events |
| QS-002 | Respect limit parameter | `{limit: 5}` | At most 5 events |
| QS-003 | Default limit applied | `{}` | At most 100 events |
| QS-004 | Maximum limit enforced | `{limit: 5000}` | At most 1000 events |
| QS-005 | Time range filter | `{startTime, endTime}` | Events within range |
| QS-006 | XPath filter applied | `{xpath: "*[System[EventID=1]]"}` | Filtered events |
| QS-007 | Empty result set | `{xpath: "*[System[EventID=99999999]]"}` | Empty array |
| QS-008 | Result ordering | Default | Newest first |

### 3.5 Crash Detector Tests

| Test ID | Test Case | Input Events | Expected |
|---------|-----------|--------------|----------|
| CD-001 | Detect App Error (1000) | EventID=1000 | Crash detected |
| CD-002 | Detect App Hang (1002) | EventID=1002 | Crash detected |
| CD-003 | Detect Bugcheck (1001 from BugCheck) | Provider=BugCheck | System crash |
| CD-004 | Detect WHEA error | Provider=WHEA-Logger | System crash |
| CD-005 | Detect service failure | EventID=7034 | Service failure |
| CD-006 | Classify severity Critical | BugCheck | Severity=Critical |
| CD-007 | Classify severity High | App crash | Severity=High |
| CD-008 | Classify severity Medium | Service restart | Severity=Medium |
| CD-009 | Correlate related events | Multiple events near in time | Related array populated |
| CD-010 | No false positives | Normal info event | Not detected as crash |

### 3.6 Error Handler Tests

| Test ID | Test Case | Input Error | Expected Output |
|---------|-----------|-------------|-----------------|
| EH-001 | Channel not allowed | ChannelNotAllowedError | Generic message, no internals |
| EH-002 | XPath validation failed | XPathValidationError | Generic message |
| EH-003 | Rate limit exceeded | RateLimitError | Rate limit message |
| EH-004 | Query timeout | TimeoutError | Timeout message |
| EH-005 | Event log access failed | SystemError | Generic internal error |
| EH-006 | Unknown error | RandomError | Generic internal error |
| EH-007 | Error with stack trace | Error with stack | Stack not in response |

---

## 4. Integration Tests

### 4.1 MCP Protocol Tests

| Test ID | Test Case | Description | Expected |
|---------|-----------|-------------|----------|
| MP-001 | Initialize handshake | Send initialize request | Valid capabilities response |
| MP-002 | List tools | Request tool list | All tools returned |
| MP-003 | List resources | Request resources | Channel resource returned |
| MP-004 | Tool call - query_events | Call with valid params | Event data returned |
| MP-005 | Tool call - get_crash_events | Call with valid params | Crash data returned |
| MP-006 | Tool call - get_channel_stats | Call with valid params | Stats returned |
| MP-007 | Invalid tool name | Call unknown tool | Error response |
| MP-008 | Invalid params | Call with bad params | Validation error |
| MP-009 | Read resource | Read channels resource | Channel list |

### 4.2 Event Log Integration Tests

| Test ID | Test Case | Setup | Expected |
|---------|-----------|-------|----------|
| EL-001 | Read System log | None | Events returned |
| EL-002 | Read Application log | None | Events returned |
| EL-003 | Handle large result | Query last 1000 | All 1000 returned |
| EL-004 | Handle empty log | Filter with no matches | Empty array |
| EL-005 | Time range filtering | Specific range | Only events in range |
| EL-006 | XPath filtering | EventID filter | Only matching events |
| EL-007 | Channel enumeration | List channels | System, Application listed |
| EL-008 | Channel stats | Get stats | Record count, timestamps |
| EL-009 | Graceful degradation | Inaccessible log | Error response, no crash |

### 4.3 Transport Integration Tests

| Test ID | Test Case | Description | Expected |
|---------|-----------|-------------|----------|
| TR-001 | stdio communication | Send/receive via stdio | Messages exchanged |
| TR-002 | Large message handling | Send 1MB response | Complete transmission |
| TR-003 | Concurrent requests | Multiple requests | All processed |
| TR-004 | Malformed JSON | Invalid JSON input | Error response |
| TR-005 | Connection close | Client closes stdin | Graceful shutdown |

---

## 5. Security Tests

### 5.1 Channel Access Control Tests

| Test ID | Threat | Test Case | Expected |
|---------|--------|-----------|----------|
| SA-001 | T-T2 | Query Security channel | CHANNEL_NOT_ALLOWED error |
| SA-002 | T-T2 | Query with path traversal | CHANNEL_NOT_ALLOWED error |
| SA-003 | T-T2 | Query with unicode bypass | CHANNEL_NOT_ALLOWED error |
| SA-004 | T-T2 | Query with null bytes | CHANNEL_NOT_ALLOWED error |
| SA-005 | T-T2 | Query with case manipulation | CHANNEL_NOT_ALLOWED error |
| SA-006 | T-E1 | Query Microsoft-Windows-Security-* | CHANNEL_NOT_ALLOWED error |

### 5.2 XPath Injection Tests

| Test ID | Threat | Test Case | Expected |
|---------|--------|-----------|----------|
| SX-001 | T-T1 | Inject document() function | XPATH_INVALID error |
| SX-002 | T-T1 | Inject external entity | XPATH_INVALID error |
| SX-003 | T-T1 | Inject variable reference | XPATH_INVALID error |
| SX-004 | T-T1 | Inject parent axis | XPATH_INVALID error |
| SX-005 | T-T1 | XPath bomb (exponential) | XPATH_TOO_COMPLEX error |
| SX-006 | T-T1 | Very long XPath | XPATH_INVALID error |

### 5.3 DoS Resistance Tests

| Test ID | Threat | Test Case | Expected |
|---------|--------|-----------|----------|
| SD-001 | T-D1 | Request 100000 events | Capped at 1000 |
| SD-002 | T-D2 | 100 requests/second | Rate limited after 10 |
| SD-003 | T-D3 | Malformed JSON flood | Errors returned, no crash |
| SD-004 | T-D1 | Very wide time range | Capped or rejected |
| SD-005 | T-D1 | Query timeout | Response within 30s |

### 5.4 Information Disclosure Tests

| Test ID | Threat | Test Case | Expected |
|---------|--------|-----------|----------|
| SI-001 | T-I2 | Trigger internal error | Generic error, no stack |
| SI-002 | T-I2 | Invalid channel name | No path disclosure |
| SI-003 | T-I2 | Event log API failure | No API details exposed |

### 5.5 Fuzzing Tests

| Test ID | Component | Fuzzing Strategy | Duration |
|---------|-----------|------------------|----------|
| SF-001 | Channel parameter | Random strings, unicode | 1 hour |
| SF-002 | XPath parameter | Grammar-based fuzzing | 2 hours |
| SF-003 | Time parameters | Date format variations | 1 hour |
| SF-004 | Limit parameter | Integer overflow, negatives | 30 min |
| SF-005 | JSON-RPC messages | Structural fuzzing | 2 hours |

---

## 6. Performance Tests

### 6.1 Response Time Tests

| Test ID | Operation | Threshold | Measurement |
|---------|-----------|-----------|-------------|
| PT-001 | Channel enumeration | < 500ms | P95 |
| PT-002 | Query 10 events | < 500ms | P95 |
| PT-003 | Query 100 events | < 2s | P95 |
| PT-004 | Query 1000 events | < 5s | P95 |
| PT-005 | Get crash events (24h) | < 3s | P95 |
| PT-006 | Get channel stats | < 500ms | P95 |

### 6.2 Resource Usage Tests

| Test ID | Metric | Threshold | Condition |
|---------|--------|-----------|-----------|
| PR-001 | Memory (idle) | < 50 MB | After startup |
| PR-002 | Memory (query) | < 200 MB | During 1000 event query |
| PR-003 | Memory (sustained) | Stable | 1 hour continuous use |
| PR-004 | CPU (idle) | < 1% | No active queries |
| PR-005 | CPU (query) | < 50% | During query |

### 6.3 Stress Tests

| Test ID | Scenario | Duration | Success Criteria |
|---------|----------|----------|------------------|
| PS-001 | Continuous queries | 1 hour | No memory leak, no crash |
| PS-002 | Rate limit saturation | 10 min | Proper rejection, no crash |
| PS-003 | Large result sets | 30 min | Consistent response times |

---

## 7. Test Data Requirements

### 7.1 Event Log Prerequisites

| Requirement | Description |
|-------------|-------------|
| System log populated | At least 100 events in System log |
| Application log populated | At least 100 events in Application log |
| Crash events present | At least 1 application error (EventID 1000) |
| Time range coverage | Events spanning at least 7 days |

### 7.2 Test Event Generation

For integration tests, generate known events:

```powershell
# Generate Application error event for testing
Write-EventLog -LogName Application -Source "TestApp" -EventId 1000 -EntryType Error -Message "Test crash event"

# Generate System warning event
# (Requires appropriate source registration)
```

---

## 8. Test Environment

### 8.1 Required Environment

| Component | Requirement |
|-----------|-------------|
| OS | Windows 11 (21H2+) |
| Node.js | >= 18.0.0 |
| Privileges | Standard user (not admin) |
| Event Log Service | Running |
| System log | Accessible |
| Application log | Accessible |

### 8.2 CI/CD Environment

| Environment | Purpose | Configuration |
|-------------|---------|---------------|
| GitHub Actions (Windows) | Automated tests | windows-latest runner |
| Local development | Manual testing | Developer workstation |

---

## 9. Test Automation

### 9.1 Test Framework

| Framework | Purpose |
|-----------|---------|
| Vitest | Unit and integration tests |
| @modelcontextprotocol/test | MCP protocol tests |
| Artillery | Performance tests |
| Custom scripts | Security/fuzzing tests |

### 9.2 CI Pipeline Tests

```yaml
test:
  unit:
    - Run all unit tests
    - Coverage report
    - Fail if < 80% coverage

  integration:
    - Start server
    - Run integration tests
    - Verify Event Log access

  security:
    - Run security test suite
    - Channel bypass attempts
    - XPath injection tests

  performance:
    - Response time benchmarks
    - Memory usage checks
```

### 9.3 Test Commands

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run security tests
npm run test:security

# Run with coverage
npm run test:coverage

# Run performance tests
npm run test:perf
```

---

## 10. Acceptance Criteria

### 10.1 Phase 0 (Documentation) - Test Plan Acceptance

- [ ] All test cases defined for security requirements
- [ ] Test coverage requirements specified
- [ ] Test environment documented
- [ ] Test data requirements identified

### 10.2 Phase 1 (Implementation) - Test Execution Acceptance

- [ ] All unit tests passing
- [ ] Code coverage >= 80%
- [ ] All integration tests passing
- [ ] All security tests passing
- [ ] Performance thresholds met
- [ ] No critical or high severity bugs open

---

## 11. Traceability Matrix

| Requirement | Test Cases |
|-------------|------------|
| FR-01 (Channel enumeration) | EL-007, MP-009 |
| FR-10 (Query System) | QS-001, EL-001 |
| FR-11 (Query Application) | QS-001, EL-002 |
| FR-12 (XPath filter) | QS-006, XV-* |
| FR-13 (Time range) | QS-005, EL-005 |
| FR-14 (Result limit) | QS-002-004, SD-001 |
| FR-20 (Crash detection) | CD-001-010 |
| NFR-10 (Read-only) | N/A (by design) |
| NFR-11 (Channel allowlist) | CG-*, SA-* |
| NFR-12 (No Security log) | CG-003, SA-001 |
| NFR-13 (XPath validation) | XV-*, SX-* |
| NFR-16 (Query caps) | RL-*, SD-* |

---

## 12. Non-Goals

1. **Load testing at scale**: Not applicable for single-user MCP server
2. **Multi-user testing**: Single connection model
3. **Network protocol tests**: Phase 0 is stdio only
4. **Browser compatibility**: Not a web application
5. **Mobile testing**: Desktop Windows only
