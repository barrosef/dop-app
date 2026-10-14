/**
 * Creating a project inside a workspace of the active account — the first
 * thing the journey's closing screen offers. Workspaces come from the tree, in
 * the API's order; the repositories of a connection are not exposed by the
 * API yet, and the screen says so rather than inventing a list.
 */
import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FolderPlus, GitBranch, Loader2 } from 'lucide-react';
import {
  getGetTreeQueryKey,
  useCreateProject,
  useGetTree,
} from '@workspace/api-client-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiErrorNotice } from '@/components/welcome/api-error';
import { useI18n } from '@/lib/i18n';
import { useAccount } from '@/lib/platform/account';

export default function ProjectCreate() {
  const t = useI18n((s) => s.t);
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const { activeAccount } = useAccount();
  const first = Boolean((location.state as { firstProject?: boolean } | null)?.firstProject);
  const tree = useGetTree({
    query: { queryKey: getGetTreeQueryKey(), enabled: Boolean(activeAccount) },
  });
  const createProject = useCreateProject();
  const [chosenWorkspace, setWorkspaceId] = useState(params.get('workspace') ?? '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Derived on every render from the tree that arrived for the active
  // account: a choice (or a `?workspace=`) the tree no longer holds falls
  // back to the first workspace the API listed — never a stale id.
  const workspaceId = tree.data?.some((n) => n.workspace.id === chosenWorkspace)
    ? chosenWorkspace
    : tree.data?.[0]?.workspace.id ?? '';

  function submit(event: React.FormEvent) {
    event.preventDefault();
    createProject.mutate(
      {
        data: {
          workspace_id: workspaceId,
          name: name.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
        },
      },
      {
        onSuccess: (project) => {
          void queryClient.invalidateQueries({ queryKey: getGetTreeQueryKey() });
          navigate(`/projects/${project.id}`);
        },
      },
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl space-y-8 px-5 py-8 sm:px-8 sm:py-12">
        <header className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
            {first ? t('project.create.kickerFirst') : t('project.create.kicker')}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {first ? t('project.create.titleFirst') : t('project.create.title')}
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{t('project.create.lead')}</p>
        </header>

        {tree.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : tree.error ? (
          <ApiErrorNotice error={tree.error} onRetry={() => void tree.refetch()} />
        ) : !tree.data?.length ? (
          <Empty className="border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderPlus />
              </EmptyMedia>
              <EmptyTitle>{t('project.create.noWorkspace.title')}</EmptyTitle>
              <EmptyDescription>{t('project.create.noWorkspace.body')}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild variant="outline">
                <Link to="/workspaces/new">{t('project.create.noWorkspace.action')}</Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <form onSubmit={submit} className="space-y-5" data-testid="form-project-create">
            <div className="space-y-1.5">
              <Label htmlFor="project-workspace">{t('project.create.workspace')}</Label>
              <Select value={workspaceId} onValueChange={setWorkspaceId}>
                <SelectTrigger id="project-workspace" data-testid="select-project-workspace">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tree.data.map((node) => (
                    <SelectItem key={node.workspace.id} value={node.workspace.id}>
                      {node.workspace.name}
                      <span className="ml-2 font-mono text-[11px] text-muted-foreground">{node.workspace.key}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-name">{t('project.create.name')}</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                data-testid="input-project-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-description">
                {t('project.create.description')}{' '}
                <span className="font-normal text-muted-foreground">{t('welcome.profile.optional')}</span>
              </Label>
              <Textarea
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                data-testid="input-project-description"
              />
            </div>
            <div className="flex items-start gap-2 border-l-2 border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t('project.create.reposPending')}
            </div>
            {createProject.error ? (
              <ApiErrorNotice error={createProject.error} testId="status-project-create-error" />
            ) : null}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Button asChild variant="ghost">
                <Link to="/">{t('welcome.ready.cockpit')}</Link>
              </Button>
              <Button
                type="submit"
                disabled={createProject.isPending || !name.trim() || !workspaceId}
                data-testid="button-project-create"
              >
                {createProject.isPending ? <Loader2 className="animate-spin" /> : <FolderPlus />}
                {t('project.create.submit')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
