import { Demand } from '../api/types';

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
    title: 'Integração com novo gateway',
    assignee: 'João Silva',
    jiraStatus: 'In Progress',
    dopStatus: 'doing',
    stages: [
      { key: 'init', title: 'Iniciar a demanda', status: 'done' },
      { key: 'context', title: 'Contextualização', status: 'done' },
      { key: 'plan', title: 'Plano', status: 'running' }
    ],
    dossier: { repos: ['portal-backend'], branches: ['feature/PORTAL-103-gateway'], commits: 2, prs: [], files: [], tests: [] },
    chat: [
      { id: 'c1', author: 'dev', text: 'Inicie o trabalho nesta demanda.', at: new Date().toISOString() },
      { id: 'c2', author: 'claude', text: 'Estou elaborando o plano de execução.', at: new Date().toISOString() }
    ]
  },
  {
    id: 'd-4',
    workspaceId: 'ws-1',
    jiraKey: 'PORTAL-104',
    title: 'Atualizar dependências de segurança',
    assignee: 'Ana Costa',
    jiraStatus: 'In Progress',
    dopStatus: 'doing',
    stages: [
      { key: 'init', title: 'Iniciar a demanda', status: 'done' },
      { key: 'context', title: 'Contextualização', status: 'done' },
      { key: 'plan', title: 'Plano', status: 'done' },
      { key: 'exec', title: 'Execução do plano', status: 'done' },
      { key: 'test', title: 'Execução dos testes', status: 'running' }
    ],
    dossier: { repos: ['portal-frontend'], branches: ['feature/PORTAL-104-deps'], commits: 5, prs: [], files: [], tests: [] },
    chat: []
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
      { key: 'init', title: 'Iniciar a demanda', status: 'done' },
      { key: 'context', title: 'Contextualização', status: 'done' },
      { key: 'plan', title: 'Plano', status: 'done' },
      { key: 'exec', title: 'Execução do plano', status: 'done' },
      { key: 'test', title: 'Execução dos testes', status: 'done' },
      { key: 'val', title: 'Validação humana', status: 'done' },
      { key: 'fin', title: 'Finalização', status: 'done' }
    ],
    dossier: { repos: ['api-pagamentos'], branches: ['feature/PAY-201-refactor'], commits: 12, prs: [{ id: 'pr-1', repo: 'api-pagamentos', sourceBranch: 'feature/PAY-201-refactor', targetBranch: 'develop', url: '#', merged: false, hasConflict: false }], files: [], tests: [] },
    chat: []
  },
  {
    id: 'd-6',
    workspaceId: 'ws-2',
    jiraKey: 'PAY-202',
    title: 'Otimizar queries do banco',
    assignee: 'João Silva',
    jiraStatus: 'Done',
    dopStatus: 'delivered',
    stages: [
      { key: 'init', title: 'Iniciar a demanda', status: 'done' },
      { key: 'context', title: 'Contextualização', status: 'done' },
      { key: 'plan', title: 'Plano', status: 'done' },
      { key: 'exec', title: 'Execução do plano', status: 'done' },
      { key: 'test', title: 'Execução dos testes', status: 'done' },
      { key: 'val', title: 'Validação humana', status: 'done' },
      { key: 'fin', title: 'Finalização', status: 'done' }
    ],
    dossier: { repos: ['api-pagamentos'], branches: ['feature/PAY-202-queries'], commits: 8, prs: [{ id: 'pr-2', repo: 'api-pagamentos', sourceBranch: 'feature/PAY-202-queries', targetBranch: 'develop', url: '#', merged: true, hasConflict: false }], files: [], tests: [] },
    chat: []
  },
  {
    id: 'd-7',
    workspaceId: 'ws-2',
    jiraKey: 'PAY-203',
    title: 'Adicionar logs de auditoria',
    assignee: 'Pedro Gomes',
    jiraStatus: 'In Progress',
    dopStatus: 'doing',
    stages: [
      { key: 'init', title: 'Iniciar a demanda', status: 'done' },
      { key: 'context', title: 'Contextualização', status: 'done' },
      { key: 'plan', title: 'Plano', status: 'done' },
      { key: 'exec', title: 'Execução do plano', status: 'done' },
      { key: 'test', title: 'Execução dos testes', status: 'blocked' }
    ],
    dossier: { repos: ['api-pagamentos'], branches: ['feature/PAY-203-audit'], commits: 4, prs: [], files: [], tests: [] },
    chat: []
  },
  {
    id: 'd-8',
    workspaceId: 'ws-2',
    jiraKey: 'PAY-204',
    title: 'Corrigir falha intermitente no cron',
    assignee: 'Ana Costa',
    jiraStatus: 'In Progress',
    dopStatus: 'doing',
    stages: [
      { key: 'init', title: 'Iniciar a demanda', status: 'done' },
      { key: 'context', title: 'Contextualização', status: 'done' },
      { key: 'plan', title: 'Plano', status: 'running' }
    ],
    dossier: { repos: ['api-pagamentos'], branches: ['feature/PAY-204-cron'], commits: 1, prs: [], files: [], tests: [] },
    chat: []
  }
];
