import { Demand, ExecData } from '../api/types';

// Branches convention: "repoName|branchName" — enables repo-grouped display in the UI

const PORTAL_103_INIT_DOC = `# RFC — Integration with the new payment gateway (PORTAL-103)

## Summary

Integrate the **PagSeguro** gateway into the Customer Portal, replacing the legacy Cielo gateway on new transactions. The change has to be transparent to the end user and must not interrupt existing flows.

## Context

The contract with Cielo expires on **2026-06-30**. PagSeguro offers better rates for boleto and Pix, and is already used by the Payments team (ws-2). Reusing the existing integration in \`api-payments\` is viable through an internal call.

## Goals

- Implement \`PagSeguroGatewayAdapter\` in \`portal-backend\` following the \`IGateway\` interface
- Support the methods: **credit card**, **boleto**, **Pix**
- Show the gateway's status on the customer's panel (frontend)
- Keep compatibility with Cielo's existing transactions (read-only)

## Out of scope

- Migrating historical transactions
- Refunds through PagSeguro (phase 2)
- The mobile app (a separate scope)

## Acceptance criteria

1. New charges use PagSeguro by default
2. The panel shows the transaction's method and status in real time
3. Unit test coverage ≥ 80% on the adapter
4. Zero downtime on the deploy (feature flag \`USE_PAGSEGURO=true\`)

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| An unstable PagSeguro sandbox | Medium | Tests with a mock until approval |
| A change in the event schema | Low | Version the events in \`shared-contracts\` |

## References

- Credentials: \`secrets/pagseguro\` (Vault)
- PagSeguro documentation: [dev.pagseguro.uol.com.br](https://dev.pagseguro.uol.com.br)
- ADR-012: the architecture decision recorded in \`docs/ADR/ADR-012-gateway-integration.md\`
`;

const PORTAL_103_CONTEXT_DOC = `# Technical context — PORTAL-103

## A forensic reading of \`portal-backend\`

### The current entry point

The charge flow goes through \`PaymentService\` (\`src/payments/payment.service.ts\`). It calls \`CieloAdapter\`, which implements the \`IGateway\` interface:

\`\`\`typescript
export interface IGateway {
  charge(input: ChargeInput): Promise<ChargeResult>;
  refund(transactionId: string): Promise<void>;
  getStatus(transactionId: string): Promise<TransactionStatus>;
}
\`\`\`

### The dependencies found

| File | Role |
|------|------|
| \`src/payments/payment.service.ts\` | The orchestrator — inject the new adapter here |
| \`src/payments/adapters/cielo.adapter.ts\` | Legacy — keep it for old transactions |
| \`src/payments/dto/charge.dto.ts\` | A shared DTO — compatible with PagSeguro |
| \`src/payments/events/payment-created.event.ts\` | The event published on Redis after a charge |

### The feature flag

Use the \`USE_PAGSEGURO\` environment variable (already in \`.env.example\`) through \`ConfigService\`. When \`true\`, \`PaymentService\` instantiates \`PagSeguroAdapter\` instead of \`CieloAdapter\`.

### The frontend (\`portal-frontend\`)

The \`<PaymentStatusBadge />\` component in \`src/components/payments/\` reads the API's \`method\` field. No interface change is needed — only adding the \`"pagseguro"\` value to the union type.

### The integration risk

PagSeguro's sandbox API returns an asynchronous \`202 Accepted\` for Pix — unlike Cielo, which returns a synchronous \`200\`. \`ChargeResult\` needs a \`pending: boolean\` field.
`;

const PORTAL_103_PLAN_DOC = `# Development plan — PORTAL-103

> **Status:** being drafted — waiting on the dev to confirm the Pix timeout

## Tasks

### Backend (\`portal-backend\`)

- [ ] **T1** — Create \`PagSeguroAdapter\` implementing \`IGateway\`
  - Support for card, boleto and Pix
  - Handle Pix's asynchronous response (\`pending: true\`)
  - Credentials through \`ConfigService\` (path: \`secrets/pagseguro\`)

- [ ] **T2** — Update \`PaymentService\` with the feature flag
  - Inject the adapter according to \`USE_PAGSEGURO\`
  - Add the \`pending\` field to \`ChargeResult\`

- [ ] **T3** — Unit tests
  - Mock PagSeguro's HTTP client
  - Cover: charge ok, async charge (Pix), network failure, invalid credential

- [ ] **T4** — Integration with the events
  - Publish \`payment-created\` on Redis with \`gateway: "pagseguro"\`

### Frontend (\`portal-frontend\`)

- [ ] **T5** — Add \`"pagseguro"\` to \`method\`'s union type
  - An icon and a label in \`<PaymentStatusBadge />\`

- [ ] **T6** — A "waiting for Pix confirmation" indicator on the panel
  - Poll every 5s on the \`GET /api/v1/payments/:id/status\` endpoint

## Execution order

\`\`\`
T1 → T2 → T3 → T4 (backend, sequential)
         ↓
        T5 → T6 (frontend, may run in parallel with T3)
\`\`\`

## Estimate

| Task | Estimate |
|------|----------|
| T1 | 2h |
| T2 | 1h |
| T3 | 2h |
| T4 | 30min |
| T5 | 30min |
| T6 | 1h30 |
| **Total** | **~7h30** |
`;

