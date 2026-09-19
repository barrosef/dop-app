import React, { useState } from 'react';
import { Building2, Mail, ShieldCheck, Users } from 'lucide-react';

import { useAccount } from '../lib/platform/account';
import { useI18n } from '../lib/i18n';
import { SecondFactorSettings } from '../components/security/second-factor-settings';
import { Members } from '../components/account/members';
import { Invites } from '../components/account/invites';
import { NewOrganization } from '../components/account/organization';
import { Refused, SectionHeading } from '../components/account/shared';
import { Button } from '../components/ui/button';

type Tab = 'members' | 'invites' | 'security' | 'organization';

export default function Account() {
  const t = useI18n((s) => s.t);
  const { accounts, activeAccount, loading, error } = useAccount();
  const [selectedTab, setActiveTab] = useState<Tab>('members');
  const activeTab = !loading && !activeAccount ? 'organization' : selectedTab;

  const currentAccountInfo = accounts.find(a => a.id === activeAccount);

  const navItems = [
    { id: 'members', label: t('account.nav.members'), icon: Users, show: !!activeAccount },
    { id: 'invites', label: t('account.nav.invites'), icon: Mail, show: !!activeAccount },
    { id: 'security', label: t('account.nav.security'), icon: ShieldCheck, show: !!activeAccount },
    { id: 'organization', label: t('account.nav.organization'), icon: Building2, show: true },
  ];

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <header className="shrink-0 border-b border-border px-4 py-4 lg:px-8">
        <p className="mb-1 text-xs font-medium text-muted-foreground">{t('account.title')}</p>
        <h1 className="truncate font-display text-lg font-semibold" data-testid="account-title">
          {currentAccountInfo?.display_name || currentAccountInfo?.handle || t('account.title')}
        </h1>
        {currentAccountInfo ? <p className="truncate font-mono text-xs text-muted-foreground">@{currentAccountInfo.handle}</p> : null}
        {loading ? <p role="status" className="text-xs text-muted-foreground">{t('shell.accounts.loading')}</p> : null}
        {error ? <Refused error={error as Error} /> : null}
        {!loading && !error && !activeAccount ? <p role="status" className="text-xs text-muted-foreground">{t('shell.accounts.none')}</p> : null}
      </header>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
      {/* Lateral Nav */}
      <aside className="w-full shrink-0 border-b border-border lg:w-44 lg:border-b-0 lg:border-r">
        <nav aria-label={t('account.navigation')} className="grid grid-cols-2 gap-1 p-2 lg:flex lg:flex-col lg:p-3">
          {navItems.filter(item => item.show).map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <Button
                key={item.id}
                variant={isActive ? "secondary" : "ghost"}
                className={`min-w-0 justify-start gap-2 px-2 text-xs ${isActive ? 'bg-primary/10 text-primary hover:bg-primary/15' : 'text-muted-foreground'}`}
                onClick={() => setActiveTab(item.id as Tab)}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                {item.label}
              </Button>
            )
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto" key={activeAccount || 'none'}>
        <div className="max-w-3xl p-4 lg:p-6">
          {activeTab === 'members' && activeAccount && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <SectionHeading icon={<Users className="h-5 w-5" />}>
                {t('account.members')}
              </SectionHeading>
              <Members />
            </section>
          )}

          {activeTab === 'invites' && activeAccount && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <SectionHeading icon={<Mail className="h-5 w-5" />}>
                {t('account.invites')}
              </SectionHeading>
              <Invites />
            </section>
          )}

          {activeTab === 'security' && activeAccount && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <SectionHeading icon={<ShieldCheck className="h-5 w-5" />}>
                {t('account.security')}
              </SectionHeading>
              <SecondFactorSettings />
            </section>
          )}

          {activeTab === 'organization' && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <SectionHeading icon={<Building2 className="h-5 w-5" />}>
                {t('account.newOrg')}
              </SectionHeading>
              <NewOrganization />
            </section>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
