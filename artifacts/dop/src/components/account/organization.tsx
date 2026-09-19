import React, { useId, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getListAccountsQueryKey, useCreateAccount } from '@workspace/api-client-react';

import { useI18n } from '../../lib/i18n';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { MutationFeedback } from './shared';

export function NewOrganization() {
  const t = useI18n((s) => s.t);
  const queryClient = useQueryClient();
  const create = useCreateAccount();
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [legalId, setLegalId] = useState('');
  const [failure, setFailure] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (setter: (v: string) => void) => (val: string) => {
    setter(val);
    setFailure('');
    setSuccess(false);
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setFailure('');
        setSuccess(false);
        create.mutate(
          { data: { display_name: displayName, handle, legal_id: legalId } },
          {
            onSuccess: () => {
              setDisplayName('');
              setHandle('');
              setLegalId('');
              setSuccess(true);
              queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
            },
            onError: (err) => setFailure((err as Error).message),
          },
        );
      }}
    >
      <div className="flex flex-col lg:flex-row gap-4">
        <Field label={t('account.newOrg.name')} value={displayName} onChange={handleChange(setDisplayName)} />
        <Field label={t('account.newOrg.handle')} value={handle} onChange={handleChange(setHandle)} />
      </div>
      <div className="flex flex-col lg:flex-row gap-4">
        <Field label={t('account.newOrg.legalId')} value={legalId} onChange={handleChange(setLegalId)} />
      </div>
      
      <MutationFeedback pending={create.isPending} success={success} error={failure} />
      
      <div className="pt-2">
        <Button
          type="submit"
          disabled={create.isPending || !displayName || !handle}
        >
          {create.isPending ? t('account.newOrg.creating') : t('account.newOrg.create')}
        </Button>
      </div>
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
  const id = useId();
  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}