const PORTAL_103_TEST_PLAN = {
  unit: `## Unit tests — PORTAL-103

### \`PagSeguroAdapter.charge\` — an approved card
- **Arrange**: a mocked HTTP client, response \`{ status: "PAID" }\`; credentials through a \`ConfigService\` mock
- **Act**: \`adapter.charge({ method: "card", amount: 100 })\`
- **Assert**: it returns \`{ success: true, pending: false }\`; the HTTP client is called with the right endpoint

### \`PagSeguroAdapter.charge\` — an asynchronous Pix
- **Arrange**: a mocked HTTP client, response \`{ status: "WAITING" }\`
- **Act**: \`adapter.charge({ method: "pix", amount: 50 })\`
- **Assert**: it returns \`{ success: true, pending: true }\`

### \`PagSeguroAdapter.charge\` — a network failure
- **Arrange**: the HTTP client throws \`NetworkError\`
- **Act**: \`adapter.charge({ method: "card", amount: 100 })\`
- **Assert**: it returns \`{ success: false, error: "network_error" }\`; no unhandled exception

### \`PaymentService\` with the feature flag \`USE_PAGSEGURO=true\`
- **Arrange**: \`ConfigService\` returns \`USE_PAGSEGURO=true\`; \`PagSeguroAdapter\` mocked
- **Act**: \`paymentService.charge(payload)\`
- **Assert**: the PagSeguro adapter is used; \`ChargeResult.pending\` is present in the return

### \`PaymentService\` with the feature flag \`USE_PAGSEGURO=false\`
- **Arrange**: \`ConfigService\` returns \`USE_PAGSEGURO=false\`; the legacy adapter mocked
- **Act**: \`paymentService.charge(payload)\`
- **Assert**: the legacy adapter is used; the \`pending\` field is absent from the return
`,
  e2e: `## E2E tests — PORTAL-103

### A payment by an approved card
- **Given that** the user is at the checkout with an item in the cart
- **When** they select "Credit card", fill in the data and confirm
- **Then** they see the "Payment approved" confirmation screen in under 3s

### A payment by Pix — waiting for confirmation
- **Given that** the user selects "Pix" at the checkout
- **When** the QR code is shown and the payment stays pending at the gateway
- **Then** the panel shows the "waiting for Pix confirmation" badge and polls every 5s

### A payment by Pix — the confirmation arrives
- **Given that** the panel shows "waiting for Pix confirmation"
- **When** PagSeguro's webhook reports the payment as approved
- **Then** the badge changes to "Paid" with no need for a manual refresh
`,
};

const PORTAL_104_TEST_PLAN = {
  unit: `## Unit tests — PORTAL-104

### \`tokenService.generateAccessToken\`
- **Arrange**: \`TokenService\` instantiated with a mock of \`jsonwebtoken@9.0.2\`; payload \`{ id: 1, role: 'admin' }\`
- **Act**: \`await generateAccessToken(payload)\`
- **Assert**: it returns a valid JWT string expiring in 15 min; \`jwt.sign\` is called with \`await\`

### \`tokenService.generateRefreshToken\`
- **Arrange**: the same; the mock uses \`mockResolvedValue\` (not \`mockReturnValue\`)
- **Act**: \`await generateRefreshToken({ id: 1 })\`
- **Assert**: a JWT expiring in 7 days; the asynchronous call is honoured

### \`tokenService.rotateToken\`
- **Arrange**: a valid refresh token in the mock; \`jsonwebtoken@9.0.2\` resolving asynchronously
- **Act**: \`await rotateToken(refreshToken)\`
- **Assert**: it returns a new \`{ accessToken, refreshToken }\` pair; the tokens differ

### \`authMiddleware\` — a valid bearer
- **Arrange**: the header \`Authorization: Bearer <valid_token>\`; the middleware instantiated
- **Act**: the request goes through \`authMiddleware\`
- **Assert**: \`req.user\` is filled in; \`next()\` is called with no error

### \`authMiddleware\` — a missing token → 401
- **Arrange**: a request with no \`Authorization\` header
- **Act**: the request goes through \`authMiddleware\`
- **Assert**: a \`401 Unauthorized\` response; \`next()\` is NOT called

### \`session.signRefreshToken\` (frontend)
- **Arrange**: \`signRefreshToken\` converted to \`async\`; a mock user payload
- **Act**: \`await signRefreshToken(payload)\`
- **Assert**: it returns a JWT; no \`SyntaxError\` from the legacy synchronous call
`,
  e2e: `## E2E tests — PORTAL-104

### Signing in with valid credentials
- **Given that** the user opens \`/login\`
- **When** they fill in the right e-mail and password and click "Sign in"
- **Then** they are redirected to \`/dashboard\`; the JWT token is stored in the \`session\` cookie

### An expired token refreshes automatically
- **Given that** the \`accessToken\` has expired (simulated with a \`Date.now\` mock)
- **When** the frontend makes any authenticated call
- **Then** the \`refreshToken\` is used automatically; a new pair is issued with no visible 401

### A forged token is rejected (CVE-2026-1234)
- **Given that** an attacker sends a JWT with a malformed key for \`RS256\`
- **When** the token reaches \`authMiddleware\`
- **Then** it returns \`401 Unauthorized\`; no sensitive data is exposed in the body
`,
};

const PORTAL_104_INIT_DOC = `# Security PRD — CVE-2026-1234 (PORTAL-104)

## The vulnerability

**CVE-2026-1234** affects \`jsonwebtoken\` in versions **< 9.0.2**. The flaw lets an attacker forge JWT tokens when the \`RS256\` algorithm is used with malformed keys.

**CVSS score:** 9.1 (Critical)
**Vector:** Network / No prior authentication / High confidentiality impact

## The systems affected

| Repo | Current version | Impact |
|------|-----------------|--------|
| \`portal-backend\` | \`jsonwebtoken@8.5.1\` | ✅ Affected — it uses RS256 |
| \`portal-frontend\` | \`jsonwebtoken@8.5.1\` | ⚠️ Affected — it verifies the token in SSR |

## The action required

Update **immediately** to \`jsonwebtoken@9.0.2\` in both repos.

### v9's breaking changes

The \`sign()\` API became **asynchronous** by default when no \`callback\` is given:

\`\`\`diff
- const token = jwt.sign(payload, secret);           // v8 — synchronous
+ const token = await jwt.sign(payload, secret);      // v9 — asynchronous
\`\`\`

## Acceptance criteria

1. Both repos on \`jsonwebtoken@9.0.2\`
2. Every \`sign()\` call adjusted to \`async/await\`
3. \`tokenService\`'s unit tests passing
4. Deployed to production with zero downtime

## Deadline

The fix has to be in production within **48h** of this card being opened.
`;

