import { DopApi } from './client';
import { Workspace, Demand, ChatMessage, LogLine } from './types';
import { mockWorkspaces } from '../mocks/workspaces';
import { mockDemands } from '../mocks/demands';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

  async testConnection(kind: 'git' | 'jira' | 'runtime', payload: unknown): Promise<{ ok: boolean; message: string }> {
    await delay(1000);
    const success = Math.random() > 0.1;
    if (success) {
      return { ok: true, message: 'Conexão estabelecida com sucesso' };
    }
    return { ok: false, message: 'Falha na conexão. Verifique as credenciais.' };
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

    // Simulate claude response
    setTimeout(() => {
      const claudeMsg: ChatMessage = {
        id: `c-${Date.now()+1}`,
        author: 'claude',
        text: `Entendi. Vou proceder com: ${text}`,
        at: new Date().toISOString(),
        actions: ['Analisou o pedido']
      };
      demand.chat.push(claudeMsg);
    }, 1500);

    return devMsg;
  }

  async *streamLogs(demandId: string, source: LogLine['source']): AsyncIterable<LogLine> {
    let count = 0;
    while (true) {
      await delay(1000);
      yield {
        source,
        service: source === 'app' ? 'api-server' : source === 'test' ? 'jest' : 'db-container',
        line: `[INFO] Log entry ${++count} for demand ${demandId} from ${source}. All systems normal.`,
        at: new Date().toISOString()
      };
    }
  }
}

export const api = new MockDopApi();
