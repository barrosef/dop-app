import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Trash2, UserMinus } from 'lucide-react';
import {
  getListMembersQueryKey,
  getListMemberGrantsQueryKey,
  getListResourcesQueryKey,
  useListMembers,
  useListMemberGrants,
  useListResources,
  useUpdateMember,
  useRemoveMember,
  useGrantResource,
  useRevokeGrant,
  type MemberSummary,
} from '@workspace/api-client-react';

import { useI18n } from '../../lib/i18n';
import { MutationFeedback, Refused } from './shared';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const ROLES = ['owner', 'admin', 'developer', 'viewer'] as const;
const LEVELS = ['use', 'manage'] as const;

export function Members() {
  const t = useI18n((s) => s.t);
  const queryClient = useQueryClient();
  const { data, error, isLoading } = useListMembers({
    query: { queryKey: getListMembersQueryKey(), retry: false },
  });

  if (isLoading) {
    return (
      <div role="status" aria-label={t('account.feedback.loading')} className="space-y-3">
        <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
      </div>
    );
  }
  if (error) return <Refused error={error as Error} />;
  if (!data?.length) {
    return <p className="text-sm text-muted-foreground">{t('account.members.empty')}</p>;
  }
  return (
    <ul className="border-t border-border divide-y divide-border/60">
      {data.map((m) => (
        <MemberRow
          key={m.id}
          member={m}
          onChanged={() =>
            queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() })
          }
        />
      ))}
    </ul>
  );
}

function MemberRow({
  member,
  onChanged,
}: {
  member: MemberSummary;
  onChanged: () => void;
}) {
  const t = useI18n((s) => s.t);
  const update = useUpdateMember();
  const remove = useRemoveMember();
  const [open, setOpen] = useState(false);
  const [failure, setFailure] = useState('');
  const [success, setSuccess] = useState(false);

  function fail(err: unknown) {
    setFailure((err as Error).message);
  }
  
  function succeed() {
    setSuccess(true);
    onChanged();
  }

  return (
    <li className="flex flex-col gap-2 py-3 text-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center justify-between border-l-2 border-primary/40 pl-3">
        <Button
          variant="ghost"
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 items-center gap-2 text-left hover:text-primary transition-colors"
          aria-expanded={open}
          aria-label={`${t('account.grants')}: ${member.user_id}`}
        >
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
          <span className="truncate font-mono">{member.user_id}</span>
        </Button>

        <div className="flex shrink-0 items-center gap-2">
          <Select
            value={member.role}
            onValueChange={(val) => {
              setFailure('');
              setSuccess(false);
              update.mutate(
                { membershipId: member.id, data: { role: val } },
                { onSuccess: succeed, onError: fail },
              );
            }}
            disabled={update.isPending}
          >
            <SelectTrigger aria-label={t('account.member.changeRole')} className="h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {t(`account.role.${r}` as never)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label={t('account.member.remove')}
            title={t('account.member.remove')}
            disabled={remove.isPending}
            onClick={() => {
              setFailure('');
              setSuccess(false);
              remove.mutate(
                { membershipId: member.id },
                { onSuccess: succeed, onError: fail },
              );
            }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-destructive disabled:opacity-50 transition-colors"
          >
            <UserMinus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <MutationFeedback pending={update.isPending || remove.isPending} success={success} error={failure} />
      {open ? <MemberGrants userId={member.user_id} /> : null}
    </li>
  );
}

function MemberGrants({ userId }: { userId: string }) {
  const t = useI18n((s) => s.t);
  const queryClient = useQueryClient();
  const { data: grants, error, isLoading } = useListMemberGrants(userId, {
    query: { queryKey: getListMemberGrantsQueryKey(userId), retry: false },
  });
  const { data: resources, error: resourcesError, isLoading: resourcesLoading } = useListResources(
    { kind: 'integration' },
    {
      query: {
        queryKey: getListResourcesQueryKey({ kind: 'integration' }),
        retry: false,
      },
    },
  );
  const grant = useGrantResource();
  const revoke = useRevokeGrant();
  const [resourceId, setResourceId] = useState('');
  const [level, setLevel] = useState<string>('use');
  const [failure, setFailure] = useState('');
  const [success, setSuccess] = useState(false);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: getListMemberGrantsQueryKey(userId) });
  }
  function nameOf(id: string) {
    return resources?.find((r) => r.id === id)?.name ?? id;
  }

  if (error) return <div className="mt-3"><Refused error={error as Error} /></div>;
  if (resourcesError) return <div className="mt-3"><Refused error={resourcesError as Error} /></div>;
  if (isLoading || resourcesLoading) {
    return (
      <div role="status" className="mt-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{t('account.feedback.loading')}</p>
        <div className="h-6 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const grantable = (resources ?? []).filter(
    (r) => !grants?.some((g) => g.resource_id === r.id),
  );

  return (
    <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
      <p className="text-xs font-medium text-muted-foreground">
        {t('account.grants')}
      </p>

      {!grants?.length ? (
        <p className="text-xs text-muted-foreground">{t('account.grants.empty')}</p>
      ) : (
        <ul className="space-y-1.5">
          {grants.map((g) => (
            <li key={g.id} className="flex flex-col gap-1 lg:flex-row lg:items-center justify-between">
              <span className="truncate text-sm">{nameOf(g.resource_id)}</span>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                {t(`account.grants.level.${g.level}` as never)}
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label={t('account.grants.revoke')}
                  title={t('account.grants.revoke')}
                  onClick={() => {
                    setFailure('');
                    setSuccess(false);
                    revoke.mutate(
                      { grantId: g.id },
                      { onSuccess: () => { setSuccess(true); refresh(); }, onError: (e) => setFailure((e as Error).message) },
                    );
                  }}
                  disabled={revoke.isPending}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-destructive disabled:opacity-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {grantable.length ? (
        <form
          className="flex flex-col lg:flex-row lg:items-center gap-2 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            setFailure('');
            setSuccess(false);
            grant.mutate(
              { data: { resource_id: resourceId || grantable[0].id, user_id: userId, level } },
              {
                onSuccess: () => {
                  setResourceId('');
                  setSuccess(true);
                  refresh();
                },
                onError: (err) => setFailure((err as Error).message),
              },
            );
          }}
        >
          <Select
            value={resourceId || grantable[0].id}
            onValueChange={(val) => { setResourceId(val); setFailure(''); setSuccess(false); }}
          >
            <SelectTrigger aria-label={t('account.grants.resource')} className="h-8 min-w-0 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {grantable.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={level}
            onValueChange={(val) => { setLevel(val); setFailure(''); setSuccess(false); }}
          >
            <SelectTrigger aria-label={t('account.grants.level')} className="h-8 w-full lg:w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {t(`account.grants.level.${l}` as never)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="submit"
            disabled={grant.isPending}
            className="h-8 px-3 w-full lg:w-auto"
          >
            {t('account.grants.add')}
          </Button>
        </form>
      ) : null}
      
      <MutationFeedback pending={grant.isPending || revoke.isPending} success={success} error={failure} />
    </div>
  );
}