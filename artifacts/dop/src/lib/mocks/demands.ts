import { Demand } from '../api/types';

// Branches convention: "repoName|branchName" — enables repo-grouped display in the UI

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
      { key: 'init',    title: 'Iniciar a demanda',    status: 'done', summary: 'Card PORTAL-103 lido via MCP Jira. Contexto inicial capturado.' },
      { key: 'context', title: 'Contextualização',     status: 'done', summary: 'Análise forense concluída. Identificados 3 pontos de integração no portal-backend.' },
      { key: 'plan',    title: 'Plano',                status: 'running', summary: 'Elaborando plano de desenvolvimento: 4 tarefas no backend, 2 no frontend.' }
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
      startedAt: new Date(Date.now() - 3600000).toISOString()
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
      { key: 'init',    title: 'Iniciar a demanda',    status: 'done', summary: 'Card lido. CVE-2026-1234 afeta `jsonwebtoken` < 9.0.2.', startedAt: new Date(Date.now() - 7200000).toISOString(), finishedAt: new Date(Date.now() - 7100000).toISOString() },
      { key: 'context', title: 'Contextualização',     status: 'done', summary: 'Ambos os repos usam jsonwebtoken. Backend: v8.5.1, Frontend: v8.5.1. Upgrade necessário em ambos.', startedAt: new Date(Date.now() - 7100000).toISOString(), finishedAt: new Date(Date.now() - 6800000).toISOString() },
      { key: 'plan',    title: 'Plano',                status: 'done', summary: 'Plano: (1) upgrade frontend (2) upgrade backend (3) ajustar uso de API que mudou na v9.', startedAt: new Date(Date.now() - 6800000).toISOString(), finishedAt: new Date(Date.now() - 6600000).toISOString() },
      { key: 'exec',    title: 'Execução do plano',    status: 'done', summary: '`jsonwebtoken` atualizado para 9.0.2 nos dois repos. 3 chamadas de API ajustadas no backend.', startedAt: new Date(Date.now() - 6600000).toISOString(), finishedAt: new Date(Date.now() - 5400000).toISOString() },
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
      { key: 'init', title: 'Iniciar a demanda', status: 'done' },
      { key: 'context', title: 'Contextualização', status: 'done' },
      { key: 'plan', title: 'Plano', status: 'done' },
      { key: 'exec', title: 'Execução do plano', status: 'done' },
      { key: 'test', title: 'Execução dos testes', status: 'done' },
      { key: 'val',  title: 'Validação humana', status: 'done' },
      { key: 'fin',  title: 'Finalização', status: 'done' }
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
