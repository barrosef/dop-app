import { DopApi } from './client';
import { Workspace, Demand, ChatMessage, LogLine } from './types';
import { mockWorkspaces } from '../mocks/workspaces';
import { mockDemands } from '../mocks/demands';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Per-app log templates for realistic app streaming
const APP_SERVICE_LOGS: Record<string, string[]> = {
  frontend: [
    '[vite] page reload triggered',
    '[HMR] App.tsx updated in 14ms',
    'GET / 200 — 2ms',
    'GET /assets/index-Bk2Axe.js 304 — 0ms',
    'WebSocket connection established',
    '[react-query] invalidating cache: ["invoices","list"]',
    'Hydration mismatch detected — suppressed in prod mode',
    '[router] navigated to /dashboard/subscriptions',
  ],
  backend: [
    'GET /api/v1/customers 200 — 11ms',
    'POST /api/v1/auth/login 200 — 38ms',
    'GET /api/v1/invoices?page=2 200 — 9ms',
    'PUT /api/v1/subscriptions/sub-8811 200 — 22ms',
    '[WARN] Rate limit 90% for 192.168.1.22',
    '[INFO] Background job: sync-subscriptions started',
    '[INFO] Cache invalidated: portal:catalog:*',
    '[ERROR] Upstream timeout "notifications-svc" — retry 1/3',
    '[INFO] Upstream retry succeeded — 204ms',
    'DELETE /api/v1/sessions/abc123 204 — 4ms',
  ],
  api: [
    'POST /api/v2/payments 201 — 54ms',
    'GET /api/v2/transactions?status=pending 200 — 18ms',
    'PUT /api/v2/payments/pmt-9901/capture 200 — 112ms',
    '[INFO] PSP webhook received: payment.captured',
    '[INFO] Event published: payment.created → rabbitmq',
    '[WARN] Idempotency key reuse detected — returning cached response',
    'GET /api/v2/reconciliation/summary 200 — 44ms',
    '[ERROR] PSP gateway timeout — pmt-7721 queued for retry',
  ],
  worker: [
    '[worker] polling queue: cobrancas.pendentes — depth: 3',
    '[worker] processing job cobranca#4421',
    '[worker] PSP call succeeded — pmt-4421 marked paid',
    '[worker] job cobranca#4421 completed in 1.2s',
    '[worker] polling queue: cobrancas.pendentes — depth: 0',
    '[worker] heartbeat OK — idle',
    '[WARN] job cobranca#4408 failed — scheduled retry in 60s',
    '[worker] retry job cobranca#4408 — attempt 2/3',
  ],
  'app-generic': [
    '[INFO] Application started on port 3000',
    '[INFO] Health check OK',
    'GET / 200',
  ],
};

// Per-service log templates for realistic infra streaming
const INFRA_LOGS: Record<string, string[]> = {
  mysql: [
    'InnoDB: Buffer pool(s) load completed at',
    'Query OK, 1 row affected',
    'Starting InnoDB Buffer Pool dump',
    'Innodb_rows_read: 14829',
    'slow query log: SELECT * FROM payments WHERE status=\'pending\' — 0.342s',
    'Table locks acquired: 0',
    'Connection from 172.18.0.3:54210',
  ],
  mongodb: [
    'mongod startup complete',
    'Waiting for connections on port 27017',
    'createIndex { createdAt: 1 } — 12ms',
    'find collection=audit filter={status:"pending"} — 4ms',
    'updateMany matched=32 modified=32 — 18ms',
    'WiredTiger cache usage: 42%',
  ],
  redis: [
    'Server started, Redis version=7.2.4',
    'SET portal:session:abc123 EX 3600 — OK',
    'GET portal:session:abc123 — HIT',
    'EXPIRE portal:cache:users — OK',
    'XADD events:audit * type payment_created id 8837',
    'Memory usage: 12.34M',
  ],
  postgres: [
    'database system is ready to accept connections',
    'autovacuum: processing database "pagamentos"',
    'LOG: execute S_1: SELECT id, amount, status FROM transactions LIMIT 100',
    'LOG: checkpoint starting: time',
    'LOG: checkpoint complete: wrote 47 buffers',
    'connection received: host=172.18.0.4 port=41230',
  ],
  rabbitmq: [
    'Server startup complete',
    'accepting AMQP connection 172.18.0.5:35412',
    'accepting AMQP connection 172.18.0.6:35413',
    'queue \'audit.events\' declared — durable: true',
    'message published to exchange \'payments\' routing_key \'payment.created\'',
    'consumer ack delivery_tag=1042 channel=1',
    'queue depth \'audit.events\': 3 messages',
  ],
  'db-container': [
    'Container started',
    'Ready to accept connections',
    'Health check OK',
  ],
};

const APP_LOGS = [
  '[INFO] GET /api/v1/customers 200 — 12ms',
  '[INFO] POST /api/v1/auth/login 200 — 45ms',
  '[WARN] Rate limit approaching for client 192.168.1.22',
  '[INFO] Background job started: sync-subscriptions',
  '[INFO] Cache invalidated: portal:catalog:*',
  '[INFO] GET /api/v1/invoices?page=2 200 — 8ms',
  '[ERROR] Upstream timeout for service "notifications" — retrying (1/3)',
  '[INFO] Upstream retry succeeded',
];

