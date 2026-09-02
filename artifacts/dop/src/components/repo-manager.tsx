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
import { useI18n } from '../lib/i18n';

/* ── providers ─────────────────────────────────────────────────── */
const PROVIDERS: {
  id: GitProvider; label: string; shortLabel?: string; icon: React.ElementType;
  color: string; bg: string;
}[] = [
  { id: 'github',             label: 'GitHub',            icon: Github,    color: 'text-white',      bg: 'bg-[#24292e]' },
  { id: 'gitlab',             label: 'GitLab',            icon: GitBranch, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  { id: 'gitlab_self_hosted', label: 'GitLab Self Hosted', shortLabel: 'gitlab\nself hosted', icon: GitBranch, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  { id: 'azure_devops',       label: 'Azure DevOps',      icon: Cloud,     color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
  { id: 'bitbucket',          label: 'Bitbucket',         icon: Server,    color: 'text-sky-400',    bg: 'bg-sky-500/10 border-sky-500/20' },
];

function providerInfo(id?: GitProvider) {
  return PROVIDERS.find(p => p.id === id) ?? PROVIDERS[0];
}

/* ── protocol inference ─────────────────────────────────────────── */
function inferProtocol(url: string): GitProtocol | null {
  const u = url.trim().toLowerCase();
  if (u.startsWith('git@') || u.startsWith('ssh://')) return 'ssh';
  if (u.startsWith('https://') || u.startsWith('http://'))  return 'https';
  return null;
}

/* ── repo card ──────────────────────────────────────────────────── */
function RepoCard({ repo, onDelete }: { repo: RepoConfig; onDelete: () => void }) {
  const { t } = useI18n();
  const p    = providerInfo(repo.provider);
  const PIcon = p.icon;
  return (
    <div className="border border-border/50 rounded-md p-3 flex items-start gap-3 bg-card/60 hover:bg-muted/10 transition-colors group">
      <div className={`w-8 h-8 rounded border ${p.bg} flex items-center justify-center shrink-0`}>
        <PIcon className={`w-4 h-4 ${p.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-bold">{repo.name}</span>
          <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 border-border/60 bg-muted/30">{repo.protocol.toUpperCase()}</Badge>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-border/60 bg-muted/30">{p.label}</Badge>
        </div>
        {repo.description && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{repo.description}</p>
        )}
        <p className="text-[10px] font-mono text-muted-foreground/60 mt-1 truncate">{repo.remoteUrl}</p>
      </div>
      <button
        onClick={onDelete}
        className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
        title={t('repo.remove')}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ── form state ─────────────────────────────────────────────────── */
interface FormState {
  mode: 'existing' | 'new';
  provider: GitProvider;
  remoteUrl: string;
  inferredProtocol: GitProtocol | null;
  alias: string;
  description: string;
  baseUrl: string;
  repoName: string;
  newDescription: string;
  protocol: GitProtocol;
  token: string;
  sshKeyName: string;
  sshKeyContent: string;
}

const BLANK: FormState = {
  mode: 'existing', provider: 'github',
  remoteUrl: '', inferredProtocol: null, alias: '', description: '',
  baseUrl: '', repoName: '', newDescription: '',
  protocol: 'ssh',
  token: '', sshKeyName: '', sshKeyContent: '',
};

function SshKeyInput({
  keyName,
  keyContent,
  onChange,
}: {
  keyName: string;
  keyContent: string;
  onChange: (name: string, content: string) => void;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'drop' | 'text'>('drop');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = event => onChange(file.name, (event.target?.result as string) ?? '');
    reader.readAsText(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5" />
          {t('repo.ssh.label')}
        </Label>
        <button
          type="button"
          onClick={() => setMode(current => current === 'drop' ? 'text' : 'drop')}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {mode === 'drop'
            ? <><FileKey className="w-3 h-3" /> {t('repo.ssh.paste')}</>
            : <><Upload className="w-3 h-3" /> {t('repo.ssh.upload')}</>}
        </button>
      </div>

      {mode === 'drop' ? (
        <>
          <input
            type="file"
            ref={fileRef}
            className="hidden"
            accept=".pem,.key,id_rsa,id_ed25519,.txt"
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) loadFile(file);
            }}
          />
          <div
            onDragOver={event => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={event => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files[0];
              if (file) loadFile(file);
            }}
            onClick={() => fileRef.current?.click()}
            className={`rounded-md border-2 border-dashed p-4 text-center cursor-pointer transition-all ${
              dragging
                ? 'border-primary/60 bg-primary/10'
                : keyContent
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-border/50 hover:border-primary/40 hover:bg-muted/20'
            }`}
          >
            {keyContent ? (
              <div className="flex items-center justify-center gap-2 text-xs text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>{keyName || t('repo.ssh.loaded')}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                <Upload className="w-5 h-5" />
                <span className="text-xs">{t('repo.ssh.drop')}</span>
                <span className="text-[10px] text-muted-foreground/60">id_rsa · id_ed25519 · .pem · .key</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <textarea
          value={keyContent}
          onChange={event => onChange('', event.target.value)}
          placeholder={'-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----'}
          rows={7}
          spellCheck={false}
          className="w-full font-mono text-xs resize-y rounded-md border border-border/60 bg-card/50 p-3 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      )}
    </div>
  );
}

/* ── add panel ──────────────────────────────────────────────────── */
function AddRepoPanel({ onAdd, onCancel }: { onAdd: (r: RepoConfig) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [form, setForm]     = useState<FormState>(BLANK);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(p => {
      const next = { ...p, [k]: v };
      if (k === 'remoteUrl' && p.mode === 'existing') {
        next.inferredProtocol = inferProtocol(v as string);
      }
      return next;
    });

  const effProtocol = form.mode === 'existing' ? form.inferredProtocol : form.protocol;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (form.mode === 'existing') {
      if (!form.remoteUrl.trim()) errs.remoteUrl = t('repo.validation.remoteUrl');
      if (effProtocol === 'https' && !form.token.trim()) errs.token = t('repo.validation.token');
    } else {
      if (!form.baseUrl.trim()) errs.baseUrl = t('repo.validation.baseUrl');
      if (!form.repoName.trim()) errs.repoName = t('repo.validation.name');
      if (effProtocol === 'https' && !form.token.trim()) errs.token = t('repo.validation.token');
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const protocol = effProtocol ?? 'ssh';
    const fullUrl = form.mode === 'existing'
      ? form.remoteUrl.trim()
      : `${form.baseUrl.trim().replace(/\/$/, '')}/${form.repoName.trim()}`;
    const name = form.mode === 'existing'
      ? (form.alias.trim() || fullUrl.split('/').pop()?.replace(/\.git$/, '') || 'repo')
      : form.repoName.trim();
    const description = form.mode === 'existing' ? form.description : form.newDescription;
    const repo: RepoConfig = {
      id: `r-${Date.now()}`,
      name,
      provider: form.provider,
      description: description.trim() || undefined,
      remoteUrl: fullUrl,
      protocol,
      credentialRef: protocol === 'https' ? '***' : undefined,
      sshKeyRef: protocol === 'ssh' && form.sshKeyContent
        ? (form.sshKeyName || 'chave-colada') : undefined,
      baseBranch: 'main',
      prTargets: ['develop'],
    };
    onAdd(repo);
  };

  return (
    <div className="border border-primary/20 bg-primary/5 rounded-md p-4 space-y-5">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">{t('repo.add.title')}</h4>
        <button onClick={onCancel} className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground hover:text-foreground transition-colors">{t('repo.add.cancel')}</button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(['existing', 'new'] as const).map(m => (
          <button
            key={m}
            onClick={() => set('mode', m)}
            className={`rounded border py-2.5 px-3 text-xs font-medium transition-all ${
              form.mode === m
                ? 'bg-primary/10 border-primary/30 text-primary shadow-sm'
                : 'bg-card/50 border-border/50 text-muted-foreground hover:border-border hover:bg-card'
            }`}
          >
            {m === 'existing'
              ? <><Link2 className="w-3.5 h-3.5 inline mr-1.5" />{t('repo.add.connect')}</>
              : <><Plus  className="w-3.5 h-3.5 inline mr-1.5" />{t('repo.add.create')}</>}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('repo.add.provider')}</Label>
        <div className="grid grid-cols-5 gap-2">
          {PROVIDERS.map(p => {
            const PIcon = p.icon;
            const lines = p.shortLabel ? p.shortLabel.split('\n') : [p.label];
            return (
              <button
                key={p.id}
                onClick={() => set('provider', p.id)}
                className={`min-h-16 rounded border py-3 px-1 flex flex-col items-center justify-center gap-1.5 text-[9px] font-medium leading-tight text-center transition-all ${
                  form.provider === p.id
                    ? `border-primary/40 ${p.bg} ${p.color} bg-opacity-20`
                    : 'bg-card/50 border-border/50 text-muted-foreground hover:border-border hover:bg-card'
                }`}
              >
                <PIcon className="w-4 h-4 shrink-0" />
                {lines.map((l, i) => <span key={i}>{l}</span>)}
              </button>
            );
          })}
        </div>
      </div>

      {form.mode === 'existing' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground" htmlFor="repo-url">{t('repo.add.url')}</Label>
            <Input
              id="repo-url"
              value={form.remoteUrl}
              onChange={e => set('remoteUrl', e.target.value)}
              placeholder="git@github.com:org/repo.git or https://github.com/org/repo.git"
              className={`font-mono text-xs h-8 bg-card/50 ${errors.remoteUrl ? 'border-red-500' : ''}`}
            />
            {errors.remoteUrl && <p className="text-[10px] text-red-400">{errors.remoteUrl}</p>}
            {form.inferredProtocol && (
              <p className="text-[9px] text-muted-foreground/80 mt-1">
                {t('repo.add.protocol')}:{' '}
                <span className="font-bold text-foreground">{form.inferredProtocol.toUpperCase()}</span>
              </p>
            )}
          </div>

          {effProtocol === 'https' && (
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground" htmlFor="repo-token">{t('repo.add.token')}</Label>
              <Input
                id="repo-token"
                type="password"
                value={form.token}
                onChange={e => set('token', e.target.value)}
                placeholder="ghp_••••••••••••"
                className={`font-mono text-xs h-8 bg-card/50 ${errors.token ? 'border-red-500' : ''}`}
              />
              {errors.token && <p className="text-[10px] text-red-400">{errors.token}</p>}
            </div>
          )}
          {effProtocol === 'ssh' && (
            <SshKeyInput
              keyName={form.sshKeyName}
              keyContent={form.sshKeyContent}
              onChange={(name, content) => {
                set('sshKeyName', name);
                set('sshKeyContent', content);
              }}
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground" htmlFor="repo-alias">
                {t('repo.add.alias')}
              </Label>
              <Input id="repo-alias" value={form.alias} onChange={e => set('alias', e.target.value)} placeholder="frontend" className="h-8 text-xs bg-card/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground" htmlFor="repo-desc">
                {t('repo.add.desc')}
              </Label>
              <Input id="repo-desc" value={form.description} onChange={e => set('description', e.target.value)} placeholder={t('repo.descriptionPlaceholder')} className="h-8 text-xs bg-card/50" />
            </div>
          </div>
        </>
      )}

      {form.mode === 'new' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('repo.add.baseUrl')}</Label>
            <div className="flex items-center">
              <Input value={form.baseUrl} onChange={e => set('baseUrl', e.target.value)} placeholder="https://gitlab.company.com/org" className={`flex-1 rounded-r-none h-8 font-mono text-xs bg-card/50 ${errors.baseUrl ? 'border-red-500' : ''}`} />
              <span className="h-8 px-2 flex items-center border-y border-border bg-muted/30 text-muted-foreground text-xs select-none shrink-0">/</span>
              <Input value={form.repoName} onChange={e => set('repoName', e.target.value)} placeholder="nome-repo" className={`w-32 rounded-l-none h-8 border-l-0 font-mono text-xs bg-card/50 ${errors.repoName ? 'border-red-500' : ''}`} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground" htmlFor="repo-new-desc">{t('repo.add.desc')}</Label>
            <Input id="repo-new-desc" value={form.newDescription} onChange={e => set('newDescription', e.target.value)} placeholder={t('repo.descriptionPlaceholder')} className="h-8 text-xs bg-card/50" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('repo.authProtocol')}</Label>
            <div className="inline-flex rounded-md border border-border/50 overflow-hidden">
              {(['ssh', 'https'] as GitProtocol[]).map(protocol => (
                <button
                  key={protocol}
                  type="button"
                  onClick={() => set('protocol', protocol)}
                  className={`px-4 py-1.5 text-xs font-semibold transition-colors ${
                    form.protocol === protocol
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {protocol.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {effProtocol === 'ssh' && (
            <SshKeyInput
              keyName={form.sshKeyName}
              keyContent={form.sshKeyContent}
              onChange={(name, content) => {
                set('sshKeyName', name);
                set('sshKeyContent', content);
              }}
            />
          )}
          {effProtocol === 'https' && (
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground" htmlFor="repo-token-new">{t('repo.add.token')}</Label>
              <Input
                id="repo-token-new"
                type="password"
                value={form.token}
                onChange={event => set('token', event.target.value)}
                placeholder="••••••••••••"
                className={`font-mono text-xs h-8 bg-card/50 ${errors.token ? 'border-red-500' : ''}`}
              />
              {errors.token && <p className="text-[10px] text-red-400">{errors.token}</p>}
            </div>
          )}
        </>
      )}

      <div className="flex gap-2 pt-2">
        <Button onClick={handleSave} size="sm" className="h-8 text-xs">
          {form.mode === 'new' ? t('repo.add.saveNew') : t('repo.add.save')}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 text-xs">
          {t('repo.add.cancel')}
        </Button>
      </div>
    </div>
  );
}

export function RepoManager({
  repos,
  onChange,
}: {
  repos: RepoConfig[];
  onChange: (repos: RepoConfig[]) => void;
}) {
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);

  const handleDelete = (id: string) => onChange(repos.filter(r => r.id !== id));
  const handleAdd    = (repo: RepoConfig) => { onChange([...repos, repo]); setAdding(false); };

  return (
    <div className="space-y-2.5">
      {repos.length === 0 && !adding && (
        <div className="border border-dashed border-border/50 rounded-md p-6 text-center text-xs text-muted-foreground bg-card/30">
          {t('repo.none')}
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
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-dashed border-border/50 text-xs text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('repo.add')}
        </button>
      )}
    </div>
  );
}
