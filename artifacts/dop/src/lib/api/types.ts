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
export interface ExecFile {
  path: string;          // relative path within repo, e.g. "src/auth/tokenService.ts"
  repo: string;          // repo name
  branch: string;        // feature branch
  linesAdded: number;
  linesRemoved: number;
  diff: string;          // unified diff content
}
export interface ExecTask {
  id: string;
  label: string;
  parallelGroup: number; // tasks with same group number run simultaneously
  filePaths: string[];   // "repo::path" keys matching ExecFile
  status: 'pending' | 'running' | 'done';
}
export interface ExecData { tasks: ExecTask[]; files: ExecFile[]; }
export interface Stage { key: string; title: string; status: StageStatus; summary?: string; document?: string; execData?: ExecData; startedAt?: string; finishedAt?: string; }
export interface PullRequest { id: string; repo: string; sourceBranch: string; targetBranch: string; url: string; merged: boolean; approver?: string; hasConflict: boolean; }
export interface FileTouched { path: string; kind: 'plan' | 'context' | 'adr' | 'source' | 'test'; change: 'created' | 'modified'; }
export interface TestResult {
  name: string;
  repo?: string;       // for hierarchical grouping by repository
  type: 'unit' | 'e2e';
  status: TestStatus;
  durationMs?: number; // execution time in ms
}
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
