import { Demand, ExecData } from '../api/types';

// Branches convention: "repoName|branchName" — enables repo-grouped display in the UI

const PORTAL_103_INIT_DOC = `# RFC — Integração com novo gateway de pagamentos (PORTAL-103)

## Resumo

Integrar o gateway **PagSeguro** ao Portal do Cliente, substituindo o gateway legado Cielo nas novas transações. A mudança deve ser transparente para o usuário final e não deve interromper fluxos existentes.

## Contexto

O contrato com a Cielo vence em **30/06/2026**. O PagSeguro oferece melhores taxas para boleto e Pix, e já é usado pelo time de Pagamentos (ws-2). Reaproveitar a integração existente em \`api-pagamentos\` é viável via chamada interna.

## Objetivos

- Implementar \`PagSeguroGatewayAdapter\` no \`portal-backend\` seguindo a interface \`IGateway\`
- Suportar os métodos: **cartão de crédito**, **boleto**, **Pix**
- Exibir status do gateway no painel do cliente (frontend)
- Manter compatibilidade com transações existentes da Cielo (read-only)

## Fora do escopo

- Migração de transações históricas
- Estorno via PagSeguro (fase 2)
- App Mobile (escopo separado)

## Critérios de aceite

1. Novas cobranças usam PagSeguro por padrão
2. Painel exibe método e status da transação em tempo real
3. Cobertura de testes unitários ≥ 80% no adapter
4. Zero downtime no deploy (feature flag \`USE_PAGSEGURO=true\`)

## Riscos

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Instabilidade sandbox PagSeguro | Média | Testes com mock até homologação |
| Mudança de schema de evento | Baixa | Versionar eventos no \`shared-contracts\` |

## Referências

- Credenciais: \`secrets/pagseguro\` (Vault)
- Documentação PagSeguro: [dev.pagseguro.uol.com.br](https://dev.pagseguro.uol.com.br)
- ADR-012: decisão de arquitetura registrada em \`docs/ADR/ADR-012-gateway-integration.md\`
`;

const PORTAL_103_CONTEXT_DOC = `# Contexto técnico — PORTAL-103

## Análise forense do \`portal-backend\`

### Ponto de entrada atual

O fluxo de cobrança passa por \`PaymentService\` (\`src/payments/payment.service.ts\`). Ele chama \`CieloAdapter\` que implementa a interface \`IGateway\`:

\`\`\`typescript
export interface IGateway {
  charge(input: ChargeInput): Promise<ChargeResult>;
  refund(transactionId: string): Promise<void>;
  getStatus(transactionId: string): Promise<TransactionStatus>;
}
\`\`\`

### Dependências identificadas

| Arquivo | Papel |
|---------|-------|
| \`src/payments/payment.service.ts\` | Orquestrador — injetar novo adapter aqui |
| \`src/payments/adapters/cielo.adapter.ts\` | Legado — manter para transações antigas |
| \`src/payments/dto/charge.dto.ts\` | DTO compartilhado — compatível com PagSeguro |
| \`src/payments/events/payment-created.event.ts\` | Evento publicado no Redis após cobrança |

### Feature flag

Usar variável de ambiente \`USE_PAGSEGURO\` (já existente no \`.env.example\`) via \`ConfigService\`. Quando \`true\`, \`PaymentService\` instancia \`PagSeguroAdapter\` em vez de \`CieloAdapter\`.

### Frontend (\`portal-frontend\`)

O componente \`<PaymentStatusBadge />\` em \`src/components/payments/\` lê o campo \`method\` da API. Nenhuma mudança de interface necessária — apenas adicionar o valor \`"pagseguro"\` ao union type.

### Risco de integração

A API sandbox do PagSeguro retorna \`202 Accepted\` assíncrono para Pix — diferente da Cielo que retorna \`200\` síncrono. O \`ChargeResult\` precisa de campo \`pending: boolean\`.
`;

