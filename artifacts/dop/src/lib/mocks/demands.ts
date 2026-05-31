import { Demand } from '../api/types';

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

export const mockDemands: Demand[] = [
  {
    id: 'd-1',
    workspaceId: 'ws-1',
    jiraKey: 'PORTAL-101',
    title: 'Adicionar exportação para PDF',
    assignee: 'João Silva',
    jiraStatus: 'To Do',
    dopStatus: 'new',
    stages: [],
    dossier: { repos: [], branches: [], commits: 0, prs: [], files: [], tests: [] },
    chat: []
  },
  {
    id: 'd-2',
    workspaceId: 'ws-1',
    jiraKey: 'PORTAL-102',
    title: 'Corrigir bug na paginação',
    assignee: 'Maria Oliveira',
    jiraStatus: 'To Do',
    dopStatus: 'new',
    stages: [],
    dossier: { repos: [], branches: [], commits: 0, prs: [], files: [], tests: [] },
    chat: []
  },
  {
    id: 'd-3',
    workspaceId: 'ws-1',
    jiraKey: 'PORTAL-103',
    title: 'Integração com novo gateway de pagamentos',
    assignee: 'João Silva',
    jiraStatus: 'In Progress',
    dopStatus: 'doing',
    stages: [
      { key: 'init',    title: 'Iniciar a demanda',    status: 'done',    summary: 'Card PORTAL-103 lido via MCP Jira. RFC gerada e aprovada.',                                              document: PORTAL_103_INIT_DOC,    startedAt: new Date(Date.now() - 3700000).toISOString(), finishedAt: new Date(Date.now() - 3500000).toISOString() },
      { key: 'context', title: 'Contextualização',     status: 'done',    summary: 'Análise forense concluída. Identificados 3 pontos de integração no portal-backend.',                    document: PORTAL_103_CONTEXT_DOC, startedAt: new Date(Date.now() - 3500000).toISOString(), finishedAt: new Date(Date.now() - 3200000).toISOString() },
      { key: 'plan',    title: 'Plano',                status: 'running', summary: 'Elaborando plano de desenvolvimento: 4 tarefas no backend, 2 no frontend.',                            document: PORTAL_103_PLAN_DOC,    startedAt: new Date(Date.now() - 3200000).toISOString() }
    ],
    dossier: {
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
    jiraKey: 'PORTAL-104',
    title: 'Atualizar dependências de segurança (CVE-2026-1234)',
    assignee: 'Ana Costa',
    jiraStatus: 'In Progress',
    dopStatus: 'doing',
    stages: [
      { key: 'init',    title: 'Iniciar a demanda',    status: 'done',    summary: 'Card lido. CVE-2026-1234 afeta `jsonwebtoken` < 9.0.2. PRD de segurança gerada.',           document: PORTAL_104_INIT_DOC,    startedAt: new Date(Date.now() - 7200000).toISOString(), finishedAt: new Date(Date.now() - 7100000).toISOString() },
      { key: 'context', title: 'Contextualização',     status: 'done',    summary: 'Ambos os repos usam jsonwebtoken@8.5.1. 4 chamadas sign() identificadas, 1 no frontend.', document: PORTAL_104_CONTEXT_DOC, startedAt: new Date(Date.now() - 7100000).toISOString(), finishedAt: new Date(Date.now() - 6800000).toISOString() },
      { key: 'plan',    title: 'Plano',                status: 'done',    summary: 'Plano: (1) upgrade frontend (2) upgrade backend (3) ajustar API que mudou na v9.',         document: PORTAL_104_PLAN_DOC,    startedAt: new Date(Date.now() - 6800000).toISOString(), finishedAt: new Date(Date.now() - 6600000).toISOString() },
      { key: 'exec',    title: 'Execução do plano',    status: 'done',    summary: '`jsonwebtoken` atualizado para 9.0.2 nos dois repos. 3 chamadas de API ajustadas no backend.', startedAt: new Date(Date.now() - 6600000).toISOString(), finishedAt: new Date(Date.now() - 5400000).toISOString() },
      { key: 'test',    title: 'Execução dos testes',  status: 'running', startedAt: new Date(Date.now() - 5400000).toISOString() }
    ],
    dossier: {
      repos: ['portal-frontend', 'portal-backend'],
      branches: [
        'portal-frontend|feature/PORTAL-104-sec-deps',
        'portal-backend|feature/PORTAL-104-sec-deps'
      ],
      commits: 7,
      prs: [],
      files: [
        { path: 'portal-frontend/package.json',                      kind: 'source', change: 'modified' },
        { path: 'portal-backend/package.json',                       kind: 'source', change: 'modified' },
        { path: 'portal-backend/src/auth/tokenService.ts',           kind: 'source', change: 'modified' },
        { path: 'portal-backend/src/middleware/authMiddleware.ts',    kind: 'source', change: 'modified' },
        { path: 'portal-backend/tests/unit/tokenService.test.ts',    kind: 'test',   change: 'modified' }
      ],
      tests: [
        { name: 'tokenService > sign token',                   type: 'unit', status: 'success' },
        { name: 'tokenService > verify valid token',           type: 'unit', status: 'success' },
        { name: 'tokenService > reject expired token',         type: 'unit', status: 'success' },
        { name: 'authMiddleware > valid bearer',               type: 'unit', status: 'success' },
        { name: 'authMiddleware > missing token returns 401',  type: 'unit', status: 'fail'    },
        { name: 'login flow e2e',                              type: 'e2e',  status: 'running' },
        { name: 'protected route e2e',                         type: 'e2e',  status: 'skipped' }
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
    jiraKey: 'PAY-201',
    title: 'Refatorar serviço de reconciliação',
    assignee: 'Carlos Mendes',
    jiraStatus: 'In Review',
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
    dossier: {
      repos: ['api-pagamentos', 'worker-cobrancas'],
      branches: [
        'api-pagamentos|feature/PAY-201-reconcile-refactor',
        'worker-cobrancas|feature/PAY-201-reconcile-worker'
      ],
      commits: 14,
      prs: [
        { id: 'pr-1', repo: 'api-pagamentos',   sourceBranch: 'feature/PAY-201-reconcile-refactor', targetBranch: 'develop', url: '#', merged: false, approver: 'Carlos Mendes', hasConflict: false },
        { id: 'pr-2', repo: 'worker-cobrancas', sourceBranch: 'feature/PAY-201-reconcile-worker',   targetBranch: 'develop', url: '#', merged: false, hasConflict: false }
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
    jiraKey: 'PAY-202',
    title: 'Otimizar queries do banco de dados',
    assignee: 'João Silva',
    jiraStatus: 'Done',
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
    dossier: {
      repos: ['api-pagamentos'],
      branches: ['api-pagamentos|feature/PAY-202-query-opt'],
      commits: 8,
      prs: [{ id: 'pr-3', repo: 'api-pagamentos', sourceBranch: 'feature/PAY-202-query-opt', targetBranch: 'develop', url: '#', merged: true, approver: 'Maria Oliveira', hasConflict: false }],
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
    jiraKey: 'PAY-203',
    title: 'Adicionar logs de auditoria em todas as transações',
    assignee: 'Pedro Gomes',
    jiraStatus: 'In Progress',
    dopStatus: 'doing',
    stages: [
      { key: 'init',    title: 'Iniciar a demanda',   status: 'done' },
      { key: 'context', title: 'Contextualização',    status: 'done' },
      { key: 'plan',    title: 'Plano',               status: 'done' },
      { key: 'exec',    title: 'Execução do plano',   status: 'done' },
      { key: 'test',    title: 'Execução dos testes', status: 'blocked', summary: 'Teste e2e "auditoria de chargeback" falha por timeout no RabbitMQ. Aguardando decisão do Dev sobre retry policy.' }
    ],
    dossier: {
      repos: ['api-pagamentos', 'shared-contracts'],
      branches: [
        'api-pagamentos|feature/PAY-203-audit-log',
        'shared-contracts|feature/PAY-203-audit-events'
      ],
      commits: 6,
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
    jiraKey: 'PAY-204',
    title: 'Corrigir falha intermitente no cron de cobrança',
    assignee: 'Ana Costa',
    jiraStatus: 'In Progress',
    dopStatus: 'doing',
    stages: [
      { key: 'init',    title: 'Iniciar a demanda', status: 'done' },
      { key: 'context', title: 'Contextualização',  status: 'done' },
      { key: 'plan',    title: 'Plano',             status: 'running', summary: 'Análise forense em andamento. Suspeita de race condition no lock distribuído do Redis.' }
    ],
    dossier: {
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
