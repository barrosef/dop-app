import { Workspace } from '../api/types';

export const mockWorkspaces: Workspace[] = [
  {
    id: 'ws-1',
    name: 'Portal do Cliente',
    root: '/Users/dev/projects/portal-cliente',
    status: 'active',
    gitProvider: 'azure_devops',
    repos: [
      { id: 'r1', name: 'portal-frontend', remoteUrl: 'git@ssh.dev.azure.com:v3/org/portal-frontend', protocol: 'ssh', baseBranch: 'main', prTargets: ['develop'] },
      { id: 'r2', name: 'portal-backend', remoteUrl: 'git@ssh.dev.azure.com:v3/org/portal-backend', protocol: 'ssh', baseBranch: 'main', prTargets: ['develop'] }
    ],
    taskManager: { provider: 'jira', baseUrl: 'https://org.atlassian.net', project: 'PORTAL' },
    runtime: { apps: [{ name: 'frontend', role: 'frontend', port: 3000 }, { name: 'backend', role: 'backend', port: 8080 }], infra: ['redis'] },
    claudeExtensions: { mcps: [], plugins: [], skills: [], commands: [] },
    rules: ['Usar React Query para chamadas de API', 'Testes unitários são obrigatórios'],
    context: 'Portal para clientes gerenciarem suas assinaturas.'
  },
  {
    id: 'ws-2',
    name: 'API de Pagamentos',
    root: '/Users/dev/projects/api-pagamentos',
    status: 'active',
    gitProvider: 'azure_devops',
    repos: [],
    taskManager: { provider: 'jira', baseUrl: 'https://org.atlassian.net', project: 'PAY' },
    runtime: { apps: [], infra: [] },
    claudeExtensions: { mcps: [], plugins: [], skills: [], commands: [] },
    rules: [],
    context: ''
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