const PORTAL_104_CONTEXT_DOC = `# Technical context — PORTAL-104

## An inventory of \`jsonwebtoken\`'s use

### \`portal-backend\`

| File | Use | Impact |
|------|-----|--------|
| \`src/auth/tokenService.ts\` | \`jwt.sign()\` (3x) | **Requires async/await** |
| \`src/middleware/authMiddleware.ts\` | \`jwt.verify()\` | No change (it stays synchronous) |
| \`src/auth/tokenService.test.ts\` | Mocks of sign | Adjust the mocks to a Promise |

### \`portal-frontend\`

| File | Use | Impact |
|------|-----|--------|
| \`src/lib/auth/ssr-token.ts\` | \`jwt.verify()\` in the Next.js middleware | No change |
| \`src/lib/auth/session.ts\` | \`jwt.sign()\` (1x) for the refresh token | **Requires async/await** |

## The \`sign()\` calls found in the backend

\`\`\`typescript
// src/auth/tokenService.ts — line 42
const accessToken = jwt.sign({ sub: user.id, role: user.role }, privateKey, {
  algorithm: 'RS256', expiresIn: '15m'
});

// src/auth/tokenService.ts — line 61
const refreshToken = jwt.sign({ sub: user.id }, refreshSecret, { expiresIn: '7d' });

// src/auth/tokenService.ts — line 89 (renewal)
const newToken = jwt.sign({ ...decoded, iat: Date.now() }, privateKey, { algorithm: 'RS256' });
\`\`\`

## The fix's pattern

\`\`\`typescript
// Before (v8)
const token = jwt.sign(payload, secret, options);

// After (v9)
const token = await jwt.sign(payload, secret, options);
// The calling functions have to be marked async
\`\`\`

## A note on the tests

The current mock in \`tokenService.test.ts\` uses \`jest.spyOn(jwt, 'sign').mockReturnValue('fake-token')\`. With v9 it needs \`mockResolvedValue('fake-token')\`.
`;

const PORTAL_104_PLAN_DOC = `# Execution plan — PORTAL-104

## The sequence

### 1. \`portal-frontend\` (the smaller risk — 1 occurrence)

- [ ] Bump \`jsonwebtoken\` to \`9.0.2\` in \`package.json\`
- [ ] Make \`src/lib/auth/session.ts#signRefreshToken()\` asynchronous
- [ ] Check that \`signRefreshToken()\`'s callers are async-safe
- [ ] Run \`pnpm test\` on the frontend

### 2. \`portal-backend\` (3 occurrences + tests)

- [ ] Bump \`jsonwebtoken\` to \`9.0.2\`
- [ ] Convert the 3 \`sign()\` calls into \`await jwt.sign()\`
- [ ] Mark \`generateAccessToken()\`, \`generateRefreshToken()\` and \`rotateToken()\` as \`async\`
- [ ] Update the mocks in \`tokenService.test.ts\` (\`mockReturnValue\` → \`mockResolvedValue\`)
- [ ] Run \`pnpm test\` on the backend

### 3. Integrated validation

- [ ] Bring the whole local environment up (\`frontend + backend\`)
- [ ] Test the sign-in, refresh and sign-out flow by hand
- [ ] Confirm \`authMiddleware\` still rejects invalid tokens

## Deploy checklist

\`\`\`
[ ] The PR reviewed and approved
[ ] CI green (every test passing)
[ ] Deployed to staging — a sign-in smoke test
[ ] Deployed to production — watch Sentry for 15min
\`\`\`

## Rollback

On a critical failure in production: revert through the \`LEGACY_JWT=true\` feature flag, which keeps \`jsonwebtoken@8.5.1\` in compatibility mode (already configured in the Vault).
`;

