# Rules of Engagement

No active probe starts until this checklist is complete. Store the signed
authorization outside the report (reference it), never paste secrets.

## Authorization

- [ ] Written authorization names the target(s) and the tester.
- [ ] Scope allowlist: hosts, URLs, API methods, accounts, repositories, builds,
      MCP servers and exclusions.
- [ ] Time window and timezone.
- [ ] Non-production environment or snapshot/VM; rollback owner.
- [ ] Test accounts and data; no real customer data.
- [ ] Emergency stop contact and escalation path.
- [ ] Data handling: redaction, retention, transfer, deletion.
- [ ] Insurance/legal/contract constraints captured.

## Safe mode

- [ ] Read-only default (GET/HEAD/OPTIONS, static analysis).
- [ ] Tier B tests individually approved with a rate limit and stop condition.
- [ ] No DoS, fuzzing floods, destructive payloads, persistence, lateral
      movement, credential theft or data exfiltration.
- [ ] No redirect following outside the allowlist.
- [ ] No third-party/shared infrastructure unless explicitly named.
- [ ] Snapshot/VM for desktop/mobile instrumentation.

## Execution controls

| Control | Rule |
|---|---|
| Rate limit | Per-tool explicit; Nuclei `-rate-limit`, ffuf `-rate`, sqlmap `--risk 1 --level 1` unless approved |
| Scope check | Resolve DNS, compare host/IP; reject out-of-scope and shared hosts |
| Evidence | Redacted request/response, command, timestamp, tool/version |
| Monitoring | Watch error rate/latency; stop on production impact |
| Cleanup | Remove test data/artifacts; restore snapshots |
| Reporting | Candidate → audit scoring; no unsupported claims |

## Stop conditions

Stop and report immediately if:

- authorization or scope is ambiguous;
- a target resolves outside the allowlist or to shared infrastructure;
- production impact, errors, latency or rate limits are observed;
- credentials, tokens, PII or customer data appear;
- a test would require destructive/state-changing behavior beyond approval;
- the owner or emergency contact asks to stop.

Do not resume without written approval and a new scope check.

## MCP/agentic

- Prefer static/config scans over live proxying.
- MCP Inspector only against a locally hosted disposable server, pinned version;
  CVE-2025-49596 (no auth between client and proxy) and CVE-2025-58444 (XSS →
  command execution against an untrusted server) make it unsafe otherwise.
- Never send real credentials to an unverified MCP server.
- Treat tool descriptions and agent instructions as untrusted input.

## Desktop/mobile

- Use a VM/snapshot and test builds; never instrument a production device.
- No capture of real user traffic; use test accounts and redacted fixtures.
- Restore the snapshot and remove instrumentation after the test.
