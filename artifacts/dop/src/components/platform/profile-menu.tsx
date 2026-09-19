import React from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Moon, Settings, ShieldCheck, Sun, UserRound } from 'lucide-react';
import { useSession } from '../../lib/platform/session';
import { useI18n } from '../../lib/i18n';
import { useUiStore } from '../../store/uiStore';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '../ui/dropdown-menu';
import { profileInitials } from './profile-initials';

export function ProfileMenu() {
  const { user, signOut } = useSession();
  const { theme, setTheme } = useUiStore();
  const t = useI18n((s) => s.t);
  const [pending, setPending] = React.useState(false);
  const [failure, setFailure] = React.useState('');
  const initials = profileInitials(user?.displayName, user?.email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full p-0"
          aria-label={t('shell.profile.menu')} data-testid="profile-menu-trigger">
          <Avatar className="h-8 w-8 border border-border" aria-hidden="true">
            <AvatarFallback className="text-xs font-semibold">
              {initials || <UserRound className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-1rem)] shadow-none" sideOffset={8}>
        <DropdownMenuLabel className="min-w-0">
          <p className="truncate">{user?.displayName?.trim() || t('shell.profile.user')}</p>
          {user?.email ? <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserRound />{t('shell.profile.profile')}
          <span className="ml-auto text-xs">{t('shell.profile.soon')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/account" data-testid="link-account"><ShieldCheck />{t('account.title')}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Settings />{t('shell.profile.settings')}
          <span className="ml-auto text-xs">{t('shell.profile.soon')}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">{t('shell.profile.theme')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as 'light' | 'dark')} aria-label={t('shell.profile.theme')}>
          <DropdownMenuRadioItem value="light" className="gap-2"><Sun className="h-4 w-4" />{t('shell.theme.light')}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="gap-2"><Moon className="h-4 w-4" />{t('shell.theme.dark')}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={pending} data-testid="button-sign-out" onSelect={(event) => {
          event.preventDefault();
          setPending(true);
          setFailure('');
          void signOut().catch((error: unknown) => {
            setFailure(error instanceof Error ? error.message : t('shell.profile.signOutError'));
          }).finally(() => setPending(false));
        }}>
          <LogOut />{pending ? t('shell.profile.signingOut') : t('shell.signOut')}
        </DropdownMenuItem>
        {failure ? <p role="alert" className="break-words px-2 py-1 text-xs text-destructive">{failure}</p> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}