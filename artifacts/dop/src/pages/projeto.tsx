/**
 * Projeto: as demandas dele.
 *
 * Projeto é o nível 2 do DOP (GLOSSARIO.md) — não o "projeto do Jira", que é
 * outra coisa e sempre aparece qualificado.
 *
 * Card × demanda: o card é a origem (vem do task manager); a demanda é o card
 * em execução na plataforma. Esta lista mostra demandas.
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

function Etiqueta({
  texto,
  tom,
}: {
  texto: string;
  tom: 'neutro' | 'alerta' | 'ativo';
}) {
  const cor =
    tom === 'alerta'
      ? 'border-amber-500/25 bg-amber-500/10 text-amber-400'
      : tom === 'ativo'
        ? 'border-primary/25 bg-primary/10 text-primary'
        : 'border-border bg-muted/40 text-muted-foreground';
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${cor}`}
    >
      {texto}
    </span>
  );
}

function LinhaDaDemanda({ demanda }: { demanda: Demand }) {
  return (
    <Link
      to={`/demandas/${demanda.id}`}
      className="flex items-center gap-3 rounded-md border border-border/60 bg-card/60 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-muted/40"
      data-testid={`link-demanda-${demanda.id}`}
    >
      <CircleDot className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {demanda.title || demanda.external_key}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {demanda.external_key}
          {demanda.current_stage_key
            ? ` · etapa ${demanda.current_stage_key}`
            : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {demanda.dop_status ? (
          <Etiqueta texto={demanda.dop_status} tom="ativo" />
        ) : null}
        {demanda.awaiting_decision ? (
          <Etiqueta texto="aguardando decisão" tom="alerta" />
        ) : null}
        {demanda.blocked ? (
          <span title="bloqueada">
            <Lock className="h-3.5 w-3.5 text-amber-400" />
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export default function Projeto() {
  const { projectId = '' } = useParams();
  const projeto = useGetProject(projectId, {
    query: {
      queryKey: getGetProjectQueryKey(projectId),
      enabled: Boolean(projectId),
    },
  });
  const demandas = useListDemands(
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
          data-testid="titulo-projeto"
        >
          {projeto.data?.name ?? 'Projeto'}
        </h1>
        {projeto.data?.description ? (
          <p className="text-xs text-muted-foreground">
            {projeto.data.description}
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          Demandas
        </h2>
        {demandas.isLoading ? (
          <p className="text-xs text-muted-foreground">Carregando…</p>
        ) : demandas.error ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{(demandas.error as Error).message}</span>
          </div>
        ) : (demandas.data?.demands?.length ?? 0) === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma demanda neste projeto ainda.
          </p>
        ) : (
          <div className="space-y-1.5">
            {demandas.data?.demands?.map((demanda) => (
              <LinhaDaDemanda key={demanda.id} demanda={demanda} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
