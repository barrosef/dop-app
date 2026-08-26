import { Workspace, Card, ChatMessage, LogLine } from './types';

export interface DopApi {
  listWorkspaces(): Promise<Workspace[]>;
  getWorkspace(id: string): Promise<Workspace>;
  saveWorkspace(ws: Partial<Workspace>): Promise<Workspace>;
  testConnection(kind: 'git' | 'jira' | 'runtime', payload: unknown): Promise<{ ok: boolean; message: string }>;
  listCards(workspaceId: string): Promise<Card[]>;
  listAllCards(): Promise<Card[]>;
  getCard(workspaceId: string, cardId: string): Promise<Card>;
  sendChatMessage(cardId: string, text: string): Promise<ChatMessage>;
  streamLogs(cardId: string, source: LogLine['source'], filter?: { testType?: 'unit' | 'e2e'; testRepo?: string }): AsyncIterable<LogLine>;
}
