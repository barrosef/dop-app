import { LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ApiErrorNotice } from '@/components/welcome/api-error';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/platform/session';

/**
 * A refusal at a gate has to leave a way out. The API's sentence may tell the
 * person to use another sign-in method (a 409: the e-mail belongs to a
 * different provider), and a screen with only the message traps them — the
 * shell behind the gate never mounts, so there is no profile menu and no
 * sign-out. Every gate that stands between the session and a screen renders
 * its refusal through here.
 */
export function GateRefusal({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useI18n((s) => s.t);
  const { signOut } = useSession();
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-4">
        <ApiErrorNotice error={error} onRetry={onRetry} />
        <Button variant="outline" onClick={() => void signOut()} data-testid="button-gate-sign-out">
          <LogOut />
          {t('welcome.layout.signOut')}
        </Button>
      </div>
    </div>
  );
}
