import { Workspace, Demand, ChatMessage, LogLine } from './types';

export interface DopApi {
  listWorkspaces(): Promise<Workspace[]>;
  getWorkspace(id: string): Promise<Workspace>;
  saveWorkspace(ws: Partial<Workspace>): Promise<Workspace>;
  testConnection(kind: 'git' | 'jira' | 'runtime', payload: unknown): Promise<{ ok: boolean; message: string }>;
  listDemands(workspaceId: string): Promise<Demand[]>;
  listAllDemands(): Promise<Demand[]>;
  getDemand(workspaceId: string, demandId: string): Promise<Demand>;
  sendChatMessage(demandId: string, text: string): Promise<ChatMessage>;
  streamLogs(demandId: string, source: LogLine['source'], filter?: { testType?: 'unit' | 'e2e'; testRepo?: string }): AsyncIterable<LogLine>;
}