const PORTAL_103_PLAN_DOC = `# Plano de desenvolvimento — PORTAL-103

> **Status:** em elaboração — aguardando confirmação do Dev sobre timeout de Pix

## Tarefas

### Backend (\`portal-backend\`)

- [ ] **T1** — Criar \`PagSeguroAdapter\` implementando \`IGateway\`
  - Suporte a cartão, boleto e Pix
  - Tratar resposta assíncrona do Pix (\`pending: true\`)
  - Credenciais via \`ConfigService\` (path: \`secrets/pagseguro\`)

- [ ] **T2** — Atualizar \`PaymentService\` com feature flag
  - Injetar adapter conforme \`USE_PAGSEGURO\`
  - Adicionar campo \`pending\` ao \`ChargeResult\`

- [ ] **T3** — Testes unitários
  - Mock do HTTP client do PagSeguro
  - Cobrir: charge ok, charge async (Pix), falha de rede, credencial inválida

- [ ] **T4** — Integração com eventos
  - Publicar \`payment-created\` no Redis com \`gateway: "pagseguro"\`

### Frontend (\`portal-frontend\`)

- [ ] **T5** — Adicionar \`"pagseguro"\` ao union type de \`method\`
  - Ícone e label no \`<PaymentStatusBadge />\`

- [ ] **T6** — Indicador de "aguardando confirmação Pix" no painel
  - Poll a cada 5s no endpoint \`GET /api/v1/payments/:id/status\`

## Ordem de execução

\`\`\`
T1 → T2 → T3 → T4 (backend, sequencial)
         ↓
        T5 → T6 (frontend, pode ser paralelo com T3)
\`\`\`

## Estimativa

| Tarefa | Estimativa |
|--------|------------|
| T1 | 2h |
| T2 | 1h |
| T3 | 2h |
| T4 | 30min |
| T5 | 30min |
| T6 | 1h30 |
| **Total** | **~7h30** |
`;

const PORTAL_103_TEST_PLAN = {
  unit: `## Testes Unitários — PORTAL-103

### \`PagSeguroAdapter.charge\` — cartão aprovado
- **Arrange**: HTTP client mockado, resposta \`{ status: "PAID" }\`; credenciais via \`ConfigService\` mock
- **Act**: \`adapter.charge({ method: "card", amount: 100 })\`
- **Assert**: Retorna \`{ success: true, pending: false }\`; HTTP client chamado com endpoint correto

### \`PagSeguroAdapter.charge\` — Pix assíncrono
- **Arrange**: HTTP client mockado, resposta \`{ status: "WAITING" }\`
- **Act**: \`adapter.charge({ method: "pix", amount: 50 })\`
- **Assert**: Retorna \`{ success: true, pending: true }\`

### \`PagSeguroAdapter.charge\` — falha de rede
- **Arrange**: HTTP client lança \`NetworkError\`
- **Act**: \`adapter.charge({ method: "card", amount: 100 })\`
- **Assert**: Retorna \`{ success: false, error: "network_error" }\`; sem exceção não tratada

### \`PaymentService\` com feature flag \`USE_PAGSEGURO=true\`
- **Arrange**: \`ConfigService\` retorna \`USE_PAGSEGURO=true\`; \`PagSeguroAdapter\` mockado
- **Act**: \`paymentService.charge(payload)\`
- **Assert**: Adapter PagSeguro utilizado; \`ChargeResult.pending\` presente no retorno

### \`PaymentService\` com feature flag \`USE_PAGSEGURO=false\`
- **Arrange**: \`ConfigService\` retorna \`USE_PAGSEGURO=false\`; adapter legado mockado
- **Act**: \`paymentService.charge(payload)\`
- **Assert**: Adapter legado utilizado; campo \`pending\` ausente no retorno
`,
  e2e: `## Testes E2E — PORTAL-103

### Pagamento via cartão aprovado
- **Dado que** o usuário está no checkout com item no carrinho
- **Quando** seleciona "Cartão de crédito", preenche os dados e confirma
- **Então** vê tela de confirmação "Pagamento aprovado" em menos de 3s

### Pagamento via Pix — aguardando confirmação
- **Dado que** o usuário seleciona "Pix" no checkout
- **Quando** o QR code é exibido e o pagamento fica pendente no gateway
- **Então** o painel exibe badge "aguardando confirmação Pix" e faz poll a cada 5s

### Pagamento via Pix — confirmação recebida
- **Dado que** o painel exibe "aguardando confirmação Pix"
- **Quando** o webhook do PagSeguro notifica pagamento aprovado
- **Então** o badge muda para "Pago" sem necessidade de refresh manual
`,
};

