import React, { useRef, useState } from 'react';
import {
  Plus, Trash2, Github, GitBranch, Cloud, Link2,
  Upload, CheckCircle2, Server, KeyRound, FileKey,
} from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { RepoConfig, GitProvider, GitProtocol } from '../lib/api/types';

/* ── providers ─────────────────────────────────────────────────── */
const PROVIDERS: {
  id: GitProvider; label: string; icon: React.ElementType; color: string; bg: string;
}[] = [
  { id: 'github',             label: 'GitHub',            icon: Github,    color: 'text-white',      bg: 'bg-[#24292e]' },
  { id: 'gitlab',             label: 'GitLab',            icon: GitBranch, color: 'text-orange-300', bg: 'bg-orange-950/60' },
  { id: 'gitlab_self_hosted', label: 'GitLab Self Hosted',icon: GitBranch, color: 'text-orange-200', bg: 'bg-orange-900/40' },
  { id: 'azure_devops',       label: 'Azure DevOps',      icon: Cloud,     color: 'text-blue-300',   bg: 'bg-blue-950/60' },
  { id: 'bitbucket',          label: 'Bitbucket',         icon: Server,    color: 'text-sky-300',    bg: 'bg-sky-950/60' },
];

function providerInfo(id?: GitProvider) {
  return PROVIDERS.find(p => p.id === id) ?? PROVIDERS[0];
}

