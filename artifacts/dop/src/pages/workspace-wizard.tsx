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
import { Loader2 } from 'lucide-react';

export default function WorkspaceWizard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: workspace, isLoading: isLoadingWs } = useWorkspace(id);
  const saveWs = useSaveWorkspace();
  
  const [step, setStep] = useState(1);
  const steps = ["Básico", "Repositórios Git", "Fluxo de Branches", "Task Manager", "Runtime", "Extensões do Claude", "Chat de Configuração"];

  // Local state for Step 1
  const [name, setName] = useState('');
  const [root, setRoot] = useState('');

  // Sync on load
  React.useEffect(() => {
    if (workspace) {
      setName(workspace.name);
      setRoot(workspace.root);
    }
  }, [workspace]);

  if (id && isLoadingWs) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  const handleSaveStep = () => {
    if (step === 1) {
      saveWs.mutate({ id: workspace?.id, name, root, status: workspace?.status || 'draft' }, {
        onSuccess: (saved) => {
          toast({ title: "Etapa salva", description: "Configurações básicas atualizadas." });
          if (!id) navigate(`/workspaces/${saved.id}/edit`, { replace: true });
          setStep(2);
        }
      });
    } else {
      // Mock save for other steps
      toast({ title: "Etapa salva", description: `Etapa ${step} atualizada.` });
      if (step < steps.length) setStep(s => s + 1);
      else navigate('/');
    }
  };

  const renderStepContent = () => {
    switch(step) {
      case 1: return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="ws-name">Nome do Workspace</Label>
            <Input id="ws-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Portal do Cliente" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-root">Diretório Raiz (Caminho absoluto)</Label>
            <Input id="ws-root" value={root} onChange={e => setRoot(e.target.value)} placeholder="/Users/dev/projects/portal" className="font-mono text-sm" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-desc">Descrição / Contexto (Opcional)</Label>
            <Textarea id="ws-desc" placeholder="Descreva brevemente o projeto para ajudar o Claude a entender o contexto geral." rows={4} />
          </div>
        </div>
      );
      case 2: return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Provedor Git</Label>
            <Select defaultValue="azure_devops">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="azure_devops">Azure DevOps</SelectItem>
                <SelectItem value="github" disabled>GitHub (Em breve)</SelectItem>
                <SelectItem value="gitlab" disabled>GitLab (Em breve)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="border border-border rounded-lg p-4 bg-muted/20">
            <h4 className="font-medium mb-4">Repositório 1</h4>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome (alias local)</Label>
                  <Input defaultValue="frontend" />
                </div>
                <div className="space-y-2">
                  <Label>Protocolo</Label>
                  <Select defaultValue="ssh">
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ssh">SSH</SelectItem>
                      <SelectItem value="https">HTTPS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>URL Remota</Label>
                <Input defaultValue="git@ssh.dev.azure.com:v3/org/proj/frontend" className="font-mono text-sm" />
              </div>
              <Button variant="secondary" size="sm" type="button" onClick={() => toast({ title: "Sucesso", description: "Conexão Git estabelecida."})}>
                Testar Conexão
              </Button>
            </div>
          </div>
          <Button variant="outline" className="w-full border-dashed">+ Adicionar outro repositório</Button>
        </div>
      );
      case 4: return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Provedor</Label>
            <Select defaultValue="jira">
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="jira">Jira Software</SelectItem>
                <SelectItem value="linear" disabled>Linear (Em breve)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>URL Base</Label>
            <Input defaultValue="https://minha-empresa.atlassian.net" />
          </div>
          <div className="space-y-2">
            <Label>Chave do Projeto (Prefix)</Label>
            <Input defaultValue="PORTAL" />
          </div>
          <Button variant="secondary" type="button" onClick={() => toast({ title: "Sucesso", description: "Conectado ao Jira."})}>
            Testar Conexão
          </Button>
        </div>
      );
      case 7: return (
        <div className="flex h-[400px] border border-border rounded-lg overflow-hidden bg-card">
          <div className="w-1/2 p-4 border-r border-border flex flex-col">
            <h4 className="font-semibold mb-4 text-sm">Chat com Claude</h4>
            <div className="flex-1 bg-muted/30 rounded p-4 text-sm space-y-4 overflow-y-auto">
              <div className="bg-primary/10 text-foreground p-3 rounded-lg border border-primary/20">
                Olá! Sou o Claude. Para terminarmos de configurar o workspace "{name || 'Projeto'}", me conte um pouco sobre as regras de arquitetura e padrões de código que devemos seguir.
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Input placeholder="Escreva aqui..." />
              <Button size="sm">Enviar</Button>
            </div>
          </div>
          <div className="w-1/2 p-4 bg-muted/10">
            <h4 className="font-semibold mb-4 text-sm">Regras Extraídas</h4>
            <ul className="text-sm space-y-2 text-muted-foreground list-disc pl-4">
              <li>Aguardando conversa para extrair regras...</li>
            </ul>
          </div>
        </div>
      );
      default: return (
        <div className="p-8 border border-dashed border-border rounded-lg bg-muted/20 flex flex-col items-center justify-center min-h-[300px] text-center">
          <p className="text-muted-foreground mb-4">A configuração detalhada da etapa "{steps[step-1]}" é simulada para este protótipo.</p>
          <Button variant="outline" onClick={() => setStep(s => s+1)}>Pular configuração</Button>
        </div>
      );
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl flex h-[calc(100vh-4rem)]">
      <div className="w-64 shrink-0 pr-8 border-r border-border h-full overflow-y-auto">
        <div className="mb-6">
          <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground mb-4 text-sm flex items-center gap-1">
            ← Cancelar
          </button>
          <h2 className="text-xl font-bold">{id ? 'Editar Workspace' : 'Nova Workspace'}</h2>
        </div>
        <nav className="space-y-1">
          {steps.map((s, i) => (
            <button
              key={i}
              onClick={() => setStep(i + 1)}
              className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors ${step === i + 1 ? 'bg-primary/10 text-primary font-medium border border-primary/20' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            >
              <span className="mr-2 opacity-50">{i + 1}.</span> {s}
            </button>
          ))}
        </nav>
      </div>
      
      <div className="flex-1 pl-8 h-full overflow-y-auto pb-20">
        <div className="max-w-2xl">
          <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm">{step}</span>
            {steps[step - 1]}
          </h3>
          
          <Card className="border-border/50 shadow-sm">
            <CardContent className="pt-6">
              {renderStepContent()}
            </CardContent>
          </Card>

          <div className="mt-8 flex justify-between items-center">
            <Button variant="ghost" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1 || saveWs.isPending}>
              Voltar
            </Button>
            <Button onClick={handleSaveStep} disabled={saveWs.isPending} className="min-w-[120px]">
              {saveWs.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : step === steps.length ? 'Finalizar' : 'Salvar e Avançar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