const PORTAL_104_TEST_PLAN = {
  unit: `## Testes Unitários — PORTAL-104

### \`tokenService.generateAccessToken\`
- **Arrange**: \`TokenService\` instanciado com mock de \`jsonwebtoken@9.0.2\`; payload \`{ id: 1, role: 'admin' }\`
- **Act**: \`await generateAccessToken(payload)\`
- **Assert**: Retorna string JWT válida com expiração 15 min; \`jwt.sign\` chamado com \`await\`

### \`tokenService.generateRefreshToken\`
- **Arrange**: Idem; mock usa \`mockResolvedValue\` (não \`mockReturnValue\`)
- **Act**: \`await generateRefreshToken({ id: 1 })\`
- **Assert**: JWT com expiração de 7 dias; chamada assíncrona respeitada

### \`tokenService.rotateToken\`
- **Arrange**: Refresh token válido no mock; \`jsonwebtoken@9.0.2\` resolvendo assincronamente
- **Act**: \`await rotateToken(refreshToken)\`
- **Assert**: Retorna novo par \`{ accessToken, refreshToken }\`; tokens distintos

### \`authMiddleware\` — bearer válido
- **Arrange**: Header \`Authorization: Bearer <valid_token>\`; middleware instanciado
- **Act**: Request atravessa \`authMiddleware\`
- **Assert**: \`req.user\` preenchido; \`next()\` chamado sem erro

### \`authMiddleware\` — token ausente → 401
- **Arrange**: Request sem header \`Authorization\`
- **Act**: Request atravessa \`authMiddleware\`
- **Assert**: Resposta \`401 Unauthorized\`; \`next()\` NÃO chamado

### \`session.signRefreshToken\` (frontend)
- **Arrange**: \`signRefreshToken\` convertida para \`async\`; payload de usuário mock
- **Act**: \`await signRefreshToken(payload)\`
- **Assert**: Retorna JWT; sem \`SyntaxError\` de chamada síncrona legada
`,
  e2e: `## Testes E2E — PORTAL-104

### Login com credenciais válidas
- **Dado que** o usuário acessa \`/login\`
- **Quando** preenche email e senha corretos e clica em "Entrar"
- **Então** é redirecionado para \`/dashboard\`; token JWT armazenado no cookie \`session\`

### Refresh automático de token expirado
- **Dado que** o \`accessToken\` expirou (simulado via \`Date.now\` mock)
- **Quando** o frontend realiza qualquer chamada autenticada
- **Então** o \`refreshToken\` é usado automaticamente; novo par emitido sem erro 401 visível

### Rejeição de token forjado (CVE-2026-1234)
- **Dado que** um atacante envia um JWT com chave malformada para \`RS256\`
- **Quando** o token chega ao \`authMiddleware\`
- **Então** retorna \`401 Unauthorized\`; nenhum dado sensível exposto no body
`,
};

const PORTAL_104_INIT_DOC = `# PRD de Segurança — CVE-2026-1234 (PORTAL-104)

## Vulnerabilidade

**CVE-2026-1234** afeta \`jsonwebtoken\` nas versões **< 9.0.2**. A falha permite que um atacante forje tokens JWT quando o algoritmo \`RS256\` é usado com chaves malformadas.

**CVSS Score:** 9.1 (Crítico)
**Vetor:** Rede / Sem autenticação prévia / Alto impacto de confidencialidade

## Sistemas afetados

| Repo | Versão atual | Impacto |
|------|-------------|---------|
| \`portal-backend\` | \`jsonwebtoken@8.5.1\` | ✅ Afetado — usa RS256 |
| \`portal-frontend\` | \`jsonwebtoken@8.5.1\` | ⚠️ Afetado — verifica token no SSR |

## Ação requerida

Atualizar **imediatamente** para \`jsonwebtoken@9.0.2\` em ambos os repos.

### Breaking changes da v9

A API \`sign()\` tornou-se **assíncrona** por padrão quando \`callback\` não é fornecido:

\`\`\`diff
- const token = jwt.sign(payload, secret);           // v8 — síncrono
+ const token = await jwt.sign(payload, secret);      // v9 — assíncrono
\`\`\`

## Critérios de aceite

1. Ambos os repos em \`jsonwebtoken@9.0.2\`
2. Todas as chamadas de \`sign()\` ajustadas para \`async/await\`
3. Testes unitários de \`tokenService\` passando
4. Deploy em produção com zero downtime

## Prazo

Correção deve ser implantada em produção até **48h** da abertura deste card.
`;

