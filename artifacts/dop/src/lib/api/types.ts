export type WorkspaceStatus = 'draft' | 'active' | 'inactive' | 'deleted';
export type GitProtocol = 'http' | 'https' | 'ssh';
export type DopStatus = 'new' | 'doing' | 'done' | 'delivered';
export type StageStatus = 'pending' | 'running' | 'done' | 'blocked';
export type TestStatus = 'running' | 'success' | 'fail' | 'skipped';

export interface RepoConfig {
  id: string; name: string; remoteUrl: string; protocol: GitProtocol;
  credentialRef?: string;
  baseBranch: string; prTargets: string[]; flowRules?: string;
}
export interface TaskManagerConfig { provider: 'jira'; baseUrl: string; project: string; }
export interface RuntimeApp { name: string; role: 'frontend' | 'backend'; port: number; dependsOn?: string[]; }
export interface ClaudeExtensions {
  mcps: { name: string; kind: string }[];
  plugins: string[]; skills: string[];
  commands: { name: string; description: string }[];
}
export interface Workspace {
  id: string; name: string; root: string; status: WorkspaceStatus;
  gitProvider: 'azure_devops';
  repos: RepoConfig[]; taskManager: TaskManagerConfig;
  runtime: { apps: RuntimeApp[]; infra: string[] };
  claudeExtensions: ClaudeExtensions;
  rules: string[];
  context: string;
}
export interface Stage { key: string; title: string; status: StageStatus; summary?: string; startedAt?: string; finishedAt?: string; }
export interface PullRequest { id: string; repo: string; sourceBranch: string; targetBranch: string; url: string; merged: boolean; approver?: string; hasConflict: boolean; }
export interface FileTouched { path: string; kind: 'plan' | 'context' | 'adr' | 'source' | 'test'; change: 'created' | 'modified'; }
export interface TestResult { name: string; type: 'unit' | 'e2e'; status: TestStatus; }
export interface DemandDossier {
  repos: string[]; branches: string[]; commits: number;
  prs: PullRequest[]; files: FileTouched[]; tests: TestResult[];
  startedAt?: string; finishedAt?: string; elapsedSeconds?: number;
}
export interface ChatMessage { id: string; author: 'dev' | 'claude'; text: string; at: string; actions?: string[]; }
export interface LogLine { source: 'app' | 'test' | 'infra'; service: string; line: string; at: string; }
export interface Demand {
  id: string; jiraKey: string; title: string; assignee: string;
  jiraStatus: string; dopStatus: DopStatus;
  stages: Stage[]; dossier: DemandDossier; chat: ChatMessage[];
  workspaceId: string;
}
