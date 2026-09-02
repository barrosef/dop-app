/**
 * The account: members, invites, the second factor and creating an organization.
 *
 * It is the screen that closes the loop the invite e-mail starts: somebody
 * invites here, the person receives the message, opens `/invites/:id` and comes
 * back inside.
 *
 * The role rules are NOT repeated here. The screen asks and shows what came
 * back — a developer gets a 403 from the edge, and that refusal is the answer,
 * not a second copy of the policy on the front end.
 */
import React from 'react';
import { AlertTriangle, Building2, Mail, ShieldCheck, Trash2, Users } from 'lucide-react';
import {
  getListAccountsQueryKey,
  getListInvitesQueryKey,
  getListMembersQueryKey,
  useCreateAccount,
  useCreateInvite,
  useListInvites,
  useListMembers,
  useRevokeInvite,
  useUpdateMember,
  type InviteSummary,
  type MemberSummary,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

import { SecondFactorSettings } from '../components/security/second-factor-settings';
import { useAccount } from '../lib/platform/account';
import { useI18n } from '../lib/i18n';

const ROLES = ['owner', 'admin', 'developer', 'viewer'] as const;

export default function Account() {
  const t = useI18n((s) => s.t);
  const { activeAccount } = useAccount();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight" data-testid="account-title">
          {t('account.title')}
        </h1>
      </div>

      <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-5">
        <section className="max-w-lg">
          <SecondFactorSettings />
        </section>

        {activeAccount ? (
          <>
            <section className="max-w-lg space-y-3">
              <Heading icon={<Users className="h-4 w-4 text-primary" />}>
                {t('account.members')}
              </Heading>
              <Members />
            </section>

            <section className="max-w-lg space-y-3">
              <Heading icon={<Mail className="h-4 w-4 text-primary" />}>
                {t('account.invites')}
              </Heading>
              <Invites />
            </section>
          </>
        ) : null}

        <section className="max-w-lg space-y-3">
          <Heading icon={<Building2 className="h-4 w-4 text-primary" />}>
            {t('account.newOrg')}
          </Heading>
          <NewOrganization />
        </section>
      </div>
    </div>
  );
}

function Heading({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold">
      {icon}
      {children}
    </h2>
  );
}

function Members() {
  const t = useI18n((s) => s.t);
  const queryClient = useQueryClient();
  const { data, error } = useListMembers({
    query: { queryKey: getListMembersQueryKey(), retry: false },
  });

  if (error) return <Refused error={error as Error} />;
  if (!data?.length) {
    return <p className="text-xs text-muted-foreground">{t('account.members.empty')}</p>;
  }
  return (
    <ul className="space-y-1">
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

/**
 * A member's row: the role is a select, and the select is the whole edit.
 *
 * Whoever may not change it gets a 403 from the edge — the screen shows the
 * refusal instead of hiding the control, because hiding would be a second copy
 * of the rule and the two would drift apart. The same goes for the last owner:
 * the domain refuses (`identity.membership.last_owner`) and the message lands
 * right here.
 */
function MemberRow({
  member,
  onChanged,
}: {
  member: MemberSummary;
  onChanged: () => void;
}) {
  const t = useI18n((s) => s.t);
  const update = useUpdateMember();
  const [failure, setFailure] = React.useState('');

  return (
    <li className="rounded-md border border-border/60 bg-card/60 px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono">{member.user_id}</span>
        <select
          aria-label={t('account.member.changeRole')}
          value={member.role}
          disabled={update.isPending}
          onChange={(e) => {
            setFailure('');
            update.mutate(
              { membershipId: member.id, data: { role: e.target.value } },
              {
                onSuccess: onChanged,
                onError: (err) => setFailure((err as Error).message),
              },
            );
          }}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs disabled:opacity-50"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`account.role.${r}` as never)}
            </option>
          ))}
        </select>
      </div>
      {failure ? <p className="mt-1 text-[11px] text-destructive">{failure}</p> : null}
    </li>
  );
}