// ── Exec data for PORTAL-104 (CVE fix — two repos in parallel) ──────────────
const PORTAL_104_EXEC_DATA: ExecData = {
  tasks: [
    { id: 't1', label: 'T1 — Upgrade portal-frontend', parallelGroup: 0, filePaths: ['portal-frontend::package.json', 'portal-frontend::src/lib/auth/session.ts'], status: 'done' },
    { id: 't2', label: 'T2 — Upgrade portal-backend',  parallelGroup: 0, filePaths: ['portal-backend::package.json', 'portal-backend::src/auth/tokenService.ts'], status: 'done' },
    { id: 't3', label: 'T3 — Adjust the tests',        parallelGroup: 1, filePaths: ['portal-backend::tests/unit/tokenService.test.ts'], status: 'done' },
  ],
  files: [
    {
      path: 'package.json', repo: 'portal-frontend', branch: 'feature/PORTAL-104-sec-deps',
      linesAdded: 1, linesRemoved: 1,
      diff: `--- a/package.json\n+++ b/package.json\n@@ -12,7 +12,7 @@\n   "name": "portal-frontend",\n   "dependencies": {\n-    "jsonwebtoken": "^8.5.1",\n+    "jsonwebtoken": "^9.0.2",\n     "react": "^18.2.0",\n     "react-dom": "^18.2.0"\n   }`,
    },
    {
      path: 'src/lib/auth/session.ts', repo: 'portal-frontend', branch: 'feature/PORTAL-104-sec-deps',
      linesAdded: 2, linesRemoved: 2,
      diff: `--- a/src/lib/auth/session.ts\n+++ b/src/lib/auth/session.ts\n@@ -8,8 +8,8 @@ import { config } from '../config';\n \n-export function signRefreshToken(userId: string): string {\n-  return jwt.sign(\n+export async function signRefreshToken(userId: string): Promise<string> {\n+  return await jwt.sign(\n     { sub: userId },\n     config.refreshSecret,\n     { expiresIn: '7d' }\n   );\n }`,
    },
    {
      path: 'package.json', repo: 'portal-backend', branch: 'feature/PORTAL-104-sec-deps',
      linesAdded: 1, linesRemoved: 1,
      diff: `--- a/package.json\n+++ b/package.json\n@@ -8,7 +8,7 @@\n   "name": "portal-backend",\n   "dependencies": {\n-    "jsonwebtoken": "^8.5.1",\n+    "jsonwebtoken": "^9.0.2",\n     "express": "^5.0.0",\n     "drizzle-orm": "^0.30.0"\n   }`,
    },
    {
      path: 'src/auth/tokenService.ts', repo: 'portal-backend', branch: 'feature/PORTAL-104-sec-deps',
      linesAdded: 6, linesRemoved: 6,
      diff: `--- a/src/auth/tokenService.ts\n+++ b/src/auth/tokenService.ts\n@@ -18,19 +18,19 @@ import { config } from '../config';\n \n-export function generateAccessToken(user: User): string {\n-  return jwt.sign(\n+export async function generateAccessToken(user: User): Promise<string> {\n+  return await jwt.sign(\n     { sub: user.id, role: user.role },\n     config.privateKey,\n     { algorithm: 'RS256', expiresIn: '15m' }\n   );\n }\n \n-export function generateRefreshToken(userId: string): string {\n-  return jwt.sign(\n+export async function generateRefreshToken(userId: string): Promise<string> {\n+  return await jwt.sign(\n     { sub: userId }, config.refreshSecret, { expiresIn: '7d' }\n   );\n }\n \n-export function rotateToken(decoded: JwtPayload): string {\n-  return jwt.sign(\n+export async function rotateToken(decoded: JwtPayload): Promise<string> {\n+  return await jwt.sign(\n     { ...decoded, iat: Date.now() }, config.privateKey, { algorithm: 'RS256' }\n   );\n }`,
    },
    {
      path: 'tests/unit/tokenService.test.ts', repo: 'portal-backend', branch: 'feature/PORTAL-104-sec-deps',
      linesAdded: 4, linesRemoved: 4,
      diff: `--- a/tests/unit/tokenService.test.ts\n+++ b/tests/unit/tokenService.test.ts\n@@ -8,14 +8,14 @@ describe('tokenService', () => {\n   it('should generate access token', async () => {\n-    jest.spyOn(jwt, 'sign').mockReturnValue('mock-access' as any);\n-    const token = tokenService.generateAccessToken(mockUser);\n+    jest.spyOn(jwt, 'sign').mockResolvedValue('mock-access' as any);\n+    const token = await tokenService.generateAccessToken(mockUser);\n     expect(token).toBe('mock-access');\n   });\n \n   it('should generate refresh token', async () => {\n-    jest.spyOn(jwt, 'sign').mockReturnValue('mock-refresh' as any);\n-    const token = tokenService.generateRefreshToken(mockUser.id);\n+    jest.spyOn(jwt, 'sign').mockResolvedValue('mock-refresh' as any);\n+    const token = await tokenService.generateRefreshToken(mockUser.id);\n     expect(token).toBe('mock-refresh');\n   });\n });`,
    },
  ],
};

// ── Exec data for PAY-203 (audit logs — three repos sequential) ──────────────
const PAY_203_EXEC_DATA: ExecData = {
  tasks: [
    { id: 't1', label: 'T1 — Create the AuditEvent schema', parallelGroup: 0, filePaths: ['shared-contracts::src/events/AuditEvent.ts'], status: 'done' },
    { id: 't2', label: 'T2 — Implement auditService', parallelGroup: 1, filePaths: ['api-payments::src/audit/auditService.ts'], status: 'done' },
    { id: 't3', label: 'T3 — Write the e2e tests',      parallelGroup: 2, filePaths: ['api-payments::tests/e2e/audit.e2e.test.ts'], status: 'done' },
  ],
  files: [
    {
      path: 'src/events/AuditEvent.ts', repo: 'shared-contracts', branch: 'feature/PAY-203-audit-events',
      linesAdded: 16, linesRemoved: 0,
      diff: `--- /dev/null\n+++ b/src/events/AuditEvent.ts\n@@ -0,0 +1,16 @@\n+export type AuditEventType =\n+  | 'payment.created'\n+  | 'payment.captured'\n+  | 'payment.failed'\n+  | 'chargeback.initiated';\n+\n+export interface AuditEvent {\n+  id: string;\n+  type: AuditEventType;\n+  transactionId: string;\n+  amount: number;\n+  currency: 'BRL';\n+  occurredAt: string; // ISO 8601\n+  metadata?: Record<string, unknown>;\n+}`,
    },
    {
      path: 'src/audit/auditService.ts', repo: 'api-payments', branch: 'feature/PAY-203-audit-log',
      linesAdded: 22, linesRemoved: 0,
      diff: `--- /dev/null\n+++ b/src/audit/auditService.ts\n@@ -0,0 +1,22 @@\n+import { AuditEvent } from 'shared-contracts/src/events/AuditEvent';\n+import { rabbitMQ } from '../infra/rabbitmq';\n+import { logger } from '../infra/logger';\n+\n+const EXCHANGE = 'audit.events';\n+\n+export async function publishAuditEvent(event: AuditEvent): Promise<void> {\n+  try {\n+    await rabbitMQ.publish(EXCHANGE, event.type, event);\n+    logger.info({ event }, 'Audit event published');\n+  } catch (err) {\n+    logger.error({ err, event }, 'Failed to publish audit event');\n+    throw err;\n+  }\n+}\n+\n+export async function buildAuditEvent(\n+  type: AuditEvent['type'],\n+  transactionId: string,\n+  amount: number,\n+): Promise<AuditEvent> {\n+  return { id: crypto.randomUUID(), type, transactionId, amount, currency: 'BRL', occurredAt: new Date().toISOString() };\n+}`,
    },
    {
      path: 'tests/e2e/audit.e2e.test.ts', repo: 'api-payments', branch: 'feature/PAY-203-audit-log',
      linesAdded: 28, linesRemoved: 0,
      diff: `--- /dev/null\n+++ b/tests/e2e/audit.e2e.test.ts\n@@ -0,0 +1,28 @@\n+import { publishAuditEvent, buildAuditEvent } from '../../src/audit/auditService';\n+import { rabbitMQ } from '../../src/infra/rabbitmq';\n+\n+describe('Audit log e2e', () => {\n+  let events: unknown[] = [];\n+\n+  beforeAll(async () => {\n+    await rabbitMQ.connect();\n+    rabbitMQ.subscribe('audit.events', e => events.push(e));\n+  });\n+\n+  afterAll(async () => { await rabbitMQ.disconnect(); });\n+\n+  it('should publish payment.created event', async () => {\n+    const ev = await buildAuditEvent('payment.created', 'pmt-9901', 199.90);\n+    await publishAuditEvent(ev);\n+    await new Promise(r => setTimeout(r, 200));\n+    expect(events).toHaveLength(1);\n+    expect(events[0]).toMatchObject({ type: 'payment.created' });\n+  });\n+\n+  it('should publish chargeback event', async () => {\n+    // Requires RabbitMQ consumer with 15s timeout\n+    const ev = await buildAuditEvent('chargeback.initiated', 'pmt-8821', 89.90);\n+    await publishAuditEvent(ev);\n+    await new Promise(r => setTimeout(r, 10000));\n+    expect(events).toHaveLength(2);\n+  });\n+});`,
    },
  ],
};

