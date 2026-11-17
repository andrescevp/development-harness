# Tool Matrix

Verify version/license before use; the harness bundles none of these. Tier A is
read-only by default; Tier B requires per-test approval. Primary sources:
[`docs/research/security-probing-tooling-2026.md`](../../../docs/research/security-probing-tooling-2026.md).

## Tier A — read-only / low impact

| Surface | Tool | Access | Notes |
|---|---|---|---|
| Web | OWASP ZAP baseline | passive | spider + passive only; https://www.zaproxy.org/docs/docker/baseline-scan/ |
| Web | httpx | read-only | HTTP probing; https://github.com/projectdiscovery/httpx |
| Web/TLS | testssl.sh | read-only | handshake/cipher checks; https://github.com/testssl/testssl.sh |
| Discovery | Amass (passive) | read-only | no `-active`; https://github.com/owasp-amass/amass |
| API | jwt_tool decode-only | read-only | no token attacks; https://github.com/ticarpi/jwt_tool |
| API | graphql-cop | read-only | introspection/config checks; https://github.com/dolevf/graphql-cop |
| Desktop | ElectroNG | static | active successor to archived Electronegativity; https://github.com/doyensec/ElectroNG |
| Desktop | Ghidra / radare2 | offline | copy binaries; https://ghidra-sre.org/ · https://rada.re/n/ |
| Mobile | MobSF static | static | https://github.com/MobSF/Mobile-Security-Framework-MobSF |
| MCP | snyk-agent-scan | static/config | replaces `mcp-scan`; https://github.com/snyk/agent-scan |
| MCP | Cisco mcp-scanner | static | https://github.com/cisco-ai-defense/mcp-scanner |
| MCP | MCP Inspector | local only | pinned; local disposable server only (CVE-2025-49596, CVE-2025-58444); https://github.com/modelcontextprotocol/inspector |
| Supply chain | osv-scanner | read-only | https://github.com/google/osv-scanner |
| Supply chain | Semgrep OSS | read-only | LGPL-2.1 engine; https://semgrep.dev/ |
| Supply chain | Trivy / Syft / Grype | read-only | Apache-2.0; https://trivy.dev/ |
| Secrets | Gitleaks / TruffleHog | read-only | TruffleHog AGPL-3.0; keep local |
| Supply chain | cosign / slsa-verifier | verify | Apache-2.0; verify only |
| Supply chain | Scorecard / Checkov / kube-bench | read-only | Apache-2.0 |

## Tier B — state-changing / intrusive (approval required)

| Surface | Tool | Risk | Required controls | Source |
|---|---|---|---|---|
| Web | ZAP full/active scan | active payloads | scope, rate, non-prod, stop condition | https://www.zaproxy.org/docs/docker/full-scan/ |
| Web | Burp Scanner/Intruder | active/commercial | test accounts, scope, rate | https://portswigger.net/burp |
| Web | Nuclei (intrusive templates) | request templates | `-rate-limit`, template allowlist, non-prod | https://github.com/projectdiscovery/nuclei |
| Web | ffuf | high-volume fuzzing | `-rate`, scope, stop condition | https://github.com/ffuf/ffuf |
| Web/API | sqlmap | injection/exploitation | `--risk 1 --level 1`, non-destructive flags, written approval | https://github.com/sqlmapproject/sqlmap/wiki/Usage |
| API | Schemathesis | creates/changes/deletes | test/staging only, disposable data | https://github.com/schemathesis/schemathesis |
| API | RESTler | stateful fuzzing | disposable data, cleanup | https://github.com/microsoft/restler-fuzzer |
| Desktop | MobSF dynamic | instrumentation | VM/snapshot, test build | https://github.com/MobSF/Mobile-Security-Framework-MobSF |
| Mobile | Frida / objection | runtime instrumentation | test device/snapshot, GPL/wxWindows licenses | https://frida.re/ · https://github.com/sensepost/objection |
| Traffic | mitmproxy / Wireshark | capture privacy | test device, CA consent, redaction | https://mitmproxy.org/ · https://www.wireshark.org/ |
| MCP | promptfoo red-team | adversarial prompts | sandbox, local server, approval | https://www.promptfoo.dev/docs/red-team/mcp-security-testing/ |
| Discovery | Amass `-active` | active recon | scope, rate, approval | https://github.com/owasp-amass/amass |

## Licensing notes

- External CLI use is fine; do not vendor GPL/AGPL tools into distributed code
  without review. TruffleHog AGPL-3.0; sqlmap/testssl.sh GPL-2.0; jwt_tool/
  MobSF/objection GPL-3.0; Frida wxWindows 3.1; Semgrep engine LGPL-2.1;
  radare2 LGPLv3.
- Pin versions/commits; MCP tooling changes quickly.

## CI-safe subset

osv-scanner, Semgrep, Trivy, Syft/Grype, Gitleaks, cosign verify, slsa-verifier,
Scorecard, Checkov, kube-bench — no live target traffic.