const TEST_LOGS = [
  '  ✓ tokenService > sign token (3ms)',
  '  ✓ tokenService > verify valid token (1ms)',
  '  ✗ authMiddleware > missing token returns 401 — expected 401 received 200',
  '  ↪ Re-running failed test...',
  '  ✓ authMiddleware > missing token returns 401 (2ms) — fixed',
  '  ✓ authMiddleware > valid bearer (1ms)',
  '',
  '  Starting e2e suite...',
  '  playwright > chromium launched',
  '  ✓ login flow e2e (1204ms)',
  '  ◌ protected route e2e — running...',
];

class MockDopApi implements DopApi {
  private workspaces = [...mockWorkspaces];
  private demands = [...mockDemands];

  async listWorkspaces(): Promise<Workspace[]> {
    await delay(300 + Math.random() * 500);
    return this.workspaces;
  }

  async getWorkspace(id: string): Promise<Workspace> {
    await delay(200 + Math.random() * 400);
    const ws = this.workspaces.find(w => w.id === id);
    if (!ws) throw new Error('Workspace not found');
    return ws;
  }

  async saveWorkspace(ws: Partial<Workspace>): Promise<Workspace> {
    await delay(400 + Math.random() * 400);
    if (ws.id) {
      const idx = this.workspaces.findIndex(w => w.id === ws.id);
      if (idx !== -1) {
        this.workspaces[idx] = { ...this.workspaces[idx], ...ws } as Workspace;
        return this.workspaces[idx];
      }
    }
    const newWs = { ...ws, id: `ws-${Date.now()}` } as Workspace;
    this.workspaces.push(newWs);
    return newWs;
  }

  async testConnection(kind: 'git' | 'jira' | 'runtime', _payload: unknown): Promise<{ ok: boolean; message: string }> {
    await delay(1000);
    const success = Math.random() > 0.1;
    return success
      ? { ok: true,  message: 'Conexão estabelecida com sucesso' }
      : { ok: false, message: 'Falha na conexão. Verifique as credenciais.' };
  }

  async listDemands(workspaceId: string): Promise<Demand[]> {
    await delay(300 + Math.random() * 500);
    return this.demands.filter(d => d.workspaceId === workspaceId);
  }

  async listAllDemands(): Promise<Demand[]> {
    await delay(400);
    return this.demands;
  }

  async getDemand(workspaceId: string, demandId: string): Promise<Demand> {
    await delay(200 + Math.random() * 400);
    const demand = this.demands.find(d => d.id === demandId && d.workspaceId === workspaceId);
    if (!demand) throw new Error('Demand not found');
    return demand;
  }

  async sendChatMessage(demandId: string, text: string): Promise<ChatMessage> {
    await delay(300);
    const demand = this.demands.find(d => d.id === demandId);
    if (!demand) throw new Error('Demand not found');

    const devMsg: ChatMessage = { id: `c-${Date.now()}`, author: 'dev', text, at: new Date().toISOString() };
    demand.chat.push(devMsg);

    setTimeout(() => {
      const claudeMsg: ChatMessage = {
        id: `c-${Date.now() + 1}`,
        author: 'claude',
        text: `Entendido. Vou proceder com: "${text}". Analisando o impacto e planejando os próximos passos.`,
        at: new Date().toISOString(),
        actions: ['Analisou o pedido', `Registrou no contexto da demanda`]
      };
      demand.chat.push(claudeMsg);
    }, 1500);

    return devMsg;
  }

  async *streamLogs(demandId: string, source: LogLine['source']): AsyncIterable<LogLine> {
    const lines = source === 'app' ? APP_LOGS : source === 'test' ? TEST_LOGS : [];
    let idx = 0;
    while (true) {
      await delay(900 + Math.random() * 400);
      if (source === 'infra') {
        // Round-robin across all infra services
        const services = ['mysql', 'redis', 'postgres'];
        const svc = services[Math.floor(Math.random() * services.length)];
        const pool = INFRA_LOGS[svc] ?? INFRA_LOGS['db-container'];
        const line = pool[Math.floor(Math.random() * pool.length)];
        yield { source, service: svc, line, at: new Date().toISOString() };
      } else {
        const pool = lines.length ? lines : [`[INFO] ${source} log entry for demand ${demandId}`];
        yield { source, service: source === 'app' ? 'api-server' : 'jest', line: pool[idx % pool.length], at: new Date().toISOString() };
        idx++;
      }
    }
  }

  // Stream logs for a specific service or app (used by the infra log overlay)
  async *streamServiceLogs(service: string): AsyncIterable<LogLine> {
    const isApp  = service in APP_SERVICE_LOGS || !INFRA_LOGS[service];
    const pool   = APP_SERVICE_LOGS[service]
      ?? INFRA_LOGS[service]
      ?? APP_SERVICE_LOGS['app-generic'];
    const source = isApp ? ('app' as const) : ('infra' as const);
    while (true) {
      await delay(600 + Math.random() * 700);
      yield {
        source,
        service,
        line: pool[Math.floor(Math.random() * pool.length)],
        at: new Date().toISOString()
      };
    }
  }
}

export const api = new MockDopApi();