export const mockCards: Demand[] = [
  {
    id: 'd-1',
    workspaceId: 'ws-1',
    externalKey: 'PORTAL-101',
    title: 'Add a PDF export', type: 'Story', provider: 'jira',
    assignee: 'João Silva',
    providerStatus: 'To Do',
    dopStatus: 'new',
    stages: [],
    repositoryOverview: { repos: [], branches: [], commits: 0, prs: [], files: [], tests: [] },
    chat: []
  },
  {
    id: 'd-2',
    workspaceId: 'ws-1',
    externalKey: 'PORTAL-102',
    title: 'Fix a bug in the pagination', type: 'Bug', provider: 'jira',
    assignee: 'Maria Oliveira',
    providerStatus: 'To Do',
    dopStatus: 'new',
    stages: [],
    repositoryOverview: { repos: [], branches: [], commits: 0, prs: [], files: [], tests: [] },
    chat: []
  },
  {
    id: 'd-3',
    workspaceId: 'ws-1',
    externalKey: 'PORTAL-103',
    title: 'Integration with the new payment gateway', type: 'Epic', provider: 'jira',
    assignee: 'João Silva',
    providerStatus: 'In Progress',
    dopStatus: 'doing',
    stages: [
      { key: 'init',    title: 'Start the demand',    status: 'done',    summary: 'The PORTAL-103 card was read through the Jira MCP. The RFC was generated and approved.',                 document: PORTAL_103_INIT_DOC,    startedAt: new Date(Date.now() - 3700000).toISOString(), finishedAt: new Date(Date.now() - 3500000).toISOString() },
      { key: 'context', title: 'Contextualisation',     status: 'done',    summary: 'The forensic reading is done. Three integration points were found in portal-backend.',                   document: PORTAL_103_CONTEXT_DOC, startedAt: new Date(Date.now() - 3500000).toISOString(), finishedAt: new Date(Date.now() - 3200000).toISOString() },
      { key: 'plan',    title: 'Plan',                status: 'running', summary: 'Drafting the development plan: 4 tasks on the backend, 2 on the frontend.',                             document: PORTAL_103_PLAN_DOC,    testPlan: PORTAL_103_TEST_PLAN, startedAt: new Date(Date.now() - 3200000).toISOString() }
    ],
    repositoryOverview: {
      repos: ['portal-backend'],
      branches: ['portal-backend|feature/PORTAL-103-gateway'],
      commits: 2,
      prs: [],
      files: [
        { path: 'docs/prompts/PORTAL-103-context.md', kind: 'context', change: 'created' },
        { path: 'docs/ADR/ADR-012-gateway-integration.md', kind: 'adr', change: 'created' }
      ],
      tests: [],
      startedAt: new Date(Date.now() - 3700000).toISOString()
    },
    chat: [
      { id: 'c1', author: 'dev',    text: 'Start the work on this demand.',  at: new Date(Date.now() - 3500000).toISOString() },
      { id: 'c2', author: 'claude', text: 'Understood. I read the PORTAL-103 card through the Jira MCP. I will do a forensic reading of portal-backend to understand the existing integration points.', at: new Date(Date.now() - 3400000).toISOString(), actions: ['Ran `dop demand-init PORTAL-103`', 'Read the Jira card through the MCP'] },
      { id: 'c3', author: 'claude', text: 'The forensic reading is done. I found the `PaymentService` service in portal-backend, which will need extending. Writing the development plan now.', at: new Date(Date.now() - 2800000).toISOString(), actions: ['Created the feature/PORTAL-103-gateway branch', 'Generated ADR-012-gateway-integration.md'] },
      { id: 'c4', author: 'dev',    text: 'The new gateway is PagSeguro. The credentials are in the Vault path `secrets/pagseguro`.', at: new Date(Date.now() - 2400000).toISOString() },
      { id: 'c5', author: 'claude', text: 'Perfect. I noted the credentials (a reference in the context, without exposing the value). I am finishing the plan now — it should have 3 backend tasks and 1 frontend task to show the gateway\u2019s status.', at: new Date(Date.now() - 2000000).toISOString() }
    ]
  },
  {
    id: 'd-4',
    workspaceId: 'ws-1',
    externalKey: 'PORTAL-104',
    title: 'Update the security dependencies (CVE-2026-1234)', type: 'Bug', provider: 'jira',
    assignee: 'Ana Costa',
    providerStatus: 'In Progress',
    dopStatus: 'doing',
    stages: [
      { key: 'init',    title: 'Start the demand',    status: 'done',    summary: 'The card was read. CVE-2026-1234 affects `jsonwebtoken` < 9.0.2. The security PRD was generated.', document: PORTAL_104_INIT_DOC,    startedAt: new Date(Date.now() - 7200000).toISOString(), finishedAt: new Date(Date.now() - 7100000).toISOString() },
      { key: 'context', title: 'Contextualisation',     status: 'done',    summary: 'Both repos use jsonwebtoken@8.5.1. Four sign() calls were found, one on the frontend.',   document: PORTAL_104_CONTEXT_DOC, startedAt: new Date(Date.now() - 7100000).toISOString(), finishedAt: new Date(Date.now() - 6800000).toISOString() },
      { key: 'plan',    title: 'Plan',                status: 'done',    summary: 'The plan: (1) upgrade the frontend (2) upgrade the backend (3) adjust the API that changed in v9.', document: PORTAL_104_PLAN_DOC,    testPlan: PORTAL_104_TEST_PLAN, startedAt: new Date(Date.now() - 6800000).toISOString(), finishedAt: new Date(Date.now() - 6600000).toISOString() },
      { key: 'exec',    title: 'Plan execution',    status: 'done',    summary: '`jsonwebtoken` was updated to 9.0.2 in both repos. Three API calls were adjusted on the backend.', execData: PORTAL_104_EXEC_DATA, startedAt: new Date(Date.now() - 6600000).toISOString(), finishedAt: new Date(Date.now() - 5400000).toISOString() },
      { key: 'test',    title: 'Test execution',  status: 'done',    startedAt: new Date(Date.now() - 5400000).toISOString(), finishedAt: new Date(Date.now() - 3600000).toISOString() },
      { key: 'val',     title: 'Human validation',     status: 'done',    startedAt: new Date(Date.now() - 3600000).toISOString(), finishedAt: new Date(Date.now() - 1800000).toISOString() },
      { key: 'fin',     title: 'Finalisation',          status: 'running', startedAt: new Date(Date.now() -  900000).toISOString() },
    ],
    repositoryOverview: {
      repos: ['portal-frontend', 'portal-backend'],
      branches: [
        'portal-frontend|feature/PORTAL-104-sec-deps',
        'portal-backend|feature/PORTAL-104-sec-deps'
      ],
      commits: 7,
      commitsByRepo: { 'portal-frontend': 2, 'portal-backend': 5 },
      prs: [
        {
          id: 'pr-10', repo: 'portal-frontend',
          sourceBranch: 'feature/PORTAL-104-sec-deps', targetBranch: 'develop',
          url: '#', merged: false, hasConflict: false,
          reviewers: [
            { name: 'Maria Oliveira', initials: 'MO', status: 'approved' },
            { name: 'João Silva',     initials: 'JS', status: 'pending'  },
          ],
        },
        {
          id: 'pr-11', repo: 'portal-backend',
          sourceBranch: 'feature/PORTAL-104-sec-deps', targetBranch: 'develop',
          url: '#', merged: false, hasConflict: false,
          reviewers: [
            { name: 'Carlos Mendes', initials: 'CM', status: 'rejected' },
            { name: 'Pedro Gomes',   initials: 'PG', status: 'pending'  },
          ],
        },
      ],
      files: [
        {
          path: 'package.json', repo: 'portal-frontend', branch: 'feature/PORTAL-104-sec-deps',
          kind: 'source', change: 'modified', gitStatus: 'staged', linesAdded: 1, linesRemoved: 1,
          diff: `--- a/package.json\n+++ b/package.json\n@@ -4,7 +4,7 @@ {\n   "dependencies": {\n-    "jsonwebtoken": "^8.5.1",\n+    "jsonwebtoken": "^9.0.2",\n     "react": "^18.2.0",\n     "react-dom": "^18.2.0"\n   }\n }`,
        },
        {
          path: 'package.json', repo: 'portal-backend', branch: 'feature/PORTAL-104-sec-deps',
          kind: 'source', change: 'modified', gitStatus: 'staged', linesAdded: 1, linesRemoved: 1,
          diff: `--- a/package.json\n+++ b/package.json\n@@ -4,7 +4,7 @@ {\n   "dependencies": {\n-    "jsonwebtoken": "^8.5.1",\n+    "jsonwebtoken": "^9.0.2",\n     "express": "^5.0.0",\n     "drizzle-orm": "^0.30.0"\n   }\n }`,
        },
        {
          path: 'src/auth/tokenService.ts', repo: 'portal-backend', branch: 'feature/PORTAL-104-sec-deps',
          kind: 'source', change: 'modified', gitStatus: 'staged', linesAdded: 4, linesRemoved: 4,
          diff: `--- a/src/auth/tokenService.ts\n+++ b/src/auth/tokenService.ts\n@@ -8,12 +8,12 @@ import * as jwt from 'jsonwebtoken';\n \n-export function generateAccessToken(user: User): string {\n-  return jwt.sign(\n-    { sub: user.id, role: user.role },\n-    process.env.JWT_SECRET!, { expiresIn: '15m' }\n-  );\n+export async function generateAccessToken(user: User): Promise<string> {\n+  return jwt.sign(\n+    { sub: user.id, role: user.role },\n+    process.env.JWT_SECRET!, { expiresIn: '15m' }\n+  ) as Promise<string>;\n }`,
        },
        {
          path: 'src/middleware/authMiddleware.ts', repo: 'portal-backend', branch: 'feature/PORTAL-104-sec-deps',
          kind: 'source', change: 'modified', gitStatus: 'staged', linesAdded: 1, linesRemoved: 1,
          diff: `--- a/src/middleware/authMiddleware.ts\n+++ b/src/middleware/authMiddleware.ts\n@@ -14,7 +14,7 @@ export async function verifyToken(req: Request): Promise<JwtPayload> {\n   const token = extractBearer(req);\n   if (!token) throw new AuthError(401, 'Missing token');\n-  const payload = jwt.verify(token, process.env.JWT_SECRET!);\n+  const payload = await jwt.verify(token, process.env.JWT_SECRET!);\n   return payload as JwtPayload;\n }`,
        },
        {
          path: 'tests/unit/tokenService.test.ts', repo: 'portal-backend', branch: 'feature/PORTAL-104-sec-deps',
          kind: 'test', change: 'modified', gitStatus: 'staged', linesAdded: 3, linesRemoved: 3,
          diff: `--- a/tests/unit/tokenService.test.ts\n+++ b/tests/unit/tokenService.test.ts\n@@ -8,9 +8,9 @@ describe('tokenService', () => {\n   it('generateAccessToken', async () => {\n-    jest.spyOn(jwt, 'sign').mockReturnValue('tok' as any);\n-    const token = tokenService.generateAccessToken(mockUser);\n-    expect(token).toBe('tok');\n+    jest.spyOn(jwt, 'sign').mockResolvedValue('tok' as any);\n+    const token = await tokenService.generateAccessToken(mockUser);\n+    expect(token).resolves.toBe('tok');\n   });\n });`,
        },
        {
          path: 'src/auth/session.ts', repo: 'portal-backend', branch: 'feature/PORTAL-104-sec-deps',
          kind: 'source', change: 'modified', gitStatus: 'modified', linesAdded: 2, linesRemoved: 0,
          diff: `--- a/src/auth/session.ts\n+++ b/src/auth/session.ts\n@@ -22,6 +22,8 @@ export async function refreshSession(token: string) {\n   const payload = await verifyToken(token);\n+  // TODO: invalidate the old token in Redis\n+  // await redis.del(\`session:\${payload.sub}\`);\n   return generateAccessToken({ id: payload.sub, role: payload.role });\n }`,
        },
        {
          path: '.env.local', repo: 'portal-frontend', branch: 'feature/PORTAL-104-sec-deps',
          kind: 'source', change: 'created', gitStatus: 'untracked',
        },
        {
          path: 'notes-debug.txt', repo: 'portal-backend', branch: 'feature/PORTAL-104-sec-deps',
          kind: 'context', change: 'created', gitStatus: 'untracked',
        },
      ],
      tests: [
        { name: 'tokenService > generateAccessToken',         type: 'unit', status: 'success', repo: 'portal-backend',  durationMs: 89  },
        { name: 'tokenService > generateRefreshToken',        type: 'unit', status: 'success', repo: 'portal-backend',  durationMs: 72  },
        { name: 'tokenService > rotateToken',                 type: 'unit', status: 'success', repo: 'portal-backend',  durationMs: 94  },
        { name: 'authMiddleware > valid bearer',              type: 'unit', status: 'success', repo: 'portal-backend',  durationMs: 61  },
        { name: 'authMiddleware > missing token returns 401', type: 'unit', status: 'fail',    repo: 'portal-backend',  durationMs: 42  },
        { name: 'session > signRefreshToken is async',        type: 'unit', status: 'success', repo: 'portal-frontend', durationMs: 150 },
        { name: 'auth flow > login with valid credentials',   type: 'e2e',  status: 'running', repo: 'portal-frontend'                  },
        { name: 'auth flow > protected route redirects',      type: 'e2e',  status: 'skipped', repo: 'portal-frontend'                  },
      ],
      startedAt: new Date(Date.now() - 7200000).toISOString(),
      elapsedSeconds: 6200
    },
    chat: [
      { id: 'c1', author: 'dev',    text: 'PORTAL-104 — a critical CVE. High priority.',  at: new Date(Date.now() - 7200000).toISOString() },
      { id: 'c2', author: 'claude', text: 'Starting the analysis. I will check jsonwebtoken\u2019s version in both repos.', at: new Date(Date.now() - 7150000).toISOString(), actions: ['Ran `dop demand-init PORTAL-104`'] },
      { id: 'c3', author: 'claude', text: 'Both repos are on jsonwebtoken@8.5.1. The API changed in v9: `sign()` is now asynchronous by default. I will adjust the 3 affected calls on the backend.', at: new Date(Date.now() - 6900000).toISOString(), actions: ['Created the portal-frontend/feature/PORTAL-104-sec-deps branch', 'Created the portal-backend/feature/PORTAL-104-sec-deps branch'] },
      { id: 'c4', author: 'claude', text: 'The execution is done. Running the tests now. There is a failure in `authMiddleware > missing token returns 401` that I am investigating — it looks like the test needs adjusting, not the code.', at: new Date(Date.now() - 5400000).toISOString(), actions: ['Ran `pnpm test`'] }
    ]
  },
  {
    id: 'd-5',
    workspaceId: 'ws-2',
    externalKey: 'PAY-201',
    title: 'Refactor the reconciliation service', type: 'Task', provider: 'clickup',
    assignee: 'Carlos Mendes',
    providerStatus: 'In Review',
    dopStatus: 'done',
    stages: [
      { key: 'init',    title: 'Start the demand',   status: 'done' },
      { key: 'context', title: 'Contextualisation',    status: 'done' },
      { key: 'plan',    title: 'Plan',               status: 'done' },
      { key: 'exec',    title: 'Plan execution',   status: 'done' },
      { key: 'test',    title: 'Test execution', status: 'done' },
      { key: 'val',     title: 'Human validation',    status: 'done' },
      { key: 'fin',     title: 'Finalisation',         status: 'done' }
    ],
    repositoryOverview: {
      repos: ['api-payments', 'worker-billing'],
      branches: [
        'api-payments|feature/PAY-201-reconcile-refactor',
        'worker-billing|feature/PAY-201-reconcile-worker'
      ],
      commits: 14,
      commitsByRepo: { 'api-payments': 9, 'worker-billing': 5 },
      prs: [
        { id: 'pr-1', repo: 'api-payments',   sourceBranch: 'feature/PAY-201-reconcile-refactor', targetBranch: 'develop', url: '#', merged: false, hasConflict: false,
          reviewers: [
            { name: 'Carlos Mendes',  initials: 'CM', status: 'approved' },
            { name: 'Maria Oliveira', initials: 'MO', status: 'approved' },
            { name: 'Pedro Gomes',    initials: 'PG', status: 'pending'  },
          ] },
        { id: 'pr-2', repo: 'worker-billing', sourceBranch: 'feature/PAY-201-reconcile-worker',   targetBranch: 'develop', url: '#', merged: false, hasConflict: false,
          reviewers: [
            { name: 'Ana Costa', initials: 'AC', status: 'approved' },
          ] },
      ],
      files: [],
      tests: [
        { name: 'reconcileService > processes a batch',   type: 'unit', status: 'success' },
        { name: 'reconcileService > idempotency',         type: 'unit', status: 'success' },
        { name: 'worker > consume event',                type: 'unit', status: 'success' },
        { name: 'full reconciliation flow e2e',           type: 'e2e',  status: 'success' }
      ],
      startedAt: new Date(Date.now() - 86400000).toISOString(),
      finishedAt: new Date(Date.now() - 43200000).toISOString(),
      elapsedSeconds: 43200
    },
    chat: []
  },
  {
    id: 'd-6',
    workspaceId: 'ws-2',
    externalKey: 'PAY-202',
    title: 'Optimise the database queries', type: 'Task', provider: 'clickup',
    assignee: 'João Silva',
    providerStatus: 'Done',
    dopStatus: 'delivered',
    stages: [
      { key: 'init',    title: 'Start the demand',    status: 'done' },
      { key: 'context', title: 'Contextualisation',     status: 'done' },
      { key: 'plan',    title: 'Plan',                status: 'done' },
      { key: 'exec',    title: 'Plan execution',    status: 'done' },
      { key: 'test',    title: 'Test execution',  status: 'done' },
      { key: 'val',     title: 'Human validation',     status: 'done' },
      { key: 'fin',     title: 'Finalisation',          status: 'done' }
    ],
    repositoryOverview: {
      repos: ['api-payments'],
      branches: ['api-payments|feature/PAY-202-query-opt'],
      commits: 8,
      prs: [{ id: 'pr-3', repo: 'api-payments', sourceBranch: 'feature/PAY-202-query-opt', targetBranch: 'develop', url: '#', merged: true, hasConflict: false,
        reviewers: [
          { name: 'Maria Oliveira', initials: 'MO', status: 'approved' },
          { name: 'João Silva',     initials: 'JS', status: 'approved' },
        ] }],
      files: [],
      tests: [
        { name: 'query performance < 50ms', type: 'unit', status: 'success' },
        { name: 'paginated search e2e',      type: 'e2e',  status: 'success' }
      ],
      startedAt: new Date(Date.now() - 172800000).toISOString(),
      finishedAt: new Date(Date.now() - 129600000).toISOString(),
      elapsedSeconds: 43200
    },
    chat: []
  },
  {
    id: 'd-7',
    workspaceId: 'ws-2',
    externalKey: 'PAY-203',
    title: 'Add audit logs on every transaction', type: 'Task', provider: 'clickup',
    assignee: 'Pedro Gomes',
    providerStatus: 'In Progress',
    dopStatus: 'doing',
    stages: [
      { key: 'init',    title: 'Start the demand',   status: 'done' },
      { key: 'context', title: 'Contextualisation',    status: 'done' },
      { key: 'plan',    title: 'Plan',               status: 'done' },
      { key: 'exec',    title: 'Plan execution',   status: 'done', execData: PAY_203_EXEC_DATA },
      { key: 'test',    title: 'Test execution', status: 'blocked', summary: 'The "chargeback audit" e2e test fails on a RabbitMQ timeout. Waiting on the dev to decide the retry policy.' }
    ],
    repositoryOverview: {
      repos: ['api-payments', 'shared-contracts'],
      branches: [
        'api-payments|feature/PAY-203-audit-log',
        'shared-contracts|feature/PAY-203-audit-events'
      ],
      commits: null,
      commitsByRepoStatus: 'unavailable',
      prs: [],
      files: [
        { path: 'api-payments/src/audit/auditService.ts',         kind: 'source', change: 'created'  },
        { path: 'shared-contracts/src/events/AuditEvent.ts',        kind: 'source', change: 'created'  },
        { path: 'api-payments/tests/e2e/audit.e2e.test.ts',       kind: 'test',   change: 'created'  }
      ],
      tests: [
        { name: 'auditService > records a transaction',   type: 'unit', status: 'success' },
        { name: 'auditService > serialises an event',     type: 'unit', status: 'success' },
        { name: 'payment audit e2e',                      type: 'e2e',  status: 'success' },
        { name: 'chargeback audit e2e',                   type: 'e2e',  status: 'fail'    }
      ],
      startedAt: new Date(Date.now() - 10800000).toISOString(),
      elapsedSeconds: 10000
    },
    chat: [
      { id: 'c1', author: 'claude', text: 'Blocked on the chargeback e2e test — the RabbitMQ consumer has a 5s timeout, which is not enough in a test environment. The options: (A) raise the timeout to 15s, (B) use a mock consumer in the test. Which do you prefer?', at: new Date(Date.now() - 900000).toISOString(), actions: ['Blocked on the "Test execution" stage'] }
    ]
  },
  {
    id: 'd-8',
    workspaceId: 'ws-2',
    externalKey: 'PAY-204',
    title: 'Fix the intermittent failure in the billing cron', type: 'Bug', provider: 'clickup',
    assignee: 'Ana Costa',
    providerStatus: 'In Progress',
    dopStatus: 'doing',
    stages: [
      { key: 'init',    title: 'Start the demand', status: 'done' },
      { key: 'context', title: 'Contextualisation',  status: 'done' },
      { key: 'plan',    title: 'Plan',             status: 'running', summary: 'The forensic reading is under way. A race condition in the Redis distributed lock is suspected.' }
    ],
    repositoryOverview: {
      repos: ['worker-billing'],
      branches: ['worker-billing|feature/PAY-204-cron-fix'],
      commits: 1,
      prs: [],
      files: [{ path: 'docs/prompts/PAY-204-forensics.md', kind: 'context', change: 'created' }],
      tests: [],
      startedAt: new Date(Date.now() - 1800000).toISOString(),
      elapsedSeconds: 1800
    },
    chat: [
      { id: 'c1', author: 'dev',    text: 'PAY-204 — this cron fails 1 run in 50. The Sentry logs are attached.', at: new Date(Date.now() - 1800000).toISOString() },
      { id: 'c2', author: 'claude', text: 'Reading the Sentry logs. I suspect a race condition in the Redis distributed lock — two workers take the lock at the same time when network latency goes over 200ms. I will confirm it with a forensic reading of the worker.', at: new Date(Date.now() - 1700000).toISOString(), actions: ['Started the forensic reading', 'Created the feature/PAY-204-cron-fix branch'] }
    ]
  }
];
