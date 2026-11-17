# Probe Playbooks

Every playbook starts with the rules of engagement gate and ends with a stop
condition. Use test accounts and non-production data only.

## Web application

1. Confirm scope and authorization; record baseline error/latency.
2. Passive: headers, cookies, CORS, CSP, TLS (`testssl.sh`), exposed files,
   source maps, framework versions.
3. Auth/session: login/logout, MFA paths, session rotation, cookie flags,
   password reset, account enumeration (test accounts).
4. Access control: horizontal/vertical object and function checks with two test
   identities.
5. Input/output: reflection, injection candidates, file upload/download, SSRF
   canaries (no internal scanning), open redirect.
6. Business logic: replay, quantity/price manipulation, coupon/refund abuse.
7. Record evidence and stop on production impact.

## API

1. Confirm scope, API version, auth scheme and rate limits.
2. Inventory endpoints/schemas (OpenAPI/GraphQL); check docs/debug exposure.
3. Auth: token validation, audience/issuer, expiry, refresh, JWT algorithms.
4. BOLA/BFLA/property authorization with two tenants/roles; object ID fuzzing
   only in test data.
5. Resource consumption and business flows: pagination, batch, export, quota.
6. Schema fuzzing only with approval (`Schemathesis`/`RESTler`) in a disposable
   environment; cleanup test data.
7. GraphQL: introspection policy, depth/complexity limits, resolver authz.

## Desktop / Electron

1. Confirm build hash, signing, test VM/snapshot.
2. Static: Electron flags (`nodeIntegration`, `contextIsolation`, sandbox, CSP,
   `webSecurity`), IPC sender validation, preload surface, auto-update, asar.
3. Local data: storage, logs, caches, keychain/credential storage, file
   permissions.
4. Navigation/window controls, external protocol handlers, `shell.openExternal`.
5. Network: TLS validation, proxy handling, certificate pinning where claimed.
6. Dynamic instrumentation only with approval and a test build; restore VM.

## Mobile

1. Confirm scope, app build, test device/emulator and snapshot.
2. Static: manifest/plist permissions, exported components, deep links, backup,
   secrets, hardcoded endpoints, MASVS storage/crypto/auth/network/platform.
3. Dynamic: TLS validation, root/jailbreak detection, instrumentation
   resistance, local storage, keychain/keystore (test build only).
4. Privacy: tracking SDKs, data minimization, permission prompts.
5. Use MASTG test IDs and record evidence; restore device.

## MCP / agentic

1. Confirm scope; prefer static/config scanning.
2. Inventory MCP servers/tools, transports, auth, scopes, tool schemas,
   resources/prompts, agent instructions, memory stores.
3. Check tool descriptions/instructions for injection and unsafe defaults.
4. Authorization: audience validation, token passthrough, confused deputy,
   scope minimization, consent, redirect URI/CIMD trust.
5. Prompt/tool-output injection and memory poisoning with a local disposable
   server; no third-party server from a privileged host.
6. MCP Inspector only pinned + local; treat it as an attack surface.
7. Record candidate findings and hand off to the audit skill.

## Supply chain / CI

1. Confirm repo/artifact scope and read-only access.
2. Lockfiles/SBOM: osv-scanner, Trivy/Syft/Grype; record versions.
3. Secrets: Gitleaks/TruffleHog, local-only output.
4. Static: Semgrep, Checkov/kube-bench, Scorecard.
5. Provenance: cosign/slsa-verifier against the released artifact.
6. CI: workflow permissions, untrusted PR execution, secret exposure, artifact
   signing; do not modify workflows without approval.

## Stop conditions

Stop on out-of-scope target, production impact, unexpected data, secret/PII
exposure, rate/traffic limit, destructive request without approval, or owner
request. Record the condition and evidence; do not continue.
