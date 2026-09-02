import { Workspace, GitProvider } from '../api/types';

const AZ: GitProvider = 'azure_devops';
const GH: GitProvider = 'github';
const GL: GitProvider = 'gitlab';

export const mockWorkspaces: Workspace[] = [
  {
    id: 'ws-1',
    name: 'Customer Portal',
    root: '/Users/dev/projects/customer-portal',
    status: 'active',
    gitProvider: 'azure_devops',
    repos: [
      { id: 'r1', name: 'portal-frontend', provider: AZ, remoteUrl: 'git@ssh.dev.azure.com:v3/org/portal-frontend', protocol: 'ssh', baseBranch: 'main', prTargets: ['develop'], description: 'The customer portal\u2019s React frontend' },
      { id: 'r2', name: 'portal-backend',  provider: GH, remoteUrl: 'git@github.com:org/portal-backend.git',         protocol: 'ssh', baseBranch: 'main', prTargets: ['develop'], description: 'The portal\u2019s Node.js API' },
    ],
    taskManager: { provider: 'jira', baseUrl: 'https://org.atlassian.net', project: 'PORTAL' },
    cardTypes: ['Story', 'Bug', 'Epic'],
      runtime: {
        apps: [
          { id: 'portal-frontend-d1', name: 'portal-frontend', role: 'frontend', port: 3000, taskId: 'd-1', status: 'running', dependsOn: ['portal-backend'] },
          { id: 'portal-backend-d1', name: 'portal-backend', role: 'backend', port: 8080, taskId: 'd-1', status: 'running', dependsOn: ['mysql', 'redis'] },
          { id: 'portal-backend-d3', name: 'portal-backend', role: 'backend', port: 8083, taskId: 'd-3', status: 'running', dependsOn: ['mysql', 'redis'] },
          { id: 'portal-backend-d4', name: 'portal-backend', role: 'backend', port: 8084, taskId: 'd-4', status: 'running', dependsOn: ['mysql'] },
        ],
        infra: [
          { id: 'portal-mysql', name: 'mysql', taskIds: ['d-1', 'd-3', 'd-4'], status: 'running' },
          { id: 'portal-redis', name: 'redis', taskIds: ['d-1', 'd-3'], status: 'running' },
          { id: 'portal-mongodb', name: 'mongodb', taskIds: ['d-1'], status: 'running' },
        ]
      },
    claudeExtensions: {
      mcps: [{ name: 'pg', kind: 'postgres' }, { name: 'fs', kind: 'filesystem' }],
      plugins: [], skills: [],
      commands: [
        { name: 'forensics', description: 'A forensic reading of the source code' },
        { name: 'adr',       description: 'Write an ADR for a technical decision' }
      ]
    },
    rules: ['Use React Query for API calls', 'Unit tests are mandatory'],
    context: 'A portal where customers manage their subscriptions and invoices.'
  },
  {
    id: 'ws-2',
    name: 'Payments API',
    root: '/Users/dev/projects/api-payments',
    status: 'active',
    gitProvider: 'azure_devops',
    repos: [
      { id: 'r3', name: 'api-payments',   provider: AZ, remoteUrl: 'https://org@dev.azure.com/org/api-payments/_git/api-payments',   protocol: 'https', baseBranch: 'main', prTargets: ['develop', 'release'] },
      { id: 'r4', name: 'worker-billing', provider: GL, remoteUrl: 'https://gitlab.com/org/worker-billing.git',                         protocol: 'https', baseBranch: 'main', prTargets: ['develop'] },
      { id: 'r5', name: 'shared-contracts', provider: AZ, remoteUrl: 'https://org@dev.azure.com/org/api-payments/_git/shared-contracts',   protocol: 'https', baseBranch: 'main', prTargets: ['develop'] },
    ],
    taskManager: { provider: 'clickup', baseUrl: 'https://app.clickup.com', project: 'PAY' },
    cardTypes: ['Task', 'Subtask'],
      runtime: {
        apps: [
          { id: 'api-payments-d5', name: 'api-payments', role: 'backend', port: 8081, taskId: 'd-5', status: 'running', dependsOn: ['postgres', 'rabbitmq'] },
          { id: 'api-payments-d6', name: 'api-payments', role: 'backend', port: 8083, taskId: 'd-6', status: 'running', dependsOn: ['postgres', 'redis'] },
          { id: 'api-payments-d7', name: 'api-payments', role: 'backend', port: 8084, taskId: 'd-7', status: 'running', dependsOn: ['postgres', 'rabbitmq'] },
          { id: 'worker-billing-d5', name: 'worker-billing', role: 'backend', port: 8082, taskId: 'd-5', status: 'running', dependsOn: ['api-payments', 'rabbitmq'] },
          { id: 'worker-billing-d8', name: 'worker-billing', role: 'backend', port: 8085, taskId: 'd-8', status: 'stopped', dependsOn: ['api-payments', 'redis'] },
        ],
        infra: [
          { id: 'payments-postgres', name: 'postgres', taskIds: ['d-5', 'd-6', 'd-7', 'd-8'], status: 'running' },
          { id: 'payments-rabbitmq', name: 'rabbitmq', taskIds: ['d-5', 'd-7'], status: 'running' },
          { id: 'payments-redis', name: 'redis', taskIds: ['d-6', 'd-8'], status: 'running' },
        ]
      },
    claudeExtensions: {
      mcps: [{ name: 'pg', kind: 'postgres' }, { name: 'rmq', kind: 'rabbitmq' }],
      plugins: [], skills: [],
      commands: [{ name: 'reconcile', description: 'Check the payment reconciliation' }]
    },
    rules: ['Every mutation must have an integration test', 'RabbitMQ events use the shared-contracts schema'],
    context: 'An API that processes and reconciles payments through PSPs.'
  },
  {
    id: 'ws-3',
    name: 'Mobile App',
    root: '/Users/dev/projects/mobile-app',
    status: 'draft',
    gitProvider: 'azure_devops',
    repos: [],
    taskManager: { provider: 'redmine', baseUrl: 'https://redmine.org.com', project: 'APP' },
    cardTypes: ['Feature', 'Defect'],
    runtime: { apps: [], infra: [] },
    claudeExtensions: { mcps: [], plugins: [], skills: [], commands: [] },
    rules: [],
    context: ''
  }
];