const PORTAL_104_CONTEXT_DOC = `# Contexto técnico — PORTAL-104

## Inventário de uso do \`jsonwebtoken\`

### \`portal-backend\`

| Arquivo | Uso | Impacto |
|---------|-----|---------|
| \`src/auth/tokenService.ts\` | \`jwt.sign()\` (3x) | **Requer async/await** |
| \`src/middleware/authMiddleware.ts\` | \`jwt.verify()\` | Sem mudança (síncrono mantido) |
| \`src/auth/tokenService.test.ts\` | Mocks de sign | Ajustar mocks para Promise |

### \`portal-frontend\`

| Arquivo | Uso | Impacto |
|---------|-----|---------|
| \`src/lib/auth/ssr-token.ts\` | \`jwt.verify()\` no middleware Next.js | Sem mudança |
| \`src/lib/auth/session.ts\` | \`jwt.sign()\` (1x) para refresh token | **Requer async/await** |

## Chamadas \`sign()\` identificadas no backend

\`\`\`typescript
// src/auth/tokenService.ts — linha 42
const accessToken = jwt.sign({ sub: user.id, role: user.role }, privateKey, {
  algorithm: 'RS256', expiresIn: '15m'
});

// src/auth/tokenService.ts — linha 61
const refreshToken = jwt.sign({ sub: user.id }, refreshSecret, { expiresIn: '7d' });

// src/auth/tokenService.ts — linha 89 (renovação)
const newToken = jwt.sign({ ...decoded, iat: Date.now() }, privateKey, { algorithm: 'RS256' });
\`\`\`

## Padrão de correção

\`\`\`typescript
// Antes (v8)
const token = jwt.sign(payload, secret, options);

// Depois (v9)
const token = await jwt.sign(payload, secret, options);
// Funções chamadoras devem ser marcadas como async
\`\`\`

## Observação sobre testes

O mock atual em \`tokenService.test.ts\` usa \`jest.spyOn(jwt, 'sign').mockReturnValue('fake-token')\`. Com a v9, precisa de \`mockResolvedValue('fake-token')\`.
`;

const PORTAL_104_PLAN_DOC = `# Plano de execução — PORTAL-104

## Sequência

### 1. \`portal-frontend\` (menor risco — 1 ocorrência)

- [ ] Bump \`jsonwebtoken\` para \`9.0.2\` no \`package.json\`
- [ ] Tornar \`src/lib/auth/session.ts#signRefreshToken()\` assíncrona
- [ ] Verificar que chamadores de \`signRefreshToken()\` são async-safe
- [ ] Rodar \`pnpm test\` no frontend

### 2. \`portal-backend\` (3 ocorrências + testes)

- [ ] Bump \`jsonwebtoken\` para \`9.0.2\`
- [ ] Converter as 3 chamadas \`sign()\` em \`await jwt.sign()\`
- [ ] Marcar \`generateAccessToken()\`, \`generateRefreshToken()\`, \`rotateToken()\` como \`async\`
- [ ] Atualizar mocks em \`tokenService.test.ts\` (\`mockReturnValue\` → \`mockResolvedValue\`)
- [ ] Rodar \`pnpm test\` no backend

### 3. Validação integrada

- [ ] Subir ambiente local completo (\`frontend + backend\`)
- [ ] Testar fluxo de login, refresh e logout manualmente
- [ ] Confirmar que \`authMiddleware\` ainda rejeita tokens inválidos

## Checklist de deploy

\`\`\`
[ ] PR revisado e aprovado
[ ] CI verde (todos os testes passando)
[ ] Deploy em staging — smoke test de login
[ ] Deploy em produção — monitorar Sentry por 15min
\`\`\`

## Rollback

Se falha crítica em produção: reverter via feature flag \`LEGACY_JWT=true\` que mantém \`jsonwebtoken@8.5.1\` em modo de compatibilidade (já configurado no Vault).
`;