/* ── repo card ──────────────────────────────────────────────────── */
function RepoCard({ repo, onDelete }: { repo: RepoConfig; onDelete: () => void }) {
  const p = providerInfo(repo.provider);
  const PIcon = p.icon;
  return (
    <div className="border border-border/50 rounded-lg p-3 flex items-start gap-3 bg-muted/10 group">
      <div className={`w-8 h-8 rounded-md ${p.bg} flex items-center justify-center shrink-0`}>
        <PIcon className={`w-4 h-4 ${p.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{repo.name}</span>
          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">{repo.protocol.toUpperCase()}</Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{p.label}</Badge>
        </div>
        {repo.description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{repo.description}</p>
        )}
        <p className="text-[11px] font-mono text-muted-foreground/70 mt-1 truncate">{repo.remoteUrl}</p>
      </div>
      <button
        onClick={onDelete}
        className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
        title="Remover repositório"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ── add panel ──────────────────────────────────────────────────── */
interface FormState {
  mode: 'existing' | 'new';
  provider: GitProvider;
  name: string;
  description: string;
  remoteUrl: string;
  protocol: GitProtocol;
  token: string;
  sshKeyName: string;
  sshKeyContent: string;
}

const BLANK: FormState = {
  mode: 'existing', provider: 'github', name: '', description: '',
  remoteUrl: '', protocol: 'ssh', token: '', sshKeyName: '', sshKeyContent: '',
};

function AddRepoPanel({ onAdd, onCancel }: { onAdd: (r: RepoConfig) => void; onCancel: () => void }) {
  const [form, setForm]     = useState<FormState>(BLANK);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [dragging, setDragging] = useState(false);
  const [sshMode, setSshMode]   = useState<'drop' | 'text'>('drop');
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const loadFile = (file: File) => {
    set('sshKeyName', file.name);
    const reader = new FileReader();
    reader.onload = ev => set('sshKeyContent', ev.target?.result as string ?? '');
    reader.readAsText(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) loadFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  };

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!form.name.trim())                                  errs.name = 'Nome é obrigatório';
    if (form.mode === 'existing' && !form.remoteUrl.trim()) errs.remoteUrl = 'URL remota é obrigatória';
    if (form.protocol === 'https' && !form.token.trim())    errs.token = 'Token de acesso é obrigatório';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const domainMap: Partial<Record<GitProvider, string>> = {
      github: 'github.com', gitlab: 'gitlab.com',
      gitlab_self_hosted: 'gitlab.empresa.com', azure_devops: 'dev.azure.com', bitbucket: 'bitbucket.org',
    };
    const repo: RepoConfig = {
      id: `r-${Date.now()}`,
      name: form.name.trim(),
      provider: form.provider,
      description: form.description.trim() || undefined,
      remoteUrl: form.mode === 'existing'
        ? form.remoteUrl.trim()
        : `git@${domainMap[form.provider] ?? 'git.example.com'}:org/${form.name.trim()}.git`,
      protocol: form.protocol,
      credentialRef: form.protocol === 'https' ? '***' : undefined,
      sshKeyRef: form.protocol === 'ssh' && form.sshKeyContent
        ? (form.sshKeyName || 'chave-colada')
        : undefined,
      baseBranch: 'main',
      prTargets: ['develop'],
    };
    onAdd(repo);
  };

  return (
    <div className="border border-primary/25 bg-primary/5 rounded-lg p-4 space-y-5">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Adicionar repositório</h4>
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
      </div>

      {/* Mode */}
      <div className="grid grid-cols-2 gap-2">
        {(['existing', 'new'] as const).map(m => (
          <button
            key={m}
            onClick={() => set('mode', m)}
            className={`rounded-lg border py-3 px-4 text-sm font-medium transition-all ${
              form.mode === m
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
            }`}
          >
            {m === 'existing' ? (
              <><Link2 className="w-4 h-4 inline mr-2" />Conectar existente</>
            ) : (
              <><Plus className="w-4 h-4 inline mr-2" />Criar novo</>
            )}
          </button>
        ))}
      </div>

      {/* Provider — horizontal pills */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Provedor Git</Label>
        <div className="flex flex-wrap gap-1.5">
          {PROVIDERS.map(p => {
            const PIcon = p.icon;
            return (
              <button
                key={p.id}
                onClick={() => set('provider', p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-all ${
                  form.provider === p.id
                    ? `border-primary/40 ${p.bg} ${p.color}`
                    : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground'
                }`}
              >
                <PIcon className="w-3.5 h-3.5 shrink-0" />
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Name / Description */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs" htmlFor="repo-name">
            {form.mode === 'new' ? 'Nome do repositório' : 'Alias local'}
          </Label>
          <Input
            id="repo-name"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder={form.mode === 'new' ? 'meu-repo' : 'frontend'}
            className={`text-sm ${errors.name ? 'border-red-500' : ''}`}
          />
          {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
        </div>
        <div className="space-y-2">
          <Label className="text-xs" htmlFor="repo-desc">Descrição</Label>
          <Input
            id="repo-desc"
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Breve descrição opcional"
            className="text-sm"
          />
        </div>
      </div>

      {/* Remote URL (existing mode only) */}
      {form.mode === 'existing' && (
        <div className="space-y-2">
          <Label className="text-xs" htmlFor="repo-url">URL remota</Label>
          <Input
            id="repo-url"
            value={form.remoteUrl}
            onChange={e => set('remoteUrl', e.target.value)}
            placeholder="git@github.com:org/repo.git"
            className={`font-mono text-xs ${errors.remoteUrl ? 'border-red-500' : ''}`}
          />
          {errors.remoteUrl && <p className="text-xs text-red-400">{errors.remoteUrl}</p>}
        </div>
      )}

      {/* Protocol toggle */}
      <div className="space-y-2">
        <Label className="text-xs">Protocolo de autenticação</Label>
        <div className="flex rounded-lg border border-border/50 overflow-hidden w-fit">
          {(['ssh', 'https'] as GitProtocol[]).map(pr => (
            <button
              key={pr}
              onClick={() => set('protocol', pr)}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                form.protocol === pr
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {pr.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* SSH key */}
      {form.protocol === 'ssh' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              Chave privada SSH
            </Label>
            <button
              type="button"
              onClick={() => {
                setSshMode(m => m === 'drop' ? 'text' : 'drop');
                if (sshMode === 'text') set('sshKeyContent', '');
              }}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {sshMode === 'drop'
                ? <><FileKey className="w-3 h-3" /> Colar / digitar</>
                : <><Upload className="w-3 h-3" /> Upload de arquivo</>
              }
            </button>
          </div>

          {sshMode === 'drop' ? (
            <>
              <input
                type="file"
                ref={fileRef}
                onChange={handleFileInput}
                className="hidden"
                accept=".pem,.key,id_rsa,id_ed25519,.txt"
              />
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`rounded-lg border-2 border-dashed p-5 text-center cursor-pointer select-none transition-all ${
                  dragging
                    ? 'border-primary/60 bg-primary/10'
                    : form.sshKeyContent
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : 'border-border/40 hover:border-border/70 hover:bg-muted/20'
                }`}
              >
                {form.sshKeyContent ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{form.sshKeyName || 'Chave carregada'}</span>
                    <span className="text-xs text-emerald-400/60">— clique para substituir</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                    <Upload className="w-5 h-5" />
                    <span className="text-sm">
                      Arraste o arquivo da chave aqui ou{' '}
                      <span className="text-primary underline underline-offset-2">selecione</span>
                    </span>
                    <span className="text-xs text-muted-foreground/60">id_rsa · id_ed25519 · .pem · .key</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <textarea
              value={form.sshKeyContent}
              onChange={e => { set('sshKeyContent', e.target.value); set('sshKeyName', ''); }}
              placeholder={'-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----'}
              rows={7}
              spellCheck={false}
              className="w-full font-mono text-xs resize-y rounded-md border border-border/60 bg-muted/20 p-3 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 leading-relaxed"
            />
          )}
        </div>
      )}

      {/* HTTPS token */}
      {form.protocol === 'https' && (
        <div className="space-y-2">
          <Label className="text-xs" htmlFor="repo-token">Token de acesso pessoal (PAT)</Label>
          <Input
            id="repo-token"
            type="password"
            value={form.token}
            onChange={e => set('token', e.target.value)}
            placeholder="ghp_••••••••••••"
            className={`font-mono text-sm ${errors.token ? 'border-red-500' : ''}`}
          />
          {errors.token && <p className="text-xs text-red-400">{errors.token}</p>}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button onClick={handleSave} size="sm">
          {form.mode === 'new' ? 'Criar e conectar' : 'Conectar repositório'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

/* ── main component ─────────────────────────────────────────────── */
export function RepoManager({
  repos,
  onChange,
}: {
  repos: RepoConfig[];
  onChange: (repos: RepoConfig[]) => void;
}) {
  const [adding, setAdding] = useState(false);

  const handleDelete = (id: string) => onChange(repos.filter(r => r.id !== id));
  const handleAdd    = (repo: RepoConfig) => { onChange([...repos, repo]); setAdding(false); };

  return (
    <div className="space-y-3">
      {repos.length === 0 && !adding && (
        <div className="border border-dashed border-border/50 rounded-lg p-6 text-center text-sm text-muted-foreground">
          Nenhum repositório configurado. Adicione um abaixo.
        </div>
      )}

      {repos.map(r => (
        <RepoCard key={r.id} repo={r} onDelete={() => handleDelete(r.id)} />
      ))}

      {adding ? (
        <AddRepoPanel onAdd={handleAdd} onCancel={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          Adicionar repositório
        </button>
      )}
    </div>
  );
}
