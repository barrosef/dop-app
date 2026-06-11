import { Workspace, GitProvider } from '../api/types';

const AZ: GitProvider = 'azure_devops';
const GH: GitProvider = 'github';
const GL: GitProvider = 'gitlab';

export const mockWorkspaces: Workspace[] = [
  {
    id: 'ws-1',
    name: 'Portal do Cliente',
    root: '/Users/dev/projects/portal-cliente',
    status: 'active',
    gitProvider: 'azure_devops',
    repos: [
      { id: 'r1', name: 'portal-frontend', provider: AZ, remoteUrl: 'git@ssh.dev.azure.com:v3/org/portal-frontend', protocol: 'ssh', baseBranch: 'main', prTargets: ['develop'], description: 'Frontend React do portal de clientes' },
      { id: 'r2', name: 'portal-backend',  provider: GH, remoteUrl: 'git@github.com:org/portal-backend.git',         protocol: 'ssh', baseBranch: 'main', prTargets: ['develop'], description: 'API Node.js do portal' },
    ],
    taskManager: { provider: 'jira', baseUrl: 'https://org.atlassian.net', project: 'PORTAL' },
    runtime: {
      apps: [
        { name: 'frontend', role: 'frontend', port: 3000, dependsOn: ['backend'] },
        { name: 'backend',  role: 'backend',  port: 8080 }
      ],
      infra: ['mysql', 'redis', 'mongodb']
    },
    claudeExtensions: {
      mcps: [{ name: 'pg', kind: 'postgres' }, { name: 'fs', kind: 'filesystem' }],
      plugins: [], skills: [],
      commands: [
        { name: 'forensics', description: 'Análise forense do código-fonte' },
        { name: 'adr',       description: 'Criar ADR para decisão técnica' }
      ]
    },
    rules: ['Usar React Query para chamadas de API', 'Testes unitários são obrigatórios'],
    context: 'Portal para clientes gerenciarem suas assinaturas e faturas.'
  },
  {
    id: 'ws-2',
    name: 'API de Pagamentos',
    root: '/Users/dev/projects/api-pagamentos',
    status: 'active',
    gitProvider: 'azure_devops',
    repos: [
      { id: 'r3', name: 'api-pagamentos',   provider: AZ, remoteUrl: 'https://org@dev.azure.com/org/api-pagamentos/_git/api-pagamentos',   protocol: 'https', baseBranch: 'main', prTargets: ['develop', 'release'] },
      { id: 'r4', name: 'worker-cobrancas', provider: GL, remoteUrl: 'https://gitlab.com/org/worker-cobrancas.git',                         protocol: 'https', baseBranch: 'main', prTargets: ['develop'] },
      { id: 'r5', name: 'shared-contracts', provider: AZ, remoteUrl: 'https://org@dev.azure.com/org/api-pagamentos/_git/shared-contracts',   protocol: 'https', baseBranch: 'main', prTargets: ['develop'] },
    ],
    taskManager: { provider: 'jira', baseUrl: 'https://org.atlassian.net', project: 'PAY' },
    runtime: {
      apps: [
        { name: 'api',    role: 'backend', port: 8081 },
        { name: 'worker', role: 'backend', port: 8082, dependsOn: ['api'] }
      ],
      infra: ['postgres', 'rabbitmq', 'redis']
    },
    claudeExtensions: {
      mcps: [{ name: 'pg', kind: 'postgres' }, { name: 'rmq', kind: 'rabbitmq' }],
      plugins: [], skills: [],
      commands: [{ name: 'reconcile', description: 'Verificar reconciliação de pagamentos' }]
    },
    rules: ['Toda mutation deve ter teste de integração', 'Eventos RabbitMQ usam o schema do shared-contracts'],
    context: 'API de processamento e reconciliação de pagamentos via PSPs.'
  },
  {
    id: 'ws-3',
    name: 'App Mobile',
    root: '/Users/dev/projects/app-mobile',
    status: 'draft',
    gitProvider: 'azure_devops',
    repos: [],
    taskManager: { provider: 'jira', baseUrl: 'https://org.atlassian.net', project: 'APP' },
    runtime: { apps: [], infra: [] },
    claudeExtensions: { mcps: [], plugins: [], skills: [], commands: [] },
    rules: [],
    context: ''
  }
];
