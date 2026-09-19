import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import {
  getListInvitesQueryKey,
  useListInvites,
  useCreateInvite,
  useRevokeInvite,
  type InviteSummary,
} from '@workspace/api-client-react';

import { useI18n } from '../../lib/i18n';
import { MutationFeedback, Refused } from './shared';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const ROLES = ['owner', 'admin', 'developer', 'viewer'] as const;

export function Invites() {
  const t = useI18n((s) => s.t);
  const queryClient = useQueryClient();
  const { data, error, isLoading } = useListInvites({
    query: { queryKey: getListInvitesQueryKey(), retry: false },
  });
  const create = useCreateInvite();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('developer');
  const [failure, setFailure] = useState('');
  const [success, setSuccess] = useState(false);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: getListInvitesQueryKey() });
  }

  if (error) return <Refused error={error as Error} />;

  return (
    <div className="space-y-6">
      <form
        className="flex flex-col lg:flex-row lg:items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setFailure('');
          setSuccess(false);
          create.mutate(
            { data: { email, role, grants: [] } },
            {
              onSuccess: () => {
                setEmail('');
                setSuccess(true);
                refresh();
              },
              onError: (err) => setFailure((err as Error).message),
            },
          );
        }}
      >
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="invite-email">
            {t('account.invite.email')}
          </Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFailure('');
              setSuccess(false);
            }}
          />
        </div>
        <div className="w-full lg:w-40 space-y-1.5">
          <Label htmlFor="invite-role">
            {t('account.invite.role')}
          </Label>
          <Select value={role} onValueChange={(v) => { setRole(v); setFailure(''); setSuccess(false); }}>
            <SelectTrigger id="invite-role">
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
        </div>
        <Button
          type="submit"
          disabled={create.isPending || !email}
          className="w-full lg:w-auto"
        >
          {create.isPending ? t('account.invite.sending') : t('account.invite.send')}
        </Button>
      </form>
      
      <MutationFeedback pending={create.isPending} success={success} error={failure} />

      {isLoading ? (
        <div role="status" aria-label={t('account.feedback.loading')} className="space-y-3 pt-2">
          <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
        </div>
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">{t('account.invite.empty')}</p>
      ) : (
        <ul className="border-t border-border divide-y divide-border/60">
          {data.map((i) => (
            <InviteRow key={i.id} invite={i} onChanged={refresh} />
          ))}
        </ul>
      )}
    </div>
  );
}

function InviteRow({
  invite,
  onChanged,
}: {
  invite: InviteSummary;
  onChanged: () => void;
}) {
  const t = useI18n((s) => s.t);
  const revoke = useRevokeInvite();
  const [failure, setFailure] = useState('');
  const [success, setSuccess] = useState(false);

  return (
    <li className="flex flex-col gap-3 py-3 text-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0 border-l-2 border-primary/40 pl-3">
          <p className="truncate font-medium">{invite.email}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(`account.role.${invite.role}` as never)} &middot;{' '}
            {t(`invite.status.${invite.status}` as never)}
          </p>
        </div>
        {/* Only a PENDING invite can be revoked: revoking an accepted one would be
            removing a member, which is another operation with another meaning. */}
        {invite.status === 'pending' ? (
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label={t('account.invite.revoke')}
            title={t('account.invite.revoke')}
            disabled={revoke.isPending}
            onClick={() => {
              setFailure('');
              setSuccess(false);
              revoke.mutate({ inviteId: invite.id }, {
                onSuccess: () => {
                  setSuccess(true);
                  onChanged();
                },
                onError: (err) => setFailure((err as Error).message),
              });
            }}
            className="self-end lg:self-auto flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-destructive disabled:opacity-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <MutationFeedback pending={revoke.isPending} success={success} error={failure} />
    </li>
  );
}