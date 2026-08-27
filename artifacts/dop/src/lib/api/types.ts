export type WorkspaceStatus = 'draft' | 'active' | 'inactive' | 'deleted';
export type GitProtocol = 'http' | 'https' | 'ssh';
export type GitProvider = 'azure_devops' | 'github' | 'gitlab' | 'gitlab_self_hosted' | 'bitbucket';
export type DopStatus = 'new' | 'doing' | 'done' | 'delivered';
export type StageStatus = 'pending' | 'running' | 'done' | 'blocked';
export type TestStatus = 'running' | 'success' | 'fail' | 'skipped';

export interface RepoConfig {
  id: string; name: string; remoteUrl: string; protocol: GitProtocol;
  provider?: GitProvider;
  credentialRef?: string;
  sshKeyRef?: string;
  description?: string;
  baseBranch: string; prTargets: string[]; flowRules?: string;
}
export interface TaskManagerConfig { provider: 'jira' | 'clickup' | 'redmine' | 'custom'; baseUrl: string; project: string; }
export interface RuntimeApp {
  id: string;
  name: string;
  role: 'frontend' | 'backend';
  port: number;
  taskId?: string;
  status?: 'running' | 'stopped';
  dependsOn?: string[];
}
export interface RuntimeService {
  id: string;
  name: string;
  taskIds?: string[];
  status?: 'running' | 'stopped';
}
export interface ClaudeExtensions {
  mcps: { name: string; kind: string }[];
  plugins: string[]; skills: string[];
  commands: { name: string; description: string }[];
}
export interface Workspace {
  id: string; name: string; root: string; status: WorkspaceStatus;
  gitProvider?: GitProvider;
  repos: RepoConfig[]; taskManager: TaskManagerConfig;
  runtime: { apps: RuntimeApp[]; infra: RuntimeService[] };
  claudeExtensions: ClaudeExtensions;
  rules: string[];
  context: string;
  cardTypes: string[];
}
export interface ExecFile {
  path: string;          // relative path within repo
  repo: string;          // repo name
  branch: string;        // feature branch
  linesAdded: number;
  linesRemoved: number;
  diff: string;          // unified diff content
  error?: string;
}
export interface ExecTask {
  id: string;
  label: string;
  parallelGroup: number;
  filePaths: string[];
  status: 'pending' | 'running' | 'done';
}
export interface ExecData { tasks: ExecTask[]; files: ExecFile[]; }
export interface TestPlan { unit: string; e2e: string; }
export interface Stage { key: string; title: string; status: StageStatus; summary?: string; document?: string; execData?: ExecData; testPlan?: TestPlan; startedAt?: string; finishedAt?: string; }
export interface Reviewer { name: string; initials: string; status: 'approved' | 'rejected' | 'pending'; }
export interface PullRequest { id: string; repo: string; sourceBranch: string; targetBranch: string; url: string; merged: boolean; approver?: string; hasConflict: boolean; reviewers?: Reviewer[]; }
export interface FileTouched { path: string; kind: 'plan' | 'context' | 'adr' | 'source' | 'test'; change: 'created' | 'modified'; gitStatus?: 'staged' | 'modified' | 'untracked' | 'deleted'; repo?: string; branch?: string; diff?: string; linesAdded?: number; linesRemoved?: number; }
export interface TestResult {
  name: string;
  repo?: string;
  type: 'unit' | 'e2e';
  status: TestStatus;
  durationMs?: number;
}
export interface RepositoryOverview {
  repos: string[]; branches: string[]; commits: number;
  commitsByRepo?: Record<string, number>;
  prs: PullRequest[]; files: FileTouched[]; tests: TestResult[];
  startedAt?: string; finishedAt?: string; elapsedSeconds?: number;
}
export interface LogLine { source: 'app' | 'test' | 'infra'; service: string; line: string; at: string; testType?: 'unit' | 'e2e'; testRepo?: string; }
export interface ChatMessage { id: string; author: 'dev' | 'claude'; text: string; at: string; actions?: string[]; }

export interface Card {
  id: string; externalKey: string; title: string; assignee: string;
  type: string;
  provider: string;
  providerStatus: string; dopStatus: DopStatus;
  stages: Stage[]; repositoryOverview: RepositoryOverview; chat: ChatMessage[];
  workspaceId: string;
}

// Aliases for compatibility
export type Demand = Card;
export type DemandDossier = RepositoryOverview;