function Invites() {
  const t = useI18n((s) => s.t);
  const queryClient = useQueryClient();
  const { data, error } = useListInvites({
    query: { queryKey: getListInvitesQueryKey(), retry: false },
  });
  const create = useCreateInvite();
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<string>('developer');
  const [failure, setFailure] = React.useState('');

  function refresh() {
    queryClient.invalidateQueries({ queryKey: getListInvitesQueryKey() });
  }

  if (error) return <Refused error={error as Error} />;

  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setFailure('');
          create.mutate(
            { data: { email, role, grants: [] } },
            {
              onSuccess: () => {
                setEmail('');
                refresh();
              },
              onError: (err) => setFailure((err as Error).message),
            },
          );
        }}
      >
        <div className="flex-1 space-y-1">
          <label className="text-[11px] font-medium" htmlFor="invite-email">
            {t('account.invite.email')}
          </label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium" htmlFor="invite-role">
            {t('account.invite.role')}
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`account.role.${r}` as never)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={create.isPending || !email}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {create.isPending ? t('account.invite.sending') : t('account.invite.send')}
        </button>
      </form>

      {failure ? <p className="text-[11px] text-destructive">{failure}</p> : null}

      {!data?.length ? (
        <p className="text-xs text-muted-foreground">{t('account.invite.empty')}</p>
      ) : (
        <ul className="space-y-1">
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

  return (
    <li className="flex items-center justify-between rounded-md border border-border/60 bg-card/60 px-3 py-2 text-xs">
      <div className="min-w-0">
        <p className="truncate">{invite.email}</p>
        <p className="text-[11px] text-muted-foreground">
          {t(`account.role.${invite.role}` as never)} ·{' '}
          {t(`invite.status.${invite.status}` as never)}
        </p>
      </div>
      {/* Only a PENDING invite can be revoked: revoking an accepted one would be
          removing a member, which is another operation with another meaning. */}
      {invite.status === 'pending' ? (
        <button
          type="button"
          title={t('account.invite.revoke')}
          onClick={() => revoke.mutate({ inviteId: invite.id }, { onSuccess: onChanged })}
          className="rounded p-1 text-muted-foreground hover:bg-muted/50 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </li>
  );
}

function NewOrganization() {
  const t = useI18n((s) => s.t);
  const queryClient = useQueryClient();
  const create = useCreateAccount();
  const [displayName, setDisplayName] = React.useState('');
  const [handle, setHandle] = React.useState('');
  const [legalId, setLegalId] = React.useState('');
  const [failure, setFailure] = React.useState('');

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        setFailure('');
        create.mutate(
          { data: { display_name: displayName, handle, legal_id: legalId } },
          {
            onSuccess: () => {
              setDisplayName('');
              setHandle('');
              setLegalId('');
              queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
            },
            onError: (err) => setFailure((err as Error).message),
          },
        );
      }}
    >
      <div className="grid grid-cols-3 gap-2">
        <Field label={t('account.newOrg.name')} value={displayName} onChange={setDisplayName} />
        <Field label={t('account.newOrg.handle')} value={handle} onChange={setHandle} />
        <Field label={t('account.newOrg.legalId')} value={legalId} onChange={setLegalId} />
      </div>
      {failure ? <p className="text-[11px] text-destructive">{failure}</p> : null}
      <button
        type="submit"
        disabled={create.isPending || !displayName || !handle}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
      >
        {create.isPending ? t('account.newOrg.creating') : t('account.newOrg.create')}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs"
      />
    </div>
  );
}

/**
 * A refusal from the edge IS the answer. Repeating the role rule on the screen
 * would be the second ruler — and the day the policy changes, the front end
 * would keep enforcing the old one.
 */
function Refused({ error }: { error: Error }) {
  const t = useI18n((s) => s.t);
  const status = (error as { status?: number }).status;
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {status === 403 ? t('account.onlyManagers') : t('account.error', { reason: error.message })}
    </p>
  );
}
