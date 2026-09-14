import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetTreeQueryKey,
  getListWorkspacesQueryKey,
  useCreateWorkspace,
  type NewWorkspace,
} from '@workspace/api-client-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { useI18n } from '../lib/i18n';
import { useAccount } from '../lib/platform/account';

/** Only fields supported by NewWorkspace; provider configuration is separate. */
export default function WorkspaceCreate() {
  const t = useI18n((state) => state.t);
  const navigate = useNavigate();
  const cache = useQueryClient();
  const { activeAccount } = useAccount();
  const create = useCreateWorkspace();
  const { register, handleSubmit } = useForm<NewWorkspace>({
    defaultValues: { name: '', key: '', description: '' },
  });

  const submit = handleSubmit((values) => {
    create.mutate({
      data: {
        name: values.name.trim(),
        key: values.key.trim(),
        ...(values.description?.trim() ? { description: values.description.trim() } : {}),
      },
    }, {
      onSuccess: async (workspace) => {
        await Promise.all([
          cache.invalidateQueries({ queryKey: getGetTreeQueryKey() }),
          cache.invalidateQueries({ queryKey: getListWorkspacesQueryKey() }),
        ]);
        navigate(`/workspaces/${encodeURIComponent(workspace.id)}`);
      },
    });
  });

  return (
    <section className="mx-auto w-full max-w-xl overflow-y-auto p-6">
      <h1 className="mb-6 text-lg font-semibold">{t('workspace.new')}</h1>
      <form onSubmit={submit} className="space-y-4" data-testid="form-create-workspace">
        <div className="space-y-2">
          <Label htmlFor="workspace-name">{t('wizard.basic.name')}</Label>
          <Input id="workspace-name" required disabled={create.isPending}
            {...register('name', { required: true, validate: (value) => Boolean(value.trim()) })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="workspace-key">{t('workspace.field.key')}</Label>
          <Input id="workspace-key" required disabled={create.isPending} className="font-mono"
            {...register('key', { required: true, validate: (value) => Boolean(value.trim()) })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="workspace-description">{t('wizard.basic.description')}</Label>
          <Textarea id="workspace-description" disabled={create.isPending} {...register('description')} />
        </div>
        {create.error ? (
          <p role="alert" className="text-sm text-destructive">{create.error.message}</p>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={!activeAccount || create.isPending}>
            {t(create.isPending ? 'common.loading' : 'common.save')}
          </Button>
          <Button type="button" variant="outline" disabled={create.isPending} onClick={() => navigate('/')}>
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    </section>
  );
}