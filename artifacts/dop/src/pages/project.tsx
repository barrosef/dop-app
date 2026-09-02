/**
 * A project: its demands.
 *
 * A project is DOP's level 2 (GLOSSARIO.md) — not the "Jira project", which is
 * something else and always shows up qualified.
 *
 * A card vs. a demand: the card is the origin (it comes from the task manager);
 * the demand is the card in execution on the platform. This list shows demands.
 */
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, CircleDot, Lock } from 'lucide-react';
import {
  getGetProjectQueryKey,
  getListDemandsQueryKey,
  useGetProject,
  useListDemands,
  type Demand,
} from '@workspace/api-client-react';

import { useI18n } from '../lib/i18n';

function Tag({
  text,
  tone,
}: {
  text: string;
  tone: 'neutral' | 'warning' | 'active';
}) {
  const color =
    tone === 'warning'
      ? 'border-amber-500/25 bg-amber-500/10 text-amber-400'
      : tone === 'active'
        ? 'border-primary/25 bg-primary/10 text-primary'
        : 'border-border bg-muted/40 text-muted-foreground';
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${color}`}
    >
      {text}
    </span>
  );
}

function DemandRow({ demand }: { demand: Demand }) {
  const t = useI18n((s) => s.t);
  return (
    <Link
      to={`/demands/${demand.id}`}
      className="flex items-center gap-3 rounded-md border border-border/60 bg-card/60 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-muted/40"
      data-testid={`link-demand-${demand.id}`}
    >
      <CircleDot className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {demand.title || demand.external_key}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {demand.external_key}
          {demand.current_stage_key
            ? ` · ${t('project.demand.stage', { key: demand.current_stage_key })}`
            : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {demand.dop_status ? (
          <Tag text={demand.dop_status} tone="active" />
        ) : null}
        {demand.awaiting_decision ? (
          <Tag text={t('project.demand.awaiting')} tone="warning" />
        ) : null}
        {demand.blocked ? (
          <span title={t('project.demand.blocked')}>
            <Lock className="h-3.5 w-3.5 text-amber-400" />
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export default function Project() {
  const { projectId = '' } = useParams();
  const t = useI18n((s) => s.t);
  const project = useGetProject(projectId, {
    query: {
      queryKey: getGetProjectQueryKey(projectId),
      enabled: Boolean(projectId),
    },
  });
  const demands = useListDemands(
    { project_id: projectId },
    {
      query: {
        queryKey: getListDemandsQueryKey({ project_id: projectId }),
        enabled: Boolean(projectId),
      },
    },
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border px-6 py-4">
        <h1
          className="text-lg font-semibold tracking-tight"
          data-testid="project-title"
        >
          {project.data?.name ?? t('project.fallbackTitle')}
        </h1>
        {project.data?.description ? (
          <p className="text-xs text-muted-foreground">
            {project.data.description}
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          {t('project.demands')}
        </h2>
        {demands.isLoading ? (
          <p className="text-xs text-muted-foreground">{t('project.loading')}</p>
        ) : demands.error ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {t('project.error', {
                reason: (demands.error as Error).message,
              })}
            </span>
          </div>
        ) : (demands.data?.demands?.length ?? 0) === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t('project.demands.empty')}
          </p>
        ) : (
          <div className="space-y-1.5">
            {demands.data?.demands?.map((demand) => (
              <DemandRow key={demand.id} demand={demand} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
