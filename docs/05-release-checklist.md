# Release Checklist

## Document Information
- **Project**: winlog-mcp
- **Version**: 0.1.0
- **Phase**: 0 (Documentation)
- **Last Updated**: 2025-12-26

---

## 1. Overview

This checklist defines the criteria that must be satisfied before releasing winlog-mcp. Each item must be verified and signed off.

---

## 2. Pre-Release Checklist

### 2.1 Documentation Complete

| Item | Owner | Status | Sign-off |
|------|-------|--------|----------|
| [ ] Requirements document finalized | | ⬜ | |
| [ ] Threat model reviewed and approved | | ⬜ | |
| [ ] Permissions matrix verified | | ⬜ | |
| [ ] Architecture document complete | | ⬜ | |
| [ ] Test plan approved | | ⬜ | |
| [ ] API documentation complete | | ⬜ | |
| [ ] README with installation instructions | | ⬜ | |
| [ ] CHANGELOG updated | | ⬜ | |
| [ ] LICENSE file present | | ⬜ | |

### 2.2 Code Quality

| Item | Owner | Status | Sign-off |
|------|-------|--------|----------|
| [ ] All code reviewed and approved | | ⬜ | |
| [ ] No TODO/FIXME comments in release code | | ⬜ | |
| [ ] ESLint passes with no errors | | ⬜ | |
| [ ] Prettier formatting applied | | ⬜ | |
| [ ] TypeScript strict mode enabled | | ⬜ | |
| [ ] No `any` types in production code | | ⬜ | |
| [ ] All dependencies on stable versions | | ⬜ | |

### 2.3 Testing Complete

| Item | Owner | Status | Sign-off |
|------|-------|--------|----------|
| [ ] Unit test coverage >= 80% | | ⬜ | |
| [ ] All unit tests passing | | ⬜ | |
| [ ] Integration tests passing | | ⬜ | |
| [ ] Security tests passing | | ⬜ | |
| [ ] Performance tests meet thresholds | | ⬜ | |
| [ ] Manual testing completed | | ⬜ | |
| [ ] Edge cases tested | | ⬜ | |

### 2.4 Security Verification

| Item | Owner | Status | Sign-off |
|------|-------|--------|----------|
| [ ] Channel allowlist enforced (System, Application only) | | ⬜ | |
| [ ] Security channel blocked - verified | | ⬜ | |
| [ ] XPath validation tested with injection attempts | | ⬜ | |
| [ ] Rate limiting functional | | ⬜ | |
| [ ] Result caps enforced | | ⬜ | |
| [ ] No secrets in code or config | | ⬜ | |
| [ ] Dependencies scanned for vulnerabilities | | ⬜ | |
| [ ] npm audit shows no high/critical issues | | ⬜ | |
| [ ] Audit logging functional | | ⬜ | |
| [ ] Error messages don't leak internals | | ⬜ | |

### 2.5 Build and Package

| Item | Owner | Status | Sign-off |
|------|-------|--------|----------|
| [ ] Clean build succeeds | | ⬜ | |
| [ ] Production build optimized | | ⬜ | |
| [ ] Package.json version updated | | ⬜ | |
| [ ] Package.json metadata complete (author, license, repo) | | ⬜ | |
| [ ] .npmignore excludes dev files | | ⬜ | |
| [ ] Native bindings compile on target platform | | ⬜ | |
| [ ] No dev dependencies in production | | ⬜ | |

---

## 3. Release Verification

### 3.1 Installation Verification

| Environment | Steps | Status |
|-------------|-------|--------|
| Fresh Windows 11 VM | 1. Install Node.js 18+<br>2. npm install -g winlog-mcp<br>3. Verify startup | ⬜ |
| Windows 11 with existing Node | 1. npm install -g winlog-mcp<br>2. Verify no conflicts | ⬜ |

### 3.2 MCP Client Integration

| Client | Steps | Status |
|--------|-------|--------|
| Claude Desktop | 1. Add to config<br>2. Restart<br>3. Verify tools available | ⬜ |
| VS Code (if applicable) | 1. Configure MCP<br>2. Verify tools available | ⬜ |

### 3.3 Functional Verification

| Feature | Verification Steps | Status |
|---------|-------------------|--------|
| Channel enumeration | Request channels resource, verify System/Application listed | ⬜ |
| Query System log | query_events with channel=System, verify events returned | ⬜ |
| Query Application log | query_events with channel=Application, verify events returned | ⬜ |
| Security channel blocked | query_events with channel=Security, verify error | ⬜ |
| XPath filtering | Query with EventID filter, verify filtered results | ⬜ |
| Time range filtering | Query with startTime/endTime, verify range | ⬜ |
| Result limiting | Query with limit=10, verify max 10 events | ⬜ |
| Crash detection | get_crash_events, verify crash events identified | ⬜ |
| Channel stats | get_channel_stats, verify stats returned | ⬜ |

### 3.4 Error Handling Verification