// ── Exec data for PORTAL-104 (CVE fix — two repos in parallel) ──────────────
const PORTAL_104_EXEC_DATA: ExecData = {
  tasks: [
    { id: 't1', label: 'T1 — Upgrade portal-frontend', parallelGroup: 0, filePaths: ['portal-frontend::package.json', 'portal-frontend::src/lib/auth/session.ts'], status: 'done' },
    { id: 't2', label: 'T2 — Upgrade portal-backend',  parallelGroup: 0, filePaths: ['portal-backend::package.json', 'portal-backend::src/auth/tokenService.ts'], status: 'done' },
    { id: 't3', label: 'T3 — Ajustar testes',          parallelGroup: 1, filePaths: ['portal-backend::tests/unit/tokenService.test.ts'], status: 'done' },
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
    { id: 't1', label: 'T1 — Criar AuditEvent schema', parallelGroup: 0, filePaths: ['shared-contracts::src/events/AuditEvent.ts'], status: 'done' },
    { id: 't2', label: 'T2 — Implementar auditService', parallelGroup: 1, filePaths: ['api-pagamentos::src/audit/auditService.ts'], status: 'done' },
    { id: 't3', label: 'T3 — Escrever testes e2e',      parallelGroup: 2, filePaths: ['api-pagamentos::tests/e2e/audit.e2e.test.ts'], status: 'done' },
  ],
  files: [
    {
      path: 'src/events/AuditEvent.ts', repo: 'shared-contracts', branch: 'feature/PAY-203-audit-events',
      linesAdded: 16, linesRemoved: 0,
      diff: `--- /dev/null\n+++ b/src/events/AuditEvent.ts\n@@ -0,0 +1,16 @@\n+export type AuditEventType =\n+  | 'payment.created'\n+  | 'payment.captured'\n+  | 'payment.failed'\n+  | 'chargeback.initiated';\n+\n+export interface AuditEvent {\n+  id: string;\n+  type: AuditEventType;\n+  transactionId: string;\n+  amount: number;\n+  currency: 'BRL';\n+  occurredAt: string; // ISO 8601\n+  metadata?: Record<string, unknown>;\n+}`,
    },
    {
      path: 'src/audit/auditService.ts', repo: 'api-pagamentos', branch: 'feature/PAY-203-audit-log',
      linesAdded: 22, linesRemoved: 0,
      diff: `--- /dev/null\n+++ b/src/audit/auditService.ts\n@@ -0,0 +1,22 @@\n+import { AuditEvent } from 'shared-contracts/src/events/AuditEvent';\n+import { rabbitMQ } from '../infra/rabbitmq';\n+import { logger } from '../infra/logger';\n+\n+const EXCHANGE = 'audit.events';\n+\n+export async function publishAuditEvent(event: AuditEvent): Promise<void> {\n+  try {\n+    await rabbitMQ.publish(EXCHANGE, event.type, event);\n+    logger.info({ event }, 'Audit event published');\n+  } catch (err) {\n+    logger.error({ err, event }, 'Failed to publish audit event');\n+    throw err;\n+  }\n+}\n+\n+export async function buildAuditEvent(\n+  type: AuditEvent['type'],\n+  transactionId: string,\n+  amount: number,\n+): Promise<AuditEvent> {\n+  return { id: crypto.randomUUID(), type, transactionId, amount, currency: 'BRL', occurredAt: new Date().toISOString() };\n+}`,
    },
    {
      path: 'tests/e2e/audit.e2e.test.ts', repo: 'api-pagamentos', branch: 'feature/PAY-203-audit-log',
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
    title: 'Adicionar exportação para PDF', type: 'Story', provider: 'jira',
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
    title: 'Corrigir bug na paginação', type: 'Bug', provider: 'jira',
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
    title: 'Integração com novo gateway de pagamentos', type: 'Epic', provider: 'jira',
    assignee: 'João Silva',
    providerStatus: 'In Progress',
    dopStatus: 'doing',
    stages: [
      { key: 'init',    title: 'Iniciar a demanda',    status: 'done',    summary: 'Card PORTAL-103 lido via MCP Jira. RFC gerada e aprovada.',                                              document: PORTAL_103_INIT_DOC,    startedAt: new Date(Date.now() - 3700000).toISOString(), finishedAt: new Date(Date.now() - 3500000).toISOString() },
      { key: 'context', title: 'Contextualização',     status: 'done',    summary: 'Análise forense concluída. Identificados 3 pontos de integração no portal-backend.',                    document: PORTAL_103_CONTEXT_DOC, startedAt: new Date(Date.now() - 3500000).toISOString(), finishedAt: new Date(Date.now() - 3200000).toISOString() },
      { key: 'plan',    title: 'Plano',                status: 'running', summary: 'Elaborando plano de desenvolvimento: 4 tarefas no backend, 2 no frontend.',                            document: PORTAL_103_PLAN_DOC,    testPlan: PORTAL_103_TEST_PLAN, startedAt: new Date(Date.now() - 3200000).toISOString() }
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
      { id: 'c1', author: 'dev',    text: 'Inicie o trabalho nesta demanda.',  at: new Date(Date.now() - 3500000).toISOString() },
      { id: 'c2', author: 'claude', text: 'Entendido. Li o card PORTAL-103 via MCP Jira. Vou fazer a análise forense do portal-backend para entender os pontos de integração existentes.', at: new Date(Date.now() - 3400000).toISOString(), actions: ['Executou `dop demand-init PORTAL-103`', 'Leu o card Jira via MCP'] },
      { id: 'c3', author: 'claude', text: 'Análise forense concluída. Encontrei o serviço `PaymentService` no portal-backend que precisará de extensão. Criando o plano de desenvolvimento agora.', at: new Date(Date.now() - 2800000).toISOString(), actions: ['Criou branch feature/PORTAL-103-gateway', 'Gerou ADR-012-gateway-integration.md'] },
      { id: 'c4', author: 'dev',    text: 'O gateway novo é o PagSeguro. Credenciais estão no Vault path `secrets/pagseguro`.', at: new Date(Date.now() - 2400000).toISOString() },
      { id: 'c5', author: 'claude', text: 'Perfeito. Anotei as credenciais (ref no contexto, sem expor o valor). Estou finalizando o plano agora — deve ter 3 tarefas de backend e 1 de frontend para exibir status do gateway.', at: new Date(Date.now() - 2000000).toISOString() }
    ]
  },
  {
    id: 'd-4',
    workspaceId: 'ws-1',
    externalKey: 'PORTAL-104',
    title: 'Atualizar dependências de segurança (CVE-2026-1234)', type: 'Bug', provider: 'jira',
    assignee: 'Ana Costa',
    providerStatus: 'In Progress',
    dopStatus: 'doing',
    stages: [
      { key: 'init',    title: 'Iniciar a demanda',    status: 'done',    summary: 'Card lido. CVE-2026-1234 afeta `jsonwebtoken` < 9.0.2. PRD de segurança gerada.',           document: PORTAL_104_INIT_DOC,    startedAt: new Date(Date.now() - 7200000).toISOString(), finishedAt: new Date(Date.now() - 7100000).toISOString() },
      { key: 'context', title: 'Contextualização',     status: 'done',    summary: 'Ambos os repos usam jsonwebtoken@8.5.1. 4 chamadas sign() identificadas, 1 no frontend.', document: PORTAL_104_CONTEXT_DOC, startedAt: new Date(Date.now() - 7100000).toISOString(), finishedAt: new Date(Date.now() - 6800000).toISOString() },
      { key: 'plan',    title: 'Plano',                status: 'done',    summary: 'Plano: (1) upgrade frontend (2) upgrade backend (3) ajustar API que mudou na v9.',         document: PORTAL_104_PLAN_DOC,    testPlan: PORTAL_104_TEST_PLAN, startedAt: new Date(Date.now() - 6800000).toISOString(), finishedAt: new Date(Date.now() - 6600000).toISOString() },
      { key: 'exec',    title: 'Execução do plano',    status: 'done',    summary: '`jsonwebtoken` atualizado para 9.0.2 nos dois repos. 3 chamadas de API ajustadas no backend.', execData: PORTAL_104_EXEC_DATA, startedAt: new Date(Date.now() - 6600000).toISOString(), finishedAt: new Date(Date.now() - 5400000).toISOString() },
      { key: 'test',    title: 'Execução dos testes',  status: 'done',    startedAt: new Date(Date.now() - 5400000).toISOString(), finishedAt: new Date(Date.now() - 3600000).toISOString() },
      { key: 'val',     title: 'Validação humana',     status: 'done',    startedAt: new Date(Date.now() - 3600000).toISOString(), finishedAt: new Date(Date.now() - 1800000).toISOString() },
      { key: 'fin',     title: 'Finalização',          status: 'running', startedAt: new Date(Date.now() -  900000).toISOString() },
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
          diff: `--- a/src/auth/session.ts\n+++ b/src/auth/session.ts\n@@ -22,6 +22,8 @@ export async function refreshSession(token: string) {\n   const payload = await verifyToken(token);\n+  // TODO: invalidar token antigo no Redis\n+  // await redis.del(\`session:\${payload.sub}\`);\n   return generateAccessToken({ id: payload.sub, role: payload.role });\n }`,
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
      { id: 'c1', author: 'dev',    text: 'PORTAL-104 — CVE crítica. Prioridade alta.',  at: new Date(Date.now() - 7200000).toISOString() },
      { id: 'c2', author: 'claude', text: 'Iniciando análise. Vou verificar a versão do jsonwebtoken nos dois repos.', at: new Date(Date.now() - 7150000).toISOString(), actions: ['Executou `dop demand-init PORTAL-104`'] },
      { id: 'c3', author: 'claude', text: 'Ambos os repos estão em jsonwebtoken@8.5.1. A API mudou na v9: `sign()` agora é assíncrona por padrão. Vou ajustar as 3 chamadas afetadas no backend.', at: new Date(Date.now() - 6900000).toISOString(), actions: ['Criou branch portal-frontend/feature/PORTAL-104-sec-deps', 'Criou branch portal-backend/feature/PORTAL-104-sec-deps'] },
      { id: 'c4', author: 'claude', text: 'Execução concluída. Rodando testes agora. Há uma falha em `authMiddleware > missing token returns 401` que estou investigando — parece ser o teste que precisa de ajuste, não o código.', at: new Date(Date.now() - 5400000).toISOString(), actions: ['Executou `pnpm test`'] }
    ]
  },
  {
    id: 'd-5',
    workspaceId: 'ws-2',
    externalKey: 'PAY-201',
    title: 'Refatorar serviço de reconciliação', type: 'Task', provider: 'clickup',
    assignee: 'Carlos Mendes',
    providerStatus: 'In Review',
    dopStatus: 'done',
    stages: [
      { key: 'init',    title: 'Iniciar a demanda',   status: 'done' },
      { key: 'context', title: 'Contextualização',    status: 'done' },
      { key: 'plan',    title: 'Plano',               status: 'done' },
      { key: 'exec',    title: 'Execução do plano',   status: 'done' },
      { key: 'test',    title: 'Execução dos testes', status: 'done' },
      { key: 'val',     title: 'Validação humana',    status: 'done' },
      { key: 'fin',     title: 'Finalização',         status: 'done' }
    ],
    repositoryOverview: {
      repos: ['api-pagamentos', 'worker-cobrancas'],
      branches: [
        'api-pagamentos|feature/PAY-201-reconcile-refactor',
        'worker-cobrancas|feature/PAY-201-reconcile-worker'
      ],
      commits: 14,
      commitsByRepo: { 'api-pagamentos': 9, 'worker-cobrancas': 5 },
      prs: [
        { id: 'pr-1', repo: 'api-pagamentos',   sourceBranch: 'feature/PAY-201-reconcile-refactor', targetBranch: 'develop', url: '#', merged: false, hasConflict: false,
          reviewers: [
            { name: 'Carlos Mendes',  initials: 'CM', status: 'approved' },
            { name: 'Maria Oliveira', initials: 'MO', status: 'approved' },
            { name: 'Pedro Gomes',    initials: 'PG', status: 'pending'  },
          ] },
        { id: 'pr-2', repo: 'worker-cobrancas', sourceBranch: 'feature/PAY-201-reconcile-worker',   targetBranch: 'develop', url: '#', merged: false, hasConflict: false,
          reviewers: [
            { name: 'Ana Costa', initials: 'AC', status: 'approved' },
          ] },
      ],
      files: [],
      tests: [
        { name: 'reconcileService > processa lote',      type: 'unit', status: 'success' },
        { name: 'reconcileService > idempotência',       type: 'unit', status: 'success' },
        { name: 'worker > consume event',                type: 'unit', status: 'success' },
        { name: 'fluxo completo de reconciliação e2e',   type: 'e2e',  status: 'success' }
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
    title: 'Otimizar queries do banco de dados', type: 'Task', provider: 'clickup',
    assignee: 'João Silva',
    providerStatus: 'Done',
    dopStatus: 'delivered',
    stages: [
      { key: 'init',    title: 'Iniciar a demanda',    status: 'done' },
      { key: 'context', title: 'Contextualização',     status: 'done' },
      { key: 'plan',    title: 'Plano',                status: 'done' },
      { key: 'exec',    title: 'Execução do plano',    status: 'done' },
      { key: 'test',    title: 'Execução dos testes',  status: 'done' },
      { key: 'val',     title: 'Validação humana',     status: 'done' },
      { key: 'fin',     title: 'Finalização',          status: 'done' }
    ],
    repositoryOverview: {
      repos: ['api-pagamentos'],
      branches: ['api-pagamentos|feature/PAY-202-query-opt'],
      commits: 8,
      prs: [{ id: 'pr-3', repo: 'api-pagamentos', sourceBranch: 'feature/PAY-202-query-opt', targetBranch: 'develop', url: '#', merged: true, hasConflict: false,
        reviewers: [
          { name: 'Maria Oliveira', initials: 'MO', status: 'approved' },
          { name: 'João Silva',     initials: 'JS', status: 'approved' },
        ] }],
      files: [],
      tests: [
        { name: 'query performance < 50ms', type: 'unit', status: 'success' },
        { name: 'busca paginada e2e',        type: 'e2e',  status: 'success' }
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
    title: 'Adicionar logs de auditoria em todas as transações', type: 'Task', provider: 'clickup',
    assignee: 'Pedro Gomes',
    providerStatus: 'In Progress',
    dopStatus: 'doing',
    stages: [
      { key: 'init',    title: 'Iniciar a demanda',   status: 'done' },
      { key: 'context', title: 'Contextualização',    status: 'done' },
      { key: 'plan',    title: 'Plano',               status: 'done' },
      { key: 'exec',    title: 'Execução do plano',   status: 'done', execData: PAY_203_EXEC_DATA },
      { key: 'test',    title: 'Execução dos testes', status: 'blocked', summary: 'Teste e2e "auditoria de chargeback" falha por timeout no RabbitMQ. Aguardando decisão do Dev sobre retry policy.' }
    ],
    repositoryOverview: {
      repos: ['api-pagamentos', 'shared-contracts'],
      branches: [
        'api-pagamentos|feature/PAY-203-audit-log',
        'shared-contracts|feature/PAY-203-audit-events'
      ],
      commits: null,
      commitsByRepoStatus: 'unavailable',
      prs: [],
      files: [
        { path: 'api-pagamentos/src/audit/auditService.ts',         kind: 'source', change: 'created'  },
        { path: 'shared-contracts/src/events/AuditEvent.ts',        kind: 'source', change: 'created'  },
        { path: 'api-pagamentos/tests/e2e/audit.e2e.test.ts',       kind: 'test',   change: 'created'  }
      ],
      tests: [
        { name: 'auditService > registra transação',     type: 'unit', status: 'success' },
        { name: 'auditService > serializa evento',       type: 'unit', status: 'success' },
        { name: 'auditoria de pagamento e2e',            type: 'e2e',  status: 'success' },
        { name: 'auditoria de chargeback e2e',           type: 'e2e',  status: 'fail'    }
      ],
      startedAt: new Date(Date.now() - 10800000).toISOString(),
      elapsedSeconds: 10000
    },
    chat: [
      { id: 'c1', author: 'claude', text: 'Bloqueado no teste e2e de chargeback — o consumer RabbitMQ está com timeout de 5s que é insuficiente em ambiente de teste. Opções: (A) aumentar timeout para 15s, (B) usar mock do consumer no teste. Qual prefere?', at: new Date(Date.now() - 900000).toISOString(), actions: ['Bloqueou na etapa "Execução dos testes"'] }
    ]
  },
  {
    id: 'd-8',
    workspaceId: 'ws-2',
    externalKey: 'PAY-204',
    title: 'Corrigir falha intermitente no cron de cobrança', type: 'Bug', provider: 'clickup',
    assignee: 'Ana Costa',
    providerStatus: 'In Progress',
    dopStatus: 'doing',
    stages: [
      { key: 'init',    title: 'Iniciar a demanda', status: 'done' },
      { key: 'context', title: 'Contextualização',  status: 'done' },
      { key: 'plan',    title: 'Plano',             status: 'running', summary: 'Análise forense em andamento. Suspeita de race condition no lock distribuído do Redis.' }
    ],
    repositoryOverview: {
      repos: ['worker-cobrancas'],
      branches: ['worker-cobrancas|feature/PAY-204-cron-fix'],
      commits: 1,
      prs: [],
      files: [{ path: 'docs/prompts/PAY-204-forensics.md', kind: 'context', change: 'created' }],
      tests: [],
      startedAt: new Date(Date.now() - 1800000).toISOString(),
      elapsedSeconds: 1800
    },
    chat: [
      { id: 'c1', author: 'dev',    text: 'PAY-204 — esse cron falha 1 em 50 execuções. Logs do Sentry em anexo.', at: new Date(Date.now() - 1800000).toISOString() },
      { id: 'c2', author: 'claude', text: 'Lendo os logs do Sentry. Suspeito de race condition no lock distribuído do Redis — dois workers assumem o lock simultaneamente quando há latência de rede > 200ms. Vou confirmar fazendo análise forense do worker.', at: new Date(Date.now() - 1700000).toISOString(), actions: ['Iniciou análise forense', 'Criou branch feature/PAY-204-cron-fix'] }
    ]
  }
];
