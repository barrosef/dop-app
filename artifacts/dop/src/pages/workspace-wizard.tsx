import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspace, useSaveWorkspace } from '../hooks/use-api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent } from '../components/ui/card';
import { useToast } from '../hooks/use-toast';
import { Loader2, TerminalSquare, CheckCircle2, ArrowLeft } from 'lucide-react';
import { RepoManager } from '../components/repo-manager';
import { RepoConfig, TaskManagerConfig } from '../lib/api/types';
import { useI18n } from '../lib/i18n';

export default function WorkspaceWizard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const { data: workspace, isLoading: isLoadingWs } = useWorkspace(id);
  const saveWs = useSaveWorkspace();
  
  const [step, setStep] = useState(1);
  const steps = [
    t('wizard.step.basic'),
    t('wizard.step.repos'),
    t('wizard.step.branches'),
    t('wizard.step.taskmanager'),
    t('wizard.step.runtime'),
    t('wizard.step.extensions'),
    t('wizard.step.chat')
  ];

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [repos, setRepos] = useState<RepoConfig[]>([]);
  const [cardProvider, setCardProvider] = useState<TaskManagerConfig['provider']>('jira');
  const [providerBaseUrl, setProviderBaseUrl] = useState('');
  const [providerProject, setProviderProject] = useState('');
  const [cardTypes, setCardTypes] = useState('');

  React.useEffect(() => {
    if (workspace) {
      setName(workspace.name);
      setDescription(workspace.context ?? '');
      setRepos(workspace.repos ?? []);
      setCardProvider(workspace.taskManager?.provider ?? 'jira');
      setProviderBaseUrl(workspace.taskManager?.baseUrl ?? '');
      setProviderProject(workspace.taskManager?.project ?? '');
      setCardTypes((workspace.cardTypes ?? []).join(', '));
    }
  }, [workspace]);

  if (id && isLoadingWs) return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <Loader2 className="w-6 h-6 animate-spin mr-3" /> {t('common.loading')}
    </div>
  );

  const handleSaveStep = () => {
    if (step === 1) {
      saveWs.mutate({
        id: workspace?.id,
        name,
        context: description,
        status: workspace?.status || 'draft',
      }, {
        onSuccess: (saved) => {
          toast({ title: t('wizard.saved.title'), description: t('wizard.saved.basic') });
          if (!id) navigate(`/workspaces/${saved.id}/edit`, { replace: true });
          setStep(2);
        }
      });
    } else if (step === 2) {
      saveWs.mutate({ id: workspace?.id, repos }, {
        onSuccess: () => {
          toast({ title: t('wizard.saved.title'), description: t('wizard.saved.step', { step }) });
          setStep(3);
        }
      });
    } else if (step === 4) {
      saveWs.mutate({
        id: workspace?.id,
        taskManager: {
          provider: cardProvider,
          baseUrl: providerBaseUrl,
          project: providerProject,
        },
        cardTypes: cardTypes.split(',').map(type => type.trim()).filter(Boolean),
      }, {
        onSuccess: () => {
          toast({ title: t('wizard.saved.title'), description: t('wizard.saved.step', { step }) });
          setStep(5);
        }
      });
    } else {
      toast({ title: t('wizard.saved.title'), description: t('wizard.saved.step', { step }) });
      if (step < steps.length) setStep(s => s + 1);
      else navigate('/');
    }
  };

  const renderStepContent = () => {
    switch(step) {
      case 1: return (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="ws-name" className="text-xs font-semibold">{t('wizard.basic.name')}</Label>
            <Input id="ws-name" value={name} onChange={e => setName(e.target.value)} placeholder={t('wizard.basic.namePlaceholder')} className="h-9 text-sm bg-muted/30" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-desc" className="text-xs font-semibold">{t('wizard.basic.description')}</Label>
            <Textarea
              id="ws-desc"
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder={t('wizard.basic.descriptionPlaceholder')}
              rows={4}
              className="text-sm bg-muted/30 resize-none"
            />
          </div>
        </div>
      );
      case 2: return (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
             {t('wizard.repos.description')}
          </p>
          <RepoManager repos={repos} onChange={setRepos} />
        </div>
      );
      case 4: return (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">{t('wizard.cards.provider')}</Label>
            <Select value={cardProvider} onValueChange={value => setCardProvider(value as TaskManagerConfig['provider'])}>
              <SelectTrigger className="h-9 text-sm bg-muted/30"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="jira">Jira Software</SelectItem>
                <SelectItem value="clickup">ClickUp</SelectItem>
                <SelectItem value="redmine">Redmine</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">{t('wizard.cards.baseUrl')}</Label>
            <Input value={providerBaseUrl} onChange={event => setProviderBaseUrl(event.target.value)} placeholder="https://provider.example.com" className="h-9 text-sm bg-muted/30 font-mono" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">{t('wizard.cards.project')}</Label>
            <Input value={providerProject} onChange={event => setProviderProject(event.target.value)} placeholder="PORTAL" className="h-9 text-sm bg-muted/30 font-mono" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">{t('wizard.cards.types')}</Label>
            <Input value={cardTypes} onChange={event => setCardTypes(event.target.value)} placeholder="Story, Bug, Epic" className="h-9 text-sm bg-muted/30" />
            <p className="text-[10px] text-muted-foreground">{t('wizard.cards.typesHint')}</p>
          </div>
          <Button variant="secondary" size="sm" type="button" onClick={() => toast({ title: t('wizard.cards.test'), description: t('wizard.cards.testSuccess') })}>
            {t('wizard.cards.test')}
          </Button>
        </div>
      );
      case 7: return (
        <div className="flex h-[400px] border border-border/50 rounded-md overflow-hidden bg-card/50">
          <div className="w-1/2 p-4 border-r border-border/50 flex flex-col bg-muted/10">
            <h4 className="font-semibold mb-4 text-xs tracking-wider uppercase text-muted-foreground">{t('wizard.chat.title')}</h4>
            <div className="flex-1 bg-background/50 rounded border border-border/50 p-4 text-sm space-y-4 overflow-y-auto mb-4">
              <div className="bg-primary/10 text-foreground p-3 rounded border border-primary/20 leading-relaxed text-xs">
                {t('wizard.chat.message')} <strong className="font-mono text-primary">{name}</strong>
              </div>
            </div>
            <div className="flex gap-2">
              <Input placeholder={t('wizard.chat.placeholder')} className="h-8 text-xs bg-muted/50" />
              <Button size="sm" className="h-8 text-xs">{t('wizard.chat.send')}</Button>
            </div>
          </div>
          <div className="w-1/2 p-4 bg-muted/5">
            <h4 className="font-semibold mb-4 text-xs tracking-wider uppercase text-muted-foreground">{t('wizard.chat.rules')}</h4>
            <ul className="text-xs space-y-2 text-muted-foreground list-disc pl-4 italic">
              <li>{t('wizard.chat.waiting')}</li>
            </ul>
          </div>
        </div>
      );
      default: return (
        <div className="p-8 border border-dashed border-border/50 rounded-md bg-muted/10 flex flex-col items-center justify-center min-h-[300px] text-center">
          <p className="text-xs text-muted-foreground mb-4 max-w-sm leading-relaxed">{t('wizard.simulated', { step: steps[step - 1] })}</p>
          <Button variant="outline" size="sm" onClick={() => setStep(s => s + 1)}>{t('wizard.skip')}</Button>
        </div>
      );
    }
  };

  return (
    <div className="flex flex-1 h-full overflow-hidden bg-background">
      <div className="w-64 shrink-0 border-r border-border bg-card/30 flex flex-col">
        <div className="p-4 border-b border-border">
          <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-primary text-[11px] font-medium flex items-center gap-1 mb-3 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> {t('wizard.cancel')}
          </button>
          <h2 className="text-base font-bold flex items-center gap-2">
            <TerminalSquare className="w-4 h-4 text-primary" />
            {id ? t('wizard.edit') : t('workspace.new')}
          </h2>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {steps.map((s, i) => {
            const isPast = step > i + 1;
            const isActive = step === i + 1;
            return (
              <button
                key={i}
                onClick={() => setStep(i + 1)}
                className={`w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
                    : isPast
                      ? 'text-foreground/80 hover:bg-muted/50'
                      : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                }`}
              >
                {isPast ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <span className={`w-3.5 h-3.5 rounded-full border text-[9px] flex items-center justify-center shrink-0 ${isActive ? 'border-primary/50 bg-primary/20' : 'border-muted-foreground/40'}`}>
                    {i + 1}
                  </span>
                )}
                <span className="truncate">{s}</span>
              </button>
            );
          })}
        </nav>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
            <span className="flex items-center justify-center w-7 h-7 rounded bg-primary/10 border border-primary/20 text-primary text-sm font-mono">{step}</span>
            {steps[step - 1]}
          </h3>
          
          <Card className="border-border/60 shadow-sm bg-card/60">
            <CardContent className="p-6">
              {renderStepContent()}
            </CardContent>
          </Card>

          <div className="mt-6 flex justify-between items-center px-1">
            <Button variant="ghost" size="sm" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1 || saveWs.isPending} className="text-xs">
              {t('wizard.back')}
            </Button>
            <Button size="sm" onClick={handleSaveStep} disabled={saveWs.isPending} className="min-w-[120px] text-xs font-medium">
              {saveWs.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : step === steps.length ? t('wizard.finish') : t('wizard.saveNext')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