| Scenario | Expected Behavior | Status |
|----------|-------------------|--------|
| Invalid channel name | CHANNEL_NOT_ALLOWED error | ⬜ |
| Invalid XPath | XPATH_INVALID error | ⬜ |
| Rate limit exceeded | RATE_LIMITED error after threshold | ⬜ |
| Query timeout | QUERY_TIMEOUT after 30s | ⬜ |

---

## 4. Release Artifacts

### 4.1 Required Artifacts

| Artifact | Location | Status |
|----------|----------|--------|
| [ ] npm package | npmjs.com | ⬜ |
| [ ] GitHub release | github.com/[org]/winlog-mcp/releases | ⬜ |
| [ ] Source tarball | GitHub release assets | ⬜ |
| [ ] CHANGELOG.md | Repository root | ⬜ |

### 4.2 Release Notes Template

```markdown
# winlog-mcp v0.1.0

## Overview
Read-only MCP server for Windows Event Logs.

## Features
- Query System and Application event logs
- XPath-based event filtering
- Time range queries
- Crash/incident detection
- Audit logging

## Requirements
- Windows 11 (21H2 or later)
- Node.js 18.0.0 or later
- Standard user privileges (no admin required)

## Installation
```bash
npm install -g winlog-mcp
```

## Configuration
Add to your MCP client configuration:
```json
{
  "mcpServers": {
    "winlog": {
      "command": "npx",
      "args": ["winlog-mcp"]
    }
  }
}
```

## Security Notes
- Only System and Application logs are accessible
- Security log is explicitly blocked
- All queries are logged for audit

## Known Limitations
- stdio transport only (HTTP in future release)
- No real-time subscriptions
- 1000 event maximum per query

## Breaking Changes
N/A (initial release)

## Contributors
[List contributors]
```

---

## 5. Post-Release Checklist

### 5.1 Verification

| Item | Owner | Status |
|------|-------|--------|
| [ ] npm package installable | | ⬜ |
| [ ] GitHub release visible | | ⬜ |
| [ ] Documentation accessible | | ⬜ |
| [ ] No immediate critical bugs reported | | ⬜ |

### 5.2 Communication

| Item | Owner | Status |
|------|-------|--------|
| [ ] Release announcement prepared | | ⬜ |
| [ ] Update project status | | ⬜ |

### 5.3 Monitoring

| Item | Duration | Owner |
|------|----------|-------|
| [ ] Monitor npm download stats | 7 days | |
| [ ] Monitor GitHub issues | 7 days | |
| [ ] Check for security reports | 7 days | |

---

## 6. Rollback Procedure

### 6.1 npm Rollback

```bash
# Deprecate problematic version
npm deprecate winlog-mcp@0.1.0 "Critical bug found, please use 0.1.1"

# If necessary, unpublish (within 72 hours only)
npm unpublish winlog-mcp@0.1.0
```

### 6.2 GitHub Rollback

1. Delete release from Releases page
2. Delete associated git tag
3. Post issue explaining rollback

### 6.3 Communication

1. Post notice on GitHub Discussions/Issues
2. Update README with warning
3. Notify known users if possible

---

## 7. Version Numbering

### 7.1 Semantic Versioning

| Version Component | When to Increment |
|-------------------|-------------------|
| Major (X.0.0) | Breaking changes to MCP interface |
| Minor (0.X.0) | New features, new tools/resources |
| Patch (0.0.X) | Bug fixes, security patches |

### 7.2 Pre-release Versions

| Tag | Purpose | Example |
|-----|---------|---------|
| alpha | Early development | 0.1.0-alpha.1 |
| beta | Feature complete, testing | 0.1.0-beta.1 |
| rc | Release candidate | 0.1.0-rc.1 |

---

## 8. Security Release Process

### 8.1 Security Issue Received

| Step | Action | Timeframe |
|------|--------|-----------|
| 1 | Acknowledge receipt | 24 hours |
| 2 | Assess severity | 48 hours |
| 3 | Develop fix | Based on severity |
| 4 | Internal testing | 24-48 hours |
| 5 | Release patch | ASAP for critical |
| 6 | Public disclosure | After patch available |

### 8.2 Severity Response Times

| Severity | Response Time | Example |
|----------|---------------|---------|
| Critical | 24 hours | Remote code execution |
| High | 48 hours | Security log bypass |
| Medium | 1 week | DoS vulnerability |
| Low | Next release | Minor info disclosure |

---

## 9. Sign-off

### 9.1 Release Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| Reviewer | | | |
| Security | | | |

### 9.2 Final Checklist

- [ ] All sections above completed
- [ ] All sign-offs obtained
- [ ] No open blockers
- [ ] Release approved

---

## 10. Non-Goals

1. **Automated deployment**: Manual release process for initial versions
2. **Multiple distribution channels**: npm only for Phase 0
3. **Installer packages**: No .msi or .exe installer
4. **Docker images**: Not applicable for Windows-only MCP server
5. **Continuous deployment**: Manual release triggers only
