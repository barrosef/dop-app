/**
 * Accepting an invite — the screen the e-mail's link leads to (P-32, ADR-0019).
 *
 * Until today the link led to a 404: the acceptance existed in the core and
 * nothing reached it. This screen is the missing end.
 *
 * Two properties of ADR-0019 show up here as UI:
 *
 *   - the preview does NOT say who the invite was for, so it can be opened by
 *     whoever holds the link without leaking an address;
 *   - the two refusals are DIFFERENT screens. "Confirm your e-mail" and "this
 *     invite is not yours" send the person to do different things, and a single
 *     message would make both look like the same wall.
 */
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, MailCheck, UserPlus } from 'lucide-react';
import {
  getGetInviteQueryKey,
  useAcceptInvite,
  useGetInvite,
} from '@workspace/api-client-react';

import { setActiveAccount } from '../lib/platform/active-account';
import { useI18n } from '../lib/i18n';

export default function Invite() {
  const { inviteId = '' } = useParams();
  const navigate = useNavigate();
  const t = useI18n((s) => s.t);
  const [error, setError] = React.useState<{ status?: number; message: string } | null>(
    null,
  );

  const { data, isLoading, error: readError } = useGetInvite(inviteId, {
    query: {
      queryKey: getGetInviteQueryKey(inviteId),
      enabled: Boolean(inviteId),
      // A refusal here does not improve with insistence: the invite is either
      // valid or it is not.
      retry: false,
    },
  });
  const accept = useAcceptInvite();

  if (isLoading) {
    return <Centered>{t('invite.loading')}</Centered>;
  }
  if (readError) {
    return (
      <Centered>
        <Problem>{(readError as Error).message}</Problem>
      </Centered>
    );
  }
  if (!data) return null;

  const statusKey = `invite.status.${data.status}` as const;

  return (
    <Centered>
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          <h1 className="text-base font-semibold">{t('invite.title')}</h1>
        </div>

        <div>
          <p className="text-sm">
            {t('invite.join', { account: data.account_name })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('invite.role', { role: t(`account.role.${data.role}` as never) })}
          </p>
        </div>

        {!data.usable ? (
          <Problem>
            {t('invite.notUsable', { status: t(statusKey as never) })}
          </Problem>
        ) : null}

        {/* The two refusals, told apart. 412 is "confirm your e-mail"; 403 is
            "this invite is not yours" — and neither reveals the address. */}
        {error?.status === 412 ? (
          <Problem icon={<MailCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />}>
            {t('invite.needsVerifiedEmail')}
          </Problem>
        ) : error?.status === 403 ? (
          <Problem>{t('invite.notYours')}</Problem>
        ) : error ? (
          <Problem>{t('invite.failed', { reason: error.message })}</Problem>
        ) : null}

        <button
          type="button"
          disabled={!data.usable || accept.isPending}
          onClick={() => {
            setError(null);
            accept.mutate(
              { inviteId },
              {
                onSuccess: (r) => {
                  // Switching to the account just joined: whoever accepts an
                  // invite wants to be inside, and the response already carries
                  // it so there is no second round trip.
                  setActiveAccount(r.account_id);
                  navigate('/');
                },
                onError: (e) => {
                  const status = (e as { status?: number }).status;
                  setError({ status, message: (e as Error).message });
                },
              },
            );
          }}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          data-testid="accept-invite"
        >
          {accept.isPending ? t('invite.accepting') : t('invite.accept')}
        </button>
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-sm">
      {children}
    </div>
  );
}

function Problem({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
      {icon ?? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}
